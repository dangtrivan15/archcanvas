#!/usr/bin/env bash
set -euo pipefail

# ─── ArchCanvas Release Script ─────────────────────────────────────────
# Builds both architectures, signs updater bundles, and publishes to
# GitHub Releases. Usable both locally and from CI.
#
# Usage: ./scripts/release.sh [--dry-run] <patch|minor|major>
# ────────────────────────────────────────────────────────────────────────

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  shift
fi

BUMP_TYPE="${1:?Usage: ./scripts/release.sh [--dry-run] <patch|minor|major>}"

# ─── Validate bump type ────────────────────────────────────────────────
case "$BUMP_TYPE" in
  patch|minor|major) ;;
  *) echo "Error: bump type must be patch, minor, or major"; exit 1 ;;
esac

# ─── Validate prerequisites ────────────────────────────────────────────
SIGNING_KEY_PATH="$HOME/.archcanvas/updater-private-key"
REQUIRED_CMDS=(rustc bun node npm gh npx)

for cmd in "${REQUIRED_CMDS[@]}"; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: $cmd not found on PATH"
    exit 1
  fi
done

if [[ ! -f "$SIGNING_KEY_PATH" ]]; then
  echo "Error: signing key not found at $SIGNING_KEY_PATH"
  echo "Generate one with: npx tauri signer generate -w $SIGNING_KEY_PATH"
  exit 1
fi

for target in aarch64-apple-darwin x86_64-apple-darwin; do
  if ! rustup target list --installed | grep -q "$target"; then
    echo "Error: Rust target $target not installed. Run: rustup target add $target"
    exit 1
  fi
done

# ─── Calculate version ─────────────────────────────────────────────────
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
CURRENT="${LATEST_TAG#v}"
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP_TYPE" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac

VERSION="${MAJOR}.${MINOR}.${PATCH}"
TAG="v${VERSION}"
echo "Bumping $BUMP_TYPE: $CURRENT → $VERSION"

# ─── Sync versions in config files ─────────────────────────────────────
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '$VERSION';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
node -e "
  const fs = require('fs');
  const conf = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
  conf.version = '$VERSION';
  fs.writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2) + '\n');
"
sed -i '' "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
echo "Synced version to $VERSION in package.json, tauri.conf.json, and Cargo.toml"

# ─── Build frontend (shared) ───────────────────────────────────────────
echo "Building frontend..."
npm run build

# ─── Build per-architecture ─────────────────────────────────────────────
export TAURI_SIGNING_PRIVATE_KEY TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
TAURI_SIGNING_PRIVATE_KEY=$(cat "$SIGNING_KEY_PATH")

TARGETS=(aarch64-apple-darwin x86_64-apple-darwin)
BUN_TARGETS=(bun-darwin-arm64 bun-darwin-x64)
ARTIFACT_PREFIXES=(ArchCanvas-aarch64 ArchCanvas-x64)

RELEASE_DIR="release"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

for i in 0 1; do
  RUST_TARGET="${TARGETS[$i]}"
  BUN_TARGET="${BUN_TARGETS[$i]}"
  PREFIX="${ARTIFACT_PREFIXES[$i]}"

  echo ""
  echo "═══ Building for $RUST_TARGET ═══"

  # Build sidecar
  echo "Building sidecar ($BUN_TARGET)..."
  bun build --compile --target="$BUN_TARGET" src-web/bridge/index.ts \
    --outfile "src-tauri/binaries/archcanvas-bridge-${RUST_TARGET}"

  # Build Tauri app (frontend already built — disable beforeBuildCommand)
  echo "Building Tauri app..."
  npx tauri build --target "$RUST_TARGET" --bundles dmg,app \
    --config '{"build":{"beforeBuildCommand":""}}'

  # Collect artifacts
  DMG_DIR="src-tauri/target/${RUST_TARGET}/release/bundle/dmg"
  MACOS_DIR="src-tauri/target/${RUST_TARGET}/release/bundle/macos"

  cp "$DMG_DIR"/*.dmg "$RELEASE_DIR/${PREFIX}.dmg"
  cp "$MACOS_DIR"/*.app.tar.gz "$RELEASE_DIR/${PREFIX}.app.tar.gz"
  cp "$MACOS_DIR"/*.app.tar.gz.sig "$RELEASE_DIR/${PREFIX}.app.tar.gz.sig"

  echo "Artifacts collected: ${PREFIX}.dmg, ${PREFIX}.app.tar.gz, ${PREFIX}.app.tar.gz.sig"
done

# ─── Commit version bump ─────────────────────────────────────────────
# Committed after build so Cargo.lock (updated by cargo build) is included.
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
if ! git diff --cached --quiet; then
  git commit -m "chore: bump version to $VERSION"
else
  echo "Version already at $VERSION, skipping commit"
fi

# ─── Generate latest.json ──────────────────────────────────────────────
echo ""
echo "Generating latest.json..."

SIG_AARCH64=$(cat "$RELEASE_DIR/ArchCanvas-aarch64.app.tar.gz.sig")
SIG_X64=$(cat "$RELEASE_DIR/ArchCanvas-x64.app.tar.gz.sig")
PUB_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > "$RELEASE_DIR/latest.json" <<MANIFEST
{
  "version": "${VERSION}",
  "notes": "ArchCanvas v${VERSION}",
  "pub_date": "${PUB_DATE}",
  "platforms": {
    "darwin-aarch64": {
      "url": "https://github.com/dangtrivan15/archcanvas/releases/download/${TAG}/${ARTIFACT_PREFIXES[0]}.app.tar.gz",
      "signature": "${SIG_AARCH64}"
    },
    "darwin-x86_64": {
      "url": "https://github.com/dangtrivan15/archcanvas/releases/download/${TAG}/${ARTIFACT_PREFIXES[1]}.app.tar.gz",
      "signature": "${SIG_X64}"
    }
  }
}
MANIFEST

echo "latest.json generated"

# ─── Publish ────────────────────────────────────────────────────────────
if $DRY_RUN; then
  echo ""
  echo "═══ DRY RUN — skipping publish ═══"
  echo "Would create tag: $TAG"
  echo "Would upload:"
  ls -lh "$RELEASE_DIR"
  echo ""
  echo "latest.json contents:"
  cat "$RELEASE_DIR/latest.json"
  exit 0
fi

echo ""
echo "═══ Publishing $TAG ═══"

git push origin HEAD
git tag "$TAG"
git push origin "$TAG"

gh release create "$TAG" \
  --title "ArchCanvas $VERSION" \
  --generate-notes \
  "$RELEASE_DIR/ArchCanvas-aarch64.dmg" \
  "$RELEASE_DIR/ArchCanvas-x64.dmg" \
  "$RELEASE_DIR/ArchCanvas-aarch64.app.tar.gz" \
  "$RELEASE_DIR/ArchCanvas-x64.app.tar.gz" \
  "$RELEASE_DIR/ArchCanvas-aarch64.app.tar.gz.sig" \
  "$RELEASE_DIR/ArchCanvas-x64.app.tar.gz.sig" \
  "$RELEASE_DIR/latest.json"

echo ""
echo "Release $TAG published successfully!"
echo "https://github.com/dangtrivan15/archcanvas/releases/tag/$TAG"
