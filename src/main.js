const { app, BrowserWindow, BrowserView, Menu, globalShortcut, clipboard, Tray, dialog } = require('electron');
const clipboardListener = require('clipboard-event');
const path = require('path');
const preferences = require('./preferences.js')

let mainWindow;
let view;
let tray;
let shortcutKeyRegisterd = false;
let trySignin = false;

const getDomain = () => {
    return preferences.value('cotoha.domain');
}

const getShortcutKey = () => {
    return `CommandOrControl+${preferences.value('app.shortcut_key')}`
}

const setElementValue = (selector, elemType, value) => {
    // Recat用のvalue設定
    const webContents = view.webContents;
    value = value.replace(/\\|`|\$/g, '\\$&');  // 特殊文字はエスケープしておく
    const command = `var value = \'${value}\`;\n` +
        `var elem = document.querySelector('${selector}');\n` +
        `Object.getOwnPropertyDescriptor(window.${elemType}.prototype, 'value').set.call(elem, value);\n` + // 値設定
        `elem.dispatchEvent(new Event('change', {bubbles: true}));`; // 更新
    return webContents.executeJavaScript(command);
}

const sleep = (time) => {
    return new Promise(r => {
        setTimeout(() => r(), time);
    });
}

const translate = (text) => {
    // テキストエリアにコピー
    const webContents = view.webContents;
    setElementValue(
        'textarea[data-testid="textOriginalField"]',
        'HTMLTextAreaElement',
        text
    ).then(r => {
        // 翻訳ボタンが有効になるまでディレイ
        return sleep(1500);
    }).then(r => {
        // button要素をクリックする
        webContents.executeJavaScript(`document.querySelector('button[data-textid="textTranslate"]').click()`);
    }).catch(e => {
        console.log('error: translate.' + e);
    });
}

const setShortcutKey = () => {
    // ショートカットキーを設定
    if (shortcutKeyRegisterd) {
        return;
    }
    shortcutKeyRegisterd = true;
    globalShortcut.register(getShortcutKey(), () => {
        // ウィンドウ表示
        mainWindow.show();
        mainWindow.focus();

        // クリップボードから文字列を取得して翻訳
        const text = clipboard.readText();
        translate(text);
    });
}

const removeShortcutKey = () => {
    // ショートカットキーを解除
    if (shortcutKeyRegisterd) {
        globalShortcut.unregister(getShortcutKey());
        shortcutKeyRegisterd = false;
    }
}

const autoSignin = (is_submit = true) => {
    // オートサインイン
    const email = preferences.value('cotoha.email');
    let password = preferences.value('cotoha.password');
    password = preferences.decrypt(password ? password : '');
    setElementValue('#email', 'HTMLInputElement', email).then(r => {
        return setElementValue('#password', 'HTMLInputElement', password);
    }).then(r => {
        if (is_submit && (email.length > 0) && (password.length > 0)) {
            // サインイン
            view.webContents.executeJavaScript(`document.querySelector('button[type="submit"]').click()`);
        }
    }).catch(e => {
        console.log('error: autoSignin.' + e);
        dialog.showErrorBox('Signin Failed', `Signin Failed.\nerror: ${e}`);
    });
}

const quit = () => {
    // アプリ終了
    app.quitting = true;
    app.quit();
}

const createWindow = () => {
    mainWindow = new BrowserWindow({ width: 1200, height: 800, title: 'Conoha Translator Client', 'icon': __dirname + 'favicon.ico' });
    view = new BrowserView();
    mainWindow.setBrowserView(view);
    const [width, height] = mainWindow.getContentSize();
    view.setBounds({ x: 0, y: 0, width: width, height: height });
    view.setAutoResize({ width: true, height: true });
    if (process.env.NODE_ENV === "debug") {
        view.webContents.openDevTools();
    }

    if (getDomain().length > 0) {
        // ドメインが設定されていればページ読み込み
        view.webContents.loadURL(`https://${getDomain()}/register/signin.php`);
    } else {
        // そうじゃなければ初期設定
        preferences.show();
    }

    view.webContents.on('dom-ready', () => {
        // 読み込み完了
        view.setBounds(view.getBounds());

        if (view.webContents.getURL().indexOf('signin.php') >= 0) {
            // オートサインイン
            let is_submit = true;
            if (trySignin) {
                // 一度失敗したらsubmitせずにオートコンプリートだけする
                console.log('signin failed');
                dialog.showErrorBox('Signin Failed', 'Signin failed.');
                is_submit = false;
            } else {
                console.log('try signin');
                trySignin = true;
            }
            autoSignin(is_submit);
        } else {
            trySignin = false;
        }
    });

    // クリップボードの変化を検知したら一定時間ショートカットキーを有効化
    clipboardListener.startListening();
    clipboardListener.on('change', () => {
        setShortcutKey();
        setTimeout(removeShortcutKey, 1500);
    });

    tray = new Tray(path.join(__dirname, '../assets/icon.ico'));
    // タスクトレイのメニューを設定する
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show', click: () => mainWindow.show() },
        { label: 'Quit', click: () => quit() },
    ]);
    tray.setToolTip('CotohaTranslator');
    tray.setContextMenu(contextMenu);

    // アプリを終了せずにタスクトレイに格納
    mainWindow.on('close', (e) => {
        if (app.quitting) {
            mainWindow = null;
        } else {
            e.preventDefault();
            mainWindow.hide();
        }
    });

    // メニュー設定
    const menuTemplate = [{
        label: 'File',
        submenu: [
            {
                label: 'Reflash',
                accelerator: 'F5',
                click: () => {
                    trySignin = false;
                    if (getDomain().length > 0) {
                        view.webContents.loadURL(`https://${getDomain()}/loggedin/translate_text.php`);
                    }
                },
            },
            {
                label: 'Settings',
                click: () => preferences.show(),
            },
            { type: 'separator' },
            {
                label: 'Open/Close DevTools',
                click: () => {
                    if (view.webContents.isDevToolsOpened()) {
                        view.webContents.closeDevTools();
                    } else {
                        view.webContents.openDevTools();
                    }
                },
            },
            { type: 'separator' },
            {
                label: 'Quit',
                accelerator: 'CommandOrControl+Q',
                click: () => quit(),
            },
        ],
    }];
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

// 二重起動防止
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => { })
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    clipboardListener.stopListening();
    globalShortcut.unregisterAll();
    if (process.platform !== 'darwin') {
        quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
