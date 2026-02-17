#!/bin/bash
set -e
cd /var/app/staging
npm install --include=dev
rm -rf shared/dist server/dist client/dist
npm run build 1>&2
