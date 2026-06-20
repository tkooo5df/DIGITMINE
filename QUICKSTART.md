# 🚀 Quick Start - Deploy to Fly.io

## What's Been Created

All files needed to deploy your application to Fly.io with PostgreSQL and daily backups to Supabase.

## Files Created

```
✅ fly.toml                     - Fly.io application configuration
✅ Dockerfile                   - Multi-stage Docker build
✅ .dockerignore                - Docker ignore rules
✅ scripts/backup-to-supabase.js    - Daily backup script
✅ scripts/import-to-fly.js         - Data import from Supabase
✅ scripts/setup-fly.ps1            - Windows PowerShell setup
✅ scripts/setup-fly.sh             - Linux/Mac setup script
✅ .github/workflows/daily-backup.yml - Automated backup workflow
✅ DEPLOYMENT.md                - Complete deployment guide
```

## Quick Deployment (Windows)

### Step 1: Install Fly CLI

**IMPORTANT**: You must install Fly CLI first!

See detailed instructions: [INSTALL-FLY-CLI.md](INSTALL-FLY-CLI.md)

Quick method:
```powershell
Invoke-WebRequest -Uri "https://fly.io/install.ps1" -OutFile "$env:TEMP\install-fly.ps1"
& "$env:TEMP\install-fly.ps1"
```

**Restart your terminal after installation!**

Verify:
```powershell
fly version
```

### Step 2: Run Setup Script
```powershell
cd "d:\amine codes\Vault_ Digital Lux"
.\scripts\setup-fly.ps1
```

The script will:
- ✅ Login to Fly.io
- ✅ Create application
- ✅ Create PostgreSQL database
- ✅ Setup environment variables
- ✅ Deploy your app

### Step 3: Set Database URL (Manual)
```powershell
fly secrets set DATABASE_URL="postgres://vault-db:YOUR_PASSWORD@vault-db.internal:5432/vault_db"
```

Get your password with:
```powershell
fly postgres connect -a vault-db
```

### Step 4: Import Data from Supabase
```powershell
node --env-file=.env scripts/import-to-fly.js
```

This will migrate all 439 products, 182 reviews, etc.

### Step 5: Setup Daily Backup

**Option A: GitHub Actions (Recommended)**

1. Push your code to GitHub
2. Add repository secrets:
   - `FLY_DATABASE_URL` - Your Fly PostgreSQL connection string
   - `VITE_SUPABASE_URL` - Your Supabase URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

3. Backup will run automatically at 2AM UTC daily

**Option B: Manual Backup**
```powershell
# Set environment variable
$env:FLY_DATABASE_URL="postgres://vault-db:PASSWORD@vault-db.internal:5432/vault_db"

# Run backup
node --env-file=.env scripts/backup-to-supabase.js
```

## Deployment Architecture

```
Fly.io (Production Server)
├── Application: vault-digital-lux.fly.dev
├── Database: vault-db (PostgreSQL)
│     └── Primary data store
└── Daily Backup (2AM UTC)
      └── Supabase (Backup)
```

## Cost Estimate

- **Fly.io App**: ~$5-10/month
- **Fly.io PostgreSQL**: ~$10-15/month
- **Total**: ~$15-25/month

## Useful Commands

```powershell
# View logs
fly logs

# Check status
fly status

# SSH into server
fly ssh console

# Deploy updates
fly deploy

# Open website
fly open

# Restart app
fly restart

# Scale resources
fly scale memory 1024
```

## Data Flow

```
User Request → Fly.io App → Fly PostgreSQL
                                    ↓
                          Daily at 2AM UTC
                                    ↓
                              Supabase (Backup)
```

## Emergency Recovery

If Fly PostgreSQL fails:

```powershell
# Import data back from Supabase
node --env-file=.env scripts/import-to-fly.js
```

## What's Different from Supabase?

| Feature | Supabase | Fly.io |
|---------|----------|--------|
| Database | ✅ Managed PostgreSQL | ✅ Managed PostgreSQL |
| Auth | ✅ Built-in | ⚠️ Need to implement |
| Storage | ✅ Built-in | ⚠️ Use volumes or S3 |
| Realtime | ✅ Built-in | ⚠️ Use WebSockets |
| Backups | ✅ Automatic | ✅ To Supabase |

## Next Steps

1. ✅ Deploy to Fly.io
2. ✅ Import existing data
3. ✅ Setup daily backups
4. 📝 Add custom domain: `fly certs add yourdomain.com`
5. 📝 Implement authentication (replace Supabase Auth)
6. 📝 Setup storage (Fly volumes or AWS S3)
7. 📝 Add monitoring and alerts

## Documentation

- 📖 Full guide: `DEPLOYMENT.md`
- 🔧 Fly.io docs: https://fly.io/docs
- 💾 Supabase docs: https://supabase.com/docs

## Support

Need help?
- Check `DEPLOYMENT.md` for detailed instructions
- Fly.io community: https://community.fly.io
- GitHub issues for this project

---

**Ready to deploy? Run `.\scripts\setup-fly.ps1` and follow the prompts!** 🚀
