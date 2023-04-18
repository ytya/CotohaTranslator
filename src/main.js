const { app, BrowserWindow, BrowserView, Menu, globalShortcut, clipboard, Tray } = require('electron');
const clipboardListener = require('clipboard-event');
const path = require('path');
const url = require('url');

let mainWindow;
let view;
let tray;
let shortcutKeyRegisterd = false;

const setShortcutKey = () => {
    // ショートカットキーを設定
    if (shortcutKeyRegisterd) {
        return;
    }
    shortcutKeyRegisterd = true;
    globalShortcut.register('CommandOrControl+T', () => {
        // ウィンドウ表示
        mainWindow.show();
        // 選択した文字列を取得する
        const selectedText = clipboard.readText('selection');
        // ウィンドウのオブジェクトを取得する
        const win = BrowserWindow.getFocusedWindow();
        // テキストエリアにコピー
        const webContents = view.webContents;
        //webContents.executeJavaScript(`document.querySelector(".er8xn").value = "${selectedText}"`);
        webContents.executeJavaScript(`document.querySelector("#queryinput").value = "${selectedText}"`);
        // button要素をクリックする
        webContents.executeJavaScript('document.querySelector(".lQueryHeader__input_container").querySelector("button").click()');
    });
}

const removeShortcutKey = () => {
    // ショートカットキーを解除
    if (shortcutKeyRegisterd) {
        globalShortcut.unregister("CommandOrControl+T");
        shortcutKeyRegisterd = false;
    }
}

const createWindow = () => {
    mainWindow = new BrowserWindow({width: 1200, height: 675, 'icon': __dirname + 'favicon.ico'});
    view = new BrowserView();
    mainWindow.setBrowserView(view);
    const [width, height] = mainWindow.getContentSize();
    view.setBounds({x: 0, y: 0, width: width, height: height});
    //view.webContents.loadURL('https://translate.google.com/');
    view.webContents.loadURL('https://www.linguee.jp/%E6%97%A5%E6%9C%AC%E8%AA%9E-%E8%8B%B1%E8%AA%9E/%E7%BF%BB%E8%A8%B3/%E3%82%A4%E3%83%B3%E3%83%95%E3%82%A9%E3%82%B7%E3%83%BC%E3%82%AF.html');

    // ウィンドウのリサイズイベントを検知する
    mainWindow.on('resize', () => {
        // ウィンドウの現在のサイズを取得する
        const [width, height] = mainWindow.getContentSize()
        // BrowserViewのサイズと位置を変更する
        view.setBounds({ x: 0, y: 0, width: width, height: height })
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
        { label: "Quit", click: () => app.quit() },
    ]);
    tray.setToolTip("CotohaTranslator");
    tray.setContextMenu(contextMenu);

    // アプリを終了せずにタスクトレイに格納
    mainWindow.on('close', (e) => {
        e.preventDefault();
        mainWindow.hide();
    });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {})
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    clipboardListener.stopListening();
    globalShortcut.unregisterAll();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
