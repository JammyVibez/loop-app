#!/bin/bash
# Quick update — pull latest code, rebuild, restart
set -e

echo "🔄 Updating Loop App..."

cd /var/loop

echo "📦 Pulling latest code..."
git pull origin main

echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

echo "🔨 Building..."
npm run build

echo "🚀 Restarting..."
pm2 restart loop-app

echo "✅ Update complete!"
pm2 status loop-app
