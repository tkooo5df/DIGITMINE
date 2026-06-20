# 🚀 Install Fly CLI - Windows

## Method 1: Direct Download (Recommended)

### Step 1: Download
Open PowerShell and run:
```powershell
# Download the installer
Invoke-WebRequest -Uri "https://fly.io/install.ps1" -OutFile "$env:TEMP\install-fly.ps1"

# Run the installer
& "$env:TEMP\install-fly.ps1"
```

### Step 2: Add to PATH
The installer will add Fly to your PATH. **Restart your terminal** after installation.

### Step 3: Verify
```powershell
fly version
```

You should see something like: `fly v0.1.123`

---

## Method 2: Manual Download

If the script doesn't work:

1. Go to: https://github.com/superfly/flyctl/releases
2. Download the latest `flyctl_*_windows_amd64.zip`
3. Extract to: `C:\fly`
4. Add to PATH:
   ```powershell
   [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\fly", "User")
   ```
5. Restart terminal

---

## Method 3: Using Scoop

```powershell
# Install scoop first (if not installed)
irm get.scoop.sh | iex

# Install flyctl
scoop install flyctl
```

---

## After Installation

1. **Restart your terminal** (important!)
2. Verify installation:
   ```powershell
   fly version
   ```
3. Login to Fly:
   ```powershell
   fly auth login
   ```

---

## Troubleshooting

### "fly is not recognized"
- Make sure you restarted your terminal after installation
- Check if fly.exe is in your PATH:
  ```powershell
  Get-Command fly
  ```

### Download fails
- Try Method 2 (manual download)
- Or use a different network

### Permission denied
- Run PowerShell as Administrator
- Or install to user directory

---

## Quick Test

After installation, run:
```powershell
fly --help
```

You should see a list of available commands.

---

**Once Fly CLI is installed, you can run:**
```powershell
.\scripts\setup-fly.ps1
```
