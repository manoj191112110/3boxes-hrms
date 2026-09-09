# 🏗️ System Architecture

This page provides a comprehensive technical architecture overview of NEXUS HRMS.

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 16 | React framework with App Router, SSR, API routes |
| **React** | 19 | UI component library |
| **TypeScript** | 5 | Type-safe JavaScript |
| **Tailwind CSS** | 4 | Utility-first CSS framework |
| **shadcn/ui** | Latest | Reusable UI component library built on Radix UI |
| **Lucide React** | Latest | Icon library |
| **Recharts** | Latest | Charting and data visualization |
| **Zustand** | Latest | Lightweight state management |

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js API Routes** | 16 | Serverless API endpoints |
| **Prisma** | 6.x | Type-safe ORM |
| **PostgreSQL** | 15+ | Relational database (via Neon serverless) |
| **Neon** | Serverless | Serverless PostgreSQL hosting |

### Deployment & DevOps

| Technology | Purpose |
|-----------|---------|
| **Vercel** | Hosting, CI/CD, edge functions |
| **GitHub Actions** | Automated workflows |
| **Bun** | Fast JavaScript runtime and package manager |

---

## Three-Tier Architecture

NEXUS HRMS follows a classic three-tier architecture pattern, implemented within the Next.js framework:

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION TIER                      │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │
│  │  Pages   │  │Components│  │  Layout   │  │  Theme  │  │
│  │ (App     │  │(shadcn/  │  │ (Sidebar  │  │ (Dark/  │  │
│  │  Router) │  │  Custom) │  │  Navbar)  │  │  Light) │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘  │
│       └──────────────┴─────────────┴─────────────┘       │
└───────────────────────────┬──────────────────────────────┘
                            │ HTTP / Fetch
┌───────────────────────────┴──────────────────────────────┐
│                      API TIER                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ /api/    │  │ /api/    │  │ /api/    │  │ /api/    │ │
│  │ employees│  │ payroll  │  │ recruit  │  │ attendance│ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       └──────────────┴─────────────┴─────────────┘       │
│                    Middleware Layer                        │
│         (Auth, Validation, Error Handling)                │
└───────────────────────────┬──────────────────────────────┘
                            │ Prisma Client
┌───────────────────────────┴──────────────────────────────┐
│                     DATA TIER                             │
│  ┌──────────────────────────────────────────────────────┐│
│  │              PostgreSQL (Neon Serverless)              ││
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        ││
│  │  │ Users  │ │Employee│ │Payroll │ │Leave   │  ...   ││
│  │  └────────┘ └────────┘ └────────┘ └────────┘        ││
│  └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

### Presentation Tier

- **App Router Pages**: File-based routing under `src/app/`
- **React Components**: Reusable UI in `src/components/`
- **Layout System**: Persistent sidebar navigation with responsive design
- **Theme Engine**: Dark/light mode toggle with CSS variables

### API Tier

- **Route Handlers**: Next.js API routes under `src/app/api/`
- **Request Validation**: Input validation on all endpoints
- **Error Handling**: Consistent error response format
- **Demo Fallbacks**: Automatic demo data when database is unavailable

### Data Tier

- **Prisma ORM**: Type-safe database queries
- **PostgreSQL/Neon**: Serverless PostgreSQL with connection pooling
- **Migrations**: Schema versioning via Prisma Migrate
- **Seed Data**: Comprehensive demo data seeding

---

## Project Structure

```
nexus-hrms/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Home/Dashboard page
│   │   ├── globals.css               # Global styles
│   │   ├── api/                      # API route handlers
│   │   │   ├── employees/            # Employee endpoints
│   │   │   ├── payroll/              # Payroll endpoints
│   │   │   ├── recruitment/          # Recruitment endpoints
│   │   │   ├── attendance/           # Attendance endpoints
│   │   │   ├── leave/                # Leave endpoints
│   │   │   ├── departments/          # Department endpoints
│   │   │   ├── branches/             # Branch endpoints
│   │   │   ├── jobs/                 # Job endpoints
│   │   │   ├── candidates/           # Candidate endpoints
│   │   │   ├── interviews/           # Interview endpoints
│   │   │   ├── assets/               # Asset endpoints
│   │   │   ├── travel/               # Travel endpoints
│   │   │   ├── expenses/             # Expense endpoints
│   │   │   ├── tickets/              # Helpdesk ticket endpoints
│   │   │   ├── clients/              # Client endpoints
│   │   │   ├── vendors/              # Vendor endpoints
│   │   │   ├── workflows/            # Workflow endpoints
│   │   │   ├── surveys/              # Survey endpoints
│   │   │   ├── audit-logs/           # Audit log endpoints
│   │   │   ├── notifications/        # Notification endpoints
│   │   │   ├── shifts/               # Shift endpoints
│   │   │   ├── onboarding/           # Onboarding endpoints
│   │   │   ├── auth/                 # Authentication endpoints
│   │   │   ├── dashboard/            # Dashboard stats endpoints
│   │   │   └── chat/                 # AI Chat endpoints
│   │   └── (modules)/                # Module page routes
│   ├── components/                   # React components
│   │   ├── ui/                       # shadcn/ui base components
│   │   ├── layout/                   # Layout components (sidebar, navbar)
│   │   └── modules/                  # Module-specific components
│   ├── lib/                          # Utility libraries
│   │   ├── prisma.ts                 # Prisma client singleton
│   │   ├── utils.ts                  # General utilities
│   │   ├── demo-data.ts             # Demo/fallback data
│   │   └── store/                    # Zustand stores
│   ├── hooks/                        # Custom React hooks
│   └── types/                        # TypeScript type definitions
├── prisma/
│   ├── schema.prisma                 # Database schema
│   ├── seed.ts                       # Database seed script
│   └── migrations/                   # Schema migrations
├── public/                           # Static assets
├── scripts/                          # Build & deployment scripts
├── next.config.ts                    # Next.js configuration
├── tailwind.config.ts               # Tailwind configuration
├── tsconfig.json                    # TypeScript configuration
└── package.json                     # Dependencies & scripts
```

---

## Component Architecture

### Layout Components

```
RootLayout
├── ThemeProvider (dark/light mode)
├── Sidebar
│   ├── Logo
│   ├── NavigationMenu
│   │   ├── ModuleGroup (HR, Finance, etc.)
│   │   └── NavItem (with icon + badge)
│   ├── UserRoleSwitcher
│   └── UserProfile
└── MainContent
    ├── TopNavbar
    │   ├── Breadcrumb
    │   ├── SearchBar
    │   ├── NotificationCenter
    │   └── UserMenu
    └── PageContent
        └── [Module Pages]
```

### UI Component Pattern

All module pages follow a consistent component pattern:

```tsx
// Page component structure
export default function ModulePage() {
  // 1. State management (Zustand store or local state)
  // 2. Data fetching (API call with demo fallback)
  // 3. Event handlers

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader title="..." description="...">
        <ActionButton />
      </PageHeader>

      {/* Statistics Cards */}
      <StatsGrid stats={...} />

      {/* Data Table */}
      <DataTable
        data={...}
        columns={...}
        filters={...}
        pagination={...}
      />

      {/* Modals / Dialogs */}
      <CreateDialog />
      <EditDialog />
      <DeleteDialog />
    </div>
  )
}
```

---

## State Management

### Zustand Store Architecture

NEXUS HRMS uses Zustand for lightweight, scalable state management.

```typescript
// Store pattern example
import { create } from 'zustand'

interface AppState {
  // Auth state
  user: User | null
  role: UserRole
  setUser: (user: User) => void
  setRole: (role: UserRole) => void

  // UI state
  sidebarOpen: boolean
  theme: 'light' | 'dark'
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark') => void

  // Module state
  selectedCompany: string | null
  notifications: Notification[]
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  role: 'employee',
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),

  sidebarOpen: true,
  theme: 'light',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setTheme: (theme) => set({ theme }),

  selectedCompany: null,
  notifications: [],
}))
```

### State Categories

| Category | Storage | Examples |
|----------|---------|---------|
| **Authentication** | Zustand + Cookie | User session, role, permissions |
| **UI State** | Zustand | Sidebar toggle, theme, modals |
| **Module Data** | Server state (fetch) | Employee lists, payroll records |
| **Form State** | React state | Input values, validation errors |
| **Cache** | Zustand | Recently viewed, preferences |

---

## Deployment Architecture

### Vercel Deployment

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│   Vercel     │────▶│  Neon DB     │
│  (Client)    │     │  (Edge/      │     │  (PostgreSQL)│
│              │◀────│   Serverless)│◀────│              │
└──────────────┘     └──────────────┘     └──────────────┘
                           │
                     ┌─────┴─────┐
                     │  Vercel   │
                     │  Blob     │
                     │  (Assets) │
                     └───────────┘
```

### Deployment Features

- **Edge Functions**: API routes run on Vercel's edge network
- **ISR (Incremental Static Regeneration)**: Dashboard pages with revalidation
- **Image Optimization**: Next.js automatic image optimization
- **Auto-scaling**: Serverless functions scale automatically
- **Preview Deployments**: Every PR gets a preview URL
- **Environment Variables**: Secure config via Vercel dashboard

### Environment Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_URL` | ✅ | Neon PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | ❌ | Public app URL for callbacks |

---

## Data Flow

### Typical API Request Flow

```
User Action (Click/Submit)
    │
    ▼
React Component (Event Handler)
    │
    ▼
fetch() → /api/[module]
    │
    ▼
API Route Handler
    ├── 1. Parse request body/params
    ├── 2. Validate input
    ├── 3. Prisma query
    │   ├── Success → Return JSON data
    │   └── Error → Return demo data fallback
    │
    ▼
Component State Update
    │
    ▼
UI Re-render
```

### Demo Data Fallback Strategy

Every API endpoint includes a fallback to demo data when the database connection fails:

```typescript
export async function GET(request: Request) {
  try {
    const data = await prisma.model.findMany(...)
    return Response.json(data)
  } catch (error) {
    // Fallback to demo data for seamless UX
    console.error('Database error, using demo data:', error)
    return Response.json(demoData)
  }
}
```

This ensures the application always renders meaningful content, even during database outages or initial setup.

---

*See also: [API Reference](API-Reference), [Database Schema](Database-Schema), [Getting Started](Getting-Started)*
