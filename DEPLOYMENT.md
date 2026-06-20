# 🚀 Vault Digital Lux - Fly.io Deployment Guide

## Overview
This guide will walk you through deploying your application to Fly.io with PostgreSQL as the primary database and automated daily backups to Supabase.

## Architecture
```
Fly.io (Production)
├── Application Server (Node.js/Express)
├── PostgreSQL Database (Primary)
└── Daily Backup (2AM) → Supabase (Backup)
```

---

## Prerequisites
- Node.js 20+ installed
- Git installed
- Fly.io account (sign up at https://fly.io)
- Supabase project already configured

---

## Step-by-Step Deployment

### Step 1: Install Fly.io CLI

**Windows:**
```bash
winget install FlyIO.Flyctl
```

**macOS/Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

Verify installation:
```bash
fly version
```

---

### Step 2: Login to Fly.io

```bash
fly auth login
```

This will open your browser to authenticate.

---

### Step 3: Create Fly.io App

```bash
cd "d:\amine codes\Vault_ Digital Lux"
fly apps create vault-digital-lux
```

Select region: `eu-central-1` (Frankfurt - closest to your users)

---

### Step 4: Create PostgreSQL Database

```bash
fly postgres create \
  --name vault-db \
  --region eu-central-1 \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --volume-size 1
```

This will create a managed PostgreSQL database on Fly.io.

**Note the connection details** - you'll need them in the next step.

---

### Step 5: Get Database Connection String

```bash
fly postgres attach --postgres-app vault-db --app vault-digital-lux
```

Or manually get the connection string:
```bash
fly postgres connect -a vault-db
```

The connection string will look like:
```
postgres://vault-db:password@vault-db.internal:5432/vault_db
```

---

### Step 6: Set Environment Secrets

```bash
# Fly PostgreSQL connection (replace with your actual connection string)
fly secrets set DATABASE_URL="postgres://vault-db:PASSWORD@vault-db.internal:5432/vault_db"

# Supabase credentials (for backup system)
fly secrets set VITE_SUPABASE_URL="https://jhvcuvblvtjncatmsczb.supabase.co"
fly secrets set SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# Session secret (generate a random string)
fly secrets set SESSION_SECRET="$(openssl rand -hex 32)"

# Node environment
fly secrets set NODE_ENV="production"
```

**⚠️ IMPORTANT**: Replace `PASSWORD` and `your-supabase-service-role-key` with actual values.

---

### Step 7: Prepare Database Schema

The migrations in `supabase/migrations/` contain Supabase-specific features. We need to create a cleaned version for Fly PostgreSQL.

**Option A: Manual Migration (Recommended)**

1. Connect to Fly PostgreSQL:
```bash
fly postgres connect -a vault-db
```

2. Copy and paste SQL from `supabase/migrations/` files, **removing**:
   - `auth.users` references (Supabase Auth)
   - `storage.*` references (Supabase Storage)
   - Row Level Security (RLS) policies
   - `public.has_role()` function calls

3. Create essential tables first:
```sql
-- Run this first
CREATE TABLE IF NOT EXISTS public.categories (...);
CREATE TABLE IF NOT EXISTS public.products (...);
CREATE TABLE IF NOT EXISTS public.product_offers (...);
-- ... (see supabase/migrations/ for full schema)
```

**Option B: Use Migration Script**

```bash
# This will be created in the future
node scripts/prepare-fly-migrations.js
```

---

### Step 8: Import Existing Data

Your Supabase already has 439 products, 182 reviews, etc. Let's import them to Fly PostgreSQL.

```bash
# Set temporary environment variables for import script
export FLY_DATABASE_URL="postgres://vault-db:PASSWORD@vault-db.internal:5432/vault_db"

# Run import script
node --env-file=.env scripts/import-to-fly.js
```

This will:
- ✅ Export all data from Supabase
- ✅ Import to Fly PostgreSQL
- ✅ Preserve all relationships
- ✅ Handle conflicts gracefully

---

### Step 9: Deploy Application

```bash
# Build locally first (optional but recommended)
npm run build

# Deploy to Fly.io
fly deploy
```

The deployment will:
1. Build Docker image
2. Push to Fly registry
3. Start application
4. Run health checks

---

### Step 10: Verify Deployment

```bash
# Check logs
fly logs

# Open website
fly open

# Check app status
fly status

# Check database connection
fly ssh console -C "printenv DATABASE_URL"
```

---

## Step 11: Setup Daily Backup System

### Option A: Use GitHub Actions (Recommended)

Create `.github/workflows/daily-backup.yml`:

```yaml
name: Daily Backup to Supabase

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2AM UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install pg @supabase/supabase-js
      
      - name: Run backup
        env:
          FLY_DATABASE_URL: ${{ secrets.FLY_DATABASE_URL }}
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: node scripts/backup-to-supabase.js
```

**Add secrets to GitHub repository:**
- `FLY_DATABASE_URL`: Your Fly PostgreSQL connection string
- `VITE_SUPABASE_URL`: Your Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

### Option B: Use Cron on Fly.io

Add to `fly.toml`:
```toml
[[processes]]
  cmd = ["node", "scripts/backup-to-supabase.js"]
  schedule = "0 2 * * *"
```

**Note**: This requires a separate machine running 24/7.

---

## Step 12: Monitor Your Application

### Fly.io Dashboard
Visit: https://fly.io/dashboard

### Logs
```bash
# Real-time logs
fly logs

# Logs from last hour
fly logs --since 1h
```

### Database
```bash
# Connect to database
fly postgres connect -a vault-db

# Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
```

---

## Maintenance

### Restart Application
```bash
fly restart
```

### Scale Resources
```bash
# Increase memory
fly scale memory 1024

# Add more CPU
fly scale vm shared-cpu-2x
```

### View Metrics
```bash
fly dashboard
```

### Backup Database Manually
```bash
# Run backup script
node --env-file=.env scripts/backup-to-supabase.js
```

### Restore from Supabase (Emergency)
If Fly PostgreSQL fails:
```bash
# Temporarily switch to Supabase in .env
DATABASE_URL=postgres://jhvcuvblvtjncatmsczb:password@db.jhvcuvblvtjncatmsczb.supabase.co:5432/postgres

# Or import data back from Supabase
node --env-file=.env scripts/import-to-fly.js
```

---

## Troubleshooting

### Application Won't Start
```bash
# Check logs
fly logs

# SSH into machine
fly ssh console

# Check environment variables
fly ssh console -C "printenv"
```

### Database Connection Issues
```bash
# Verify connection string
fly secrets list

# Test connection
fly postgres connect -a vault-db
```

### Backup Fails
```bash
# Run backup manually with verbose output
NODE_DEBUG=* node --env-file=.env scripts/backup-to-supabase.js
```

---

## Cost Estimation

**Fly.io Costs (Monthly):**
- App Server (shared-cpu-1x, 512MB): ~$5-10
- PostgreSQL (shared-cpu-1x, 1GB): ~$10-15
- Bandwidth: ~$0 (generous free tier)
- **Total**: ~$15-25/month

**Supabase Costs:**
- Free tier: 500MB database, 1GB bandwidth
- Pro tier: $25/month (if you exceed free tier)

---

## Security Checklist

- ✅ Environment secrets stored securely (not in code)
- ✅ Database not publicly accessible
- ✅ HTTPS enabled (automatic on Fly.io)
- ✅ Non-root user in Docker container
- ✅ Health checks configured
- ✅ Regular backups scheduled

---

## Next Steps

1. **Custom Domain**: 
   ```bash
   fly certs add yourdomain.com
   ```

2. **Email Notifications**: Integrate with Resend or SendGrid

3. **Monitoring**: Setup UptimeRobot or Pingdom for uptime monitoring

4. **CI/CD**: Automate deployments with GitHub Actions

---

## Support

- Fly.io Docs: https://fly.io/docs
- Fly.io Community: https://community.fly.io
- Supabase Docs: https://supabase.com/docs

---

**Congratulations! Your application is now running on Fly.io with automated backups! 🎉**
