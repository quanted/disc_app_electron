"use strict";

const builder = require("electron-builder");
const Platform = builder.Platform;

const config = {
  "asar": true,
  "appId": "disc.app",
  "productName": "Decision Integration for Strong Communities",
  "mac": {
    "category": "disc.app"
  },
  "nsis": {
    "oneClick": false
  },
  "extraResources": [
    "hwbi_app/DISC.db",
    "hwbi_app/cities.db",
  ]
};

builder.build({
    targets: Platform.WINDOWS.createTarget(),
    config: config
})
.then(m => {
    console.log('Build OK!');
})
.catch(e => {
    console.error(e);
});
