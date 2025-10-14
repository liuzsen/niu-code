# Niu Code Uninstaller for Windows
# Requires PowerShell 5.1 or higher and Administrator privileges

#Requires -Version 5.1

$ErrorActionPreference = "Stop"

# Constants
$AppName = "niu-code"
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

function Remove-NSSMService {
    $nssmExe = "$ConfigDir\nssm\nssm.exe"

    if (!(Test-Path $nssmExe)) {
        Write-Warning "NSSM not found, skipping service removal"
        return
    }

    # Check if service exists
    $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-Host "Stopping service..." -ForegroundColor Cyan
        & $nssmExe stop $ServiceName

        Write-Host "Removing service..." -ForegroundColor Cyan
        & $nssmExe remove $ServiceName confirm

        Write-Success "Service removed"
    } else {
        Write-Warning "Service not found"
    }
}

function Remove-Binary {
    if (Test-Path $BinaryPath) {
        Write-Host "Removing binary: $BinaryPath" -ForegroundColor Cyan
        Remove-Item $BinaryPath -Force
        Write-Success "Binary removed"
    }

    # Remove install directory if empty
    if (Test-Path $InstallDir) {
        $items = Get-ChildItem $InstallDir
        if ($items.Count -eq 0) {
            Remove-Item $InstallDir -Force
        }
    }
}

function Remove-FromPath {
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -like "*$InstallDir*") {
        $newPath = ($currentPath -split ';' | Where-Object { $_ -ne $InstallDir }) -join ';'
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        Write-Success "Removed from PATH"
    }
}

function Remove-ConfigData {
    Write-Host ""
    $response = Read-Host "Do you want to remove configuration and data? (y/n)"

    if ($response -eq 'y') {
        if (Test-Path $ConfigDir) {
            Write-Host "Removing configuration and data: $ConfigDir" -ForegroundColor Cyan
            Remove-Item $ConfigDir -Recurse -Force
            Write-Success "Configuration and data removed"
        }
    } else {
        Write-Warning "Configuration and data preserved at: $ConfigDir"
    }
}

function Main {
    Write-Host ""
    Write-Host "Niu Code Uninstaller for Windows" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""

    # Check administrator privileges
    if (!(Test-Administrator)) {
        Write-Warning "Administrator privileges required"
        Write-Host "Please run this script as Administrator" -ForegroundColor Yellow
        exit 1
    }

    Remove-NSSMService
    Write-Host ""

    Remove-Binary
    Write-Host ""

    Remove-FromPath

    Remove-ConfigData

    Write-Host ""
    Write-Success "Uninstallation complete!"
    Write-Host ""
}

# Run main function
Main
