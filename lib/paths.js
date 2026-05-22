"use strict";

const path = require("path");

const packageRoot = path.resolve(__dirname, "..");

module.exports = {
  packageRoot,
  launcherPath: path.join(packageRoot, "start-codex-local-plus.ps1"),
  injectPath: path.join(packageRoot, "inject.js"),
  shortcutScriptPath: path.join(packageRoot, "scripts", "setup-shortcut.ps1"),
};
