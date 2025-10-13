# Release Checklist

This document provides a checklist for preparing and publishing a release.

## Pre-Release Checklist

### 1. Code Preparation

- [x] Frontend build system configured (rust-embed)
- [x] Backend serves embedded static files
- [x] Claude CLI detection implemented
- [x] Startup checks and warnings added

### 2. Installation Scripts

- [x] Linux/macOS install script (`scripts/install.sh`)
- [x] Windows install script (`scripts/install.ps1`)
- [x] Uninstall script (`scripts/uninstall.sh`)
- [x] Build script (`scripts/build.sh`)
- [x] systemd service template
- [x] launchd service template

### 3. CI/CD Setup

- [x] GitHub Actions workflow (`.github/workflows/release.yml`)
- [x] Multi-platform build configuration:
  - Linux x64 (musl)
  - macOS x64
  - macOS ARM64
  - Windows x64

### 4. Documentation

- [x] README.md with installation instructions
- [x] INSTALL.md with detailed guides
- [x] RELEASE_CHECKLIST.md (this file)

## Before First Release

### Update Configuration Files

1. **Update GitHub repository URLs** in:

   - [ ] `scripts/install.sh` (line 11: `GITHUB_REPO`)
   - [ ] `scripts/install.ps1` (line 11: `$GitHubRepo`)
   - [ ] `README.md` (all GitHub URLs)
   - [ ] `INSTALL.md` (all GitHub URLs)
   - [ ] `.github/workflows/release.yml` (already uses `${{ github.repository }}`)

2. **Choose and add a license**:

   - [ ] Create `LICENSE` file
   - [ ] Update license references in README.md
   - [ ] Update license badge in README.md

3. **Update project metadata**:
   - [ ] Set project version in `backend/Cargo.toml`
   - [ ] Set project version in `frontend/package.json`
   - [ ] Add project description in both

### Testing

1. **Local build test**:

```bash
# Build frontend
cd frontend
pnpm run build

# Build backend with embedded frontend
cd ../backend
cargo build --release

# Test the binary
./target/release/backend
# Visit http://127.0.0.1:33333
```

2. **Test installation scripts** (in a VM or container):

   - [ ] Test `install.sh` on Linux
   - [ ] Test `install.sh` on macOS
   - [ ] Test `install.ps1` on Windows
   - [ ] Verify service starts correctly
   - [ ] Test uninstall script

3. **Verify prerequisites checks**:
   - [ ] Test without Node.js installed
   - [ ] Test without Claude CLI installed
   - [ ] Verify warning messages appear

### Repository Setup

1. **GitHub repository settings**:

   - [ ] Enable GitHub Actions
   - [ ] Configure branch protection (optional)
   - [ ] Add repository description
   - [ ] Add topics/tags (rust, vue, claude, ai, cli-wrapper, etc.)

2. **Create initial tag**:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This will trigger the GitHub Actions workflow to build and create a release.

## Release Process

### Creating a New Release

1. **Update version numbers**:

   - `backend/Cargo.toml`
   - `frontend/package.json`
   - Any hardcoded version strings

2. **Update CHANGELOG** (create if doesn't exist):

   - List new features
   - List bug fixes
   - List breaking changes

3. **Commit changes**:

```bash
git add .
git commit -m "chore: bump version to v1.x.x"
git push
```

4. **Create and push tag**:

```bash
git tag v1.x.x
git push origin v1.x.x
```

5. **Monitor GitHub Actions**:

   - Check workflow runs successfully
   - Verify all 4 platform builds complete
   - Check release is created with all assets

6. **Post-release verification**:
   - [ ] Download and test each binary
   - [ ] Verify checksums match
   - [ ] Test installation scripts with new release
   - [ ] Update documentation if needed

## Post-Release Tasks

1. **Announce the release**:

   - [ ] GitHub Discussions
   - [ ] Social media (if applicable)
   - [ ] Relevant communities

2. **Monitor for issues**:
   - [ ] Watch GitHub Issues
   - [ ] Be responsive to bug reports
   - [ ] Collect feedback for next release

## Common Issues and Solutions

### Build Failures

**Frontend build fails**:

- Check Node.js version in workflow matches local
- Verify pnpm lockfile is committed
- Check for dependency issues

**Backend build fails**:

- Verify `frontend/dist` exists before Rust build
- Check Rust toolchain version
- For cross-compilation issues, check `cross` tool version

**Binary too large**:

- Ensure `strip` is run on Linux/macOS
- Check if debug symbols are included
- Consider using UPX compression (optional)

### Installation Script Issues

**Service won't start**:

- Check binary has execute permissions
- Verify paths in service files are correct
- Check logs for actual error

**Claude CLI not found**:

- Ensure PATH includes npm global bin directory
- For systemd/launchd, set full PATH in service file

## Release Asset Checklist

Each release should include:

- [ ] `niu-code-linux-x64` (10-25MB)
- [ ] `niu-code-macos-x64` (10-25MB)
- [ ] `niu-code-macos-arm64` (10-25MB)
- [ ] `niu-code-windows-x64.exe` (15-30MB)
- [ ] `install.sh`
- [ ] `install.ps1`
- [ ] `checksums.txt`

## Future Improvements

Consider for future releases:

- [ ] Add auto-update functionality
- [ ] Create `.deb` and `.rpm` packages for Linux
- [ ] Create `.dmg` or `.pkg` for macOS
- [ ] Create `.msi` installer for Windows
- [ ] Add to package managers (Homebrew, Chocolatey, Scoop, AUR)
- [ ] Add telemetry/crash reporting (opt-in)
- [ ] Add configuration UI for server port
- [ ] Support running multiple instances
- [ ] Docker container support

## Support Channels

After release, direct users to:

- GitHub Issues: For bug reports
- GitHub Discussions: For questions and community support
- Documentation: README.md and INSTALL.md

---

Last updated: 2025-10-13
