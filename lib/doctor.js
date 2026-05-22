"use strict";

const fs = require("fs");
const { spawnSync } = require("child_process");
const { launcherPath, injectPath } = require("./paths");
const { toPowerShellArgs } = require("./launcher");

function line(status, text) {
  console.log(`[${status}] ${text}`);
}

function commandExists(command) {
  const result = spawnSync("where", [command], { encoding: "utf8", windowsHide: true });
  return result.status === 0;
}

function runDoctor(options = {}) {
  let failed = false;

  console.log("Codex Local Plus doctor");
  console.log("");

  if (process.platform === "win32") {
    line("OK", "Platform: win32");
  } else {
    line("FAIL", `Platform: ${process.platform}; Windows is required`);
    failed = true;
  }

  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 18) {
    line("OK", `Node.js: ${process.version}`);
  } else {
    line("FAIL", `Node.js: ${process.version}; >=18 is required`);
    failed = true;
  }

  if (commandExists("powershell.exe")) {
    line("OK", "PowerShell: powershell.exe");
  } else {
    line("FAIL", "PowerShell: powershell.exe not found on PATH");
    failed = true;
  }

  if (fs.existsSync(launcherPath)) {
    line("OK", `Launcher: ${launcherPath}`);
  } else {
    line("FAIL", `Launcher missing: ${launcherPath}`);
    failed = true;
  }

  if (fs.existsSync(injectPath)) {
    line("OK", `Inject file: ${injectPath}`);
  } else {
    line("FAIL", `Inject file missing: ${injectPath}`);
    failed = true;
  }

  console.log("");
  console.log("Running launcher dry run...");

  const dryRunOptions = { ...options, dryRun: true, noLaunch: false };
  const result = spawnSync("powershell.exe", toPowerShellArgs(dryRunOptions), {
    stdio: "inherit",
    windowsHide: false,
  });

  if (result.error) {
    line("FAIL", `Dry run failed to start: ${result.error.message}`);
    failed = true;
  } else if (result.status === 0) {
    line("OK", "Launcher dry run completed");
  } else {
    line("FAIL", "Launcher dry run failed. If Codex is installed in a custom path, run with --codex-path.");
    failed = true;
  }

  return failed ? 1 : 0;
}

module.exports = {
  runDoctor,
};
