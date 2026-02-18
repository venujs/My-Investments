#!/bin/bash
set -e
cd /var/app/staging
npm install --include=dev
rm -rf shared/dist server/dist client/dist
npm run build 1>&2

# After build, replace the workspace symlink node_modules/shared with a real
# directory copy. EB renames /var/app/staging → /var/app/current and the
# relative symlink (../shared) can fail to resolve at runtime on some Node
# versions. Using a real directory guarantees node_modules/shared/dist/index.js
# is always a real file regardless of how EB performs the swap.
echo "=== Materializing shared package in node_modules ===" >&2
ls -la shared/dist/ >&2
rm -rf node_modules/shared
mkdir -p node_modules/shared/dist
cp shared/package.json node_modules/shared/
cp -r shared/dist/. node_modules/shared/dist/
echo "=== node_modules/shared/dist after materialization ===" >&2
ls -la node_modules/shared/dist/ >&2
