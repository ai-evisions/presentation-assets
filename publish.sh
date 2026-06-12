#!/usr/bin/env bash
# Publish a new version of the presentation assets.
# Usage: ./publish.sh v2   (rebuilds manifest URLs for that tag, commits, tags, pushes)
set -euo pipefail
VERSION="${1:?usage: ./publish.sh <version e.g. v2>}"

ASSET_VERSION="$VERSION" node build.mjs
git add -A
git commit -m "Publish presentation assets ${VERSION}"
git tag "$VERSION"
git push origin HEAD
git push origin "$VERSION"
echo "Published ${VERSION}. jsDelivr URLs: https://cdn.jsdelivr.net/gh/ai-evisions/presentation-assets@${VERSION}/optimized/<file>"
