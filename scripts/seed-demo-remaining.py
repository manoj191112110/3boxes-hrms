#!/usr/bin/env python3
"""
Seed remaining demo data with correct column schemas.
Tables to seed: LeaveRequest, Requisition, Feedback, Survey, SurveyResponse, Grievance, Interview
"""

import psycopg2
import psycopg2.extras
import random
from datetime import date, datetime, timedelta

POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'
DEMO_DB = 'tenant_demo'
NOW = datetime.now()

def get_conn(dbname):
    return psycopg2.connect(
        host=POOLER_HOST, database=dbname,
        user=DB_USER, password=DB_PASSWORD, sslmode='require',
        connect_timeout=30
    )

def ev(cur, table, columns, rows, conflict='(id) DO NOTHING'):
    if not rows: return 0
    col_str = ','.join([f'"{c}"' for c in columns])
    query = f'INSERT INTO "{table}" ({col_str}) VALUES %s ON CONFLICT {conflict}'
    try:
        psycopg2.extras.execute_values(cur, query, rows, page_size=100)
        return len(rows)
    except Exception as e:
        print(f'    ERR [{table}]: {str(e)[:120]}')
        return 0

def seed_remaining():
    print("=== SEEDING REMAINING DEMO DATA ===")
    conn = get_conn(DEMO_DB)
    conn.autocommit = True
    cur = conn.cursor()

    # Get existing IDs
    cur.execute('SELECT "id" FROM "Employee" ORDER BY "createdAt";')
    emp_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT "id" FROM "LeaveType" ORDER BY "createdAt";')
    lt_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT "id" FROM "Company" ORDER BY "createdAt";')
    comp_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT "id" FROM "Department" ORDER BY "createdAt";')
    dept_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT "id" FROM "Designation" ORDER BY "createdAt";')
    desig_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT "id" FROM "Branch" ORDER BY "createdAt";')
    branch_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT "id" FROM "Tenant" LIMIT 1;')
    tenant_id = cur.fetchone()[0]

    print(f"  Found: {len(emp_ids)} emps, {len(comp_ids)} comps, {len(dept_ids)} depts, {len(lt_ids)} leave types")

    # ─── LeaveRequests (0 currently) ───
    rows = []
    for i, eid in enumerate(emp_ids):
        for j in range(3):
            lt = lt_ids[j % len(lt_ids)]
            sd = date(2025, random.randint(1,6), random.randint(1,28))
            ed = sd + timedelta(days=random.randint(1,5))
            st = random.choice(['pending','approved','rejected','cancelled'])
            ab = emp_ids[0] if st in ['approved','rejected'] else None
            aa = datetime(2025, sd.month, min(sd.day+1,28)) if st in ['approved','rejected'] else None
            hd = random.choice([True, False])
            hds = 'first_half' if hd else None
            rows.append((
                f'demo-lr-{i}-{j}', eid, lt, datetime.combine(sd, datetime.min.time()),
                datetime.combine(ed, datetime.min.time()),
                'Leave request', st, ab, aa,
                f'Need days off for personal reasons', hd, hds, None, NOW, NOW
            ))
    c = ev(cur, 'LeaveRequest',
        ['id','employeeId','leaveTypeId','startDate','endDate',
         'reason','status','approvedBy','approvedAt',
         'comments','halfDay','halfDaySlot','aiCollaborativeWarning','createdAt','updatedAt'], rows)
    print(f"  LeaveRequest: {c}")

    # ─── Requisitions ───
    rows = []
    positions = ['Senior Software Engineer', 'Product Manager', 'Data Analyst',
                'UX Designer', 'HR Specialist', 'Marketing Manager',
                'DevOps Engineer', 'Business Analyst']
    for i, pos in enumerate(positions):
        rows.append((
            f'demo-req-{i}', f'REQ-2025-{i+1}',
            comp_ids[i % len(comp_ids)],
            branch_ids[i % len(branch_ids)] if branch_ids else None,
            dept_ids[i % len(dept_ids)] if dept_ids else None,
            desig_ids[i % len(desig_ids)] if desig_ids else None,
            emp_ids[i % len(emp_ids)],
            random.choice(['full_time','part_time','contract']),
            None, random.randint(1,3),
            random.choice(['permanent','contract','internship']),
            'Python, React, SQL', f'{random.randint(3,10)} years',
            'Bachelor or Master degree',
            f'{random.randint(8,25)}L-{random.randint(30,60)}L PA',
            None, None,
            random.choice(['high','medium','low']),
            datetime(2025, random.randint(7,12), 1),
            random.choice(['pending','approved','rejected']),
            emp_ids[0] if i < 5 else None,
            datetime(2025, random.randint(1,6), 15) if i < 5 else None,
            None, random.choice(['open','in_progress','closed']), None, NOW, NOW
        ))
    c = ev(cur, 'Requisition',
        ['id','requisitionId','companyId','branchId','departmentId','designationId',
         'hiringManagerId','positionType','replacementEmployeeId','numberOfOpenings',
         'employmentType','skillsRequired','experienceRequired','qualification',
         'salaryBudget','projectId','clientId','priority','expectedJoiningDate',
         'approvalStatus','approvedBy','approvedAt','rejectionReason','status',
         'jobPostingId','createdAt','updatedAt'], rows)
    print(f"  Requisition: {c}")

    # ─── Feedback ───
    rows = []
    for i, eid in enumerate(emp_ids):
        for j in range(2):
            rows.append((
                f'demo-fb-{i}-{j}',
                emp_ids[(i+3) % len(emp_ids)],
                eid,
                random.choice(['peer','manager','self','360']),
                random.randint(3,5),
                f'Feedback on performance and collaboration',
                random.choice([True, False]),
                NOW, NOW
            ))
    c = ev(cur, 'Feedback',
        ['id','fromId','toId','type','rating','comments','isAnonymous','createdAt','updatedAt'], rows)
    print(f"  Feedback: {c}")

    # ─── Survey + SurveyResponse ───
    rows = []
    for j, (title, stype) in enumerate([
        ('Employee Satisfaction Q1 2025','satisfaction'),
        ('Work Culture Assessment','culture'),
        ('Manager Effectiveness Review','manager'),
        ('Remote Work Experience','remote_work')]):
        questions = json_str = '[{"q":"How satisfied are you?","type":"rating"},{"q":"What improvements?","type":"text"}]'
        rows.append((
            f'demo-survey-{j}', title, f'{title} survey for all employees',
            stype, random.choice(['draft','active','completed']),
            random.choice([True, False]), 'all_employees', questions,
            datetime(2025, 1+j, 1), datetime(2025, 12, 31), NOW, NOW
        ))
    c1 = ev(cur, 'Survey',
        ['id','title','description','type','status','anonymous',
         'targetAudience','questions','startDate','endDate','createdAt','updatedAt'], rows)

    sr_rows = []
    for j in range(4):
        for i, eid in enumerate(emp_ids[:15]):
            ans = json_str = f'[{{"q":1,"a":{random.randint(3,5)}}},{{"q":2,"a":"Good experience"}}]'
            sr_rows.append((
                f'demo-sr-{j}-{i}', f'demo-survey-{j}', eid,
                ans, random.choice(['positive','neutral','mixed']), NOW
            ))
    c2 = ev(cur, 'SurveyResponse',
        ['id','surveyId','employeeId','answers','sentiment','createdAt'], sr_rows)
    print(f"  Survey: {c1}, SurveyResponse: {c2}")

    # ─── Grievance ───
    rows = []
    for i, eid in enumerate(emp_ids[:15]):
        rows.append((
            f'demo-griev-{i}', eid,
            random.choice(['harassment','salary','promotion','work_condition','policy']),
            f'Grievance about workplace issue #{i+1}',
            f'Employee has reported concerns regarding their work environment and treatment.',
            random.choice(['low','medium','high','urgent']),
            random.choice(['open','investigating','resolved','closed']),
            emp_ids[0] if i < 5 else None,
            f'Issue investigated and appropriate action taken.' if i < 5 else None,
            datetime(2025, random.randint(1,6), random.randint(1,28)) if i < 5 else None,
            NOW, NOW
        ))
    c = ev(cur, 'Grievance',
        ['id','employeeId','type','subject','description','priority',
         'status','assignedTo','resolution','resolvedDate','createdAt','updatedAt'], rows)
    print(f"  Grievance: {c}")

    # ─── Interview ───
    rows = []
    for j in range(8):
        rows.append((
            f'demo-intv-{j}', f'demo-ja-{j}',
            random.choice(['technical','hr','phone','video','ai_proctored']),
            datetime(2025, random.randint(7,12), random.randint(1,28)),
            f'{random.randint(9,17)}:{random.randint(0,59):02d}',
            random.randint(30,90),
            random.choice(['Conference Room A','Zoom Meeting','Phone Call']),
            f'https://zoom.us/j/{random.randint(100000,999999)}',
            emp_ids[j % len(emp_ids)],
            random.choice(['scheduled','completed','cancelled','no_show']),
            f'Good candidate with strong skills in the required area.',
            random.randint(60,95),
            random.randint(55,90),
            f'AI assessment: candidate shows good potential for the role.',
            NOW, NOW
        ))
    c = ev(cur, 'Interview',
        ['id','jobApplicationId','type','date','time','duration',
         'location','meetingUrl','interviewer','status','feedback',
         'score','aiScore','aiFeedback','createdAt','updatedAt'], rows)
    print(f"  Interview: {c}")

    # ─── Final verification ───
    print("\n=== FINAL DEMO DATA COUNTS ===")
    tables = ['Employee','Company','Department','User',
              'Attendance','LeaveBalance','LeaveRequest','LeaveType','Holiday',
              'PayrollComponent','PayrollRun','SalaryStructure','SalaryComponent',
              'PerformanceReview','Goal','Training','TrainingEnrollment',
              'TravelRequest','ExpenseClaim','Asset','AssetAssignment','Document',
              'Notification','Announcement','OnboardingTask',
              'Project','ProjectMember','Loan','Reimbursement',
              'WorkflowDefinition','WorkflowInstance','Shift',
              'Requisition','Feedback','Survey','SurveyResponse','Grievance','Interview']
    for table in tables:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            count = cur.fetchone()[0]
            status = 'OK' if count > 0 else 'EMPTY'
            print(f"  {status:>5} {table}: {count}")
        except Exception as e:
            print(f"  ERR  {table}: {str(e)[:80]}")

    conn.close()
    print("\n✅ Demo data fully seeded!")

if __name__ == '__main__':
    seed_remaining()
