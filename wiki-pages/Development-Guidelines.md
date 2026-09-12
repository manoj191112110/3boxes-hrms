# 💻 Development Guidelines

Developer conventions, code style, patterns, and best practices for contributing to NEXUS HRMS.

---

## Table of Contents

1. [Code Style](#code-style)
2. [TypeScript Patterns](#typescript-patterns)
3. [Component Development](#component-development)
4. [API Route Patterns](#api-route-patterns)
5. [Git Workflow](#git-workflow)
6. [Testing Approach](#testing-approach)
7. [Performance Guidelines](#performance-guidelines)

---

## Code Style

### General Principles

- **Readability first**: Code is read more than written
- **Consistency**: Follow existing patterns in the codebase
- **Simplicity**: Prefer simple solutions over clever ones
- **Self-documenting**: Code should explain itself; use comments for "why", not "what"

### Formatting

We use **ESLint** and **Prettier** for code formatting. Configuration is in `eslint.config.mjs`.

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files (components) | PascalCase or kebab-case | `EmployeeCard.tsx`, `page-header.tsx` |
| Files (utilities) | camelCase | `formatDate.ts`, `prisma.ts` |
| Files (API routes) | kebab-case | `route.ts` in directory |
| React Components | PascalCase | `EmployeeCard`, `DashboardStats` |
| Functions | camelCase | `formatDate()`, `calculatePayroll()` |
| Constants | SCREAMING_SNAKE | `MAX_PAGE_SIZE`, `DEFAULT_ROLE` |
| Types/Interfaces | PascalCase | `Employee`, `PayrollRecord` |
| Enums | PascalCase | `EmployeeStatus`, `LeaveType` |
| CSS classes | Tailwind utilities | `className="flex items-center gap-4"` |
| Environment vars | SCREAMING_SNAKE | `POSTGRES_URL`, `NEXT_PUBLIC_APP_URL` |

### Import Order

Organize imports in the following order:

```typescript
// 1. React/Next.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// 2. Third-party libraries
import { format } from 'date-fns'
import { create } from 'zustand'

// 3. UI Components (shadcn/ui)
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell } from '@/components/ui/table'

// 4. Custom Components
import { EmployeeCard } from '@/components/employee-card'
import { StatsGrid } from '@/components/stats-grid'

// 5. Utilities and Types
import { prisma } from '@/lib/prisma'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Employee, Department } from '@/types'
```

---

## TypeScript Patterns

### Type Definitions

```typescript
// ✅ Prefer interfaces for object shapes
interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
  department?: Department
}

// ✅ Use type for unions and intersections
type EmployeeStatus = 'active' | 'resigned' | 'terminated' | 'on_leave'
type PayrollRecord = Employee & { salary: number; deductions: Deduction[] }

// ✅ Use const enums for fixed values (aligned with Prisma enums)
const enum LeaveType {
  Casual = 'casual',
  Sick = 'sick',
  Annual = 'annual',
  Maternity = 'maternity',
}
```

### API Response Types

```typescript
// Standard API response pattern
interface ApiResponse<T> {
  data: T
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface ApiError {
  error: string
  details?: string
  code?: string
}

// Module-specific response types
type EmployeesResponse = ApiResponse<Employee[]>
type PayrollResponse = ApiResponse<PayrollRecord[]>
```

### Generic Utility Types

```typescript
// Partial update type for PUT endpoints
type UpdateDto<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>

// Create DTO (required fields only, no auto-generated fields)
type CreateEmployeeDto = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>

// List query parameters
interface ListQueryParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}
```

### Null Safety

```typescript
// ✅ Use optional chaining
const departmentName = employee?.department?.name ?? 'Unassigned'

// ✅ Use nullish coalescing for defaults
const pageSize = query.limit ?? 10

// ✅ Type guards for runtime checks
function isEmployee(user: User | Employee): user is Employee {
  return 'employeeId' in user
}
```

---

## Component Development

### File Structure

Each module page follows this structure:

```
src/app/(module)/
├── page.tsx              # Main page component
├── [id]/
│   └── page.tsx          # Detail view
├── components/
│   ├── module-stats.tsx  # Stats cards
│   ├── module-table.tsx  # Data table
│   └── module-form.tsx   # Create/Edit form dialog
└── loading.tsx           # Loading skeleton
```

### Component Template

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

// Types
interface ModuleItem {
  id: string
  name: string
  status: string
}

export default function ModulePage() {
  // State
  const [items, setItems] = useState<ModuleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Data fetching
  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/module')
      const data = await res.json()
      setItems(data)
    } catch (error) {
      console.error('Failed to fetch:', error)
    } finally {
      setLoading(false)
    }
  }

  // Event handlers
  const handleCreate = async (data: Partial<ModuleItem>) => {
    try {
      const res = await fetch('/api/module', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        fetchItems() // Refresh list
        setShowCreateDialog(false)
      }
    } catch (error) {
      console.error('Failed to create:', error)
    }
  }

  // Render
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Module Name</h1>
          <p className="text-muted-foreground">Module description</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add New
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      {/* ... */}

      {/* Dialogs */}
      {/* ... */}
    </div>
  )
}
```

### shadcn/ui Component Usage

```tsx
// ✅ Use shadcn/ui components for consistency
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ✅ Use Badge for status indicators
<Badge variant={status === 'active' ? 'default' : 'secondary'}>
  {status}
</Badge>

// ✅ Use Dialog for forms and confirmations
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Create Employee</DialogTitle>
    </DialogHeader>
    {/* Form content */}
  </DialogContent>
</Dialog>
```

### Responsive Design

```tsx
// ✅ Use responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Cards */}
</div>

// ✅ Mobile-first approach
<div className="flex flex-col md:flex-row gap-4">
  {/* Sidebar + Content */}
</div>

// ✅ Hide/show based on screen size
<span className="hidden md:inline">Full Text</span>
<span className="md:hidden">Short</span>
```

---

## API Route Patterns

### Standard GET Route

```typescript
// src/app/api/[module]/route.ts
import { prisma } from '@/lib/prisma'
import { demoData } from '@/lib/demo-data'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''

    const where = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : {}

    const [data, total] = await Promise.all([
      prisma.model.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { related: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.model.count({ where }),
    ])

    return Response.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('API Error:', error)
    return Response.json(demoData)
  }
}
```

### Standard POST Route

```typescript
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.email) {
      return Response.json(
        { error: 'Name and email are required' },
        { status: 400 }
      )
    }

    // Create record
    const record = await prisma.model.create({
      data: {
        name: body.name,
        email: body.email,
        // ... other fields
      },
    })

    return Response.json(record, { status: 201 })
  } catch (error) {
    console.error('Create Error:', error)

    if (error.code === 'P2002') {
      return Response.json(
        { error: 'Record already exists' },
        { status: 409 }
      )
    }

    return Response.json(
      { error: 'Failed to create record' },
      { status: 500 }
    )
  }
}
```

### Dynamic Route (GET/PUT/DELETE by ID)

```typescript
// src/app/api/[module]/[id]/route.ts
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const record = await prisma.model.findUnique({
      where: { id: params.id },
      include: { related: true },
    })

    if (!record) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    return Response.json(record)
  } catch (error) {
    console.error('Fetch Error:', error)
    return Response.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    const record = await prisma.model.update({
      where: { id: params.id },
      data: body,
    })

    return Response.json(record)
  } catch (error) {
    console.error('Update Error:', error)
    return Response.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.model.delete({
      where: { id: params.id },
    })

    return Response.json({ message: 'Deleted successfully' })
  } catch (error) {
    console.error('Delete Error:', error)
    return Response.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
```

### Demo Data Fallback Pattern

Every API route must include a fallback to demo data:

```typescript
import { demoEmployees } from '@/lib/demo-data'

export async function GET(request: Request) {
  try {
    const data = await prisma.employee.findMany({
      include: { department: true, branch: true },
      orderBy: { createdAt: 'desc' },
    })
    return Response.json(data)
  } catch (error) {
    // Graceful fallback to demo data
    console.error('Database error, returning demo data:', error)
    return Response.json(demoEmployees)
  }
}
```

---

## Git Workflow

### Branch Strategy

```
main (production)
  ├── develop (integration)
  │   ├── feature/employee-bulk-import
  │   ├── feature/payroll-reports
  │   ├── fix/attendance-calculation
  │   └── enhancement/dashboard-charts
  └── hotfix/critical-login-fix
```

### Branch Naming

| Type | Format | Example |
|------|--------|---------|
| Feature | `feature/description` | `feature/employee-bulk-import` |
| Bug Fix | `fix/description` | `fix/attendance-calculation` |
| Enhancement | `enhancement/description` | `enhancement/dashboard-charts` |
| Hotfix | `hotfix/description` | `hotfix/critical-login-fix` |

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation change |
| `style` | Code style (formatting, no logic change) |
| `refactor` | Code refactoring |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build, CI, or tooling changes |

**Examples:**
```
feat(employees): add bulk import via CSV
fix(payroll): correct tax calculation for senior employees
docs(api): update API reference with new endpoints
refactor(attendance): extract check-in logic to utility function
```

### Pull Request Process

1. **Create branch** from `develop`
2. **Implement changes** with clear, focused commits
3. **Test locally** — ensure `bun run build` passes
4. **Push branch** and create PR to `develop`
5. **Code review** — at least one approval required
6. **CI checks pass** — lint, type-check, build
7. **Squash merge** into `develop`
8. **Deploy to staging** for QA
9. **Merge to `main`** for production release

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Feature
- [ ] Bug fix
- [ ] Breaking change
- [ ] Documentation

## Testing
- [ ] Tested locally
- [ ] Added/updated tests
- [ ] No breaking changes

## Screenshots (if UI changes)
[Add screenshots]

## Checklist
- [ ] Code follows project conventions
- [ ] Self-reviewed the code
- [ ] No console.log left in code
- [ ] API routes include demo data fallback
```

---

## Testing Approach

### Testing Strategy

| Level | Tool | Coverage Goal |
|-------|------|---------------|
| Unit Tests | Vitest | Core utilities and functions |
| Component Tests | React Testing Library | Key components |
| Integration Tests | Vitest + MSW | API routes |
| E2E Tests | Playwright | Critical user flows |

### Unit Test Example

```typescript
// __tests__/lib/utils.test.ts
import { describe, it, expect } from 'vitest'
import { formatCurrency, calculateNetSalary } from '@/lib/utils'

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(5000)).toBe('$5,000.00')
  })

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })
})

describe('calculateNetSalary', () => {
  it('calculates net salary correctly', () => {
    const result = calculateNetSalary({
      grossSalary: 10000,
      totalDeductions: 2500,
    })
    expect(result).toBe(7500)
  })
})
```

### Component Test Example

```typescript
// __tests__/components/employee-card.test.tsx
import { render, screen } from '@testing-library/react'
import { EmployeeCard } from '@/components/employee-card'

describe('EmployeeCard', () => {
  const mockEmployee = {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    designation: 'Developer',
    department: { name: 'Engineering' },
    status: 'active',
  }

  it('renders employee name', () => {
    render(<EmployeeCard employee={mockEmployee} />)
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('shows active badge', () => {
    render(<EmployeeCard employee={mockEmployee} />)
    expect(screen.getByText('active')).toBeInTheDocument()
  })
})
```

### API Route Test Example

```typescript
// __tests__/api/employees.test.ts
import { describe, it, expect, vi } from 'vitest'
import { GET } from '@/app/api/employees/route'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    employee: {
      findMany: vi.fn().mockResolvedValue([
        { id: '1', firstName: 'John', lastName: 'Doe' }
      ]),
      count: vi.fn().mockResolvedValue(1),
    },
  },
}))

describe('GET /api/employees', () => {
  it('returns employees with pagination', async () => {
    const request = new Request('http://localhost:3000/api/employees')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toHaveLength(1)
    expect(data.pagination).toBeDefined()
  })
})
```

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test __tests__/lib/utils.test.ts

# Run with coverage
bun test --coverage

# Run in watch mode
bun test --watch

# Run E2E tests
bunx playwright test
```

---

## Performance Guidelines

### Rendering Performance

```tsx
// ✅ Memoize expensive computations
const sortedData = useMemo(
  () => data.sort((a, b) => a.name.localeCompare(b.name)),
  [data]
)

// ✅ Memoize expensive components
const ExpensiveRow = React.memo(({ item }: { item: Item }) => (
  <tr>...</tr>
))

// ✅ Use dynamic imports for heavy modules
const HeavyChart = dynamic(() => import('./heavy-chart'), {
  loading: () => <Skeleton className="h-64" />,
  ssr: false,
})
```

### Data Fetching

```typescript
// ✅ Use Promise.all for parallel requests
const [employees, departments, branches] = await Promise.all([
  fetch('/api/employees').then(r => r.json()),
  fetch('/api/departments').then(r => r.json()),
  fetch('/api/branches').then(r => r.json()),
])

// ✅ Implement pagination to limit data size
const res = await fetch(`/api/employees?page=${page}&limit=${limit}`)

// ✅ Use select to limit fields
const employees = await prisma.employee.findMany({
  select: { id: true, firstName: true, lastName: true, designation: true },
})
```

### Build Optimization

```typescript
// next.config.ts
const nextConfig = {
  // Enable React strict mode
  reactStrictMode: true,

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Experimental features
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
  },
}
```

---

## Adding a New Module

Follow this checklist when adding a new module:

1. **Prisma Model**: Add model to `prisma/schema.prisma`
2. **API Routes**: Create `src/app/api/[module]/route.ts`
3. **Demo Data**: Add demo data to `src/lib/demo-data.ts`
4. **Types**: Define TypeScript types in `src/types/`
5. **Page Component**: Create `src/app/(module)/page.tsx`
6. **Sub-components**: Create module-specific components
7. **Sidebar Navigation**: Add entry to sidebar config
8. **Role Permissions**: Define access in role configuration
9. **Test**: Write unit and integration tests
10. **Documentation**: Update wiki pages

---

*See also: [API Reference](API-Reference), [System Architecture](System-Architecture), [Database Schema](Database-Schema)*
