# Niu Code Windows Installer
# PowerShell 5.1+ required

#Requires -Version 5.1

# Stop on errors
$ErrorActionPreference = "Stop"

# Constants
$APP_NAME = "niu-code"
$GITHUB_REPO = "liuzsen/niu-code"
$INSTALL_DIR = Join-Path $env:USERPROFILE ".local\bin"
$CONFIG_DIR = Join-Path $env:USERPROFILE ".config\niu-code"
$DATA_DIR = $CONFIG_DIR
$BINARY_NAME = "$APP_NAME.exe"
$BINARY_PATH = Join-Path $INSTALL_DIR $BINARY_NAME
$BACKUP_PATH = "$BINARY_PATH.backup"
$TASK_NAME = "NiuCodeAutoStart"

# Globals
$IS_UPDATE = $false
$CURRENT_VERSION = ""
$LATEST_VERSION = ""

# Helper Functions
function Write-Info {
    param([string]$Message)
    Write-Host "[" -NoNewline
    Write-Host "OK" -ForegroundColor Green -NoNewline
    Write-Host "] $Message"
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[" -NoNewline
    Write-Host "!!" -ForegroundColor Yellow -NoNewline
    Write-Host "] $Message"
}

function Write-Error {
    param([string]$Message)
    Write-Host "[" -NoNewline
    Write-Host "XX" -ForegroundColor Red -NoNewline
    Write-Host "] $Message"
}

function Detect-Arch {
    $arch = $env:PROCESSOR_ARCHITECTURE
    switch ($arch) {
        "AMD64" { return "x64" }
        "ARM64" { return "arm64" }
        default {
            Write-Error "Unsupported architecture: $arch"
            exit 1
        }
    }
}

function Check-Installed {
    if (Test-Path $BINARY_PATH) {
        $script:IS_UPDATE = $true

        # Try to get version from binary
        try {
            $versionOutput = & $BINARY_PATH --version 2>$null
            if ($versionOutput) {
                $script:CURRENT_VERSION = ($versionOutput -split "`n")[0]
                Write-Info "Current installation found: $CURRENT_VERSION"
            } else {
                Write-Info "Current installation found (version unknown)"
            }
        } catch {
            Write-Info "Current installation found (version unknown)"
        }
        return $true
    }
    return $false
}

function Get-LatestVersion {
    Write-Info "Fetching latest version info..."

    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$GITHUB_REPO/releases/latest" -ErrorAction Stop
        $script:LATEST_VERSION = $response.tag_name
        Write-Info "Latest version: $LATEST_VERSION"
    } catch {
        Write-Warning "Could not fetch latest version info"
    }
}

function Confirm-Update {
    if ($script:IS_UPDATE) {
        Write-Host ""
        Write-Warning "An existing installation was detected."
        if ($script:CURRENT_VERSION -and $script:LATEST_VERSION) {
            Write-Host "  Current: $CURRENT_VERSION"
            Write-Host "  Latest:  $LATEST_VERSION"
        }
        Write-Host ""

        $response = Read-Host "Do you want to update? (y/n)"
        if ($response -notmatch '^[Yy]') {
            Write-Host "Installation cancelled."
            exit 0
        }
    }
}

function Stop-Service {
    if (-not $script:IS_UPDATE) {
        return
    }

    Write-Info "Stopping existing service..."

    # Stop scheduled task if it exists
    $task = Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue
    if ($task) {
        Stop-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue | Out-Null
        Write-Info "Scheduled task stopped"
    }

    # Kill running process if exists
    $process = Get-Process -Name $APP_NAME -ErrorAction SilentlyContinue
    if ($process) {
        Stop-Process -Name $APP_NAME -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Info "Process stopped"
    }
}

function Backup-Binary {
    if ($script:IS_UPDATE -and (Test-Path $BINARY_PATH)) {
        Write-Info "Backing up current binary..."
        Copy-Item $BINARY_PATH $BACKUP_PATH -Force
        Write-Info "Backup created at $BACKUP_PATH"
    }
}

function Restore-Backup {
    if (Test-Path $BACKUP_PATH) {
        Write-Warning "Restoring backup..."
        Move-Item $BACKUP_PATH $BINARY_PATH -Force
        Write-Info "Backup restored"
    }
}

function Cleanup-Backup {
    if (Test-Path $BACKUP_PATH) {
        Remove-Item $BACKUP_PATH -Force
    }
}

function Check-Dependencies {
    Write-Info "Checking dependencies..."

    $dependenciesOk = $true

    # Check for Node.js (non-blocking)
    try {
        $nodeVersion = & node --version 2>$null
        if ($nodeVersion) {
            Write-Info "Node.js $nodeVersion found"
        } else {
            throw
        }
    } catch {
        Write-Warning "Node.js not found"
        Write-Host "  The application requires Node.js to function properly."
        Write-Host "  Please install Node.js from: https://nodejs.org/"
        Write-Host ""
        $dependenciesOk = $false
    }

    # Check for Claude Code CLI (non-blocking)
    try {
        $claudeCheck = & claude --version 2>$null
        if ($claudeCheck) {
            Write-Info "Claude Code CLI found"
        } else {
            throw
        }
    } catch {
        Write-Warning "Claude Code CLI not found"
        Write-Host "  The application requires Claude Code CLI to function properly."
        Write-Host "  You can install it with:"
        Write-Host "    npm install -g @anthropic-ai/claude-code"
        Write-Host ""
        $dependenciesOk = $false
    }

    if (-not $dependenciesOk) {
        Write-Warning "Missing dependencies detected, but installation will continue."
        Write-Host "  You can install these dependencies later before running the application."
        Write-Host ""

        $response = Read-Host "Press Enter to continue or Ctrl+C to cancel"
    }
}

function Download-Binary {
    param([string]$Arch)

    Write-Info "Downloading $APP_NAME..."

    $binaryName = "$APP_NAME-windows-$Arch.exe"
    $downloadUrl = "https://github.com/$GITHUB_REPO/releases/latest/download/$binaryName"

    Write-Host "Downloading from: $downloadUrl"

    # Create install directory
    if (-not (Test-Path $INSTALL_DIR)) {
        New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
    }

    try {
        # Download with progress
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $downloadUrl -OutFile $BINARY_PATH -ErrorAction Stop
        $ProgressPreference = 'Continue'

        # Verify downloaded file
        if (-not (Test-Path $BINARY_PATH) -or (Get-Item $BINARY_PATH).Length -eq 0) {
            throw "Downloaded file is invalid or empty"
        }

        Write-Info "Binary downloaded to $BINARY_PATH"
    } catch {
        Write-Error "Failed to download binary from $downloadUrl"
        Write-Host "Error: $_"
        Restore-Backup
        exit 1
    }
}

function Add-ToPath {
    # Check if install directory is already in user PATH
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")

    if ($userPath -notlike "*$INSTALL_DIR*") {
        Write-Info "Adding $INSTALL_DIR to user PATH..."

        $newPath = if ($userPath) { "$userPath;$INSTALL_DIR" } else { $INSTALL_DIR }
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")

        # Update current session PATH
        $env:Path = "$env:Path;$INSTALL_DIR"

        Write-Info "PATH updated (restart terminal to take effect)"
    } else {
        Write-Info "Installation directory already in PATH"
    }
}

function Setup-AutoStart {
    Write-Info "Setting up auto-start..."

    # Use Windows Startup folder (no admin privileges required)
    $startupFolder = [Environment]::GetFolderPath('Startup')
    $shortcutPath = Join-Path $startupFolder "$APP_NAME.lnk"

    try {
        # Remove old scheduled task if exists
        $existingTask = Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue
        if ($existingTask) {
            Write-Info "Removing old scheduled task..."
            Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false -ErrorAction SilentlyContinue
        }

        # Create shortcut in Startup folder
        $WshShell = New-Object -ComObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut($shortcutPath)
        $Shortcut.TargetPath = $BINARY_PATH
        $Shortcut.WorkingDirectory = Split-Path $BINARY_PATH
        $Shortcut.Description = "Niu Code Web Service"
        $Shortcut.WindowStyle = 7  # Minimized
        $Shortcut.Save()

        Write-Info "Auto-start configured (Startup folder)"

        # Try to start the service now
        Write-Info "Starting service..."
        Start-Process -FilePath $BINARY_PATH -WindowStyle Minimized -ErrorAction SilentlyContinue

        Start-Sleep -Seconds 2

        # Check if process is running
        $process = Get-Process -Name $APP_NAME -ErrorAction SilentlyContinue
        if ($process) {
            Write-Info "Service started successfully"
        } else {
            Write-Warning "Service may not have started. You can start it manually."
        }

        Write-Info "Service will auto-start at user logon"
        Write-Host ""
        Write-Info "Service commands:"
        Write-Host "  Start:  Start-Process '$BINARY_PATH'"
        Write-Host "  Stop:   Stop-Process -Name $APP_NAME"
        Write-Host "  Remove auto-start: Remove-Item '$shortcutPath'"

    } catch {
        Write-Error "Failed to set up auto-start"
        Write-Host "Error: $_"
        Write-Warning "You can run the binary manually: $BINARY_PATH"
    }
}

function Create-Directories {
    if (-not (Test-Path $CONFIG_DIR)) {
        New-Item -ItemType Directory -Path $CONFIG_DIR -Force | Out-Null
    }
    if (-not (Test-Path $DATA_DIR)) {
        New-Item -ItemType Directory -Path $DATA_DIR -Force | Out-Null
    }
}

# Main Installation Function
function Main {
    Write-Host "================================"
    Write-Host "    Niu Code Windows Installer"
    Write-Host "================================"
    Write-Host ""

    $arch = Detect-Arch
    Write-Info "Detected: Windows $arch"
    Write-Host ""

    # Check if already installed
    Check-Installed
    Get-LatestVersion
    Confirm-Update
    Write-Host ""

    # Check dependencies (non-blocking)
    Check-Dependencies
    Write-Host ""

    # Stop running service before update
    Stop-Service

    # Backup current binary before replacing
    Backup-Binary

    # Create directories
    Create-Directories

    # Download and install
    Download-Binary -Arch $arch
    Write-Host ""

    # Add to PATH
    Add-ToPath
    Write-Host ""

    # Setup scheduled task
    Setup-AutoStart

    # Clean up backup after successful installation
    Cleanup-Backup

    Write-Host ""
    if ($script:IS_UPDATE) {
        Write-Info "Update complete!"
    } else {
        Write-Info "Installation complete!"
    }
    Write-Host ""
    Write-Info "Access the web UI at: http://127.0.0.1:33333"
    Write-Host ""
    Write-Host "Note: If you installed Node.js or Claude CLI during this installation,"
    Write-Host "      you may need to restart the service:"
    Write-Host "      Stop-ScheduledTask -TaskName $TASK_NAME"
    Write-Host "      Start-ScheduledTask -TaskName $TASK_NAME"
    Write-Host ""
}

# Error handling wrapper
try {
    Main
} catch {
    Write-Error "Installation failed!"
    Write-Host "Error: $_"
    Restore-Backup
    exit 1
}
