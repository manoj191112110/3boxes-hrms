# 🚀 Getting Started

Complete guide to set up and run NEXUS HRMS on your local machine.

---

## Prerequisites

Before you begin, ensure you have the following installed:

| Requirement | Version | Download |
|------------|---------|----------|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) |
| **Bun** | Latest | [bun.sh](https://bun.sh) |
| **Git** | Latest | [git-scm.com](https://git-scm.com) |
| **PostgreSQL** | 15+ | [postgresql.org](https://postgresql.org) or Neon account |

> **💡 Tip**: We recommend using [Bun](https://bun.sh) as your package manager for optimal performance. However, npm and yarn are also supported.

> **💡 Tip**: If you don't have a local PostgreSQL instance, you can use [Neon](https://neon.tech) for a free serverless PostgreSQL database.

---

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/maheshkpreddy/nexus-hrms.git
cd nexus-hrms
```

### Step 2: Install Dependencies

```bash
bun install
```

> If you prefer npm: `npm install`

### Step 3: Set Up Environment Variables

```bash
cp .env.example .env
```

Edit the `.env` file and add your PostgreSQL connection string:

```env
# Required: PostgreSQL connection string
POSTGRES_URL="postgresql://user:password@host:5432/database?sslmode=require"

# Optional: For Neon serverless
# POSTGRES_URL_NON_POOLING="postgresql://user:password@host:5432/database?sslmode=require"
```

#### Getting Your POSTGRES_URL

**Option A: Neon (Recommended for quick start)**
1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string from the dashboard
4. Paste into your `.env` file

**Option B: Local PostgreSQL**
1. Install PostgreSQL locally
2. Create a database: `createdb nexus_hrms`
3. Use: `postgresql://postgres:password@localhost:5432/nexus_hrms`

### Step 4: Generate Prisma Client

```bash
npx prisma generate
```

### Step 5: Run Database Migrations (Optional)

If you have a working database connection:

```bash
npx prisma db push
```

To seed with demo data:

```bash
npx prisma db seed
```

> **💡 Note**: The application works without a database connection! It automatically falls back to demo data when the database is unavailable.

### Step 6: Start the Development Server

```bash
bun dev
```

The application will be available at **http://localhost:3000**

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_URL` | ✅ Yes | — | PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public application URL |

### Connection String Format

```
postgresql://[user]:[password]@[host]:[port]/[database]?sslmode=require
```

#### Neon Connection String Example

```
postgresql://neondb_owner:AbCdEfGh@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

---

## First Login

### Default Credentials

| Field | Value |
|-------|-------|
| **Email** | `admin@nexushrms.com` |
| **Password** | `admin123` |
| **Role** | Super Admin |

> **⚠️ Important**: Change the default password immediately after your first login in a production environment.

### Login Steps

1. Navigate to `http://localhost:3000`
2. Enter the email: `admin@nexushrms.com`
3. Enter the password: `admin123`
4. Click **Sign In**
5. You'll be redirected to the Dashboard

---

## Demo Data

When running without a database or with a fresh database, NEXUS HRMS provides comprehensive demo data to showcase all features.

### What's Included in Demo Data

| Module | Records | Details |
|--------|---------|---------|
| **Employees** | 15+ | Various departments and designations |
| **Departments** | 8 | Engineering, HR, Finance, Marketing, Sales, Operations, Legal, Design |
| **Branches** | 4 | New York, San Francisco, London, Bangalore |
| **Jobs** | 6 | Open positions with descriptions |
| **Candidates** | 8 | Various stages in recruitment pipeline |
| **Attendance** | 30 days | Check-in/out records |
| **Leave** | 10+ | Various types and statuses |
| **Payroll** | 12 months | Salary records with breakdowns |
| **Assets** | 20+ | Laptops, monitors, phones, etc. |
| **Tickets** | 10+ | Helpdesk tickets with priorities |
| **Clients** | 5 | Client companies |
| **Vendors** | 5 | Vendor companies |
| **Workflows** | 3 | Approval workflows |

### How Demo Data Works

The demo data system uses a dual-mode approach:

```
API Request
    │
    ├── Database Connected?
    │   ├── YES → Query database → Return real data
    │   └── NO  → Return demo data from demo-data.ts
    │
    └── Error?
        └── YES → Catch error → Return demo data (graceful fallback)
```

This means:
- **No database setup required** to explore the UI
- **Seamless transition** from demo to real data
- **Error resilience** — the app never crashes due to DB issues

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| **Dev Server** | `bun dev` | Start development server with hot reload |
| **Build** | `bun run build` | Create production build |
| **Start** | `bun start` | Start production server |
| **Lint** | `bun run lint` | Run ESLint |
| **Prisma Generate** | `npx prisma generate` | Generate Prisma client |
| **Prisma Push** | `npx prisma db push` | Push schema to database |
| **Prisma Seed** | `npx prisma db seed` | Seed database with demo data |
| **Prisma Studio** | `npx prisma studio` | Open Prisma database browser |

---

## Troubleshooting Setup Issues

### "Cannot connect to database"
- Verify your `POSTGRES_URL` in `.env`
- Ensure PostgreSQL is running (if local)
- Check SSL mode requirements (Neon requires `sslmode=require`)

### "Prisma Client not generated"
```bash
npx prisma generate
```

### "Port 3000 already in use"
```bash
bun dev --port 3001
```

### "Module not found errors"
```bash
rm -rf node_modules
bun install
```

---

## Next Steps

After getting the application running:

1. 📖 Read the [Module Guide](Module-Guide) to learn about each feature
2. 🔧 Review the [API Reference](API-Reference) for backend integration
3. 🗄️ Explore the [Database Schema](Database-Schema) for data model understanding
4. 🔐 Configure [Role-Based Access](Role-Based-Access) for your organization
5. 🏗️ Understand the [System Architecture](System-Architecture) for customization

---

*See also: [System Architecture](System-Architecture), [Troubleshooting](Troubleshooting), [Development Guidelines](Development-Guidelines)*
