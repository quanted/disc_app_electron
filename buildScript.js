"use strict";

const builder = require("electron-builder");

const config = {
  asar: true,
  appId: "disc.app",
  productName: "Decision Integration for Strong Communities",
  mac: {
    category: "disc.app"
  },
  nsis: {
    oneClick: false
  },
  extraResources: [
    "hwbi_app/DISC.db",
    "hwbi_app/cities.db",
    "pdf/Connection.pdf",
    "pdf/Culture.pdf",
    "pdf/Education.pdf",
    "pdf/Health.pdf",
    "pdf/Leisure.pdf",
    "pdf/Living.pdf",
    "pdf/Safety.pdf",
    "pdf/Social.pdf"
  ]
};

builder
  .build({
    win: ["default"],
    mac: ["default"],
    targets: Platform.WINDOWS.createTarget(),
    config: config
  })
  .then(m => {
    console.log("Build OK!");
  })
  .catch(e => {
    console.error(e);
  });
