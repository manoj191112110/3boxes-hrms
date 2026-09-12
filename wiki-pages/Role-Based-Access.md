# 🔐 Role-Based Access Control

Complete documentation of the NEXUS HRMS role-based access control (RBAC) system, including all 14 user roles, module visibility, and the permission matrix.

---

## Overview

NEXUS HRMS implements a comprehensive role-based access control system that determines what modules, features, and data each user can access. The system supports 14 distinct roles, each with carefully defined permissions aligned with organizational responsibilities.

---

## User Roles

### Role Hierarchy

```
Super Admin
    └── Admin
        ├── HR Manager
        │   ├── HR Executive
        │   └── Helpdesk
        ├── Manager
        │   └── Team Lead
        │       ├── Senior Employee
        │       └── Employee
        │           └── Intern
        ├── Auditor
        ├── Client
        └── Vendor
    └── Candidate
```

### Role Definitions

| Role | Description | Typical User |
|------|-------------|-------------|
| **Super Admin** | Full system access across all companies | Platform owner |
| **Admin** | Full access within their company | Company administrator |
| **HR Manager** | HR module management and approvals | HR department head |
| **HR Executive** | Day-to-day HR operations | HR team member |
| **Manager** | Team management and approvals | Department/Team manager |
| **Team Lead** | Team oversight and limited approvals | Team leader |
| **Senior Employee** | Self-service with enhanced access | Experienced employee |
| **Employee** | Standard self-service access | Regular employee |
| **Intern** | Limited self-service access | Intern/trainee |
| **Candidate** | Recruitment portal access | Job applicant |
| **Client** | Client portal access | Client representative |
| **Vendor** | Vendor portal access | Vendor representative |
| **Auditor** | Read-only compliance access | External auditor |
| **Helpdesk** | Support ticket management | IT/HR support staff |

---

## Module Visibility Per Role

### ✅ = Full Access | 👁️ = Read-Only | ❌ = No Access

| Module | Super Admin | Admin | HR Manager | HR Executive | Manager | Team Lead | Sr. Employee | Employee | Intern | Candidate | Client | Vendor | Auditor | Helpdesk |
|--------|:-----------:|:-----:|:----------:|:------------:|:-------:|:---------:|:------------:|:--------:|:------:|:---------:|:------:|:------:|:-------:|:--------:|
| **Dashboard** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | 👁️ | ✅ |
| **Employees** | ✅ | ✅ | ✅ | ✅ | 👁️ | 👁️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 👁️ | ❌ |
| **Recruitment** | ✅ | ✅ | ✅ | ✅ | 👁️ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | 👁️ | ❌ |
| **Attendance** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | 👁️ | ❌ |
| **Leave** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | 👁️ | ❌ |
| **Payroll** | ✅ | ✅ | ✅ | 👁️ | 👁️ | ❌ | ❌ | 👁️* | 👁️* | ❌ | ❌ | ❌ | 👁️ | ❌ |
| **Performance** | ✅ | ✅ | ✅ | 👁️ | ✅ | ✅ | 👁️ | 👁️ | ❌ | ❌ | ❌ | ❌ | 👁️ | ❌ |
| **Learning** | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | 👁️ | ❌ |
| **Engagement** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | 👁️ | ❌ |
| **Helpdesk** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | 👁️ | ✅ |
| **Travel & Expense** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ | ❌ | ❌ | ❌ | 👁️ | ❌ |
| **Assets** | ✅ | ✅ | ✅ | 👁️ | 👁️ | ❌ | ❌ | 👁️ | ❌ | ❌ | ❌ | ❌ | 👁️ | ❌ |
| **Compliance** | ✅ | ✅ | ✅ | 👁️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Workflow Builder** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 👁️ | ❌ |
| **AI Interview** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | 👁️ | ❌ | ❌ | ❌ | ❌ |
| **Job Portal** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Client Portal** | ✅ | ✅ | 👁️ | ❌ | 👁️ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | 👁️ | ❌ |
| **Vendor Portal** | ✅ | ✅ | 👁️ | ❌ | 👁️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | 👁️ | ❌ |
| **Analytics** | ✅ | ✅ | ✅ | 👁️ | ✅ | 👁️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **AI Chatbot** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | 👁️ | ✅ |
| **Alumni** | ✅ | ✅ | ✅ | 👁️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 👁️ | ❌ |
| **Help & Training** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> *\*Employee/Intern payroll access is limited to their own payslip only*

---

## Permission Matrix

### Data Access Permissions

| Permission | Super Admin | Admin | HR Manager | HR Exec | Manager | Team Lead | Employee | Intern |
|-----------|:-----------:|:-----:|:----------:|:-------:|:-------:|:---------:|:--------:|:------:|
| View all employees | ✅ | ✅ | ✅ | ✅ | ✅ | Team only | Self | Self |
| Edit employee details | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Self | Self |
| Delete employees | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View salary info | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | Self | Self |
| Edit salary info | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Export employee data | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Approval Permissions

| Permission | Super Admin | Admin | HR Manager | Manager | Team Lead |
|-----------|:-----------:|:-----:|:----------:|:-------:|:---------:|
| Approve leave requests | ✅ | ✅ | ✅ | ✅ (team) | ✅ (team) |
| Reject leave requests | ✅ | ✅ | ✅ | ✅ (team) | ✅ (team) |
| Approve expenses | ✅ | ✅ | ✅ | ✅ (team) | ❌ |
| Approve travel | ✅ | ✅ | ✅ | ✅ (team) | ❌ |
| Approve workflow steps | ✅ | ✅ | ✅ | ✅ (assigned) | ✅ (assigned) |
| Override approvals | ✅ | ✅ | ✅ | ❌ | ❌ |

### Module Administration

| Permission | Super Admin | Admin | HR Manager | HR Exec |
|-----------|:-----------:|:-----:|:----------:|:-------:|
| Create/edit departments | ✅ | ✅ | ✅ | ❌ |
| Create/edit branches | ✅ | ✅ | ✅ | ❌ |
| Manage roles | ✅ | ✅ | ❌ | ❌ |
| Configure workflows | ✅ | ✅ | ✅ | ❌ |
| Manage company settings | ✅ | ✅ | ❌ | ❌ |
| Access audit logs | ✅ | ✅ | ✅ | ❌ |
| Run payroll | ✅ | ✅ | ✅ | ❌ |
| Manage asset registry | ✅ | ✅ | ✅ | 👁️ |

---

## Role-Specific Capabilities

### Super Admin
- Access across all companies (multi-tenant)
- Manage company-level settings
- Create and delete companies
- Assign admin roles
- Access all audit logs
- Override any approval
- Configure system-wide settings

### Admin
- Full access within their company
- Manage users and roles (within company)
- Configure company settings
- Run payroll
- Access all reports and analytics
- Manage integrations

### HR Manager
- Full HR module access
- Approve/reject all HR requests
- Run payroll processing
- Manage recruitment pipeline
- Configure leave policies
- View compliance reports
- Create surveys and engagement programs

### HR Executive
- Day-to-day HR operations
- Add/edit employees
- Process leave requests (recommend)
- Manage attendance records
- Schedule interviews
- Create helpdesk tickets
- View (not edit) payroll records

### Manager
- View team members' details
- Approve team leave requests
- Approve team expenses
- Conduct performance reviews
- Assign training to team
- View team analytics
- Limited recruitment access (interviewer)

### Team Lead
- View team members (limited)
- Approve team leave requests
- View team attendance
- Submit feedback for team
- Limited expense approval

### Employee
- Self-service access only
- View own profile and payslips
- Submit leave requests
- Check in/out attendance
- Submit expense claims
- Create helpdesk tickets
- Access learning modules
- Use AI chatbot

### Intern
- Limited self-service access
- View own profile
- Check in/out attendance
- Submit leave requests (limited types)
- Access learning modules
- Create helpdesk tickets

### Candidate
- Access job portal only
- View open positions
- Submit applications
- Track application status
- Attend scheduled interviews
- Upload resume and documents

### Client
- Client portal access
- View contract details
- Track project status
- Download invoices
- Communicate with team
- Submit support tickets

### Vendor
- Vendor portal access
- View purchase orders
- Submit invoices
- View contract details
- Update vendor profile
- Communicate with procurement

### Auditor
- Read-only access across modules
- View audit logs
- View compliance reports
- View payroll summaries
- No edit/create permissions
- No access to sensitive data (passwords, bank details)

### Helpdesk
- Full ticket management
- Create, edit, close tickets
- Assign tickets to agents
- View employee directory (basic info)
- Access knowledge base management
- Run ticket reports

---

## Role Switching

NEXUS HRMS provides a role switcher in the sidebar for demo and testing purposes. This allows users (especially admins) to experience the application from different role perspectives.

### How to Switch Roles
1. Click the role badge in the sidebar footer
2. Select a role from the dropdown
3. The UI updates to reflect the selected role's permissions
4. Module visibility and actions adjust accordingly

> **⚠️ Note**: Role switching in production should be restricted to admin users only and requires a separate authentication step.

---

## Permission Implementation

### Frontend Permission Check

```typescript
// Module visibility based on role
const moduleVisibility: Record<UserRole, string[]> = {
  super_admin: ['*'], // All modules
  admin: ['*'],       // All modules within company
  hr_manager: ['dashboard', 'employees', 'recruitment', 'attendance',
               'leave', 'payroll', 'performance', 'learning', 'engagement',
               'helpdesk', 'travel', 'assets', 'compliance', 'workflows',
               'analytics', 'chatbot', 'alumni'],
  employee: ['dashboard', 'attendance', 'leave', 'helpdesk',
             'travel', 'learning', 'engagement', 'chatbot'],
  // ... other roles
}

// Action permission check
function canPerform(role: UserRole, action: string, resource: string): boolean {
  const permissions = rolePermissions[role]
  return permissions?.[resource]?.includes(action) ?? false
}
```

### API-Level Permission

```typescript
// API route middleware
export async function GET(request: Request) {
  const user = await getCurrentUser()

  if (!canAccess(user.role, 'employees', 'read')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Scope data based on role
  if (user.role === 'manager') {
    return getTeamEmployees(user.id)
  }

  return getAllEmployees(user.companyId)
}
```

---

## Best Practices

1. **Principle of Least Privilege**: Assign the minimum role needed
2. **Regular Audits**: Review role assignments quarterly
3. **Separation of Duties**: Don't combine conflicting roles (e.g., payroll creator and approver)
4. **Document Exceptions**: Any permission overrides should be documented
5. **Monitor Access**: Use audit logs to track role changes
6. **Onboarding**: Assign roles during employee onboarding
7. **Offboarding**: Revoke access promptly upon exit

---

*See also: [Module Guide](Module-Guide), [API Reference](API-Reference), [Troubleshooting](Troubleshooting)*
