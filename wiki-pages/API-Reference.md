# 📡 API Reference

Complete documentation for all NEXUS HRMS REST API endpoints. The API follows RESTful conventions and uses JSON for request/response payloads.

---

## Overview

- **Base URL**: `http://localhost:3000/api`
- **Content Type**: `application/json`
- **Authentication**: Session-based (cookie)
- **Pagination**: Query parameters (`page`, `limit`)
- **Error Format**: `{ error: string, details?: string }`
- **Demo Fallback**: All endpoints return demo data when database is unavailable

---

## Authentication

### POST `/api/auth/login`

Authenticate a user and create a session.

**Request Body:**
```json
{
  "email": "admin@nexushrms.com",
  "password": "admin123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "clx...",
    "email": "admin@nexushrms.com",
    "name": "Super Admin",
    "role": "super_admin",
    "companyId": "clx..."
  },
  "token": "jwt-token-here"
}
```

**Error (401):**
```json
{
  "error": "Invalid credentials"
}
```

### POST `/api/auth/logout`

Terminate the current session.

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

## Dashboard

### GET `/api/dashboard/stats`

Retrieve dashboard statistics for the current user's company.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `companyId` | string | — | Filter by company |

**Response (200):**
```json
{
  "totalEmployees": 156,
  "activeEmployees": 142,
  "departments": 8,
  "branches": 4,
  "openPositions": 6,
  "pendingLeaves": 12,
  "pendingTickets": 5,
  "attendanceToday": {
    "present": 128,
    "absent": 14,
    "late": 8,
    "onLeave": 6
  },
  "recentActivities": [...],
  "headCountTrend": [...]
}
```

---

## Employees

### GET `/api/employees`

List all employees with pagination and filtering.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page |
| `department` | string | — | Filter by department |
| `branch` | string | — | Filter by branch |
| `status` | string | — | Filter by status (active/inactive) |
| `search` | string | — | Search by name or email |

**Response (200):**
```json
{
  "employees": [
    {
      "id": "clx...",
      "employeeId": "EMP001",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@company.com",
      "phone": "+1-555-0101",
      "department": { "id": "...", "name": "Engineering" },
      "designation": "Senior Developer",
      "branch": { "id": "...", "name": "New York" },
      "status": "active",
      "joinDate": "2023-01-15",
      "avatar": "/avatars/john.jpg"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 156,
    "totalPages": 16
  }
}
```

### POST `/api/employees`

Create a new employee.

**Request Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@company.com",
  "phone": "+1-555-0202",
  "departmentId": "clx...",
  "designation": "Product Manager",
  "branchId": "clx...",
  "joinDate": "2024-03-01",
  "salary": 95000,
  "reportingTo": "clx..."
}
```

**Response (201):**
```json
{
  "employee": {
    "id": "clx...",
    "employeeId": "EMP157",
    "firstName": "Jane",
    "lastName": "Smith",
    ...
  }
}
```

### GET `/api/employees/[id]`

Get a single employee by ID.

**Response (200):**
```json
{
  "id": "clx...",
  "employeeId": "EMP001",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@company.com",
  "phone": "+1-555-0101",
  "department": { "id": "...", "name": "Engineering" },
  "designation": "Senior Developer",
  "branch": { "id": "...", "name": "New York" },
  "status": "active",
  "joinDate": "2023-01-15",
  "salary": 85000,
  "reportingTo": { "id": "...", "name": "Manager Name" },
  "address": { ... },
  "emergencyContact": { ... },
  "bankDetails": { ... }
}
```

### PUT `/api/employees/[id]`

Update an employee record.

**Request Body:** (partial update supported)
```json
{
  "firstName": "John",
  "lastName": "Updated",
  "designation": "Lead Developer",
  "salary": 95000
}
```

**Response (200):**
```json
{
  "employee": { ... updated fields ... }
}
```

### DELETE `/api/employees/[id]`

Delete (soft-delete) an employee.

**Response (200):**
```json
{
  "message": "Employee deleted successfully",
  "id": "clx..."
}
```

---

## Departments

### GET `/api/departments`

List all departments.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `companyId` | string | Filter by company |

**Response (200):**
```json
{
  "departments": [
    {
      "id": "clx...",
      "name": "Engineering",
      "description": "Software development and technical operations",
      "head": { "id": "...", "name": "CTO Name" },
      "employeeCount": 45,
      "budget": 5000000
    }
  ]
}
```

### POST `/api/departments`

Create a new department.

**Request Body:**
```json
{
  "name": "Data Science",
  "description": "AI/ML and data analytics team",
  "headId": "clx...",
  "budget": 2000000
}
```

### PUT `/api/departments/[id]`

Update a department.

### DELETE `/api/departments/[id]`

Delete a department.

---

## Branches

### GET `/api/branches`

List all company branches/locations.

**Response (200):**
```json
{
  "branches": [
    {
      "id": "clx...",
      "name": "New York HQ",
      "address": "123 Broadway, New York, NY 10001",
      "city": "New York",
      "country": "USA",
      "timezone": "America/New_York",
      "employeeCount": 65
    }
  ]
}
```

### POST `/api/branches`

Create a new branch.

**Request Body:**
```json
{
  "name": "Berlin Office",
  "address": "Friedrichstraße 123, 10117 Berlin",
  "city": "Berlin",
  "country": "Germany",
  "timezone": "Europe/Berlin"
}
```

### PUT `/api/branches/[id]`

Update a branch.

### DELETE `/api/branches/[id]`

Delete a branch.

---

## Recruitment

### GET `/api/jobs`

List all job openings.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter: open/closed/draft |
| `department` | string | Filter by department |
| `type` | string | Filter: full-time/part-time/contract/internship |

**Response (200):**
```json
{
  "jobs": [
    {
      "id": "clx...",
      "title": "Senior React Developer",
      "department": { "name": "Engineering" },
      "location": "Remote",
      "type": "full-time",
      "status": "open",
      "salaryRange": { "min": 120000, "max": 160000 },
      "postedDate": "2024-02-01",
      "applicantCount": 24,
      "description": "..."
    }
  ]
}
```

### POST `/api/jobs`

Create a new job posting.

**Request Body:**
```json
{
  "title": "UX Designer",
  "departmentId": "clx...",
  "location": "San Francisco",
  "type": "full-time",
  "salaryMin": 90000,
  "salaryMax": 130000,
  "description": "...",
  "requirements": ["Figma", "User Research", "Prototyping"],
  "status": "open"
}
```

### PUT `/api/jobs/[id]`

Update a job posting.

### DELETE `/api/jobs/[id]`

Delete a job posting.

### GET `/api/candidates`

List all candidates in the recruitment pipeline.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `jobId` | string | Filter by job |
| `stage` | string | Filter: applied/screening/interview/offer/hired/rejected |

**Response (200):**
```json
{
  "candidates": [
    {
      "id": "clx...",
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "phone": "+1-555-0303",
      "job": { "id": "...", "title": "Senior React Developer" },
      "stage": "interview",
      "appliedDate": "2024-02-10",
      "resume": "/resumes/alice.pdf",
      "rating": 4.5,
      "notes": "Strong technical skills"
    }
  ]
}
```

### POST `/api/candidates`

Add a new candidate.

### PUT `/api/candidates/[id]`

Update candidate information or move to next stage.

### PATCH `/api/candidates/[id]/stage`

Move a candidate to a different recruitment stage.

**Request Body:**
```json
{
  "stage": "interview"
}
```

### GET `/api/interviews`

List all scheduled interviews.

**Response (200):**
```json
{
  "interviews": [
    {
      "id": "clx...",
      "candidate": { "id": "...", "name": "Alice Johnson" },
      "interviewer": { "id": "...", "name": "Bob Manager" },
      "job": { "id": "...", "title": "Senior React Developer" },
      "scheduledAt": "2024-03-15T10:00:00Z",
      "duration": 60,
      "type": "technical",
      "status": "scheduled",
      "location": "Conference Room A",
      "meetingLink": "https://meet.google.com/..."
    }
  ]
}
```

### POST `/api/interviews`

Schedule a new interview.

### PUT `/api/interviews/[id]`

Update interview details.

### PATCH `/api/interviews/[id]/status`

Update interview status (scheduled/completed/cancelled/no-show).

---

## Attendance

### GET `/api/attendance`

List attendance records.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | string | Filter by date (YYYY-MM-DD) |
| `employeeId` | string | Filter by employee |
| `month` | string | Filter by month (YYYY-MM) |

**Response (200):**
```json
{
  "records": [
    {
      "id": "clx...",
      "employee": { "id": "...", "name": "John Doe" },
      "date": "2024-03-01",
      "checkIn": "09:00:00",
      "checkOut": "18:15:00",
      "status": "present",
      "hoursWorked": 9.25,
      "overtime": 1.25,
      "note": ""
    }
  ],
  "summary": {
    "present": 128,
    "absent": 14,
    "late": 8,
    "onLeave": 6
  }
}
```

### POST `/api/attendance`

Record check-in or check-out.

**Request Body:**
```json
{
  "employeeId": "clx...",
  "type": "check-in",
  "note": "Arrived on time"
}
```

### GET `/api/attendance/summary`

Get attendance summary for a period.

---

## Leave Management

### GET `/api/leave`

List leave requests.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter: pending/approved/rejected |
| `employeeId` | string | Filter by employee |
| `type` | string | Filter: casual/sick/annual/maternity/paternity |

**Response (200):**
```json
{
  "leaves": [
    {
      "id": "clx...",
      "employee": { "id": "...", "name": "John Doe" },
      "type": "annual",
      "startDate": "2024-03-20",
      "endDate": "2024-03-22",
      "days": 3,
      "status": "pending",
      "reason": "Family vacation",
      "approvedBy": null,
      "appliedDate": "2024-03-10"
    }
  ]
}
```

### POST `/api/leave`

Submit a new leave request.

**Request Body:**
```json
{
  "type": "sick",
  "startDate": "2024-03-15",
  "endDate": "2024-03-16",
  "reason": "Medical appointment",
  "documents": ["/uploads/medical-cert.pdf"]
}
```

### PATCH `/api/leave/[id]/approve`

Approve a leave request.

### PATCH `/api/leave/[id]/reject`

Reject a leave request.

**Request Body:**
```json
{
  "rejectionReason": "Insufficient leave balance"
}
```

---

## Payroll

### GET `/api/payroll`

List payroll records.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `month` | string | Filter by month (YYYY-MM) |
| `employeeId` | string | Filter by employee |
| `status` | string | Filter: pending/processed/paid |

**Response (200):**
```json
{
  "payroll": [
    {
      "id": "clx...",
      "employee": { "id": "...", "name": "John Doe", "employeeId": "EMP001" },
      "month": "2024-02",
      "basicSalary": 7083.33,
      "hra": 2833.33,
      "da": 1416.67,
      "specialAllowance": 1000,
      "grossSalary": 12333.33,
      "pf": 850,
      "esi": 216.67,
      "tax": 1500,
      "professionalTax": 200,
      "totalDeductions": 2766.67,
      "netSalary": 9566.66,
      "status": "paid",
      "paidDate": "2024-03-01"
    }
  ]
}
```

### POST `/api/payroll`

Process payroll for a month.

**Request Body:**
```json
{
  "month": "2024-03",
  "employeeIds": ["clx..."],
  "processAll": false
}
```

### GET `/api/payroll/payslip/[id]`

Generate a payslip for a specific payroll record.

---

## Assets

### GET `/api/assets`

List all company assets.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Filter: laptop/monitor/phone/furniture/other |
| `status` | string | Filter: allocated/available/under-repair/retired |
| `assignedTo` | string | Filter by employee ID |

**Response (200):**
```json
{
  "assets": [
    {
      "id": "clx...",
      "assetId": "AST001",
      "name": "MacBook Pro 16\"",
      "category": "laptop",
      "serialNumber": "C02XX1YYFFFFFF",
      "assignedTo": { "id": "...", "name": "John Doe" },
      "assignedDate": "2023-06-15",
      "status": "allocated",
      "purchaseDate": "2023-05-01",
      "purchaseCost": 2499.00,
      "warrantyExpiry": "2026-05-01"
    }
  ]
}
```

### POST `/api/assets`

Register a new asset.

### PUT `/api/assets/[id]`

Update asset details.

### PATCH `/api/assets/[id]/allocate`

Allocate an asset to an employee.

### PATCH `/api/assets/[id]/return`

Return an asset (mark as available).

---

## Travel & Expense

### GET `/api/travel`

List travel requests.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter: pending/approved/rejected/completed |
| `employeeId` | string | Filter by employee |

**Response (200):**
```json
{
  "travels": [
    {
      "id": "clx...",
      "employee": { "id": "...", "name": "John Doe" },
      "purpose": "Client meeting",
      "destination": "London, UK",
      "departureDate": "2024-04-01",
      "returnDate": "2024-04-05",
      "estimatedCost": 3500,
      "status": "approved",
      "approvedBy": { "name": "Manager" },
      "itinerary": { ... }
    }
  ]
}
```

### POST `/api/travel`

Submit a new travel request.

### PATCH `/api/travel/[id]/approve`

Approve a travel request.

### GET `/api/expenses`

List expense claims.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter: pending/approved/rejected/reimbursed |
| `category` | string | Filter: travel/food/accommodation/other |

**Response (200):**
```json
{
  "expenses": [
    {
      "id": "clx...",
      "employee": { "id": "...", "name": "John Doe" },
      "title": "Client Dinner",
      "category": "food",
      "amount": 150.00,
      "date": "2024-03-10",
      "status": "pending",
      "receipts": ["/uploads/receipt1.jpg"],
      "notes": "Dinner with client team"
    }
  ]
}
```

### POST `/api/expenses`

Submit a new expense claim.

### PATCH `/api/expenses/[id]/approve`

Approve an expense claim.

---

## Helpdesk

### GET `/api/tickets`

List support tickets.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter: open/in-progress/resolved/closed |
| `priority` | string | Filter: low/medium/high/critical |
| `category` | string | Filter: it/hr/facilities/payroll/other |

**Response (200):**
```json
{
  "tickets": [
    {
      "id": "clx...",
      "ticketId": "TKT001",
      "title": "VPN Connection Issue",
      "description": "Unable to connect to VPN since morning",
      "category": "it",
      "priority": "high",
      "status": "open",
      "createdBy": { "id": "...", "name": "John Doe" },
      "assignedTo": { "id": "...", "name": "IT Support" },
      "createdAt": "2024-03-01T09:30:00Z",
      "comments": [...]
    }
  ]
}
```

### POST `/api/tickets`

Create a new support ticket.

**Request Body:**
```json
{
  "title": "Laptop battery issue",
  "description": "Battery drains very quickly after recent update",
  "category": "it",
  "priority": "medium"
}
```

### PUT `/api/tickets/[id]`

Update a ticket.

### PATCH `/api/tickets/[id]/status`

Update ticket status.

---

## Clients

### GET `/api/clients`

List all client companies.

**Response (200):**
```json
{
  "clients": [
    {
      "id": "clx...",
      "name": "Acme Corp",
      "industry": "Technology",
      "contactPerson": "Bob Wilson",
      "email": "bob@acme.com",
      "phone": "+1-555-0404",
      "contractValue": 500000,
      "status": "active",
      "startDate": "2023-01-01"
    }
  ]
}
```

### POST `/api/clients`

Add a new client.

### PUT `/api/clients/[id]`

Update client details.

### DELETE `/api/clients/[id]`

Remove a client.

---

## Vendors

### GET `/api/vendors`

List all vendor companies.

**Response (200):**
```json
{
  "vendors": [
    {
      "id": "clx...",
      "name": "CloudTech Solutions",
      "category": "IT Services",
      "contactPerson": "Sarah Lee",
      "email": "sarah@cloudtech.com",
      "phone": "+1-555-0505",
      "contractValue": 200000,
      "status": "active",
      "rating": 4.5
    }
  ]
}
```

### POST `/api/vendors`

Add a new vendor.

### PUT `/api/vendors/[id]`

Update vendor details.

### DELETE `/api/vendors/[id]`

Remove a vendor.

---

## Workflows

### GET `/api/workflows`

List workflow definitions.

**Response (200):**
```json
{
  "workflows": [
    {
      "id": "clx...",
      "name": "Leave Approval Workflow",
      "description": "Multi-level leave approval process",
      "type": "approval",
      "steps": [
        { "step": 1, "approver": "reporting_manager", "action": "review" },
        { "step": 2, "approver": "hr_manager", "action": "approve" }
      ],
      "status": "active",
      "instancesCount": 45
    }
  ]
}
```

### POST `/api/workflows`

Create a new workflow definition.

**Request Body:**
```json
{
  "name": "Expense Approval",
  "description": "Expense claim approval workflow",
  "type": "approval",
  "steps": [
    { "step": 1, "approverRole": "reporting_manager", "action": "review" },
    { "step": 2, "approverRole": "finance_manager", "action": "approve" }
  ]
}
```

### GET `/api/workflows/[id]/instances`

List workflow instances for a definition.

### POST `/api/workflows/[id]/trigger`

Trigger a workflow instance.

---

## Surveys

### GET `/api/surveys`

List all surveys.

**Response (200):**
```json
{
  "surveys": [
    {
      "id": "clx...",
      "title": "Employee Satisfaction Q1 2024",
      "description": "Quarterly employee satisfaction survey",
      "status": "active",
      "questions": [...],
      "responses": 89,
      "totalInvited": 142,
      "createdDate": "2024-01-15",
      "endDate": "2024-02-15"
    }
  ]
}
```

### POST `/api/surveys`

Create a new survey.

### POST `/api/surveys/[id]/respond`

Submit a survey response.

---

## Audit Logs

### GET `/api/audit-logs`

List audit log entries.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | string | Filter by user |
| `action` | string | Filter by action type |
| `entity` | string | Filter by entity type |
| `startDate` | string | Filter from date |
| `endDate` | string | Filter to date |

**Response (200):**
```json
{
  "logs": [
    {
      "id": "clx...",
      "user": { "id": "...", "name": "Admin" },
      "action": "UPDATE",
      "entity": "Employee",
      "entityId": "clx...",
      "changes": {
        "before": { "salary": 80000 },
        "after": { "salary": 95000 }
      },
      "ipAddress": "192.168.1.100",
      "timestamp": "2024-03-01T14:30:00Z"
    }
  ]
}
```

---

## Notifications

### GET `/api/notifications`

List notifications for the current user.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `unreadOnly` | boolean | Show only unread notifications |
| `type` | string | Filter by type (leave/approval/system/ticket) |

**Response (200):**
```json
{
  "notifications": [
    {
      "id": "clx...",
      "title": "Leave Request Approved",
      "message": "Your annual leave request for March 20-22 has been approved",
      "type": "leave",
      "read": false,
      "createdAt": "2024-03-10T09:00:00Z",
      "link": "/leave/requests/clx..."
    }
  ],
  "unreadCount": 5
}
```

### PATCH `/api/notifications/[id]/read`

Mark a notification as read.

### PATCH `/api/notifications/read-all`

Mark all notifications as read.

---

## Shifts

### GET `/api/shifts`

List shift schedules.

**Response (200):**
```json
{
  "shifts": [
    {
      "id": "clx...",
      "name": "Morning Shift",
      "startTime": "06:00",
      "endTime": "14:00",
      "breakDuration": 60,
      "employees": ["clx..."],
      "days": ["MON", "TUE", "WED", "THU", "FRI"]
    }
  ]
}
```

### POST `/api/shifts`

Create a new shift.

### PUT `/api/shifts/[id]`

Update shift details.

---

## Onboarding

### GET `/api/onboarding`

List onboarding tasks.

**Response (200):**
```json
{
  "tasks": [
    {
      "id": "clx...",
      "title": "Complete IT Setup",
      "description": "Set up laptop, email, and access cards",
      "assignee": "IT Department",
      "dueDate": "2024-03-05",
      "status": "pending",
      "employee": { "id": "...", "name": "New Employee" },
      "category": "it"
    }
  ]
}
```

### POST `/api/onboarding`

Create an onboarding task.

### PATCH `/api/onboarding/[id]/complete`

Mark onboarding task as complete.

---

## AI Chat

### POST `/api/chat`

Send a message to the AI chatbot assistant.

**Request Body:**
```json
{
  "message": "How many employees are on leave today?",
  "context": {
    "companyId": "clx...",
    "userId": "clx..."
  }
}
```

**Response (200):**
```json
{
  "response": "There are currently 6 employees on leave today. 2 are on annual leave, 3 on sick leave, and 1 on maternity leave.",
  "suggestions": [
    "View leave calendar",
    "Approve pending leave requests",
    "Check department-wise leave stats"
  ]
}
```

---

## Pagination

All list endpoints support pagination with the following query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number (1-indexed) |
| `limit` | number | 10 | Items per page (max: 100) |

**Pagination Response Format:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 156,
    "totalPages": 16,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": "Brief error description",
  "details": "Detailed error message (optional)",
  "code": "ERROR_CODE (optional)"
}
```

### HTTP Status Codes

| Code | Meaning | When |
|------|---------|------|
| **200** | OK | Successful GET, PUT, PATCH |
| **201** | Created | Successful POST |
| **400** | Bad Request | Invalid input, missing required fields |
| **401** | Unauthorized | Missing or invalid authentication |
| **403** | Forbidden | Insufficient permissions |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | Duplicate resource |
| **500** | Server Error | Internal error (falls back to demo data) |

### Demo Data Fallback

When a database error occurs, the API automatically returns demo data:

```typescript
try {
  const data = await prisma.model.findMany(...)
  return Response.json(data)
} catch (error) {
  console.error('DB Error, using demo data:', error)
  return Response.json(demoData) // Seamless fallback
}
```

This ensures the application remains functional even during database outages.

---

*See also: [Database Schema](Database-Schema), [System Architecture](System-Architecture), [Development Guidelines](Development-Guidelines)*
