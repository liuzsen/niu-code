#!/usr/bin/env bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Constants
APP_NAME="niu-code"
GITHUB_REPO="liuzsen/niu-code"
INSTALL_DIR="$HOME/.local/bin"
CONFIG_DIR="$HOME/.config/niu-code"
DATA_DIR="${CONFIG_DIR}"
BINARY_PATH="${INSTALL_DIR}/${APP_NAME}"
BACKUP_PATH="${BINARY_PATH}.backup"

# Globals
IS_UPDATE=false
CURRENT_VERSION=""
LATEST_VERSION=""

# Functions
print_info() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC}  $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

detect_os() {
    case "$(uname -s)" in
        Linux*)     OS="linux";;
        Darwin*)    OS="macos";;
        *)          print_error "Unsupported operating system"; exit 1;;
    esac
}

detect_arch() {
    case "$(uname -m)" in
        x86_64|amd64)   ARCH="x64";;
        aarch64|arm64)  ARCH="arm64";;
        *)              print_error "Unsupported architecture: $(uname -m)"; exit 1;;
    esac
}

check_installed() {
    if [ -f "$BINARY_PATH" ]; then
        IS_UPDATE=true
        # Try to get version from binary (if it supports --version)
        if CURRENT_VERSION=$("$BINARY_PATH" --version 2>/dev/null | head -n1); then
            print_info "Current installation found: $CURRENT_VERSION"
        else
            print_info "Current installation found (version unknown)"
        fi
        return 0
    fi
}

get_latest_version() {
    print_info "Fetching latest version info..."

    if command -v curl &> /dev/null; then
        LATEST_VERSION=$(curl -s "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' || echo "")
    elif command -v wget &> /dev/null; then
        LATEST_VERSION=$(wget -qO- "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' || echo "")
    fi

    if [ -n "$LATEST_VERSION" ]; then
        print_info "Latest version: $LATEST_VERSION"
    else
        print_warning "Could not fetch latest version info"
    fi
}

confirm_update() {
    if [ "$IS_UPDATE" = true ]; then
        echo ""
        print_warning "An existing installation was detected."
        if [ -n "$CURRENT_VERSION" ] && [ -n "$LATEST_VERSION" ]; then
            echo "  Current: $CURRENT_VERSION"
            echo "  Latest:  $LATEST_VERSION"
        fi
        echo ""
        read -p "Do you want to update? (y/n) " -n 1 -r < /dev/tty
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Installation cancelled."
            exit 0
        fi
    fi
}

stop_service() {
    if [ "$IS_UPDATE" = false ]; then
        return 0
    fi

    print_info "Stopping existing service..."

    if [ "$OS" = "linux" ] && command -v systemctl &> /dev/null; then
        if systemctl --user is-active --quiet ${APP_NAME}.service 2>/dev/null; then
            systemctl --user stop ${APP_NAME}.service
            print_info "Systemd service stopped"
        fi
    elif [ "$OS" = "macos" ]; then
        local plist_file="$HOME/Library/LaunchAgents/com.${APP_NAME}.plist"
        if [ -f "$plist_file" ] && launchctl list | grep -q "com.${APP_NAME}"; then
            launchctl unload "$plist_file" 2>/dev/null || true
            print_info "Launchd service stopped"
        fi
    fi
}

backup_binary() {
    if [ "$IS_UPDATE" = true ] && [ -f "$BINARY_PATH" ]; then
        print_info "Backing up current binary..."
        cp "$BINARY_PATH" "$BACKUP_PATH"
        print_info "Backup created at $BACKUP_PATH"
    fi
}

restore_backup() {
    if [ -f "$BACKUP_PATH" ]; then
        print_warning "Restoring backup..."
        mv "$BACKUP_PATH" "$BINARY_PATH"
        print_info "Backup restored"
    fi
}

cleanup_backup() {
    if [ -f "$BACKUP_PATH" ]; then
        rm "$BACKUP_PATH"
    fi
}

check_dependencies() {
    print_info "Checking dependencies..."

    # Check for Node.js
    if ! command -v node &> /dev/null; then
        print_warning "Node.js not found. Please install Node.js first."
        echo "Visit: https://nodejs.org/"
        exit 1
    fi
    print_info "Node.js $(node --version) found"

    # Check for claude code CLI
    if ! command -v claude &> /dev/null; then
        print_warning "Claude Code CLI not found"
        echo "Please install it with:"
        echo "  npm install -g @anthropic-ai/claude-code"
        echo ""
        read -p "Do you want to continue anyway? (y/n) " -n 1 -r < /dev/tty
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        print_info "Claude Code CLI found"
    fi
}

download_binary() {
    print_info "Downloading $APP_NAME..."

    local binary_name="${APP_NAME}-${OS}-${ARCH}"
    if [ "$OS" = "macos" ] && [ "$ARCH" = "x64" ]; then
        binary_name="${APP_NAME}-macos-x64"
    elif [ "$OS" = "macos" ] && [ "$ARCH" = "arm64" ]; then
        binary_name="${APP_NAME}-macos-arm64"
    fi

    local download_url="https://github.com/${GITHUB_REPO}/releases/latest/download/${binary_name}"
    echo "Downloading ${download_url}"

    mkdir -p "$INSTALL_DIR"

    local download_success=false
    if command -v curl &> /dev/null; then
        if curl -fL "$download_url" -o "${BINARY_PATH}"; then
            download_success=true
        fi
    elif command -v wget &> /dev/null; then
        if wget -q "$download_url" -O "${BINARY_PATH}"; then
            download_success=true
        fi
    else
        print_error "curl or wget is required to download the binary"
        restore_backup
        exit 1
    fi

    if [ "$download_success" = false ]; then
        print_error "Failed to download binary from $download_url"
        restore_backup
        exit 1
    fi

    # Verify downloaded file is executable
    if [ ! -f "${BINARY_PATH}" ] || [ ! -s "${BINARY_PATH}" ]; then
        print_error "Downloaded file is invalid or empty"
        restore_backup
        exit 1
    fi

    chmod +x "${BINARY_PATH}"
    print_info "Binary downloaded to ${BINARY_PATH}"
}

setup_systemd_service() {
    local service_dir="$HOME/.config/systemd/user"
    local service_file="${service_dir}/${APP_NAME}.service"
    mkdir -p "$service_dir"

    local service_exists=false
    if [ -f "$service_file" ]; then
        service_exists=true
    fi

    print_info "Setting up systemd service..."

    # Capture current user's PATH to preserve tool locations
    local user_path="$PATH"

    cat > "$service_file" <<EOF
[Unit]
Description=Niu Code
Documentation=https://github.com/${GITHUB_REPO}
After=network.target

[Service]
Type=simple
ExecStart=${BINARY_PATH}
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment="PATH=${user_path}"

[Install]
WantedBy=default.target
EOF

    systemctl --user daemon-reload

    if [ "$service_exists" = true ]; then
        # Service exists - restart it
        if systemctl --user is-enabled --quiet ${APP_NAME}.service 2>/dev/null; then
            systemctl --user restart ${APP_NAME}.service
            print_info "Systemd service updated and restarted"
        else
            systemctl --user enable ${APP_NAME}.service
            systemctl --user start ${APP_NAME}.service
            print_info "Systemd service enabled and started"
        fi
    else
        # New installation
        systemctl --user enable ${APP_NAME}.service
        systemctl --user start ${APP_NAME}.service
        print_info "Systemd service installed and started"
    fi

    # Verify service started successfully
    sleep 2
    if ! systemctl --user is-active --quiet ${APP_NAME}.service; then
        print_error "Service failed to start. Check status with: systemctl --user status ${APP_NAME}"
        print_error "View logs with: journalctl --user -u ${APP_NAME} -f"
        exit 1
    fi

    print_info "Service commands:"
    echo "  Status:  systemctl --user status ${APP_NAME}"
    echo "  Stop:    systemctl --user stop ${APP_NAME}"
    echo "  Restart: systemctl --user restart ${APP_NAME}"
    echo "  Logs:    journalctl --user -u ${APP_NAME} -f"
}

setup_launchd_service() {
    local plist_dir="$HOME/Library/LaunchAgents"
    local plist_file="${plist_dir}/com.${APP_NAME}.plist"
    mkdir -p "$plist_dir"
    mkdir -p "${CONFIG_DIR}/logs"

    local service_loaded=false
    if launchctl list | grep -q "com.${APP_NAME}"; then
        service_loaded=true
        print_info "Unloading existing service..."
        launchctl unload "$plist_file" 2>/dev/null || true
    fi

    print_info "Setting up launchd service..."

    # Capture current user's PATH to preserve tool locations
    local user_path="$PATH"

    cat > "$plist_file" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.${APP_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${BINARY_PATH}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>StandardOutPath</key>
    <string>${CONFIG_DIR}/logs/${APP_NAME}.log</string>
    <key>StandardErrorPath</key>
    <string>${CONFIG_DIR}/logs/${APP_NAME}-error.log</string>
    <key>WorkingDirectory</key>
    <string>${HOME}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${user_path}</string>
    </dict>
</dict>
</plist>
EOF

    if launchctl load "$plist_file" 2>/dev/null; then
        if [ "$service_loaded" = true ]; then
            print_info "Launchd service updated and reloaded"
        else
            print_info "Launchd service installed and started"
        fi
    else
        print_error "Failed to load launchd service"
        exit 1
    fi

    # Verify service is running
    sleep 2
    if ! launchctl list | grep -q "com.${APP_NAME}"; then
        print_error "Service failed to start. Check logs at: ${CONFIG_DIR}/logs/${APP_NAME}-error.log"
        exit 1
    fi

    print_info "Service commands:"
    echo "  Status:  launchctl list | grep ${APP_NAME}"
    echo "  Stop:    launchctl unload ${plist_file}"
    echo "  Start:   launchctl load ${plist_file}"
    echo "  Logs:    tail -f ${CONFIG_DIR}/logs/${APP_NAME}.log"
}

create_directories() {
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$DATA_DIR"
}

main() {
    echo "Niu Code Installer"
    echo "=============================="
    echo ""

    detect_os
    detect_arch
    print_info "Detected: $OS $ARCH"
    echo ""

    # Check if already installed
    check_installed
    get_latest_version
    confirm_update
    echo ""

    check_dependencies
    echo ""

    # Stop running service before update
    stop_service

    # Backup current binary before replacing
    backup_binary

    create_directories
    download_binary
    echo ""

    # Setup or update service
    if [ "$OS" = "linux" ]; then
        if command -v systemctl &> /dev/null; then
            echo ""
            setup_systemd_service
        else
            print_warning "systemd not found. Service will not be installed."
            print_info "You can run the binary manually: ${BINARY_PATH}"
        fi
    elif [ "$OS" = "macos" ]; then
        echo ""
        setup_launchd_service
    fi

    # Clean up backup after successful installation
    cleanup_backup

    echo ""
    if [ "$IS_UPDATE" = true ]; then
        print_info "Update complete!"
    else
        print_info "Installation complete!"
    fi
    echo ""
    print_info "Access the web UI at: http://127.0.0.1:33333"
    echo ""
}

# Trap errors and restore backup if something goes wrong
trap 'if [ $? -ne 0 ]; then print_error "Installation failed!"; restore_backup; fi' EXIT

main "$@"

# If we reach here, installation succeeded
trap - EXIT
