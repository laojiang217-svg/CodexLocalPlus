# Codex Local Plus

API Key 用户也可以在 Codex Desktop 里使用插件。

## 安全

- 本地运行，只使用 `127.0.0.1`。
- 不上传你的 API Key。
- 不持久化注入，退出当前 Codex 进程后失效。
- 不修改 Codex 原始安装目录。
- 不作为后台服务常驻。

## 使用

先完全退出 Codex Desktop。

```powershell
npm install -g codex-local-plus
clp
```

检查环境：

```powershell
clp doctor
```

创建快捷方式：

```powershell
clp setup-shortcut
```

也可以用这些命令启动：

```powershell
codex-plus
codex-local-plus
```

## 要求

- Windows 10/11
- Node.js 18+
- 已安装 Codex Desktop
