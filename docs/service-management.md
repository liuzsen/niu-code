# Niu Code 服务管理文档

本文档介绍如何管理 Niu Code 服务，包括启动、停止、重启、更新和查看日志等操作。

## 目录

- [Linux/macOS 系统](#linuxmacos-系统)
  - [服务控制](#linux-服务控制)
  - [查看日志](#linux-查看日志)
  - [更新服务](#linux-更新服务)
  - [卸载服务](#linuxmacos-卸载服务)
- [Windows 系统](#windows-系统)
  - [服务控制](#windows-服务控制)
  - [查看状态](#windows-查看状态)
  - [更新服务](#windows-更新服务)
  - [卸载服务](#windows-卸载服务)
- [常见问题](#常见问题)

---

## Linux/macOS 系统

### 安装位置

- **二进制文件**: `~/.local/bin/niu-code`
- **配置目录**: `~/.config/niu-code`
- **数据目录**: `~/.config/niu-code`
- **配置文件**：`~/.config/niu-code/settings.json`

### Linux 服务控制

Linux 系统使用 **systemd** 管理服务（用户级服务）。

#### 启动服务

```bash
systemctl --user start niu-code
```

#### 停止服务

```bash
systemctl --user stop niu-code
```

#### 重启服务

```bash
systemctl --user restart niu-code
```

#### 查看服务状态

```bash
systemctl --user status niu-code
```

#### 启用开机自启动

```bash
systemctl --user enable niu-code
```

#### 禁用开机自启动

```bash
systemctl --user disable niu-code
```

### macOS 服务控制

macOS 系统使用 **launchd** 管理服务。

#### 启动服务

```bash
launchctl load ~/Library/LaunchAgents/com.niu-code.plist
```

#### 停止服务

```bash
launchctl unload ~/Library/LaunchAgents/com.niu-code.plist
```

#### 查看服务状态

```bash
launchctl list | grep niu-code
```

输出示例：

```
1234    0    com.niu-code
```

- 第一列是进程 PID（如果正在运行）
- 第二列是最后退出状态码
- 第三列是服务标识

### Linux 查看日志

Linux 系统使用 **journalctl** 查看服务日志。

#### 实时查看日志（跟随模式）

```bash
journalctl --user -u niu-code -f
```

#### 查看最近的日志

```bash
journalctl --user -u niu-code -n 100
```

#### 查看特定时间范围的日志

```bash
# 查看今天的日志
journalctl --user -u niu-code --since today

# 查看最近 1 小时的日志
journalctl --user -u niu-code --since "1 hour ago"

# 查看特定日期的日志
journalctl --user -u niu-code --since "2025-01-01" --until "2025-01-02"
```

#### 查看错误日志

```bash
journalctl --user -u niu-code -p err
```

### macOS 查看日志

macOS 系统日志存储在 `~/.config/niu-code/logs/` 目录。

#### 实时查看标准输出日志

```bash
tail -f ~/.config/niu-code/logs/niu-code.log
```

#### 实时查看错误日志

```bash
tail -f ~/.config/niu-code/logs/niu-code-error.log
```

#### 查看最近的日志行数

```bash
# 查看最后 100 行
tail -n 100 ~/.config/niu-code/logs/niu-code.log

# 查看最后 50 行错误日志
tail -n 50 ~/.config/niu-code/logs/niu-code-error.log
```

### Linux 更新服务

安装脚本内置更新功能，重新运行即可自动检测并更新：

```bash
curl -fsSL https://raw.githubusercontent.com/liuzsen/niu-code/main/scripts/install.sh | bash
```

或者如果已下载脚本：

```bash
bash install.sh
```

**更新流程**：

1. 自动检测现有安装和版本
2. 提示确认是否更新（显示当前版本和最新版本）
3. 停止正在运行的服务
4. 备份当前二进制文件（保存为 `niu-code.backup`）
5. 下载并安装新版本
6. 重启服务
7. 验证服务状态

如果更新后出现问题，备份文件可以用于回退（参见"常见问题"章节）。

### Linux/macOS 卸载服务

使用卸载脚本：

```bash
curl -fsSL https://raw.githubusercontent.com/liuzsen/niu-code/main/scripts/uninstall.sh | bash
```

或者如果已下载脚本：

```bash
bash uninstall.sh
```

**卸载流程**：

1. **Linux 系统**：

   - 停止 systemd 服务
   - 禁用服务自启动
   - 删除服务文件（`~/.config/systemd/user/niu-code.service`）
   - 重新加载 systemd 配置

2. **macOS 系统**：

   - 停止 launchd 服务
   - 删除 plist 文件（`~/Library/LaunchAgents/com.niu-code.plist`）

3. **共同步骤**：
   - 删除二进制文件（`~/.local/bin/niu-code`）
   - 询问是否删除配置和数据目录（`~/.config/niu-code`）
     - 选择 `y` 完全删除
     - 选择 `n` 保留配置和数据（可用于重新安装后恢复）

---

## Windows 系统

### 安装位置

- **二进制文件**: `%USERPROFILE%\.local\bin\niu-code.exe`
- **配置目录**: `%USERPROFILE%\.config\niu-code`
- **配置文件**: `%USERPROFILE%\.config\niu-code\settings.json`
- **数据目录**: `%USERPROFILE%\.config\niu-code`
- **自启动快捷方式**: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\niu-code.lnk`

### Windows 服务控制

Windows 系统使用 **启动文件夹快捷方式** 实现开机自启动。

#### 启动服务

使用 PowerShell：

```powershell
Start-Process "$env:USERPROFILE\.local\bin\niu-code.exe" -WindowStyle Minimized
```

或者直接双击运行：

```
%USERPROFILE%\.local\bin\niu-code.exe
```

#### 停止服务

使用 PowerShell：

```powershell
Stop-Process -Name niu-code -Force
```

或使用任务管理器：

1. 按 `Ctrl + Shift + Esc` 打开任务管理器
2. 找到 `niu-code.exe` 进程
3. 右键选择"结束任务"

### Windows 查看状态

#### 检查进程是否运行

```powershell
Get-Process -Name niu-code -ErrorAction SilentlyContinue
```

如果进程正在运行，会显示进程信息：

```
Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id  SI ProcessName
-------  ------    -----      -----     ------     --  -- -----------
    123      10     1234       5678       0.12   1234   1 niu-code
```

#### 查看端口占用

```powershell
netstat -ano | findstr :33333
```

### Windows 更新服务

安装和更新使用同一个脚本

```powershell
irm https://raw.githubusercontent.com/liuzsen/niu-code/main/scripts/install.ps1 | iex
```

### Windows 卸载服务

使用卸载脚本：

```powershell
# 下载并运行卸载脚本
irm https://raw.githubusercontent.com/liuzsen/niu-code/main/scripts/uninstall.ps1 | iex
```

---

## 常见问题

### 服务启动失败

#### Linux/macOS

1. **检查依赖**：确保已安装 Node.js 和 Claude Code CLI

   ```bash
   node --version
   claude --version
   ```

2. **查看详细错误日志**：

   ```bash
   # Linux
   journalctl --user -u niu-code -n 50

   # macOS
   tail -n 50 ~/.config/niu-code/logs/niu-code-error.log
   ```

3. **检查文件权限**：

   ```bash
   ls -la ~/.local/bin/niu-code
   # 应该显示可执行权限 (-rwxr-xr-x)
   ```

4. **手动运行测试**：
   ```bash
   ~/.local/bin/niu-code
   ```

#### Windows

1. **检查依赖**：确保已安装 Node.js 和 Claude Code CLI

   ```powershell
   node --version
   claude --version
   ```

2. **检查防火墙**：确保防火墙没有阻止 niu-code.exe

3. **以管理员身份运行**（如果需要）：
   ```powershell
   Start-Process "$env:USERPROFILE\.local\bin\niu-code.exe" -Verb RunAs
   ```

### 端口已被占用

默认端口是 **33333**。如果端口被占用：

#### Linux/macOS

```bash
# 查看占用端口的进程
lsof -i :33333

# 或使用 netstat
netstat -tulpn | grep 33333
```

#### Windows

```powershell
# 查看占用端口的进程
netstat -ano | findstr :33333

# 根据 PID 查看进程详情
tasklist /FI "PID eq <PID>"
```

### 无法访问 Web UI

1. **确认服务正在运行**：

   - Linux: `systemctl --user status niu-code`
   - macOS: `launchctl list | grep niu-code`
   - Windows: `Get-Process -Name niu-code`

2. **检查端口监听**：

   ```bash
   # Linux/macOS
   curl http://127.0.0.1:33333

   # Windows
   Invoke-WebRequest -Uri http://127.0.0.1:33333
   ```

3. **尝试使用其他浏览器或清除缓存**

### 服务频繁重启

1. **查看日志获取错误信息**

2. **检查系统资源**：

   ```bash
   # Linux/macOS
   top

   # Windows
   Get-Process niu-code | Select-Object CPU,WS,PM
   ```

3. **验证 Claude Code CLI 配置是否正确**

### 更新后服务无法启动

如果更新后服务无法启动，可以恢复备份：

#### Linux/macOS

```bash
# 如果备份文件存在
if [ -f ~/.local/bin/niu-code.backup ]; then
    mv ~/.local/bin/niu-code.backup ~/.local/bin/niu-code
    systemctl --user restart niu-code  # Linux
    # launchctl load ~/Library/LaunchAgents/com.niu-code.plist  # macOS
fi
```

#### Windows

```powershell
# 恢复备份
if (Test-Path "$env:USERPROFILE\.local\bin\niu-code.exe.backup") {
    Move-Item "$env:USERPROFILE\.local\bin\niu-code.exe.backup" "$env:USERPROFILE\.local\bin\niu-code.exe" -Force
    Start-Process "$env:USERPROFILE\.local\bin\niu-code.exe" -WindowStyle Minimized
}
```

---

## 获取帮助

- GitHub Issues: https://github.com/liuzsen/niu-code/issues
- 项目文档: https://github.com/liuzsen/niu-code
