# 3Boxes HRMS - Vercel + Custom Domain Setup
# ================================================

## Current Status
- App deployed on Vercel: https://nexus-hrms-mu.vercel.app
- Subdomain middleware active (code pushed & live)
- Demo logins removed
- Tenant info API working
- Custom domain 3boxeshrms.com needs to be added
- Wildcard subdomain *.3boxeshrms.com needs to be added
- DNS records need to be configured at registrar

## Vercel Plan Requirements

| Plan | Cost | Custom Domains | Wildcard Subdomains |
|------|------|----------------|-------------------|
| Hobby (Free) | $0 | Yes | No |
| Pro | $20/mo | Yes | Yes |

### If on Hobby (Free) Plan:
You can add individual subdomains manually:
- 3boxeshrms.com (main)
- marqaitechgroup.3boxeshrms.com (MarqAI Tech Group)
- Add more subdomains as you onboard new tenants

### If on Pro Plan:
Add wildcard domain *.3boxeshrms.com once - all future tenants auto-work.

## Step-by-Step: Add Custom Domain on Vercel

### Step 1: Go to Vercel Dashboard
1. Open https://vercel.com/dashboard
2. Click on nexus-hrms project
3. Go to Settings > Domains

### Step 2: Add Main Domain
1. Type: 3boxeshrms.com
2. Click Add
3. Vercel shows DNS records - copy them

### Step 3: Add Wildcard (Pro) or Individual Subdomains (Hobby)

Pro Plan:
1. Type: *.3boxeshrms.com
2. Click Add

Hobby Plan:
1. Type: marqaitechgroup.3boxeshrms.com
2. Click Add
3. Repeat for each tenant subdomain

### Step 4: Configure DNS at Your Domain Registrar

Go to your domain registrar (GoDaddy, Namecheap, Hostinger, Cloudflare, etc.)
and add these DNS records:

For 3boxeshrms.com (main domain):
| Type | Name | Value |
|------|------|-------|
| A | @ | 76.76.21.21 |
| CNAME | www | cname.vercel-dns.com |

For *.3boxeshrms.com (wildcard subdomain - Pro Plan):
| Type | Name | Value |
|------|------|-------|
| CNAME | * | cname.vercel-dns.com |

OR for individual subdomains (Hobby Plan):
| Type | Name | Value |
|------|------|-------|
| CNAME | marqaitechgroup | cname.vercel-dns.com |

### Step 5: Wait for DNS Propagation
- Usually 5-30 minutes
- Vercel auto-provisions SSL certificates
- Check status in Vercel Dashboard > Domains

### Step 6: Seed the Database

After the domain is working, seed MarqAI Tech Group data.

### After Setup: Login URLs

| URL | Who Can Login | Password |
|-----|--------------|----------|
| https://3boxeshrms.com | Super Admin (superadmin@3boxeshrms.com) | MarqAI@2026 |
| https://marqaitechgroup.3boxeshrms.com | All MarqAI users | MarqAI@2026 |

### Adding a New Tenant Later

1. Create tenant in database (slug = subdomain prefix)
2. If Hobby plan: Add the subdomain in Vercel Dashboard
3. If Pro plan: It just works (wildcard)
4. No code changes needed!
