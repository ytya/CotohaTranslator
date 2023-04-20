const { app, BrowserWindow, BrowserView, Menu, globalShortcut, clipboard, Tray, dialog } = require('electron');
const clipboardListener = require('clipboard-event');
const path = require('path');
const preferences = require('./preferences.js')

let mainWindow;
let view;
let tray;
let shortcutKeyRegisterd = false;
let trySignin = false;

const setElementValue = (selector, elemType, value) => {
    // Recat用のvalue設定
    const webContents = view.webContents;
    return webContents.executeJavaScript(
        `var elem = document.querySelector('${selector}');` +
        `Object.getOwnPropertyDescriptor(window.${elemType}.prototype, 'value').set.call(elem, '${value}');` +
        `input.dispatchEvent(new Event('change', {bubbles: true}));`);
}

const sleep = (time) => {
    return new Promise(r => {
        setTimeout(() => resolve(), time);
    });
}

const translate = (text) => {
    // テキストエリアにコピー
    const webContents = view.webContents;
    setElementValue('textarea[data-testid="originalText"]', 'HTMLTextAreaElement', text).then(r => {
        // 翻訳ボタンが有効になるまでディレイ
        return sleep(1500);
    }).then(r => {
        // button要素をクリックする
        webContents.executeJavaScript('document.querySelector("button").click()');
    });
}

const setShortcutKey = () => {
    // ショートカットキーを設定
    if (shortcutKeyRegisterd) {
        return;
    }
    shortcutKeyRegisterd = true;
    globalShortcut.register('CommandOrControl+T', () => {
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
        globalShortcut.unregister("CommandOrControl+T");
        shortcutKeyRegisterd = false;
    }
}

const autoSignin = (is_submit) => {
    // オートサインイン
    const email = preferences.value('cotoha.email');
    let password = preferences.value('cotoha.password');
    password = preferences.decrypt(password ? password : '');
    setElementValue('#email', 'HTMLInputTextElement', email);
    setElementValue('#password', 'HTMLInputTextElement', password);

    if (is_submit && (email.length > 0) && (password.length > 0)) {
        // サインイン
        view.webContents.executeJavaScript('document.querySelector("button").click()');
    }
}

const quit = () => {
    // アプリ終了
    app.quitting = true;
    app.quit();
}

const createWindow = () => {
    mainWindow = new BrowserWindow({ width: 1200, height: 675, title: 'Conoha Translator Client', 'icon': __dirname + 'favicon.ico' });
    view = new BrowserView();
    mainWindow.setBrowserView(view);
    view.setAutoResize({ width: true, height: true });
    if (process.env.NODE_ENV === "debug") {
        mainWindow.openDevTools();
    }

    view.webContents.loadURL(`https://${preferences.value('cotoha.domain')}/register/signin.php`);
    view.webContents.on('dom-ready', () => {
        const [width, height] = mainWindow.getContentSize();
        view.setBounds({ x: 0, y: 0, width: width, height: height });

        if (view.webContents.getURL().indexOf("signin.php") >= 0) {
            // オートサインイン
            let is_submit = true;
            if (trySignin) {
                console.log("signin failed");
                dialog.showErrorBox("Signin Failed", "Signin failed.");
                is_submit = false;
            }
            trySignin = true;
            autoSignin(is_submit);
        }
        else {
            trySignin = false;
        }
    });

    // クリップボードの変化を検知したら一定時間ショートカットキーを有効化
    clipboardListener.startListening();
    clipboardListener.on('change', () => {
        setShortcutKey();
        setTimeout(removeShortcutKey, 2000);
    });

    tray = new Tray(path.join(__dirname, "../assets/icon.ico"));
    // タスクトレイのメニューを設定する
    const contextMenu = Menu.buildFromTemplate([
        { label: "Show", click: () => mainWindow.show() },
        { label: "Quit", click: () => quit() },
    ]);
    tray.setToolTip("CotohaTranslator");
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
                    view.webContents.reload();
                },
            },
            {
                label: 'Settings',
                click: () => preferences.show(),
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
