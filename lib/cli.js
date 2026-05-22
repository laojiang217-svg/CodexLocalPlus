"use strict";

const { runLauncher } = require("./launcher");
const { runDoctor } = require("./doctor");
const { setupShortcut } = require("./shortcut");

function printHelp() {
  console.log(`Codex Local Plus

Usage:
  codex-local-plus [options]
  codex-local-plus start [options]
  codex-local-plus doctor [options]
  codex-local-plus setup-shortcut [options]

Options:
  -p, --port <port>              CDP port, default 9222
  --no-launch                    Connect to an existing Codex CDP session
  --dry-run                      Print resolved paths and arguments without launching
  --codex-path <path>            Explicit Codex.exe path
  --inject-file <path>           Explicit inject.js path
  --timeout-seconds <seconds>    Wait timeout for CDP target
  --user-data-dir <path>         Pass a custom Chromium user data dir
  --show                         Show the launcher console and logs
  --desktop                      setup-shortcut: create desktop shortcut
  --start-menu                   setup-shortcut: create Start Menu shortcut
  --name <name>                  setup-shortcut: shortcut name
  --hidden                       Deprecated alias; shortcuts are hidden by default
  -h, --help                     Show help
  -v, --version                  Show version
`);
}

function parseArgs(argv) {
  const args = [...argv];
  let command = "start";

  if (args[0] && !args[0].startsWith("-")) {
    command = args.shift();
  }

  const options = {
    extraShortcutArgs: [],
  };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const next = () => {
      const value = args[++index];
      if (!value) throw new Error(`Missing value for ${arg}`);
      return value;
    };

    switch (arg) {
      case "-h":
      case "--help":
        options.help = true;
        break;
      case "-v":
      case "--version":
        options.version = true;
        break;
      case "-p":
      case "--port":
      case "--Port":
        options.port = next();
        options.extraShortcutArgs.push("--port", String(options.port));
        break;
      case "--no-launch":
      case "--NoLaunch":
        options.noLaunch = true;
        options.extraShortcutArgs.push("--no-launch");
        break;
      case "--dry-run":
      case "--DryRun":
        options.dryRun = true;
        break;
      case "--codex-path":
      case "--CodexPath":
        options.codexPath = next();
        options.extraShortcutArgs.push("--codex-path", options.codexPath);
        break;
      case "--inject-file":
      case "--InjectFile":
        options.injectFile = next();
        options.extraShortcutArgs.push("--inject-file", options.injectFile);
        break;
      case "--timeout-seconds":
      case "--TimeoutSeconds":
        options.timeoutSeconds = next();
        options.extraShortcutArgs.push("--timeout-seconds", String(options.timeoutSeconds));
        break;
      case "--user-data-dir":
      case "--UserDataDir":
        options.userDataDir = next();
        options.extraShortcutArgs.push("--user-data-dir", options.userDataDir);
        break;
      case "--show":
      case "--Show":
        options.show = true;
        options.extraShortcutArgs.push("--show");
        break;
      case "--desktop":
        options.desktop = true;
        break;
      case "--start-menu":
        options.startMenu = true;
        break;
      case "--name":
        options.name = next();
        break;
      case "--hidden":
        options.hidden = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { command, options };
}

function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    console.error("Run codex-local-plus --help for usage.");
    process.exitCode = 1;
    return;
  }

  const { command, options } = parsed;

  if (options.help || command === "help") {
    printHelp();
    return;
  }

  if (options.version || command === "version") {
    console.log(require("../package.json").version);
    return;
  }

  if (command === "start") {
    process.exitCode = runLauncher(options);
    return;
  }

  if (command === "doctor") {
    process.exitCode = runDoctor(options);
    return;
  }

  if (command === "setup-shortcut") {
    process.exitCode = setupShortcut(options);
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.error("Run codex-local-plus --help for usage.");
  process.exitCode = 1;
}

module.exports = {
  main,
  parseArgs,
};
