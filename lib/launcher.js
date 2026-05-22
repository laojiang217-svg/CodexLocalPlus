"use strict";

const { spawnSync } = require("child_process");
const { launcherPath } = require("./paths");

function quotePowerShellString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function toPowerShellArgs(options = {}) {
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass"];

  if (!options.show && !options.dryRun) {
    args.push("-WindowStyle", "Hidden");
  }

  args.push("-File", launcherPath);

  if (options.port) args.push("-Port", String(options.port));
  if (options.codexPath) args.push("-CodexPath", options.codexPath);
  if (options.injectFile) args.push("-InjectFile", options.injectFile);
  if (options.userDataDir) args.push("-UserDataDir", options.userDataDir);
  if (options.timeoutSeconds) args.push("-TimeoutSeconds", String(options.timeoutSeconds));
  if (options.noLaunch) args.push("-NoLaunch");
  if (options.dryRun) args.push("-DryRun");

  return args;
}

function hideCurrentConsole() {
  spawnSync("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-WindowStyle",
    "Hidden",
    "-Command",
    "Add-Type -Name Win32ShowWindowAsync -Namespace Native -MemberDefinition '[DllImport(\"kernel32.dll\")] public static extern IntPtr GetConsoleWindow(); [DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);'; $hwnd = [Native.Win32ShowWindowAsync]::GetConsoleWindow(); if ($hwnd -ne [IntPtr]::Zero) { [Native.Win32ShowWindowAsync]::ShowWindowAsync($hwnd, 0) | Out-Null }",
  ], {
    stdio: "ignore",
    windowsHide: true,
  });
}

function startHiddenLauncher(options = {}) {
  const launcherArgs = toPowerShellArgs(options);
  const command = `Start-Process -WindowStyle Hidden -FilePath 'powershell.exe' -ArgumentList @(${launcherArgs.map(quotePowerShellString).join(", ")})`;

  return spawnSync("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-WindowStyle",
    "Hidden",
    "-Command",
    command,
  ], {
    stdio: "ignore",
    windowsHide: true,
  });
}

function runLauncher(options = {}) {
  if (!options.show && !options.dryRun) {
    const result = startHiddenLauncher(options);

    if (result.error) {
      console.error(`Failed to start hidden launcher: ${result.error.message}`);
      return 1;
    }

    if (typeof result.status === "number" && result.status !== 0) {
      console.error(`Hidden launcher exited with code ${result.status}. Run clp --show to see logs.`);
      return result.status;
    }

    hideCurrentConsole();
    return 0;
  }

  const result = spawnSync("powershell.exe", toPowerShellArgs(options), {
    stdio: "inherit",
    windowsHide: false,
  });

  if (result.error) {
    console.error(`Failed to run PowerShell: ${result.error.message}`);
    return 1;
  }

  return typeof result.status === "number" ? result.status : 1;
}

module.exports = {
  runLauncher,
  toPowerShellArgs,
};
