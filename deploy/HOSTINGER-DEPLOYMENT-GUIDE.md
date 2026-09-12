# 3Boxes HRMS - Hostinger VPS Deployment Guide

## Architecture Overview

```
Internet
    │
    ├── 3boxeshrms.com ─────────────► Nginx (443/SSL) ──► Next.js (PM2:3000)
    │   (Super Admin Portal)                                        │
    ├── marqaitechgroup.3boxeshrms.com ──► Nginx (443/SSL) ────────►│
    │   (MarqAI Tech Group - all 5 companies)                       │
    ├── [future-tenant].3boxeshrms.com ───► Nginx (443/SSL) ──────►│
    │                                                               │
    │                                                               ▼
    │                                                        PostgreSQL
    │                                                        (localhost:5432)
    └── DNS: *.3boxeshrms.com → VPS IP
```

## Multi-Tenant Access Model

| URL | Who Can Login | Access Scope |
|-----|--------------|-------------|
| `3boxeshrms.com` | Super Admin (`superadmin@3boxeshrms.com`) | All tenants, all companies |
| `marqaitechgroup.3boxeshrms.com` | Tenant Admin + HR Admins + Employees of MarqAI Group | Only MarqAI Tech Group companies |
| `[tenant-slug].3boxeshrms.com` | Users of that specific tenant | Only that tenant's companies |

## Prerequisites

1. **Hostinger VPS** (KVM 2 or higher recommended)
   - Minimum: 2 vCPU, 8GB RAM, 50GB SSD
   - Recommended: 4 vCPU, 16GB RAM, 100GB SSD
   - OS: Ubuntu 22.04 LTS

2. **Domain Configuration** (at your domain registrar):
   - A Record: `3boxeshrms.com` → VPS IP
   - A Record: `*.3boxeshrms.com` → VPS IP (wildcard)
   - Or CNAME: `*.3boxeshrms.com` → `3boxeshrms.com`

3. **GitHub Repository Access**
   - `https://github.com/maheshkpreddy/nexus-hrms.git`

---

## Step-by-Step Deployment

### Step 1: DNS Setup at Hostinger/Registrar

1. Log into your domain registrar (or Hostinger hPanel)
2. Navigate to DNS Zone Editor
3. Add these records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `YOUR_VPS_IP` | 3600 |
| A | `*` | `YOUR_VPS_IP` | 3600 |
| CAA | `@` | `0 issue "letsencrypt.org"` | 3600 |

4. Wait for DNS propagation (5-30 minutes)
5. Verify: `dig 3boxeshrms.com` and `dig marqaitechgroup.3boxeshrms.com`

### Step 2: VPS Initial Setup

```bash
# SSH into your VPS
ssh root@YOUR_VPS_IP

# Update system
apt update && apt upgrade -y

# Create a sudo user (optional but recommended)
adduser deploy
usermod -aG sudo deploy
```

### Step 3: Run the Automated Setup Script

```bash
# Clone the repository
git clone https://github.com/maheshkpreddy/nexus-hrms.git /tmp/hrms-setup
cd /tmp/hrms-setup

# Run the setup script
bash deploy/hostinger-setup.sh
```

This script will:
- Install Node.js 20, PM2, Nginx, PostgreSQL
- Create the database and user
- Clone the app repository
- Install dependencies and build
- Run database migrations and seed MarqAI data
- Configure Nginx with subdomain routing
- Attempt SSL certificate setup
- Start the app with PM2

### Step 4: SSL Certificate (Manual if Auto-Failed)

**For the main domain:**
```bash
sudo certbot --nginx -d 3boxeshrms.com --non-interactive --agree-tos -m admin@3boxeshrms.com
```

**For wildcard subdomains (required for `*.3boxeshrms.com`):**

Option A: DNS challenge with Cloudflare (recommended):
```bash
# Install Cloudflare DNS plugin
sudo apt install python3-certbot-dns-cloudflare

# Create Cloudflare API credentials file
sudo mkdir -p /etc/letsencrypt
sudo cat > /etc/letsencrypt/cloudflare.ini << EOF
dns_cloudflare_api_token = YOUR_CLOUDFLARE_API_TOKEN
EOF
sudo chmod 600 /etc/letsencrypt/cloudflare.ini

# Get wildcard certificate
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d '*.3boxeshrms.com' \
  --non-interactive \
  --agree-tos \
  -m admin@3boxeshrms.com

# Update Nginx to use wildcard cert for subdomains
# Edit /etc/nginx/sites-available/3boxeshrms.com
# Change the wildcard server block's SSL cert to:
# ssl_certificate /etc/letsencrypt/live/*.3boxeshrms.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/*.3boxeshrms.com/privkey.pem;
```

Option B: Single certificate covering both:
```bash
# If your DNS provider doesn't support API challenges,
# you can get a single cert for specific subdomains:
sudo certbot --nginx -d 3boxeshrms.com -d marqaitechgroup.3boxeshrms.com
```

### Step 5: Verify the Deployment

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs 3boxes-hrms --lines 50

# Test the main domain
curl -I https://3boxeshrms.com

# Test the tenant subdomain
curl -I https://marqaitechgroup.3boxeshrms.com

# Test the tenant info API
curl https://marqaitechgroup.3boxeshrms.com/api/public/tenant-info?slug=marqaitechgroup
```

### Step 6: Test Login

1. Open `https://marqaitechgroup.3boxeshrms.com` in browser
2. You should see the login page with "MarqAI Tech Group" branding
3. Login with:
   - **Tenant Admin**: `admin@marqaitechgroup.com` / `MarqAI@2026`
   - **HR Admin (MarqAI Tech)**: `hr@marqaitech.com` / `MarqAI@2026`
   - **Employee (MarqAI Tech)**: `rajesh.kumar@marqaitech.com` / `MarqAI@2026`
4. Verify the Company Switcher shows all 5 MarqAI companies for tenant admin

5. Open `https://3boxeshrms.com` in browser
6. Login with Super Admin: `superadmin@3boxeshrms.com` / `MarqAI@2026`
7. Verify access to all tenants and companies

---

## Ongoing Operations

### Updating the Application

```bash
cd /home/3boxeshrms/app
git pull origin main
npm ci
npx prisma generate
npm run build
pm2 restart 3boxes-hrms
```

### Adding a New Tenant

1. Create the tenant in the database:
```sql
INSERT INTO "Tenant" (id, name, slug, domain, plan, status, "country", currency, timezone)
VALUES (gen_random_uuid(), 'New Company Group', 'newcompany', 'newcompany.3boxeshrms.com', 'professional', 'active', 'IN', 'INR', 'Asia/Kolkata');
```

2. The subdomain `newcompany.3boxeshrms.com` will automatically work because:
   - DNS `*.3boxeshrms.com` already covers it
   - Nginx wildcard server block already handles it
   - Middleware extracts the slug and resolves the tenant

### Database Backup

```bash
# Manual backup
sudo -u postgres pg_dump 3boxes_hrms > /home/3boxeshrms/backups/backup_$(date +%Y%m%d).sql

# Automated daily backup (add to crontab)
crontab -e
# Add: 0 2 * * * sudo -u postgres pg_dump 3boxes_hrms > /home/3boxeshrms/backups/backup_$(date +\%Y\%m\%d).sql
```

### Monitoring

```bash
# PM2 monitoring dashboard
pm2 monit

# Application logs
pm2 logs 3boxes-hrms

# Nginx logs
tail -f /var/log/nginx/3boxeshrms_access.log
tail -f /var/log/nginx/3boxeshrms_error.log

# PostgreSQL logs
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE datname = '3boxes_hrms';"
```

### SSL Certificate Renewal

Let's Encrypt certificates expire every 90 days. Auto-renewal is configured:

```bash
# Check renewal status
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew

# Reload Nginx after renewal
sudo systemctl reload nginx
```

---

## Troubleshooting

### Subdomain not resolving
- Check DNS: `dig marqaitechgroup.3boxeshrms.com`
- Ensure wildcard A record `*.3boxeshrms.com` points to VPS IP
- Wait for DNS propagation (can take up to 48 hours)

### SSL errors on subdomain
- Ensure wildcard certificate covers `*.3boxeshrms.com`
- Check certificate: `sudo certbot certificates`
- Re-issue: `sudo certbot certonly --dns-cloudflare -d '*.3boxeshrms.com'`

### Login fails on tenant subdomain
- Verify tenant exists: `SELECT * FROM "Tenant" WHERE slug = 'marqaitechgroup';`
- Check user's tenantId matches the subdomain tenant
- Check PM2 logs: `pm2 logs 3boxes-hrms --lines 100`

### Database connection errors
- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check connection string in `.env` file
- Test connection: `psql -U 3boxes_user -d 3boxes_hrms -h localhost`

### Application not starting
- Check PM2 logs: `pm2 logs 3boxes-hrms --err`
- Verify build succeeded: `ls -la /home/3boxeshrms/app/.next/`
- Rebuild: `cd /home/3boxeshrms/app && npm run build && pm2 restart 3boxes-hrms`

---

## Security Checklist

- [ ] Change all default passwords after first login
- [ ] Set a strong JWT_SECRET in `.env`
- [ ] Set PostgreSQL user password to a strong value
- [ ] Enable firewall: `ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable`
- [ ] Disable root SSH login: Edit `/etc/ssh/sshd_config`, set `PermitRootLogin no`
- [ ] Set up automatic security updates: `sudo apt install unattended-upgrades`
- [ ] Configure fail2ban: `sudo apt install fail2ban`
- [ ] Regular database backups (see above)
- [ ] Monitor SSL certificate expiry
