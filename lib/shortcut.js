"use strict";

const path = require("path");
const { spawnSync } = require("child_process");
const { shortcutScriptPath } = require("./paths");

function quoteArg(value) {
  const text = String(value);
  return /\s|"/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function quotePowerShellString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function findPowerShell() {
  const fallback = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const result = spawnSync("where", ["powershell.exe"], {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status === 0) {
    const first = result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (first) return first;
  }

  return fallback;
}

function findTarget() {
  const result = spawnSync("where", ["codex-local-plus"], {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status === 0) {
    const lines = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const shimPath = lines.find((line) => line.toLowerCase().endsWith(".cmd")) || lines[0];
    if (shimPath) {
      return { targetPath: shimPath, baseArguments: [] };
    }
  }

  return {
    targetPath: process.execPath,
    baseArguments: [process.argv[1]],
  };
}

function toHiddenShortcutTarget(targetPath, shortcutArgs) {
  const command = shortcutArgs.length
    ? `Start-Process -WindowStyle Hidden -FilePath ${quotePowerShellString(targetPath)} -ArgumentList @(${shortcutArgs.map(quotePowerShellString).join(", ")})`
    : `Start-Process -WindowStyle Hidden -FilePath ${quotePowerShellString(targetPath)}`;

  return {
    targetPath: findPowerShell(),
    arguments: [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-WindowStyle",
      "Hidden",
      "-EncodedCommand",
      Buffer.from(command, "utf16le").toString("base64"),
    ].join(" "),
  };
}

function setupShortcut(options = {}) {
  const target = findTarget();
  const rawShortcutArgs = [...target.baseArguments, ...(options.extraShortcutArgs || [])];
  const shouldHide = !options.show;
  const resolvedTarget = shouldHide
    ? toHiddenShortcutTarget(target.targetPath, rawShortcutArgs)
    : {
        targetPath: target.targetPath,
        arguments: rawShortcutArgs.map(quoteArg).join(" "),
      };

  if (options.dryRun) {
    console.log("Shortcut dry run only. Nothing was created.");
    console.log(`Target: ${resolvedTarget.targetPath}`);
    console.log(`Arguments: ${resolvedTarget.arguments || "(none)"}`);
    console.log(`Name: ${options.name || "Codex Local Plus"}`);
    console.log(`Location: ${options.startMenu ? "Start Menu" : "Desktop"}`);
    console.log(`Console: ${shouldHide ? "hidden" : "visible"}`);
    return 0;
  }

  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    shortcutScriptPath,
    "-TargetPath",
    resolvedTarget.targetPath,
  ];

  if (options.name) args.push("-Name", options.name);
  if (options.startMenu) args.push("-StartMenu");
  if (options.desktop || !options.startMenu) args.push("-Desktop");
  if (resolvedTarget.arguments) args.push("-Arguments", resolvedTarget.arguments);

  const result = spawnSync("powershell.exe", args, {
    stdio: "inherit",
    windowsHide: false,
  });

  if (result.error) {
    console.error(`Failed to create shortcut: ${result.error.message}`);
    return 1;
  }

  return typeof result.status === "number" ? result.status : 1;
}

module.exports = {
  setupShortcut,
};
