#!/usr/bin/env bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_NAME="niu-code"
INSTALL_DIR="$HOME/.local/bin"
CONFIG_DIR="$HOME/.config/niu-code"
DATA_DIR="${CONFIG_DIR}"

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

uninstall_systemd() {
    if systemctl --user is-active --quiet ${APP_NAME}.service 2>/dev/null; then
        print_info "Stopping systemd service..."
        systemctl --user stop ${APP_NAME}.service
    fi

    if systemctl --user is-enabled --quiet ${APP_NAME}.service 2>/dev/null; then
        print_info "Disabling systemd service..."
        systemctl --user disable ${APP_NAME}.service
    fi

    local service_file="$HOME/.config/systemd/user/${APP_NAME}.service"
    if [ -f "$service_file" ]; then
        print_info "Removing service file: ${service_file}"
        rm "$service_file"
        systemctl --user daemon-reload
    fi
}

uninstall_launchd() {
    local plist_file="$HOME/Library/LaunchAgents/com.${APP_NAME}.plist"

    if launchctl list | grep -q "com.${APP_NAME}"; then
        print_info "Stopping launchd service..."
        launchctl unload "$plist_file" 2>/dev/null || true
    fi

    if [ -f "$plist_file" ]; then
        print_info "Removing service file: ${plist_file}"
        rm "$plist_file"
    fi
}

remove_binary() {
    local binary_path="${INSTALL_DIR}/${APP_NAME}"
    if [ -f "$binary_path" ]; then
        print_info "Removing binary: ${binary_path}"
        rm "$binary_path"
    fi
}

remove_data() {
    echo ""
    read -p "Do you want to remove configuration and data? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -d "$CONFIG_DIR" ]; then
            print_info "Removing configuration and data: ${CONFIG_DIR}"
            rm -rf "$CONFIG_DIR"
        fi
    else
        print_warning "Configuration and data preserved at: ${CONFIG_DIR}"
    fi
}

main() {
    echo "Niu Code Uninstaller"
    echo "==============================="
    echo ""

    detect_os
    print_info "Detected: $OS"
    echo ""

    if [ "$OS" = "linux" ]; then
        if command -v systemctl &> /dev/null; then
            uninstall_systemd
        fi
    elif [ "$OS" = "macos" ]; then
        uninstall_launchd
    fi

    remove_binary
    remove_data

    echo ""
    print_info "Uninstallation complete!"
    echo ""
}

main "$@"
