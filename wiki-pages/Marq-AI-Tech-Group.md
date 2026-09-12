# Marq AI Tech Group - Tenant Configuration

> **Git Branch:** `marqai-tech-group`  
> **Tenant Slug:** `marqaitechgroup`  
> **Domain:** `marqaitechgroup.3boxeshrms.com`  
> **Last Updated:** 2026-07-02

---

## Overview

Marq AI Tech Group is the first production tenant on 3Boxes HRMS. This page documents the complete configuration, company structure, and deployment details for this group of companies.

## Group Companies

| # | Company Name | Code | City | State |
|---|-------------|------|------|-------|
| 1 | MARQ AI TECH PVT LTD | MATPL | Hyderabad | TS |
| 2 | 3 BOXES LUXURY CURATIONS | 3BLC | Hyderabad | TS |
| 3 | 3 BOXES CONSULTING SERVICES | 3BCS | Bangalore | KA |
| 4 | 3 BOXES TECHNOLOGIES | 3BT | Chennai | TN |

## Access Credentials

### Super Admin (Platform Level)
- **Email:** `superadmin@3boxeshrms.com`
- **Access:** Full platform control across all tenants
- **Login URL:** `https://3boxeshrms.com`
- **Initial Password:** `MarqAI@2026` ⚠️ Change immediately after first login

### Tenant Admin (Group Level)
- **Email:** `admin@marqaitechgroup.com`
- **Access:** All 4 companies under Marq AI Tech Group
- **Login URL:** `https://marqaitechgroup.3boxeshrms.com`
- **Initial Password:** `MarqAI@2026` ⚠️ Change immediately after first login

### Company HR Admins
Each company has a dedicated HR admin that can load data for their respective company:

| Company | Email | Access |
|---------|-------|--------|
| MARQ AI TECH PVT LTD | `admin@marqaitech.com` | HR data for MARQ AI TECH only |
| 3 BOXES LUXURY CURATIONS | `admin@3boxesluxury.com` | HR data for 3 BOXES LUXURY only |
| 3 BOXES CONSULTING SERVICES | `admin@3boxesconsulting.com` | HR data for 3 BOXES CONSULTING only |
| 3 BOXES TECHNOLOGIES | `admin@3boxestechnologies.com` | HR data for 3 BOXES TECH only |

**Password for all:** `MarqAI@2026` ⚠️ Change immediately after first login

## Tenant Configuration

| Setting | Value |
|---------|-------|
| Plan | Enterprise |
| Country | India (IN) |
| Currency | INR |
| Timezone | Asia/Kolkata (IST) |
| Language | English |
| Max Companies | 10 |
| Employee Limit Mode | Group Total |
| Max Employees (Group) | 500 |
| Max Employees (Per Company) | 100 |
| AI Feedback | Enabled |
| Cross-Company Talent Pool | Enabled |
| Video Interview Retake Limit | 2 |
| Video Retention Days | 90 |

## Master Data Setup

### Departments (Per Company)
Each company starts with these basic departments. HR admins can add more as needed:

1. **Human Resources** - HR management, recruitment, onboarding
2. **Finance** - Accounting, payroll, budgeting
3. **Operations** - Day-to-day operations management

### Designations (Per Company)
Each company starts with these basic designations:

| Designation | Department | Level |
|-------------|-----------|-------|
| CEO | Human Resources | 10 |
| HR Manager | Human Resources | 5 |
| Finance Manager | Finance | 5 |
| Operations Manager | Operations | 5 |

### Branches
Each company has one Head Office branch. More branches can be added:

- MARQ AI TECH PVT LTD - Head Office (MATPL-HO, Hyderabad)
- 3 BOXES LUXURY CURATIONS - Head Office (3BLC-HO, Hyderabad)
- 3 BOXES CONSULTING SERVICES - Head Office (3BCS-HO, Bangalore)
- 3 BOXES TECHNOLOGIES - Head Office (3BT-HO, Chennai)

## Data Policy

### What Was Created
- ✅ Tenant & Company Group structure
- ✅ 4 Companies with basic master data
- ✅ Super Admin + Tenant Admin accounts
- ✅ 4 Company HR Admin accounts (one per company, with employee records)
- ✅ Basic departments, designations, and branches
- ✅ Company logo loading feature (sidebar shows company logo when set)

### What Was NOT Created (Intentionally)
- ❌ Sample employees - HR admins will add real employee data
- ❌ Payroll configurations - Will be set up during onboarding
- ❌ Leave policies - Will be configured per company
- ❌ Salary structures - Will be configured per company
- ❌ Company logos - Will be uploaded via the Company Settings page (logo feature is ready)

## Deployment Details

### DNS Configuration (GoDaddy)
| Type | Name | Value |
|------|------|-------|
| A | @ | 76.76.21.21 |
| CNAME | www | cname.vercel-dns.com |
| CNAME | marqaitechgroup | cname.vercel-dns.com |
| CNAME | * | cname.vercel-dns.com |

### Vercel Project
- **Project:** nexus-hrms
- **Default Domain:** nexus-hrms-mu.vercel.app
- **Custom Domain:** 3boxeshrms.com
- **Production URL:** https://3boxeshrms.com
- **Tenant URL:** https://marqaitechgroup.3boxeshrms.com

### Database
- **Provider:** Neon PostgreSQL (Serverless)
- **Region:** us-east-1
- **Project ID:** dark-resonance-26207403

## Seed Script

The production database was seeded using:
```bash
node scripts/reseed-marqai-production.js
```

To re-seed (⚠️ this will delete all MarqAI data and recreate):
```bash
# From the project root with production env vars
node scripts/reseed-marqai-production.js
```

To seed using the Prisma-based script (for development):
```bash
npx tsx prisma/seed-marqai.ts
```

## Adding a New Group of Companies

When onboarding a new group of companies, follow this workflow:

1. **Create a new Git branch:** `git checkout -b <group-slug>`
2. **Copy and modify the seed script:** Based on `prisma/seed-marqai.ts`
3. **Update tenant configuration:** Name, slug, domain, companies
4. **Run the seed script:** Against the production database
5. **Add DNS records:** CNAME for the new tenant subdomain
6. **Add domain in Vercel:** Via Vercel dashboard or API
7. **Create wiki page:** Document the new group's configuration
8. **Push branch & merge:** To main for Vercel auto-deploy
9. **Verify:** Test login at the new subdomain

## Troubleshooting

### Cannot login at marqaitechgroup.3boxeshrms.com
1. Check DNS: `dig marqaitechgroup.3boxeshrms.com` should resolve to Vercel
2. Check SSL: Vercel auto-provisions SSL (may take 5-10 min)
3. Check tenant API: `curl https://3boxeshrms.com/api/public/tenant-info?slug=marqaitechgroup`
4. Check Vercel domain: Verify `*.3boxeshrms.com` is in Vercel project domains

### Login returns "Invalid credentials"
1. Verify the user exists in the database
2. Check password hash matches
3. Ensure the user's tenant matches the subdomain tenant

### Subdomain shows generic login (no branding)
1. Check middleware is correctly extracting tenant slug from subdomain
2. Verify `NEXT_PUBLIC_ROOT_DOMAIN=3boxeshrms.com` is set in Vercel env
3. Check tenant-info API returns the correct tenant data
