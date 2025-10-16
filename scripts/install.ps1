# Niu Code Installer for Windows
# Requires PowerShell 5.1 or higher
# No Administrator privileges required - installs as user-level scheduled task

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
$TaskName = "NiuCode"

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

function Test-TaskExists {
    $task = schtasks /query /tn $TaskName 2>&1 | Out-Null
    return $LASTEXITCODE -eq 0
}

function Test-Dependencies {
    Write-Host "Checking dependencies..." -ForegroundColor Cyan

    # Check for Node.js (optional)
    try {
        $nodeVersion = node --version
        Write-Success "Node.js $nodeVersion found"
    } catch {
        Write-Warning "Node.js not found (optional - not required for basic functionality)"
    }

    # Check for claude-code CLI (optional)
    try {
        $null = Get-Command claude-code -ErrorAction Stop
        Write-Success "Claude Code CLI found"
    } catch {
        Write-Warning "Claude Code CLI not found (optional - not required for basic functionality)"
    }

    Write-Host ""
    Write-Host "Note: This application can run without Node.js or Claude Code CLI." -ForegroundColor Cyan
    Write-Host "The backend provides all core functionality independently." -ForegroundColor Cyan
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

function Install-ScheduledTask {
    Write-Host "Installing scheduled task..." -ForegroundColor Cyan

    # Remove existing task if it exists
    if (Test-TaskExists) {
        Write-Host "Removing existing task..." -ForegroundColor Gray
        schtasks /delete /tn $TaskName /f | Out-Null
    }

    # Create wrapper script for logging and auto-restart
    $wrapperScript = "$ConfigDir\start-service.ps1"
    $wrapperContent = @"
# Auto-generated wrapper script for $AppName
# This script runs continuously and automatically restarts the service if it exits
`$logFile = "$ConfigDir/logs/$AppName.log"
`$errorLogFile = "$ConfigDir/logs/$AppName-error.log"

# Ensure log directory exists
`$null = New-Item -ItemType Directory -Path "$ConfigDir/logs" -Force -ErrorAction SilentlyContinue

# Infinite restart loop
while (`$true) {
    try {
        `$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        "`$timestamp - Starting $AppName..." | Out-File -FilePath `$logFile -Append

        `$process = Start-Process -FilePath "$BinaryPath" ``
            -RedirectStandardOutput `$logFile ``
            -RedirectStandardError `$errorLogFile ``
            -NoNewWindow ``
            -PassThru

        # Wait for process to exit
        `$process.WaitForExit()

        `$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        `$exitCode = `$process.ExitCode
        "`$timestamp - $AppName exited with code `$exitCode. Restarting in 10 seconds..." | Out-File -FilePath `$logFile -Append

        # Wait before restarting
        Start-Sleep -Seconds 10
    } catch {
        `$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        "`$timestamp - Error starting $AppName : `$_" | Out-File -FilePath `$errorLogFile -Append
        Start-Sleep -Seconds 10
    }
}
"@
    $wrapperContent | Out-File -FilePath $wrapperScript -Encoding UTF8 -Force

    # Create scheduled task XML configuration
    $taskXml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Niu Code - Web interface for Claude Code CLI</Description>
    <URI>\$TaskName</URI>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>$env:USERDOMAIN\$env:USERNAME</UserId>
    </LogonTrigger>
    <BootTrigger>
      <Enabled>true</Enabled>
    </BootTrigger>
  </Triggers>
  <Principals>
    <Principal>
      <UserId>$env:USERDOMAIN\$env:USERNAME</UserId>
      <LogonType>S4U</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>999</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>powershell.exe</Command>
      <Arguments>-ExecutionPolicy Bypass -WindowStyle Hidden -File "$wrapperScript"</Arguments>
      <WorkingDirectory>$env:USERPROFILE</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

    # Save XML to temp file
    $xmlFile = "$env:TEMP\$AppName-task.xml"
    $taskXml | Out-File -FilePath $xmlFile -Encoding Unicode -Force

    # Create the scheduled task
    $result = schtasks /create /tn $TaskName /xml $xmlFile /f 2>&1
    Remove-Item $xmlFile -Force

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create scheduled task: $result"
        exit 1
    }

    # Start the task immediately
    schtasks /run /tn $TaskName | Out-Null
    Start-Sleep -Seconds 2

    # Verify task is running
    $taskInfo = schtasks /query /tn $TaskName /fo LIST /v 2>&1 | Out-String
    if ($taskInfo -match "Status:\s+Running") {
        Write-Success "Scheduled task installed and started"
    } else {
        Write-Warning "Task created but may not be running. Check logs for details."
    }

    Write-Host ""
    Write-Host "Service commands:" -ForegroundColor Cyan
    Write-Host "  Status:  schtasks /query /tn $TaskName"
    Write-Host "  Stop:    schtasks /end /tn $TaskName"
    Write-Host "  Start:   schtasks /run /tn $TaskName"
    Write-Host "  Remove:  schtasks /delete /tn $TaskName /f"
    Write-Host "  Logs:    Get-Content $ConfigDir/logs/$AppName.log -Tail 50 -Wait"
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

    Test-Dependencies
    Write-Host ""

    New-Directories
    Write-Host ""

    Download-Binary
    Write-Host ""

    Add-ToPath

    if (!$NoService) {
        Write-Host ""
        Install-ScheduledTask
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
