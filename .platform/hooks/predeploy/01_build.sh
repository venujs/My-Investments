#!/bin/bash
set -e
cd /var/app/staging
npm install --include=dev
npm run build 2>&1
