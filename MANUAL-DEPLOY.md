# 📝 Manual Deployment Guide - Fly.io

If the automated script doesn't work, follow these manual steps.

---

## Prerequisites

1. ✅ Fly CLI installed (see [INSTALL-FLY-CLI.md](INSTALL-FLY-CLI.md))
2. ✅ Fly.io account (https://fly.io/signup)
3. ✅ Supabase Service Role Key (from your Supabase dashboard)

---

## Step-by-Step Manual Deployment

### Step 1: Login to Fly.io

```powershell
fly auth login
```

This will open your browser. Click "Login" or "Sign Up".

---

### Step 2: Create Application

```powershell
cd "d:\amine codes\Vault_ Digital Lux"
fly apps create vault-digital-lux
```

If it says "app already exists", that's fine - continue to next step.

---

### Step 3: Create PostgreSQL Database

```powershell
fly postgres create `
  --name vault-db `
  --region eu-central-1 `
  --initial-cluster-size 1 `
  --vm-size shared-cpu-1x `
  --volume-size 1
```

⏳ **This will take 2-3 minutes.** Wait for it to complete.

---

### Step 4: Attach Database to App

```powershell
fly postgres attach --postgres-app vault-db --app vault-digital-lux
```

This will automatically set the `DATABASE_URL` secret for you!

---

### Step 5: Set Environment Variables

Get your **Supabase Service Role Key**:
1. Go to: https://supabase.com/dashboard/project/jhvcuvblvtjncatmsczb/settings/api
2. Copy the **service_role** key (NOT the anon key!)

Now set the secrets:

```powershell
# Set Supabase key (replace YOUR_KEY_HERE)
fly secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"

# Set session secret (auto-generated)
fly secrets set SESSION_SECRET="random-secret-$(Get-Random)"

# Set environment
fly secrets set NODE_ENV="production"
```

---

### Step 6: Install Dependencies

```powershell
npm install
```

---

### Step 7: Deploy Application

```powershell
fly deploy
```

⏳ **This will take 3-5 minutes.** It will:
- Build Docker image
- Push to Fly registry
- Start the application
- Run health checks

---

### Step 8: Verify Deployment

```powershell
# Check status
fly status

# View logs
fly logs

# Open website
fly open
```

Your app should now be live at: `https://vault-digital-lux.fly.dev`

---

### Step 9: Import Data from Supabase

Your Fly database is empty. Let's import your existing data:

```powershell
# Run import script
node --env-file=.env scripts/import-to-fly.js
```

This will migrate:
- ✅ 439 products
- ✅ 182 reviews
- ✅ All categories, orders, etc.

---

### Step 10: Setup Daily Backup

See: [Setup GitHub Actions Backup](#setup-github-actions-backup)

---

## Setup GitHub Actions Backup

### 1. Push Code to GitHub

```powershell
git init
git add .
git commit -m "Initial commit"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Add Repository Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `FLY_DATABASE_URL` | Get with: `fly postgres connect -a vault-db` |
| `VITE_SUPABASE_URL` | `https://jhvcuvblvtjncatmsczb.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |

**To get FLY_DATABASE_URL:**
```powershell
fly secrets list
```

Look for `DATABASE_URL` and copy its value.

### 3. Backup Will Run Automatically

- 🕐 Daily at 2:00 AM UTC
- 🔄 Or manually: Go to Actions → "Daily Backup to Supabase" → "Run workflow"

---

## Troubleshooting

### Deployment Fails

**Check logs:**
```powershell
fly logs
```

**Common issues:**
- Missing environment variables → `fly secrets list`
- Build errors → Check `npm run build` locally
- Database connection → Verify `DATABASE_URL` is set

### Database Connection Error

```powershell
# Check if DATABASE_URL is set
fly secrets list

# If missing, set it manually:
fly secrets set DATABASE_URL="postgres://vault-db:PASSWORD@vault-db.internal:5432/vault_db"
```

Get your password from:
```powershell
fly postgres connect -a vault-db
```

### App Not Accessible

```powershell
# Check app status
fly status

# Check if machines are running
fly machines list

# Restart app
fly restart
```

### Import Script Fails

```powershell
# Check if .env has Supabase credentials
cat .env

# Make sure Supabase is accessible
# Check: https://supabase.com/dashboard/project/jhvcuvblvtjncatmsczb
```

---

## Post-Deployment Checklist

- [ ] App is live: `https://vault-digital-lux.fly.dev`
- [ ] Database has data (imported from Supabase)
- [ ] Daily backup is configured (GitHub Actions)
- [ ] Logs are clean: `fly logs`
- [ ] Health check passes: `fly status`

---

## Useful Commands

```powershell
# View real-time logs
fly logs

# Check app status
fly status

# SSH into server
fly ssh console

# Connect to database
fly postgres connect -a vault-db

# Deploy updates
fly deploy

# Scale resources
fly scale memory 1024
fly scale vm shared-cpu-2x

# Add custom domain
fly certs add yourdomain.com

# View dashboard
fly dashboard
```

---

## Cost Monitoring

```powershell
# View current costs
fly dashboard

# Estimate costs
# App: ~$5-10/month
# Database: ~$10-15/month
# Total: ~$15-25/month
```

---

## Emergency Procedures

### If Fly Database Fails

1. **Don't panic!** Data is backed up to Supabase daily
2. **Import from Supabase:**
   ```powershell
   node --env-file=.env scripts/import-to-fly.js
   ```

### If App Goes Down

```powershell
# Restart app
fly restart

# Check logs for errors
fly logs --since 1h

# Scale up if needed
fly scale memory 1024
```

### Rollback to Previous Deployment

```powershell
# List deployments
fly releases

# Rollback to previous version
fly releases rollback
```

---

## Next Steps

1. ✅ Deploy application
2. ✅ Import data
3. ✅ Setup backups
4. 📝 Add custom domain
5. 📝 Implement authentication (replace Supabase Auth)
6. 📝 Setup file storage (Fly volumes or S3)
7. 📝 Add monitoring alerts

---

## Support Resources

- 📖 Full guide: [DEPLOYMENT.md](DEPLOYMENT.md)
- 🔧 Fly.io docs: https://fly.io/docs
- 💬 Community: https://community.fly.io
- 🐛 Issues: Create GitHub issue

---

**Need help? Check the logs first: `fly logs`** 🔍
