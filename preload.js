const path = require("path");

try {
    if (process.platform === "darwin") {
    window.$ = window.jQuery = require(path.resolve('node_modules/jquery'));
  } else {
    window.$ = window.jQuery = require('jquery');
  }
    
  } catch (e) { 
  console.log(e);
  try {
    window.$ = window.jQuery = require(require('path').join(process.resourcesPath, '/app.asar/node_modules/jquery'));
  } catch (e) { 
    console.log(e);
  }
}