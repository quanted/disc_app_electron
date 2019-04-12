const electron = require('electron');
// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

const path = require('path');
const url = require('url');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow () {
  const WEB_FOLDER = '';
  const PROTOCOL = 'file';

  electron.protocol.interceptFileProtocol(PROTOCOL, (request, callback) => {
      // Strip protocol
      let url = request.url.substr(PROTOCOL.length + 1);
      // Build complete path for node require function
      url = path.join(__dirname, WEB_FOLDER, url);
      // Replace backslashes by forward slashes (windows)
      // url = url.replace(/\\/g, '/');
      url = path.normalize(url);
      callback({path: url});
  });

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 825,
    webPreferences: {
      nodeIntegration: true
    }
  });

  // show the window once it's ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: 'index.html',
    protocol: PROTOCOL + ':',
    slashes: true
  }));

  // Open the DevTools.
  //mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  quit();
});

function quit() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
}

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
const ipc = electron.ipcMain;
const fs = require('fs');
const shell = electron.shell;
const {dialog} = require('electron');
ipc.on('print-to-pdf', function (event) {
  const pdfPath = path.join(__dirname, '/print.pdf');
  const win = BrowserWindow.fromWebContents(event.sender);
  win.webContents.printToPDF({printBackground: true, landscape: true}, function (error, data) {
    if (error) throw error
    dialog.showSaveDialog(
    {
      filters: [
        {
          name: 'Adobe PDF',
          extensions: ['pdf']
        }
      ]
    },
    function (fileNames) {
      if (fileNames === undefined) { // fileNames is an array that contains all the selected files
        console.log("No file selected");
      } else {
        if(!fileNames.endsWith(".pdf")) {
          fileNames += ".pdf";
        }
        fs.writeFile(fileNames, data, function (error) {
          if (error) {
            throw error;
          }
          console.log(fileNames);
          shell.openExternal('file://' + fileNames);
          event.sender.send('wrote-pdf', fileNames);
        });
      }
    });
  });
});

ipc.on('snap', function(event, data) {
  const PROTOCOL = 'file';
  
  let snapshot = new BrowserWindow({
    width: 1100,
    height: 825,
    center: true,
    resizable: true,
    frame: true,
    transparent: false,
    show: false,
    parent: mainWindow
  });

  // remove the menu from snapshot
  snapshot.setMenu(null);

  // load the snapshot file
  snapshot.loadURL(url.format({
    pathname: 'snapshot.html',
    protocol: PROTOCOL + ':',
    slashes: true
  }));

  // show the window once it's ready
  snapshot.once('ready-to-show', () => {
    snapshot.show();
  });

  // send data when the page is ready to accept it
  snapshot.webContents.on('did-finish-load', function() {
    snapshot.webContents.send('snapshot-data', data);
  });

  // garbage collection handle
  snapshot.on('closed', function() {
    snapshot = null;
  });
});
});