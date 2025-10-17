# Niu Code Windows Uninstaller
# PowerShell 5.1+ required

#Requires -Version 5.1

# Stop on errors
$ErrorActionPreference = "Stop"

# Constants
$APP_NAME = "niu-code"
$INSTALL_DIR = Join-Path $env:USERPROFILE ".local\bin"
$CONFIG_DIR = Join-Path $env:USERPROFILE ".config\niu-code"
$BINARY_NAME = "$APP_NAME.exe"
$BINARY_PATH = Join-Path $INSTALL_DIR $BINARY_NAME
$TASK_NAME = "NiuCodeAutoStart"

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

function Remove-AutoStart {
    # Remove startup shortcut
    $startupFolder = [Environment]::GetFolderPath('Startup')
    $shortcutPath = Join-Path $startupFolder "$APP_NAME.lnk"

    if (Test-Path $shortcutPath) {
        Write-Info "Removing startup shortcut..."
        Remove-Item $shortcutPath -Force
        Write-Info "Startup shortcut removed"
    }

    # Also check for old scheduled task
    $task = Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue

    if ($task) {
        Write-Info "Removing old scheduled task..."
        Stop-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue | Out-Null
        Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false -ErrorAction SilentlyContinue
        Write-Info "Old scheduled task removed"
    }

    if (-not (Test-Path $shortcutPath) -and -not $task) {
        Write-Info "No auto-start configuration found"
    }
}

function Stop-Process {
    $process = Get-Process -Name $APP_NAME -ErrorAction SilentlyContinue

    if ($process) {
        Write-Info "Stopping running process..."
        Stop-Process -Name $APP_NAME -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Info "Process stopped"
    }
}

function Remove-Binary {
    if (Test-Path $BINARY_PATH) {
        Write-Info "Removing binary: $BINARY_PATH"
        Remove-Item $BINARY_PATH -Force
        Write-Info "Binary removed"
    } else {
        Write-Info "No binary found at $BINARY_PATH"
    }
}

function Remove-FromPath {
    # Check if install directory is in user PATH
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")

    if ($userPath -like "*$INSTALL_DIR*") {
        Write-Info "Removing $INSTALL_DIR from user PATH..."

        # Remove the directory from PATH
        $pathArray = $userPath -split ";" | Where-Object { $_ -ne $INSTALL_DIR -and $_ -ne "" }
        $newPath = $pathArray -join ";"

        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")

        Write-Info "PATH updated (restart terminal to take effect)"
    }
}

function Remove-Data {
    Write-Host ""

    if (Test-Path $CONFIG_DIR) {
        $response = Read-Host "Do you want to remove configuration and data? (y/n)"

        if ($response -match '^[Yy]') {
            Write-Info "Removing configuration and data: $CONFIG_DIR"
            Remove-Item $CONFIG_DIR -Recurse -Force
            Write-Info "Configuration and data removed"
        } else {
            Write-Warning "Configuration and data preserved at: $CONFIG_DIR"
        }
    } else {
        Write-Info "No configuration directory found"
    }
}

# Main Uninstallation Function
function Main {
    Write-Host "=================================="
    Write-Host "  Niu Code Windows Uninstaller"
    Write-Host "=================================="
    Write-Host ""

    # Stop and remove scheduled task
    Remove-AutoStart
    Write-Host ""

    # Stop any running process
    Stop-Process
    Write-Host ""

    # Remove binary
    Remove-Binary
    Write-Host ""

    # Remove from PATH
    Remove-FromPath
    Write-Host ""

    # Ask about removing data
    Remove-Data

    Write-Host ""
    Write-Info "Uninstallation complete!"
    Write-Host ""
}

# Run main function
try {
    Main
} catch {
    Write-Error "Uninstallation failed!"
    Write-Host "Error: $_"
    exit 1
}
