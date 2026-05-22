# Codex Local Plus

Codex Local Plus is a Windows-only local launcher and injector for Codex Desktop.

Codex Local Plus 是一个仅支持 Windows 的 Codex 桌面端本地增强启动器。

It starts Codex with a local Chrome DevTools Protocol (CDP) endpoint on `127.0.0.1`, then injects the local `inject.js` into the Codex page.

它会通过本机回环地址 `127.0.0.1` 启动 Codex 的 Chrome DevTools Protocol（CDP）端口，并把本地 `inject.js` 注入到 Codex 页面中。

## Features / 特性

- Global npm command: `clp`
- npm 全局短命令：`clp`
- Compatible aliases: `codex-plus`, `codex-local-plus`
- 兼容别名：`codex-plus`、`codex-local-plus`
- Environment checker: `clp doctor`
- 环境检查：`clp doctor`
- Windows shortcut creator: `clp setup-shortcut`
- Windows 快捷方式创建：`clp setup-shortcut`
- Does not distribute Codex itself
- 不分发 Codex 本体
- Does not modify the original Codex installation directory
- 不修改 Codex 原始安装目录
- Does not auto-start after install
- 不做安装后自动启动
- Does not run as a background daemon
- 不后台常驻
- Injection only exists in the current Codex process
- 注入只存在于当前 Codex 进程

## Requirements / 环境要求

- Windows 10/11
- Node.js 18 or newer
- Codex Desktop must be installed separately
- PowerShell must be available

---

- Windows 10/11
- Node.js 18 或更高版本
- 需要自行安装 Codex 桌面端
- 系统需要可用 PowerShell

## Install / 安装

Install from npm:

从 npm 安装：

```powershell
npm install -g codex-local-plus
```

After installation, use the short command:

安装后使用短命令：

```powershell
clp
```

You can also use the aliases:

也可以使用兼容别名：

```powershell
codex-plus
codex-local-plus
```

## Basic usage / 基本使用

Before launching, fully quit Codex Desktop first.

启动前请先完全退出 Codex 桌面端。

Electron single-instance apps may forward a new launch request to the already-running instance. In that case, `--remote-debugging-port` may not take effect.

Electron 单实例应用在已经运行时，可能会把新启动请求转交给现有实例，导致 `--remote-debugging-port` 不生效。

Start Codex Local Plus. The launcher console is hidden by default:

启动 Codex Local Plus。启动器控制台默认隐藏：

```powershell
clp
```

Show the launcher console and logs:

显示启动器控制台和日志：

```powershell
clp --show
```

Check the environment:

检查环境：

```powershell
clp doctor
```

Only check resolved paths and arguments without launching Codex:

只检查路径和参数，不启动 Codex：

```powershell
clp --dry-run
```

Use a custom CDP port:

指定 CDP 端口：

```powershell
clp --port 9333
```

Connect to an existing CDP session:

连接已有 CDP 会话：

```powershell
clp --no-launch
```

Specify the Codex frontend executable:

指定 Codex 前端路径：

```powershell
clp --codex-path "C:\Program Files\WindowsApps\OpenAI.Codex_...\app\Codex.exe"
```

Specify a custom injection script:

指定自定义注入脚本：

```powershell
clp --inject-file "C:\path\to\inject.js"
```

Specify a custom Chromium user data directory:

指定自定义 Chromium 用户数据目录：

```powershell
clp --user-data-dir "C:\path\to\profile"
```

Set the CDP target wait timeout:

设置等待 CDP 目标页面的超时时间：

```powershell
clp --timeout-seconds 30
```

## Create shortcuts / 创建快捷方式

Create a desktop shortcut. Shortcuts are hidden-launch shortcuts by default:

创建桌面快捷方式。快捷方式默认隐藏启动器窗口：

```powershell
clp setup-shortcut
```

Create a shortcut that shows the launcher console and logs:

创建显示启动器控制台和日志的快捷方式：

```powershell
clp setup-shortcut --show
```

Create a Start Menu shortcut:

创建开始菜单快捷方式：

```powershell
clp setup-shortcut --start-menu
```

Create a shortcut with a custom name:

指定快捷方式名称：

```powershell
clp setup-shortcut --name "Codex Local Plus"
```

Create a shortcut that always uses a custom port:

创建固定使用指定端口的快捷方式：

```powershell
clp setup-shortcut --port 9333
```

Shortcut creation only points the shortcut to the `clp` command. It does not modify the Codex installation directory and does not launch Codex while creating the shortcut.

快捷方式只会指向 `clp` 命令，不会修改 Codex 安装目录，也不会在创建时启动 Codex。

## Local development / 本地开发

Run the CLI directly from the project directory:

在项目目录直接运行 CLI：

```powershell
node .\bin\codex-local-plus.js --dry-run
```

Run the PowerShell launcher directly:

直接调用 PowerShell 启动器：

```powershell
powershell -ExecutionPolicy Bypass -File .\start-codex-local-plus.ps1 -DryRun
```

Check the npm package contents:

检查 npm 包内容：

```powershell
npm pack --dry-run
```

Link the package globally for local testing:

本地全局链接测试：

```powershell
npm link
clp --dry-run
clp doctor
```

## Plugin diagnostic panel / 插件诊断面板

`inject.js` shows a `Local+` panel in the bottom-right corner of the Codex page.

`inject.js` 会在 Codex 页面右下角显示 `Local+` 面板。

After expanding the panel, you can:

展开后可以：

- Scan possible plugin, tool, browser, Chrome, and LaTeX entries on the current page.
- 扫描当前页面里可能的插件、工具、Browser、Chrome、LaTeX 入口。
- Show whether each entry is visible, disabled, and why it may be unavailable.
- 显示入口是否可见、是否被禁用，以及不可用原因。
- Open entries that are already visible and not disabled.
- 对本来已经可见且未禁用的入口提供“打开”按钮。
- Show a force-unlock action for detected disabled entries.
- 对检测到的禁用入口显示“强制解锁”按钮。
- Copy local diagnostic information for troubleshooting.
- 复制本地诊断信息，方便排查。

Current `inject.js` contains client-side DOM and React state modification logic. It is intended for temporary local testing. Do not use it with important account sessions or sensitive data unless you have audited it yourself.

当前 `inject.js` 包含客户端 DOM/React 状态修改逻辑，适合临时本地测试。用于重要账号会话或敏感数据场景前，请自行审计。

## Troubleshooting / 排查流程

1. Fully quit Codex Desktop, then relaunch it with `clp`.
2. Open `http://127.0.0.1:9222/json` and confirm that an `app://-/index.html` page is listed.
3. Expand the `Local+` panel in the bottom-right corner of Codex.
4. Click refresh and check the number of detected entries, visibility, and disabled reasons.
5. If an entry is openable, click open.
6. After modifying `inject.js`, fully quit Codex and run the launcher again. Re-injecting the same version only refreshes the existing Local+ instance.

---

1. 完全关闭 Codex 后，用 `clp` 重新打开。
2. 打开 `http://127.0.0.1:9222/json`，确认能看到 `app://-/index.html` 页面。
3. 在 Codex 右下角展开 `Local+` 面板。
4. 点击“刷新”，查看插件入口数量、可见性和禁用原因。
5. 如果入口显示可打开，点击“打开”。
6. 修改 `inject.js` 后，建议完全关闭 Codex 再重新运行启动器；同版本重复注入只会刷新现有实例。

## Package and Git notes / 发布与提交注意事项

Recommended files to commit and publish:

建议提交和发布：

```text
package.json
.gitignore
.npmignore
bin/
lib/
scripts/
start-codex-local-plus.ps1
inject.js
README.md
vendor/renderer-inject.codexplusplus.disabled.js
```

Do not commit or publish:

不要提交或发布：

```text
runtime/
node_modules/
*.tgz
*.log
.env
```

`runtime/` contains Codex/Electron runtime resources. It is large and is not part of this project's source code.

`runtime/` 包含 Codex/Electron 运行时资源，体积大且不属于本项目源码。

The npm package uses a `files` whitelist so `runtime/` is not included in the published package.

npm 包使用 `files` 白名单，确保 `runtime/` 不会被打进发布包。

## Security boundaries / 安全边界

The CDP injection script has JavaScript execution capability inside the current Codex frontend page. It can read the page DOM and may trigger frontend behavior. Its safety mainly depends on the contents of `inject.js`.

CDP 注入脚本拥有当前 Codex 前端页面里的 JavaScript 执行能力，所以它能看到页面 DOM，也可能触发页面里的前端行为。安全性主要取决于 `inject.js` 本身。

Project constraints:

当前项目约束：

- No remote scripts
- 不引入远程脚本
- No auto-update
- 不做自动更新
- No `postinstall` auto-start
- 不做 `postinstall` 自动启动
- No background daemon
- 不后台常驻
- Does not process account tokens
- 不处理账号 token
- Does not send session content to external services
- 不把会话内容发到任何外部服务
- Does not modify the Codex installation directory
- 不修改 Codex 安装目录

Current `inject.js` includes client-side DOM/React state intervention for local testing. Please audit `inject.js` before use.

当前 `inject.js` 包含客户端 DOM/React 状态干预行为，用于本地测试。使用前请自行审计 `inject.js`。

## Rollback / 回滚

Quit the Codex process started by this launcher. The injection only exists in the current process and does not install any persistent component.

关闭用这个启动器启动的 Codex 即可。注入只存在于本次进程内，没有安装持久化组件。
