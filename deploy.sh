#!/bin/bash
# Loop App — VPS Deployment Script
# Run this on your VPS after cloning the repo

set -e

echo "🚀 Loop App VPS Deployment"
echo "=========================="

# 1. Check Node.js version
echo ""
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js 20+ required. Current: $(node -v)"
  echo "   Run: nvm install 20 && nvm use 20"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# 2. Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

# 3. Check for .env.local
echo ""
if [ ! -f .env.local ]; then
  echo "⚠️  No .env.local found. Copying from .env.example..."
  cp .env.example .env.local
  echo "📝 Please edit .env.local with your actual credentials:"
  echo "   nano .env.local"
  echo ""
  echo "   Required keys:"
  echo "   - NEXT_PUBLIC_SUPABASE_URL"
  echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
  echo "   - SUPABASE_SERVICE_ROLE_KEY"
  echo "   - JWT_SECRET"
  echo "   - DATABASE_URL"
  echo ""
  echo "   Optional (for full features):"
  echo "   - CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET"
  echo "   - STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET"
  echo "   - RESEND_API_KEY"
  echo "   - NEXT_PUBLIC_GA_ID"
  exit 1
fi
echo "✅ .env.local exists"

# 4. Build the app
echo ""
echo "🔨 Building the app (this takes 1-2 minutes)..."
npm run build

# 5. Check if PM2 is installed
echo ""
if ! command -v pm2 &> /dev/null; then
  echo "📦 Installing PM2 process manager..."
  npm install -g pm2
fi
echo "✅ PM2 available"

# 6. Start with PM2
echo ""
echo "🚀 Starting app with PM2..."
pm2 delete loop-app 2>/dev/null || true
pm2 start npm --name "loop-app" -- start
pm2 save

# 7. Setup PM2 startup (auto-start on reboot)
echo ""
echo "🔄 Setting up auto-start on reboot..."
pm2 startup 2>/dev/null || echo "   Run 'pm2 startup' manually if needed"

# 8. Done
echo ""
echo "✅ Deployment complete!"
echo ""
echo "   App running at: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "   Useful commands:"
echo "   pm2 status          — Check app status"
echo "   pm2 logs loop-app   — View logs"
echo "   pm2 restart loop-app — Restart app"
echo "   pm2 stop loop-app    — Stop app"
echo ""
echo "   To update after code changes:"
echo "   git pull && npm install --legacy-peer-deps && npm run build && pm2 restart loop-app"
