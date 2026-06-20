#!/bin/bash

# 🚀 Vault Digital Lux - Fly.io Quick Setup Script
# This script automates the entire deployment process

set -e  # Exit on error

echo "🚀 Vault Digital Lux - Fly.io Setup"
echo "===================================="
echo ""

# Check if flyctl is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Fly.io CLI not found!"
    echo ""
    echo "Install it first:"
    echo "  Windows: winget install FlyIO.Flyctl"
    echo "  macOS/Linux: curl -L https://fly.io/install.sh | sh"
    echo ""
    exit 1
fi

echo "✅ Fly.io CLI found"
echo ""

# Step 1: Login
echo "📝 Step 1: Login to Fly.io"
echo "This will open your browser..."
fly auth login
echo "✅ Logged in successfully"
echo ""

# Step 2: Create App
echo "📦 Step 2: Creating Fly.io App..."
fly apps create vault-digital-lux || echo "⚠️  App might already exist, continuing..."
echo ""

# Step 3: Create PostgreSQL
echo "🗄️  Step 3: Creating PostgreSQL Database..."
echo "This will take a few minutes..."
fly postgres create \
  --name vault-db \
  --region eu-central-1 \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --volume-size 1
echo ""

# Step 4: Attach Database
echo "🔗 Step 4: Attaching Database to App..."
fly postgres attach --postgres-app vault-db --app vault-digital-lux
echo ""

# Step 5: Get Supabase Credentials
echo "🔑 Step 5: Setting up Environment Variables"
echo ""
echo "Please provide your Supabase Service Role Key:"
echo "(You can find it at: https://supabase.com/dashboard/project/jhvcuvblvtjncatmsczb/settings/api)"
read -p "Supabase Service Role Key: " SUPABASE_KEY

# Generate session secret
SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "fallback-secret-$(date +%s)")

# Set secrets
echo ""
echo "🔐 Setting environment secrets..."
fly secrets set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_KEY"
fly secrets set SESSION_SECRET="$SESSION_SECRET"
fly secrets set NODE_ENV="production"
echo ""

echo "⚠️  IMPORTANT: You need to set DATABASE_URL manually!"
echo "Run this command:"
echo "  fly secrets set DATABASE_URL=\"postgres://vault-db:PASSWORD@vault-db.internal:5432/vault_db\""
echo ""
echo "Replace PASSWORD with your actual database password."
echo "You can get it with: fly postgres connect -a vault-db"
echo ""

# Step 6: Install Dependencies
echo "📦 Step 6: Installing dependencies..."
npm install
echo ""

# Step 7: Deploy
echo "🚀 Step 7: Deploying to Fly.io..."
echo "This will take 3-5 minutes..."
fly deploy
echo ""

# Step 8: Open App
echo "✨ Deployment Complete!"
echo ""
echo "🌐 Opening your website..."
fly open
echo ""

echo "📊 Useful Commands:"
echo "  fly logs          - View application logs"
echo "  fly status        - Check app status"
echo "  fly ssh console   - SSH into server"
echo "  fly deploy        - Deploy updates"
echo ""

echo "📦 Next Steps:"
echo "  1. Import data from Supabase:"
echo "     node --env-file=.env scripts/import-to-fly.js"
echo ""
echo "  2. Setup daily backup (see DEPLOYMENT.md)"
echo ""
echo "  3. Add custom domain:"
echo "     fly certs add yourdomain.com"
echo ""

echo "🎉 Congratulations! Your app is live on Fly.io!"
