# Niu Code Installer for Windows
# Requires PowerShell 5.1 or higher and Administrator privileges

#Requires -Version 5.1

param(
    [switch]$NoService
)

$ErrorActionPreference = "Stop"

# Constants
$AppName = "niu-code"
$GitHubRepo = "liuzsen/niu-code"
$InstallDir = "$env:LOCALAPPDATA\Programs\$AppName"
$ConfigDir = "$env:LOCALAPPDATA\$AppName"
$BinaryPath = "$InstallDir\$AppName.exe"
$ServiceName = "NiuCode"

# Functions
function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-Dependencies {
    Write-Host "Checking dependencies..." -ForegroundColor Cyan

    # Check for Node.js
    try {
        $nodeVersion = node --version
        Write-Success "Node.js $nodeVersion found"
    } catch {
        Write-Warning "Node.js not found. Please install Node.js first."
        Write-Host "Visit: https://nodejs.org/" -ForegroundColor Yellow
        exit 1
    }

    # Check for claude-code CLI
    try {
        $null = Get-Command claude-code -ErrorAction Stop
        Write-Success "Claude Code CLI found"
    } catch {
        Write-Warning "Claude Code CLI not found"
        Write-Host "Please install it with:" -ForegroundColor Yellow
        Write-Host "  npm install -g @anthropic-ai/claude-code" -ForegroundColor White
        Write-Host ""
        $continue = Read-Host "Do you want to continue anyway? (y/n)"
        if ($continue -ne 'y') {
            exit 1
        }
    }
}

function New-Directories {
    Write-Host "Creating directories..." -ForegroundColor Cyan

    # Create install directory for binary
    if (!(Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    # Create config directory for settings and data
    if (!(Test-Path $ConfigDir)) {
        New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    }

    # Create logs subdirectory
    $logsDir = "$ConfigDir\logs"
    if (!(Test-Path $logsDir)) {
        New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
    }

    Write-Success "Directories created"
}

function Download-Binary {
    Write-Host "Downloading $AppName..." -ForegroundColor Cyan

    $arch = "x64"  # Windows build is typically x64
    $binaryName = "$AppName-windows-$arch.exe"
    $downloadUrl = "https://github.com/$GitHubRepo/releases/latest/download/$binaryName"

    # Download binary
    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $BinaryPath -UseBasicParsing
        Write-Success "Binary downloaded to $BinaryPath"
    } catch {
        Write-Error "Failed to download binary: $_"
        exit 1
    }
}

function Install-NSSMService {
    Write-Host "Installing Windows service..." -ForegroundColor Cyan

    # Download NSSM if not exists
    $nssmDir = "$ConfigDir\nssm"
    $nssmExe = "$nssmDir\nssm.exe"

    if (!(Test-Path $nssmExe)) {
        Write-Host "Downloading NSSM..." -ForegroundColor Gray
        $nssmZip = "$env:TEMP\nssm.zip"
        $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"

        Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip -UseBasicParsing
        Expand-Archive -Path $nssmZip -DestinationPath $env:TEMP -Force

        # Copy appropriate version
        $arch = if ([Environment]::Is64BitOperatingSystem) { "win64" } else { "win32" }
        New-Item -ItemType Directory -Path $nssmDir -Force | Out-Null
        Copy-Item "$env:TEMP\nssm-2.24\$arch\nssm.exe" $nssmExe

        Remove-Item $nssmZip -Force
        Remove-Item "$env:TEMP\nssm-2.24" -Recurse -Force

        Write-Success "NSSM downloaded"
    }

    # Remove existing service if it exists
    $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-Host "Removing existing service..." -ForegroundColor Gray
        & $nssmExe stop $ServiceName
        & $nssmExe remove $ServiceName confirm
    }

    # Install service
    & $nssmExe install $ServiceName $BinaryPath
    & $nssmExe set $ServiceName Description "Niu Code - Web interface for Claude Code CLI"
    & $nssmExe set $ServiceName Start SERVICE_AUTO_START
    & $nssmExe set $ServiceName AppStdout "$ConfigDir\logs\$AppName.log"
    & $nssmExe set $ServiceName AppStderr "$ConfigDir\logs\$AppName-error.log"

    # Start service
    & $nssmExe start $ServiceName

    Write-Success "Windows service installed and started"
    Write-Host ""
    Write-Host "Service commands:" -ForegroundColor Cyan
    Write-Host "  Status:  sc query $ServiceName"
    Write-Host "  Stop:    sc stop $ServiceName"
    Write-Host "  Start:   sc start $ServiceName"
    Write-Host "  Remove:  $nssmExe remove $ServiceName confirm"
    Write-Host "  Logs:    Get-Content $ConfigDir\logs\$AppName.log -Tail 50 -Wait"
}

function Add-ToPath {
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -notlike "*$InstallDir*") {
        [Environment]::SetEnvironmentVariable(
            "Path",
            "$currentPath;$InstallDir",
            "User"
        )
        Write-Success "Added to PATH"
    }
}

function Main {
    Write-Host ""
    Write-Host "Niu Code Installer for Windows" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host ""

    # Check administrator privileges for service installation
    if (!$NoService -and !(Test-Administrator)) {
        Write-Warning "Administrator privileges required for service installation"
        Write-Host "Please run this script as Administrator, or use -NoService flag" -ForegroundColor Yellow
        exit 1
    }

    Test-Dependencies
    Write-Host ""

    New-Directories
    Write-Host ""

    Download-Binary
    Write-Host ""

    Add-ToPath

    if (!$NoService) {
        Install-NSSMService
    } else {
        Write-Warning "Service installation skipped"
        Write-Host "You can run the binary manually: $BinaryPath" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Success "Installation complete!"
    Write-Host ""
    Write-Success "Access the web UI at: http://127.0.0.1:33333"
    Write-Host ""

    if ($NoService) {
        Write-Host "To start manually, run: $BinaryPath" -ForegroundColor Yellow
    }
}

# Run main function
Main
