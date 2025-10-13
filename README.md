# Niu Code

为 Claude Code CLI 提供现代化的 Web 界面，并复刻了你喜爱的大部分便捷操作，带来比命令行更好的交互体验。

## 功能特性

- **现代化 Web 界面**:基于 Vue 3 和 PrimeVue 构建的简洁直观界面
- **高级编辑器**: 基于 TipTap 的输入框，实时渲染 markdown 文本，支持斜杠命令和文件引用自动补全
- **后台服务**: 后端作为系统服务运行，管理所有会话，所以即使关闭了网页，Claude 仍然会在后台运行，为你执行任务（这也是 niu code 名字的来源）
- **单一可执行文件**: 前端嵌入二进制文件中,便于部署

## 与其他 Claude Code webui 不同之处（包括官方的插件）

- niu code 使用 rust 实现的 claude code SDK，在本项目的 `backend/cc-sdk` 文件夹
- niu code 使用服务端管理会话，这是和大多数 webui 在概念上的不同之处，这让你可以随时关闭网页，并保持 Claude Code Cli 运行，然后在任意设备继续查看 Claude 的运行情况。这为使用手机等移动设备控制 Claude 提供了可能性（可能是很久之后的计划）
- niu code 复刻了 Claude Code Cli 几乎所有便捷操作
  - 支持所有权限模式，如 Plan，acceptEdits（opcode 只能运行在 bypassPermissions）
  - Slash command，包括自定义命令 （opcode 不支持）
  - @ 文件引用补全 （opcode 不支持）
  - CTRL + R 查找历史提示词
- 内置的通知机制，每当 Claude 需要申请权限，都会发送声音/系统通知，让你可以放心做其他事情，不必担心 Claude 陷入无限等待
  - Plan 模式中，当 Claude 完成了计划，需要批准时
  - 任何模式中，当 Claude 需要权限使用工具，比如执行 Bash 命令、WebSearch
- 你可以配置多套 claude 配置文件，每个对话使用不同的配置
- 实时渲染 markdown 代码的输入框

## TODO

- [x] Rust 版本的 Claude Code SDK
- [x] Markdown 聊天输入框
- [x] 渲染不同类型的对话消息
- [x] 输入框中粘贴图片
- [ ] checkpoint，回滚变更
- [x] 切换 Claude 配置
- [x] 切换权限模式
- [x] 切换颜色主题
- [x] 配置热更新，更改 `~/.config/.niu-code/settings.json` 文件无需重启 niu-code
- [ ] 更好的错误处理，任何错误都应立即在客户端中体现，目前有部分错误会静默处理
- [ ] sub agent
  - [ ] 区分 sub agent 生成的消息
  - [ ] 使用快捷键（如 $）自动补全 sub agent
- [ ] 更多通知方式
  - [ ] 邮件通知
  - [ ] 微信通知
- [ ] 更多个性化配置
  - [ ] 自定义主题
  - [ ] 通知模式
  - [ ] 通知声音
- [ ] 手动控制会话的生命周期，比如不自动关闭

## 快速开始

### 前置要求

- **Claude Code CLI**: `npm install -g @anthropic-ai/claude-code`

### 安装

#### Linux / macOS

```bash
curl -fsSL https://raw.githubusercontent.com/liuzsen/niu-code/main/scripts/install.sh | bash
```

#### Windows

PowerShell (以管理员身份运行):

```powershell
irm https://raw.githubusercontent.com/liuzsen/niu-code/main/scripts/install.ps1 | iex
```

### 访问应用

安装完成后,在浏览器中打开: `http://127.0.0.1:33333`

## 手动安装

从[发布页面](https://github.com/liuzsen/niu-code/releases)下载适合的二进制文件:

- **Linux**: `niu-code-linux-x64`
- **macOS Intel**: `niu-code-macos-x64`
- **macOS Apple Silicon**: `niu-code-macos-arm64`
- **Windows**: `niu-code-windows-x64.exe`

添加可执行权限并运行:

```bash
chmod +x niu-code-linux-x64
./niu-code-linux-x64
```

详细安装说明请参阅 [INSTALL.md](INSTALL.md)。

## 服务管理

应用程序作为后台服务运行:

### Linux (systemd)

```bash
# 查看状态
systemctl --user status niu-code

# 启动/停止/重启
systemctl --user start niu-code
systemctl --user stop niu-code
systemctl --user restart niu-code

# 查看日志
journalctl --user -u niu-code -f
```

### macOS (launchd)

```bash
# 查看状态
launchctl list | grep niu-code

# 停止
launchctl unload ~/Library/LaunchAgents/com.niu-code.plist

# 启动
launchctl load ~/Library/LaunchAgents/com.niu-code.plist

# 查看日志
tail -f ~/Library/Logs/niu-code.log
```

### Windows

```powershell
# 查看状态
sc query ClaudeWebUI

# 启动/停止
sc start ClaudeWebUI
sc stop ClaudeWebUI

# 查看日志
Get-Content "$env:LOCALAPPDATA\niu-code\service.log" -Tail 50 -Wait
```

## 配置

配置文件存储位置:

- **Linux**: `~/.niu-code/settings.json`
- **macOS**: `~/.niu-code/settings.json`
- **Windows**: `~\.niu-code\settings.json`

## 开发

请参考 [DEV.MD](./docs/DEV.md)

## 贡献

欢迎贡献!请随时提交 Pull Request。

## 许可证

[您的许可证 - 例如 MIT License]

## 致谢

- 基于 Anthropic 的 [Claude Code CLI](https://github.com/anthropics/claude-code) 构建
- 后端使用 [Actix-web](https://github.com/actix/actix-web)
- 前端由 [Vue 3](https://vuejs.org/) 和 [PrimeVue](https://primevue.org/) 驱动
- 编辑器基于 [TipTap](https://tiptap.dev/)
