# 🚀 Vault Digital Lux - Fly.io Quick Setup Script (PowerShell)
# This script automates the entire deployment process for Windows

$ErrorActionPreference = "Stop"

Write-Host "🚀 Vault Digital Lux - Fly.io Setup" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if flyctl is installed
if (!(Get-Command fly -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Fly.io CLI not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install it:" -ForegroundColor Yellow
    Write-Host "  winget install FlyIO.Flyctl" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "✅ Fly.io CLI found" -ForegroundColor Green
Write-Host ""

# Step 1: Login
Write-Host "📝 Step 1: Login to Fly.io" -ForegroundColor Cyan
Write-Host "This will open your browser..." -ForegroundColor Gray
fly auth login
Write-Host "✅ Logged in successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Create App
Write-Host "📦 Step 2: Creating Fly.io App..." -ForegroundColor Cyan
fly apps create vault-digital-lux
Write-Host ""

# Step 3: Create PostgreSQL
Write-Host "🗄️  Step 3: Creating PostgreSQL Database..." -ForegroundColor Cyan
Write-Host "This will take a few minutes..." -ForegroundColor Gray
fly postgres create `
  --name vault-db `
  --region eu-central-1 `
  --initial-cluster-size 1 `
  --vm-size shared-cpu-1x `
  --volume-size 1
Write-Host ""

# Step 4: Attach Database
Write-Host "🔗 Step 4: Attaching Database to App..." -ForegroundColor Cyan
fly postgres attach --postgres-app vault-db --app vault-digital-lux
Write-Host ""

# Step 5: Get Supabase Credentials
Write-Host "🔑 Step 5: Setting up Environment Variables" -ForegroundColor Cyan
Write-Host ""
Write-Host "Please provide your Supabase Service Role Key:" -ForegroundColor Yellow
Write-Host "(You can find it at: https://supabase.com/dashboard/project/jhvcuvblvtjncatmsczb/settings/api)" -ForegroundColor Gray
$SUPABASE_KEY = Read-Host "Supabase Service Role Key"

# Generate session secret
$SESSION_SECRET = -join ((1..32) | ForEach-Object { "{0:x}" -f (Get-Random -Maximum 16) })

# Set secrets
Write-Host ""
Write-Host "🔐 Setting environment secrets..." -ForegroundColor Cyan
fly secrets set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_KEY"
fly secrets set SESSION_SECRET="$SESSION_SECRET"
fly secrets set NODE_ENV="production"
Write-Host ""

Write-Host "⚠️  IMPORTANT: You need to set DATABASE_URL manually!" -ForegroundColor Yellow
Write-Host "Run this command:" -ForegroundColor White
Write-Host "  fly secrets set DATABASE_URL=``"postgres://vault-db:PASSWORD@vault-db.internal:5432/vault_db``"" -ForegroundColor White
Write-Host ""
Write-Host "Replace PASSWORD with your actual database password." -ForegroundColor Yellow
Write-Host "You can get it with: fly postgres connect -a vault-db" -ForegroundColor Gray
Write-Host ""

# Step 6: Install Dependencies
Write-Host "📦 Step 6: Installing dependencies..." -ForegroundColor Cyan
npm install
Write-Host ""

# Step 7: Deploy
Write-Host "🚀 Step 7: Deploying to Fly.io..." -ForegroundColor Cyan
Write-Host "This will take 3-5 minutes..." -ForegroundColor Gray
fly deploy
Write-Host ""

# Step 8: Open App
Write-Host "✨ Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Opening your website..." -ForegroundColor Cyan
fly open
Write-Host ""

Write-Host "📊 Useful Commands:" -ForegroundColor Yellow
Write-Host "  fly logs          - View application logs" -ForegroundColor White
Write-Host "  fly status        - Check app status" -ForegroundColor White
Write-Host "  fly ssh console   - SSH into server" -ForegroundColor White
Write-Host "  fly deploy        - Deploy updates" -ForegroundColor White
Write-Host ""

Write-Host "📦 Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Import data from Supabase:" -ForegroundColor White
Write-Host "     node --env-file=.env scripts/import-to-fly.js" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Setup daily backup (see DEPLOYMENT.md)" -ForegroundColor White
Write-Host ""
Write-Host "  3. Add custom domain:" -ForegroundColor White
Write-Host "     fly certs add yourdomain.com" -ForegroundColor Gray
Write-Host ""

Write-Host "🎉 Congratulations! Your app is live on Fly.io!" -ForegroundColor Green
