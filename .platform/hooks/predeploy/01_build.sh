#!/bin/bash
set -e
cd /var/app/staging
npm install --include=dev
npm run build -w shared
echo "--- shared dist contents ---" 1>&2
ls -la /var/app/staging/shared/dist/ 1>&2 || echo "shared/dist NOT FOUND" 1>&2
npm run build -w client
npm run build -w server
