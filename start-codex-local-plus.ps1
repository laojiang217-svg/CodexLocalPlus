param(
  [int]$Port = 9222,
  [string]$CodexPath = "",
  [string]$InjectFile = "",
  [string]$UserDataDir = "",
  [int]$TimeoutSeconds = 20,
  [switch]$NoLaunch,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Resolve-CodexPath {
  param([string]$ExplicitPath)

  if ($ExplicitPath) {
    if (-not (Test-Path -LiteralPath $ExplicitPath)) {
      throw "CodexPath does not exist: $ExplicitPath"
    }
    return (Resolve-Path -LiteralPath $ExplicitPath).Path
  }

  $candidates = New-Object System.Collections.Generic.List[string]

  try {
    $packages = @(Get-AppxPackage -Name "OpenAI.Codex" -ErrorAction SilentlyContinue)
    foreach ($package in $packages) {
      if ($package.InstallLocation) {
        $candidates.Add((Join-Path $package.InstallLocation "app\Codex.exe"))
        $candidates.Add((Join-Path $package.InstallLocation "app\resources\codex.exe"))
        $candidates.Add((Join-Path $package.InstallLocation "resources\codex.exe"))
      }
    }
  } catch {
    # Some elevated shells cannot see per-user AppX package metadata.
  }

  if ($env:LOCALAPPDATA) {
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\codex.exe"))
  }

  if ($env:ProgramFiles) {
    try {
      $packageDirs = @(Get-ChildItem -LiteralPath (Join-Path $env:ProgramFiles "WindowsApps") -Filter "OpenAI.Codex_*" -Directory -ErrorAction SilentlyContinue)
      foreach ($dir in $packageDirs | Sort-Object Name -Descending) {
        $candidates.Add((Join-Path $dir.FullName "app\Codex.exe"))
        $candidates.Add((Join-Path $dir.FullName "app\resources\codex.exe"))
        $candidates.Add((Join-Path $dir.FullName "resources\codex.exe"))
      }
    } catch {
      # WindowsApps listing is often restricted; an explicit -CodexPath still works.
    }
  }

  foreach ($name in @("Codex.exe", "codex.exe", "codex")) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($command -and $command.Source) {
      if ($command.Source -match "\\app\\resources\\codex\.exe$") {
        $candidates.Add(($command.Source -replace "\\resources\\codex\.exe$", "\Codex.exe"))
      }
      $candidates.Add($command.Source)
    }
  }

  if ($env:LOCALAPPDATA) {
    try {
      $localBins = @(Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA "OpenAI\Codex\bin") -Recurse -Filter "codex.exe" -File -ErrorAction SilentlyContinue)
      foreach ($bin in $localBins | Sort-Object LastWriteTime -Descending) {
        $candidates.Add($bin.FullName)
      }
    } catch {
      # Optional per-user Codex binary cache may not exist.
    }
  }

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  throw "Could not find codex.exe. Pass -CodexPath explicitly, for example: -CodexPath `"C:\Program Files\WindowsApps\OpenAI.Codex_26.519.2736.0_x64__2p2nqsd0c76g0\app\resources\codex.exe`""
}

function Invoke-CdpHttp {
  param(
    [int]$Port,
    [string]$Path
  )

  $uri = "http://127.0.0.1:$Port$Path"
  return Invoke-RestMethod -UseBasicParsing -Uri $uri
}

function Receive-CdpMessage {
  param(
    [System.Net.WebSockets.ClientWebSocket]$WebSocket,
    [int]$TimeoutSeconds = 10
  )

  $buffer = New-Object byte[] 65536
  $builder = [System.Text.StringBuilder]::new()
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  do {
    $remaining = [Math]::Max(1, ($deadline - (Get-Date)).TotalMilliseconds)
    $segment = [ArraySegment[byte]]::new($buffer)
    $task = $WebSocket.ReceiveAsync($segment, [Threading.CancellationToken]::None)

    if (-not $task.Wait([TimeSpan]::FromMilliseconds($remaining))) {
      $WebSocket.Abort()
      throw "Timed out waiting for a CDP websocket message after $TimeoutSeconds seconds."
    }

    $result = $task.GetAwaiter().GetResult()

    if ($result.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) {
      throw "CDP websocket closed before a response was received."
    }

    [void]$builder.Append([System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count))
  } while (-not $result.EndOfMessage)

  return ($builder.ToString() | ConvertFrom-Json)
}

function Connect-CdpWebSocket {
  param(
    [System.Net.WebSockets.ClientWebSocket]$WebSocket,
    [string]$Url,
    [int]$TimeoutSeconds = 10
  )

  $task = $WebSocket.ConnectAsync([Uri]$Url, [Threading.CancellationToken]::None)
  if (-not $task.Wait([TimeSpan]::FromSeconds($TimeoutSeconds))) {
    $WebSocket.Abort()
    throw "Timed out connecting to CDP websocket after $TimeoutSeconds seconds: $Url"
  }
  [void]$task.GetAwaiter().GetResult()
}

function Send-CdpCommand {
  param(
    [System.Net.WebSockets.ClientWebSocket]$WebSocket,
    [int]$Id,
    [string]$Method,
    [hashtable]$Params = @{}
  )

  $request = @{
    id = $Id
    method = $Method
    params = $Params
  } | ConvertTo-Json -Depth 20 -Compress

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($request)
  $segment = [ArraySegment[byte]]::new($bytes)
  $sendTask = $WebSocket.SendAsync(
    $segment,
    [System.Net.WebSockets.WebSocketMessageType]::Text,
    $true,
    [Threading.CancellationToken]::None
  )
  if (-not $sendTask.Wait([TimeSpan]::FromSeconds(10))) {
    $WebSocket.Abort()
    throw "Timed out sending CDP command: $Method"
  }
  [void]$sendTask.GetAwaiter().GetResult()

  while ($true) {
    $message = Receive-CdpMessage -WebSocket $WebSocket -TimeoutSeconds 10
    if ($message.id -eq $Id) {
      if ($message.error) {
        throw "CDP command failed: $($message.error.message)"
      }
      return $message
    }
  }
}

function Invoke-CdpInjectionWithNode {
  param(
    [string]$WebSocketUrl,
    [string]$InjectFile
  )

  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node -or -not $node.Source) {
    throw "Node.js is required for CDP websocket injection but was not found on PATH."
  }

  $script = @'
const fs = require("fs");

const [wsUrl, injectFile] = process.argv.slice(2);
const source = fs.readFileSync(injectFile, "utf8");
const ws = new WebSocket(wsUrl);
let nextId = 1;
const pending = new Map();

function timeout(ms, message) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

function waitOpen() {
  return Promise.race([
    new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error("CDP websocket error")), { once: true });
    }),
    timeout(10000, "Timed out connecting to CDP websocket"),
  ]);
}

function send(method, params = {}) {
  const id = nextId++;
  const payload = JSON.stringify({ id, method, params });

  return Promise.race([
    new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, method });
      ws.send(payload);
    }),
    timeout(10000, `Timed out waiting for CDP response: ${method}`),
  ]).finally(() => pending.delete(id));
}

ws.addEventListener("message", (event) => {
  let message;
  try {
    message = JSON.parse(event.data);
  } catch {
    return;
  }

  if (!message.id || !pending.has(message.id)) {
    return;
  }

  const request = pending.get(message.id);
  if (message.error) {
    request.reject(new Error(message.error.message || `CDP command failed: ${request.method}`));
  } else {
    request.resolve(message.result || {});
  }
});

(async () => {
  await waitOpen();
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source });
  await send("Runtime.evaluate", { expression: source, awaitPromise: false, returnByValue: true });

  const status = await send("Runtime.evaluate", {
    expression: "({ loaded: Boolean(window.__codexLocalPlus && window.__codexLocalPlus.loaded), version: window.__codexLocalPlus && window.__codexLocalPlus.version || null })",
    awaitPromise: false,
    returnByValue: true,
  });

  console.log(JSON.stringify(status.result?.value || { loaded: false, version: null }));
  ws.close();
})().catch((error) => {
  console.error(error.message || String(error));
  try { ws.close(); } catch {}
  process.exit(1);
});
'@

  $tempScript = Join-Path ([System.IO.Path]::GetTempPath()) "codex-local-plus-cdp-$([Guid]::NewGuid().ToString('N')).cjs"
  Set-Content -LiteralPath $tempScript -Value $script -Encoding UTF8

  try {
    $output = & $node.Source $tempScript $WebSocketUrl $InjectFile 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw "Node CDP injection failed: $($output -join [Environment]::NewLine)"
    }
    return (($output -join [Environment]::NewLine) | ConvertFrom-Json)
  } finally {
    Remove-Item -LiteralPath $tempScript -Force -ErrorAction SilentlyContinue
  }
}

function Get-AppUserModelIdFromCodexPath {
  param([string]$Path)

  $current = Get-Item -LiteralPath $Path
  while ($current) {
    if ($current.Name -match "^(?<PackageName>.+?)_\d+\.\d+\.\d+\.\d+_.+__(?<PublisherId>[^\\]+)$") {
      $packageName = $Matches.PackageName
      $publisherId = $Matches.PublisherId
      $manifest = Join-Path $current.FullName "AppxManifest.xml"
      $appId = "App"

      if (Test-Path -LiteralPath $manifest) {
        try {
          [xml]$manifestXml = Get-Content -LiteralPath $manifest -Raw
          $application = @($manifestXml.Package.Applications.Application | Select-Object -First 1)[0]
          if ($application.Id) {
            $appId = [string]$application.Id
          }
        } catch {
          # Fall back to the known Codex AppX application id.
        }
      }

      return "$packageName`_$publisherId!$appId"
    }

    if ($current.FullName -match "WindowsApps\\(?<PackageName>OpenAI\.Codex)_\d+\.\d+\.\d+\.\d+_[^\\]+__(?<PublisherId>[^\\]+)") {
      return "$($Matches.PackageName)_$($Matches.PublisherId)!App"
    }

    $current = $current.Directory
  }

  return $null
}

function Start-AppxApplication {
  param(
    [string]$AppUserModelId,
    [string]$Arguments
  )

  if (-not ([System.Management.Automation.PSTypeName]"CodexLocalPlus.ApplicationActivationManager").Type) {
    $originalLib = $env:LIB
    if ($env:LIB) {
      $validLibPaths = @(
        $env:LIB -split ";" |
          Where-Object { $_ -and (Test-Path -LiteralPath $_) }
      )
      $env:LIB = $validLibPaths -join ";"
    }

    try {
      Add-Type -IgnoreWarnings -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

namespace CodexLocalPlus {
  public enum ActivateOptions {
    None = 0,
    DesignMode = 1,
    NoErrorUI = 2,
    NoSplashScreen = 4
  }

  [ComImport]
  [Guid("2e941141-7f97-4756-ba1d-9decde894a3d")]
  [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IApplicationActivationManager {
    [PreserveSig]
    int ActivateApplication(
      [In] string appUserModelId,
      [In] string arguments,
      [In] ActivateOptions options,
      out UInt32 processId);

    [PreserveSig]
    int ActivateForFile(
      [In] string appUserModelId,
      [In] IntPtr itemArray,
      [In] string verb,
      out UInt32 processId);

    [PreserveSig]
    int ActivateForProtocol(
      [In] string appUserModelId,
      [In] IntPtr itemArray,
      out UInt32 processId);
  }

  [ComImport]
  [Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")]
  public class ApplicationActivationManager {}

  public static class AppxLauncher {
    public static UInt32 Activate(string appUserModelId, string arguments) {
      IApplicationActivationManager activator =
        (IApplicationActivationManager)new ApplicationActivationManager();

      UInt32 processId;
      int result = activator.ActivateApplication(
        appUserModelId,
        arguments,
        ActivateOptions.NoErrorUI,
        out processId);

      if (result != 0) {
        Marshal.ThrowExceptionForHR(result);
      }

      return processId;
    }
  }
}
"@
    } finally {
      $env:LIB = $originalLib
    }
  }

  return [CodexLocalPlus.AppxLauncher]::Activate($AppUserModelId, $Arguments)
}

function Start-CodexApplication {
  param(
    [string]$CodexPath,
    [string[]]$LaunchArgs
  )

  $argumentText = $LaunchArgs -join " "
  $appUserModelId = Get-AppUserModelIdFromCodexPath -Path $CodexPath

  if ($appUserModelId -and $CodexPath -match "\\WindowsApps\\") {
    Write-Host "Using AppX activation: $appUserModelId"
    [void](Start-AppxApplication -AppUserModelId $appUserModelId -Arguments $argumentText)
    return
  }

  try {
    Start-Process -FilePath $CodexPath -ArgumentList $LaunchArgs -ErrorAction Stop
    return
  } catch {
    if (-not $appUserModelId) {
      throw
    }

    Write-Host "Direct launch was blocked by WindowsApps permissions. Using AppX activation: $appUserModelId"
    [void](Start-AppxApplication -AppUserModelId $appUserModelId -Arguments $argumentText)
  }
}

function Wait-CdpTarget {
  param(
    [int]$Port,
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $targets = Invoke-CdpHttp -Port $Port -Path "/json"
      $target = @($targets | Where-Object { $_.type -eq "page" -and $_.webSocketDebuggerUrl } | Select-Object -First 1)[0]
      if ($target) {
        return $target
      }
    } catch {
      Start-Sleep -Milliseconds 350
      continue
    }

    Start-Sleep -Milliseconds 350
  }

  throw "Could not find a Codex CDP page target on port $Port. If Codex was already running, close it and run this launcher again."
}

$resolvedCodexPath = Resolve-CodexPath -ExplicitPath $CodexPath

if (-not $InjectFile) {
  $InjectFile = Join-Path $PSScriptRoot "inject.js"
}

if (-not (Test-Path -LiteralPath $InjectFile)) {
  throw "Inject file does not exist: $InjectFile"
}

$resolvedInjectFile = (Resolve-Path -LiteralPath $InjectFile).Path
$launchArgs = @(
  "--remote-debugging-address=127.0.0.1",
  "--remote-debugging-port=$Port"
)

if ($UserDataDir) {
  $launchArgs += "--user-data-dir=$UserDataDir"
}

if ($DryRun) {
  Write-Host "Codex path: $resolvedCodexPath"
  Write-Host "Inject file: $resolvedInjectFile"
  Write-Host "Port: $Port"
  Write-Host "Launch args: $($launchArgs -join ' ')"
  $appUserModelId = Get-AppUserModelIdFromCodexPath -Path $resolvedCodexPath
  if ($appUserModelId) {
    Write-Host "AppX AUMID: $appUserModelId"
  }
  Write-Host "Dry run only. Nothing was launched or injected."
  exit 0
}

if (-not $NoLaunch) {
  Write-Host "Starting Codex with local CDP on 127.0.0.1:$Port..."
  Start-CodexApplication -CodexPath $resolvedCodexPath -LaunchArgs $launchArgs
}

$target = Wait-CdpTarget -Port $Port -TimeoutSeconds $TimeoutSeconds
$wsUrl = [string]$target.webSocketDebuggerUrl

if (-not ($wsUrl.StartsWith("ws://127.0.0.1:$Port/") -or $wsUrl.StartsWith("ws://localhost:$Port/"))) {
  throw "Refusing to connect to non-local CDP websocket: $wsUrl"
}

Write-Host "Connecting to CDP target: $($target.title)"
$statusValue = Invoke-CdpInjectionWithNode -WebSocketUrl $wsUrl -InjectFile $resolvedInjectFile

Write-Host "Injected $resolvedInjectFile"
if ($statusValue.loaded) {
  Write-Host "Local Plus loaded: v$($statusValue.version)"
} else {
  Write-Warning "Local Plus injection status could not be confirmed. The page may still be loading."
}
Write-Host "Target URL: $($target.url)"
Write-Host "Close Codex to remove the injection. No files were changed in the Codex install or config directories."
