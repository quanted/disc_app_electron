const electron = require("electron");
const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = electron;

const fs = require("fs");
const path = require("path");
const url = require("url");
const Papa = require("papaparse");


// SET ENV
//process.env.NODE_ENV = 'production';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let savedFileName = "";

function createWindow() {
  const WEB_FOLDER = "";
  const PROTOCOL = "file";

  electron.protocol.interceptFileProtocol(PROTOCOL, (request, callback) => {
    // Strip protocol
    let url = request.url.substr(PROTOCOL.length + 1);
    // Build complete path for node require function
    url = path.join(__dirname, WEB_FOLDER, url);
    url = path.normalize(url);
    callback({ path: url });
  });

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 825,
    webPreferences: {
      nodeIntegration: true
    },
    title:
      "Decision Integration for Strong Communities " +
      app.getVersion() +
      " | BETA | US EPA"
  });

  // show the window once it's ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Load the index.html of the app.
  mainWindow.loadURL(
    url.format({
      pathname: "index.html",
      protocol: PROTOCOL + ":",
      slashes: true
    })
  );

  const menuTemplate = [
    {
      label: "File",
      submenu: [
        {
          label: "Open Community Data...",
          accelerator: process.platform === "darwin" ? "Command+O" : "CTRL+O",
          click: () => {
            loadState();
          }
        },
        {
          label: "Save Community Data",
          accelerator: process.platform === "darwin" ? "Command+S" : "CTRL+S",
          click: () => {
            mainWindow.webContents.send("request-json", "save");
          }
        },
        {
          label: "Save Community Data As...",
          accelerator:
            process.platform === "darwin" ? "Command+Shift+S" : "CTRL+Shift+S",
          click: () => {
            mainWindow.webContents.send("request-json", "save-as");
          }
        },
        // {
        //   label: 'Import Metric Data...',
        //   accelerator: process.platform === 'darwin' ? 'Command+I' : "CTRL+I",
        //   click: () => {
        //     openFile();
        //   }
        //},
        
        {
          label: "Quit",
          accelerator: process.platform === "darwin" ? "Command+Q" : "CTRL+Q",
          click: () => {
            quit();
          }
        }
      ]
    },
    {
      label: "Settings",
      submenu: [
        {
          label: "Toggle Search Method",
          id: "toggle-offline",
          accelerator: process.platform === "darwin" ? "Command+D" : "CTRL+D",
          type: "checkbox",
          click: () => {
            let focusedWin = BrowserWindow.getFocusedWindow();
            focusedWin.webContents.send("toggleSearch");
          }
        }
      ]
    }
  ];

  /* //add dev tools item if not in production
  if (process.env.node_env !== "production") {
    menuTemplate.push({
      label: "Toggle DevTools",
      accelerator: process.platform === "darwin" ? "Command+I" : "CTRL+I",
      click(item, focusedWindow) {
        focusedWindow.toggleDevTools();
      }
    });
  } */

  // if mac add empty object to menu
  if (process.platform === "darwin") {
    menuTemplate.unshift({
      label: app.getName(),
      submenu: [{
        label: "devtools",
        click(item, focusedWindow) {
          focusedWindow.toggleDevTools();
        }},
        {role: 'about'},
        {role: 'separator'},
        {role: 'services', submenu: []},
        {role: 'separator'},
        {role: 'hide'},
        {role: 'hideothers'},
        {role: 'unhide'},
        {role: 'separator'},
        {role: 'quit'}
      ]
    });
  }

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
  
  

  // Open the DevTools.
  //mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on("close", function(e) {
    let choice;
    if (saved) {
      choice = dialog.showMessageBoxSync(this, {
        type: "question",
        buttons: ["Yes", "No"],
        title: "Decision Integration for Strong Communities",
        message: "Are you sure you want to quit?"
      });
      if (choice == 1) {
        e.preventDefault();
        return;
      }
    } else {
      choice = dialog.showMessageBoxSync(this, {
        type: "question",
        buttons: ["Save", "Don't Save", "Cancel"],
        title: "Decision Integration for Strong Communities",
        message: "Do you want to save your changes to " + savedFileName + "?"
      });
      console.log(choice);
      if (choice == 0) {
        console.log("Save and Quit");
        e.preventDefault();
        mainWindow.webContents.send("save-and-quit");
      } else if (choice == 2) {
        console.log("Cancel quit");
        e.preventDefault();
        return;
      }
    }
    snapshots.forEach(snapshot => {
      if (snapshot) {
        snapshot.close();
      }
    });
  });

  /**
   * Listens for page-title-updated and prevents the loading of the html title attribute.
   * @listens page-title-updated
   */
  mainWindow.on("page-title-updated", event => {
    event.preventDefault();
  });

  /**
   * Listens for toggle-offline message from render thread and toggle the checkmark.
   * @listens toggle-offline
   */
  ipcMain.on("toggle-offline", () => {
    const item = menu.getMenuItemById("toggle-offline");
    item.checked = !item.checked;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", function() {
  quit();
});

function quit() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
}

app.on("activate", function() {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.on("print-to-pdf", function(event) {
  const pdfPath = path.join(__dirname, "/print.pdf");
  const win = BrowserWindow.fromWebContents(event.sender);
  win.webContents.printToPDF(
    { printBackground: true, landscape: true },
    function(error, data) {
      if (error) {
        event.sender.send("wrote-pdf", fileNames);
        throw error;
      }
      dialog.showSaveDialog(
        {
          filters: [
            {
              name: "Adobe PDF",
              extensions: ["pdf"]
            }
          ]
        },
        function(fileNames) {
          if (fileNames === undefined) {
            // fileNames is an array that contains all the selected files
            event.sender.send("wrote-pdf", fileNames);
            return;
          } else {
            if (!fileNames.endsWith(".pdf")) {
              fileNames += ".pdf";
            }
            fs.writeFile(fileNames, data, function(error) {
              if (error && error.errno === -4082) {
                event.sender.send("wrote-pdf", fileNames);
                dialog.showMessageBoxSync({
                  type: "error",
                  buttons: ["OK"],
                  title: "Decision Integration for Strong Communities",
                  message: `${fileNames} is open in another program. Please close it and try again.`
                });
              } else {
                event.sender.send("wrote-pdf", fileNames);
                throw error;
              }
              shell.openExternal("file://" + fileNames);
              event.sender.send("wrote-pdf", fileNames);
            });
          }
        }
      );
    }
  );
});

let snapshots = [];

ipcMain.on("snap", function(event, data) {
  const PROTOCOL = "file";
  const id = snapshots.length;

  let snapshot = new BrowserWindow({
    width: 900,
    height: 700,
    center: true,
    resizable: true,
    frame: true,
    transparent: false,
    show: false,
    webPreferences: {
      nodeIntegration: true
    }
  });

  snapshot.setMenu(null); // remove the menu from snapshot
  snapshots[id] = snapshot;

  // load the snapshot file
  snapshot.loadURL(
    url.format({
      pathname: "snapshot.html",
      protocol: PROTOCOL + ":",
      slashes: true
    })
  );

  // show the window once it's ready
  snapshot.once("ready-to-show", () => {
    snapshot.show();
  });

  // send data when the page is ready to accept it
  snapshot.webContents.on("did-finish-load", function() {
    snapshot.webContents.send("snapshot-data", data);
    mainWindow.webContents.send("snapshot-opened");
  });

  // garbage collection handle
  snapshot.on("closed", function() {
    snapshot = null;
    snapshots[id] = null;
  });
});

// File open and close
let saved = true;
function openFile() {
  console.log("open file");
  let dataType;
  const choice = dialog.showMessageBoxSync({
    type: "question",
    buttons: ["Customized Metrics", "Scenario Builder Metrics", "Cancel"],
    title: "Decision Integration for Strong Communities",
    message: "Which Metric data do you want to load?"
  });

  if (choice === 0) {
    dataType = "custom_val";
  } else if (choice === 1) {
    dataType = "scenario_val";
  } else {
    return;
  }

  dialog.showOpenDialog(
    { filters: [{ name: "Custom File Type", extensions: ["csv"] }] },
    function(fileNames) {
      if (fileNames === undefined) {
        // fileNames is an array that contains all the selected files
        console.log("No file selected");
      } else {
        if (!saved) {
          // Check if unsaved
          console.log("not saved");
          dialog.showMessageBoxSync(
            mainWindow,
            {
              type: "question",
              buttons: ["Save", "Don't Save", "Cancel"],
              title: "Decision Integration for Strong Communities",
              message:
                "Do you want to save your changes to " + savedFileName + "?"
            },
            function(response) {
              console.log(response);
              if (response == 0) {
                console.log("Save and Open");
                mainWindow.webContents.send("save-and-open", fileNames);
              } else if (response == 2) {
                console.log("Cancel");
                return;
              } else {
                console.log("Just open");
                let data = parseCSVFile(fileNames[0]);
                mainWindow.webContents.send("open-file", [data, dataType]);
                savedFileName = fileNames[0];
                saved = true;
              }
            }
          );
        } else {
          console.log("saved");
          let data = parseCSVFile(fileNames[0]);
          mainWindow.webContents.send("open-file", [data, dataType]);
          savedFileName = fileNames[0];
          saved = true;
        }
      }
    }
  );
}

function parseCSVFile(fileName) {
  const importedData = fs.readFileSync(fileName, "utf8");
  let rows;
  Papa.parse(importedData, {
    header: true,
    delimiter: ",",
    worker: true,
    complete: function(results) {
      rows = results.data;
    }
  });

  return rows;
}

function saveFile(data) {
  console.log(savedFileName);
  if (savedFileName) {
    fs.writeFile(savedFileName, data, () => {
      mainWindow.webContents.send("has-been-saved", savedFileName);
    });
  } else {
    saveFileAs(data);
  }
}

function saveFileAs(data) {
  const nameToUse = savedFileName;
  dialog.showSaveDialogSync(
    {
      defaultPath: nameToUse,
      filters: [
        {
          name: "JSON",
          extensions: ["json"]
        }
      ]
    },
    function(fileNames) {
      if (fileNames === undefined) {
        // fileNames is an array that contains all the selected files
        console.log("No file selected");
      } else {
        const fileExtension = path.extname(fileNames);
        if (fileExtension.toLowerCase() !== ".json") {
          fileNames += ".json";
        }
        fs.writeFile(fileNames, data, () => {
          mainWindow.webContents.send("has-been-saved", fileNames);
          savedFileName = fileNames;
        });
      }
    }
  );
}

function saveFileAsAndOpen(saveName, openName) {
  var nameToUse = savedFileName;
  console.log(savedFileName);
  dialog.showSaveDialogSync(
    {
      defaultPath: nameToUse,
      filters: [
        {
          name: "Custom File Type",
          extensions: ["csv"]
        }
      ]
    },
    function(fileNames) {
      if (fileNames === undefined) {
        // fileNames is an array that contains all the selected files
        console.log("No file selected");
      } else {
        if (!fileNames.endsWith(".csv")) {
          fileNames += ".csv";
        }
        mainWindow.webContents.send("save-as-and-open", fileNames, openName);
      }
    }
  );
}

function saveFileAsAndQuit() {
  const nameToUse = savedFileName;
  console.log(savedFileName);
  dialog.showSaveDialogSync(
    {
      defaultPath: nameToUse,
      filters: [
        {
          name: "Custom File Type",
          extensions: ["csv"]
        }
      ]
    },
    function(fileNames) {
      if (fileNames === undefined) {
        // fileNames is an array that contains all the selected files
        console.log("No file selected");
      } else {
        if (!fileNames.endsWith(".csv")) {
          fileNames += ".csv";
        }
        mainWindow.webContents.send("save-as-and-quit", fileNames);
      }
    }
  );
}

// Saves the file then open when the renderer returns the data
ipcMain.on("save-as-and-open", function(event, saveName, openName) {
  saveFileAsAndOpen(saveName, openName);
});

// Saves the file then quit when the renderer returns the data
ipcMain.on("save-as-and-quit", function(event, saveName) {
  saveFileAsAndQuit(saveName);
});

ipcMain.on("has-been-changed", function(event, arg) {
  console.log("has-been-changed");
  saved = false;
});

ipcMain.on("quit", function(event, arg) {
  quit();
});

/**
 * Listens for json-save message from render thread. Saves the JSON data to a file.
 * @param {event} event - The storage event.
 * @param {object} arg - The JSON object to save.
 * @listens json-save
 */
ipcMain.on("json-save", function(event, arg) {
  if (savedFileName) {
    saveFile(arg);
  } else {
    saveFileAs(arg);
  }
});

/**
 * Listens for json-save-as message from render thread. Saves the JSON data to a file.
 * @param {event} e - The storage event.
 * @param {object} arg - The JSON object to save.
 * @listens json-save-as
 */
ipcMain.on("json-save-as", function(event, arg) {
  saveFileAs(arg);
});

/**
 * Opens a file sends the JSON contents to the render thread.
 * @function
 */
function loadState() {
  dialog.showOpenDialogSync(
    { filters: [{ name: "JSON File", extensions: ["json"] }] },
    function(fileNames) {
      if (fileNames === undefined) {
        // fileNames is an array that contains all the selected files
        console.log("No file selected");
      } else {
        fs.readFile(fileNames[0], "utf8", (err, data) => {
          if (err) throw err;
          let json = JSON.parse(data);
          mainWindow.webContents.send("load-json", json);
          savedFileName = fileNames[0];
        });
      }
    }
  );
}
