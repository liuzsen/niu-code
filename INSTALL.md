# Installation Guide

This guide covers how to install and configure Niu Code on Linux, macOS, and Windows.

## Prerequisites

### Required

- **Node.js** v18 or higher ([Download](https://nodejs.org/))
- **Claude Code CLI**: Install with `npm install -g @anthropic-ai/claude-code`

### Verify Prerequisites

```bash
# Check Node.js version
node --version  # Should be v18.0.0 or higher

# Check if Claude Code CLI is installed
claude-code --version
```

## Quick Installation

### Linux / macOS

One-line installer (recommended):

```bash
curl -fsSL https://raw.githubusercontent.com/liuzsen/niu-code/main/scripts/install.sh | bash
```

Or download and run the script manually:

```bash
wget https://raw.githubusercontent.com/liuzsen/niu-code/main/scripts/install.sh
chmod +x install.sh
./install.sh
```

### Windows

One-line installer (PowerShell as Administrator):

```powershell
irm https://raw.githubusercontent.com/liuzsen/niu-code/main/scripts/install.ps1 | iex
```

Or download and run the script manually:

```powershell
# Download the script
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/liuzsen/niu-code/main/scripts/install.ps1" -OutFile "install.ps1"

# Run as Administrator
.\install.ps1
```

## Manual Installation

If you prefer to install manually:

### 1. Download Binary

Download the appropriate binary from the [latest release](https://github.com/liuzsen/niu-code/releases/latest):

- **Linux**: `niu-code-linux-x64`
- **macOS Intel**: `niu-code-macos-x64`
- **macOS Apple Silicon**: `niu-code-macos-arm64`
- **Windows**: `niu-code-windows-x64.exe`

### 2. Make Executable (Linux/macOS)

```bash
chmod +x niu-code-linux-x64
```

### 3. Move to System Path (Optional)

**Linux/macOS:**

```bash
sudo mv niu-code-linux-x64 /usr/local/bin/niu-code
```

**Windows:**
Move the exe to a directory in your PATH, or add its directory to PATH.

### 4. Run the Application

```bash
# Linux/macOS
./niu-code

# Windows
.\niu-code-windows-x64.exe
```

The application will start on `http://127.0.0.1:33333`

## Service Installation

To run Claude Web UI as a background service:

### Linux (systemd)

1. Create service file at `~/.config/systemd/user/niu-code.service`:

```ini
[Unit]
Description=Niu Code
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/niu-code
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
```

2. Enable and start the service:

```bash
systemctl --user daemon-reload
systemctl --user enable niu-code
systemctl --user start niu-code
```

3. Check status:

```bash
systemctl --user status niu-code
```

4. View logs:

```bash
journalctl --user -u niu-code -f
```

### macOS (launchd)

1. Create plist file at `~/Library/LaunchAgents/com.niu-code.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.niu-code</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/niu-code</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/YOUR_USERNAME/Library/Logs/niu-code.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/YOUR_USERNAME/Library/Logs/niu-code-error.log</string>
</dict>
</plist>
```

2. Load the service:

```bash
launchctl load ~/Library/LaunchAgents/com.niu-code.plist
```

3. Check status:

```bash
launchctl list | grep niu-code
```

4. View logs:

```bash
tail -f ~/Library/Logs/niu-code.log
```

### Windows Service

The installer script automatically sets up a Windows service using NSSM.

Manual service management:

```powershell
# Check status
sc query ClaudeWebUI

# Start service
sc start ClaudeWebUI

# Stop service
sc stop ClaudeWebUI

# View logs
Get-Content "$env:LOCALAPPDATA\niu-code\service.log" -Tail 50 -Wait
```

## Accessing the Application

Once installed and running, open your browser and navigate to:

```
http://127.0.0.1:33333
```

## Configuration

Configuration files are stored in:

- **Linux**: `~/.config/niu-code/`
- **macOS**: `~/Library/Application Support/niu-code/`
- **Windows**: `%LOCALAPPDATA%\niu-code\`

## Troubleshooting

### Claude Code CLI Not Found

If you see a warning about Claude Code CLI not being found:

1. Install it globally:

```bash
npm install -g @anthropic-ai/claude-code
```

2. Verify installation:

```bash
which claude-code  # Linux/macOS
where claude-code  # Windows
```

3. Make sure it's in your PATH

### Service Won't Start

**Linux/macOS:**

```bash
# Check logs
journalctl --user -u niu-code -n 50  # Linux
tail -f ~/Library/Logs/niu-code-error.log  # macOS

# Restart service
systemctl --user restart niu-code  # Linux
launchctl unload ~/Library/LaunchAgents/com.niu-code.plist && \
launchctl load ~/Library/LaunchAgents/com.niu-code.plist  # macOS
```

**Windows:**

```powershell
# Check event viewer
Get-EventLog -LogName Application -Source ClaudeWebUI -Newest 20

# Check service logs
Get-Content "$env:LOCALAPPDATA\niu-code\service-error.log"
```

### Port Already in Use

If port 33333 is already in use, you can:

1. Find what's using the port:

```bash
# Linux/macOS
lsof -i :33333

# Windows
netstat -ano | findstr :33333
```

2. Change the port (future feature - currently hardcoded to 33333)

### Permission Issues

**Linux/macOS:**

```bash
# Ensure binary is executable
chmod +x /usr/local/bin/niu-code

# Check file permissions
ls -l /usr/local/bin/niu-code
```

**Windows:**
Run PowerShell as Administrator for service installation.

## Uninstallation

### Linux (systemd)

```bash
# Stop and disable service
systemctl --user stop niu-code
systemctl --user disable niu-code

# Remove service file
rm ~/.config/systemd/user/niu-code.service

# Remove binary
sudo rm /usr/local/bin/niu-code

# Remove configuration (optional)
rm -rf ~/.config/niu-code
rm -rf ~/.local/share/niu-code
```

### macOS (launchd)

```bash
# Stop service
launchctl unload ~/Library/LaunchAgents/com.niu-code.plist

# Remove service file
rm ~/Library/LaunchAgents/com.niu-code.plist

# Remove binary
sudo rm /usr/local/bin/niu-code

# Remove configuration (optional)
rm -rf ~/Library/Application\ Support/niu-code
rm -rf ~/Library/Logs/niu-code*.log
```

### Windows

```powershell
# Stop and remove service (as Administrator)
sc stop ClaudeWebUI
sc delete ClaudeWebUI

# Or using NSSM
& "$env:LOCALAPPDATA\niu-code\nssm\nssm.exe" stop ClaudeWebUI
& "$env:LOCALAPPDATA\niu-code\nssm\nssm.exe" remove ClaudeWebUI confirm

# Remove installation directory
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\niu-code"
```

## Building from Source

If you want to build from source instead of using pre-built binaries:

### Prerequisites

- Rust 1.70 or higher
- Node.js 18 or higher
- pnpm 10.x

### Build Steps

```bash
# Clone repository
git clone https://github.com/liuzsen/niu-code.git
cd niu-code

# Build frontend
cd frontend
pnpm install
pnpm run build

# Build backend
cd ../backend
cargo build --release

# Binary will be at: backend/target/release/backend
```

## Support

For issues and questions:

- GitHub Issues: https://github.com/liuzsen/niu-code/issues
- Documentation: https://github.com/liuzsen/niu-code

## License

[Your License Here]
