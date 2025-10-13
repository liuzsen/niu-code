#!/usr/bin/env bash

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC}  $1"
}

echo "Building Niu Code"
echo "==========================="
echo ""

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Build frontend
print_info "Building frontend..."
cd "$PROJECT_ROOT/frontend"

if ! command -v pnpm &> /dev/null; then
    print_warning "pnpm not found, trying npm..."
    npm run build
else
    pnpm run build
fi

print_info "Frontend built successfully"
echo ""

# Build backend
print_info "Building backend..."
cd "$PROJECT_ROOT/backend"

# Check if we should build release or debug
BUILD_TYPE="${1:-release}"

if [ "$BUILD_TYPE" = "release" ]; then
    cargo build --release
    BINARY_PATH="$PROJECT_ROOT/backend/target/release/niu-code"
else
    cargo build
    BINARY_PATH="$PROJECT_ROOT/backend/target/debug/niu-code"
fi

print_info "Backend built successfully"
echo ""

# Show binary info
print_info "Binary location: $BINARY_PATH"
if [ -f "$BINARY_PATH" ]; then
    BINARY_SIZE=$(du -h "$BINARY_PATH" | cut -f1)
    print_info "Binary size: $BINARY_SIZE"
fi

echo ""
print_info "Build complete!"
echo ""
echo "To run the application:"
echo "  $BINARY_PATH"
echo ""
echo "Or use cargo run:"
echo "  cd $PROJECT_ROOT/backend && cargo run --release"
