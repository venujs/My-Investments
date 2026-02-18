#!/bin/bash
set -e
cd /var/app/staging
npm install --include=dev

# Delete dist dirs AND tsbuildinfo files so tsc -b always does a full rebuild.
# Without this, a stale tsbuildinfo left in staging from a previous failed deploy
# makes tsc -b a no-op (it thinks sources are unchanged) even after dist/ is gone.
rm -rf shared/dist server/dist client/dist
rm -f shared/tsconfig.tsbuildinfo client/tsconfig.tsbuildinfo client/tsconfig.node.tsbuildinfo

npm run build 1>&2

# After build, replace the workspace symlink node_modules/shared with a real
# directory copy. EB renames /var/app/staging → /var/app/current and the
# relative symlink (../shared) can fail to resolve at Node.js runtime, causing
# ERR_MODULE_NOT_FOUND for shared/dist/index.js on every startup.
echo "=== Materializing shared package in node_modules ===" >&2
if [ -d shared/dist ]; then
  rm -rf node_modules/shared
  mkdir -p node_modules/shared/dist
  cp shared/package.json node_modules/shared/
  cp -r shared/dist/. node_modules/shared/dist/
  echo "=== Materialization complete ===" >&2
  ls -la node_modules/shared/dist/ >&2
else
  echo "ERROR: shared/dist not found after build — tsc -b may have been skipped" >&2
  exit 1
fi
