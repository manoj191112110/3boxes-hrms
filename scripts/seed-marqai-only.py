#!/usr/bin/env python3
"""
Fast MarqAI DB seeder - uses psycopg2.extras.execute_values with proper timestamps.
Only seeds tables that are currently EMPTY in tenant_marqaitechgroup.
"""

import psycopg2
import psycopg2.extras
import random
from datetime import date, datetime, timedelta

POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'
MARQAI_DB = 'tenant_marqaitechgroup'

NOW = datetime.now()

def get_conn(dbname):
    return psycopg2.connect(
        host=POOLER_HOST, database=dbname,
        user=DB_USER, password=DB_PASSWORD, sslmode='require',
        connect_timeout=30
    )

def get_ids(cur, table, where=None):
    q = f'SELECT id FROM "{table}"'
    if where: q += f' WHERE {where}'
    cur.execute(q)
    return [r[0] for r in cur.fetchall()]

def ev(cur, table, columns, rows, conflict='(id) DO NOTHING'):
    """execute_values batch insert."""
    if not rows: return 0
    col_str = ','.join([f'"{c}"' for c in columns])
    query = f'INSERT INTO "{table}" ({col_str}) VALUES %s ON CONFLICT {conflict}'
    try:
        psycopg2.extras.execute_values(cur, query, rows, page_size=100)
        return len(rows)
    except Exception as e:
        print(f'    ERR [{table}]: {str(e)[:100]}')
        return 0


def seed_marqai():
    print("=== SEEDING MARQAI DATABASE ===")
    conn = get_conn(MARQAI_DB)
    conn.autocommit = True
    cur = conn.cursor()

    tenant_id = get_ids(cur, "Tenant")[0]
    comp_ids = get_ids(cur, "Company")
    dept_ids = get_ids(cur, "Department")
    desig_ids = get_ids(cur, "Designation")
    branch_ids = get_ids(cur, "Branch")
    emp_ids = get_ids(cur, "Employee")
    user_ids = get_ids(cur, "User")
    lt_ids = get_ids(cur, "LeaveType")

    print(f"  Found: {len(emp_ids)} emps, {len(comp_ids)} comps, {len(dept_ids)} depts, {len(user_ids)} users")

    # ---- Shift ----
    rows = []
    for i, cid in enumerate(comp_ids):
        for j, (nm, s, e, bk, gr) in enumerate([
            ('General Shift','09:00','18:00',60,15),
            ('Morning Shift','06:00','14:00',45,10),
            ('Night Shift','22:00','06:00',60,15)]):
            rows.append((f'marq-shift-{i}-{j}', nm, s, e, bk, gr, 'active', cid, NOW, NOW))
    c = ev(cur, 'Shift', ['id','name','startTime','endTime','breakDuration','graceTime','status','companyId','createdAt','updatedAt'], rows)
    print(f"  Shift: {c}")

    # ---- SalaryStructure + SalaryComponent ----
    ss_rows = []
    sc_rows = []
    for i, cid in enumerate(comp_ids):
        ssid = f'marq-ss-{i}'
        ss_rows.append((ssid, f'Standard Structure {i+1}', cid, 'IN', 'INR', 'Standard structure', 'active', NOW, NOW))
        for j, (nm, ty, val, ct, pb, tax) in enumerate([
            ('Basic Salary','earning',50,'PERCENTAGE','GROSS',True),
            ('HRA','earning',20,'PERCENTAGE','BASIC',True),
            ('Transport Allowance','earning',1600,'FLAT_AMOUNT',None,False),
            ('Special Allowance','earning',15,'PERCENTAGE','GROSS',True),
            ('DA','earning',10,'PERCENTAGE','BASIC',True),
            ('Provident Fund','deduction',12,'PERCENTAGE','BASIC',False),
            ('Professional Tax','deduction',200,'FLAT_AMOUNT',None,False),
            ('ESI','deduction',0.75,'PERCENTAGE','GROSS',False)]):
            sc_rows.append((f'marq-sc-{i}-{j}', ssid, nm, ty, val, ct, pb, tax, NOW, NOW))
    c1 = ev(cur, 'SalaryStructure', ['id','name','companyId','country','currency','description','status','createdAt','updatedAt'], ss_rows)
    c2 = ev(cur, 'SalaryComponent', ['id','salaryStructureId','name','type','defaultValue','calculationType','percentageBase','isTaxable','createdAt','updatedAt'], sc_rows)
    print(f"  SalaryStructure: {c1}, SalaryComponent: {c2}")

    # ---- PayrollComponent ----
    rows = []
    for j, (code, nm, ct, cat, dv, calt, pb, tax) in enumerate([
        ('BASIC','Basic Salary','EARNING','NORMAL',50.0,'PERCENTAGE','GROSS',True),
        ('HRA','HRA','EARNING','NORMAL',20.0,'PERCENTAGE','BASIC',True),
        ('DA','Dearness Allowance','EARNING','NORMAL',10.0,'PERCENTAGE','BASIC',True),
        ('TA','Transport Allowance','EARNING','NORMAL',1600.0,'FLAT_AMOUNT',None,False),
        ('SA','Special Allowance','EARNING','NORMAL',15.0,'PERCENTAGE','GROSS',True),
        ('PF_EE','PF Employee','EMPLOYEE_CONTRIB','STATUTORY',12.0,'PERCENTAGE','BASIC',False),
        ('PF_ER','PF Employer','EMPLOYER_CONTRIB','STATUTORY',12.0,'PERCENTAGE','BASIC',False),
        ('ESI_EE','ESI Employee','EMPLOYEE_CONTRIB','STATUTORY',0.75,'PERCENTAGE','GROSS',False),
        ('ESI_ER','ESI Employer','EMPLOYER_CONTRIB','STATUTORY',3.25,'PERCENTAGE','GROSS',False),
        ('PT','Professional Tax','DEDUCTION','STATUTORY',200.0,'FLAT_AMOUNT',None,False),
        ('IT','Income Tax','DEDUCTION','STATUTORY',0,'SLAB_BASED','GROSS',True),
        ('LWF','Labour Welfare Fund','DEDUCTION','STATUTORY',25.0,'FLAT_AMOUNT',None,False),
        ('BONUS','Bonus','EARNING','NORMAL',0,'MANUAL_ENTRY',None,True)]):
        rows.append((f'marq-pc-{j}', code, nm, ct, cat, 'IND', calt, dv, pb, tax,
                      True, True, True, 'MONTHLY', True, True, NOW, None, comp_ids[0] if comp_ids else None, NOW, NOW))
    c = ev(cur, 'PayrollComponent',
        ['id','code','name','componentType','componentCategory','countryCode','calculationType',
         'defaultValue','percentageBase','isTaxable','affectsGross','affectsNet','affectsCTC',
         'paymentFrequency','prorationApplicable','isActive','effectiveFrom','effectiveTo','companyId','createdAt','updatedAt'], rows)
    print(f"  PayrollComponent: {c}")

    # ---- PayrollRun ----
    rows = []
    for i, cid in enumerate(comp_ids[:4]):
        for m in range(3):
            month = 6 - m; yr = 2025
            sd = date(yr, month, 1); ed = date(yr, month, 28); pd_ = date(yr, month, 28)
            te = random.randint(15,40); gr = te * random.randint(30000,60000)
            dd = int(gr*0.25); nt = gr-dd; er = int(gr*0.15)
            rows.append((f'marq-pr-{i}-{m}', cid, f'{yr}-{month:02d}', sd, ed, pd_,
                         'REGULAR', 'DISBURSED', 'INR', True, 'FULL', te, gr, dd, nt, er, cid, NOW, NOW))
    c = ev(cur, 'PayrollRun',
        ['id','legalEntityId','payrollPeriod','periodStartDate','periodEndDate','payDate',
         'runType','runStatus','currencyCode','includeStatutory','processingMode',
         'totalEmployees','totalGrossPay','totalDeductions','totalNetPay','totalEmployerContrib','companyId','createdAt','updatedAt'], rows)
    print(f"  PayrollRun: {c}")

    # ---- PerformanceReview ----
    rows = []
    for i, eid in enumerate(emp_ids):
        for j, cyc in enumerate(['Q1 2025','Q2 2025']):
            r = round(random.uniform(3.0,5.0),1); o = round(random.uniform(3.0,5.0),1)
            st = random.choice(['pending','in_progress','completed'])
            rd = date(2025,3+j*3,28) if st=='completed' else None
            rows.append((f'marq-rev-{i}-{j}', eid, cyc, cyc, emp_ids[(i+3)%len(emp_ids)],
                r, round(r*0.9,1), round(r*1.05,1), round(r*0.95,1), o,
                'Good progress', 'Technical expertise', 'Documentation', st, rd, NOW, NOW))
    c = ev(cur, 'PerformanceReview',
        ['id','employeeId','reviewCycle','reviewPeriod','reviewerId','rating','goalsRating',
         'skillsRating','behaviorRating','overallRating','comments','strengths','improvements','status','reviewDate','createdAt','updatedAt'], rows)
    print(f"  PerformanceReview: {c}")

    # ---- Goal ----
    rows = []
    for i, eid in enumerate(emp_ids):
        for j, (t, cat, pri) in enumerate([
            ('Complete Project','performance','high'),('Learn New Tech','development','medium'),('Improve Comms','behavioral','medium')]):
            st = random.choice(['not_started','in_progress','completed'])
            pr = 0 if st=='not_started' else (100 if st=='completed' else random.randint(20,80))
            cd = date(2025,6,1) if st=='completed' else None
            rows.append((f'marq-goal-{i}-{j}', eid, t, 'Auto goal', cat, pri, st, pr,
                date(2025,1,1), date(2025,12,31), cd, NOW, NOW))
    c = ev(cur, 'Goal',
        ['id','employeeId','title','description','category','priority','status','progress',
         'startDate','endDate','completedDate','createdAt','updatedAt'], rows)
    print(f"  Goal: {c}")

    # ---- Training ----
    rows = []
    t_ids = []
    for j, (t, cat, tr, mode) in enumerate([
        ('Leadership Essentials','leadership','Rajesh Kumar','online'),
        ('Advanced Python','technical','Priya Sharma','hybrid'),
        ('Cloud Architecture','technical','Arun Reddy','online'),
        ('Project Management','management','Sneha Patil','offline'),
        ('Communication Skills','soft_skills','Meera Nair','online')]):
        tid = f'marq-train-{j}'
        t_ids.append(tid)
        sd = date(2025,7+(j%6),1)
        ed = sd + timedelta(days=14)
        loc = 'Conference Room' if mode != 'online' else 'Zoom'
        st = 'upcoming' if sd > date(2025,6,22) else 'ongoing'
        rows.append((tid, t, 'Training course', cat, tr, sd, ed, loc, mode, st, 20, 5000, NOW, NOW))
    c1 = ev(cur, 'Training',
        ['id','title','description','category','trainer','startDate','endDate','location','mode','status','maxParticipants','cost','createdAt','updatedAt'], rows)

    # ---- TrainingEnrollment ----
    te_rows = []
    for j, tid in enumerate(t_ids):
        emps = emp_ids[j*2:j*2+3] if j*2+3<=len(emp_ids) else emp_ids[:3]
        for k, eid in enumerate(emps):
            st = random.choice(['enrolled','completed'])
            sc = round(random.uniform(60,100),1) if st=='completed' else None
            cd = date(2025,5,15) if st=='completed' else None
            te_rows.append((f'marq-te-{j}-{k}', tid, eid, st, sc, 'Great course', cd, NOW, NOW))
    c2 = ev(cur, 'TrainingEnrollment',
        ['id','trainingId','employeeId','status','score','feedback','completedDate','createdAt','updatedAt'],
        te_rows, conflict='("trainingId","employeeId") DO NOTHING')
    print(f"  Training: {c1}, TrainingEnrollment: {c2}")

    # ---- TravelRequest ----
    rows = []
    locs = ['Mumbai','Bangalore','Delhi','Chennai','Pune']
    for i, eid in enumerate(emp_ids[:8]):
        for j in range(2):
            sd = date(2025,7+j,min(5+i,28))
            ed = sd + timedelta(days=random.randint(2,5))
            st = random.choice(['pending','approved','completed'])
            ab = emp_ids[0] if st in ['approved','completed'] else None
            aa = (sd - timedelta(days=3)) if st in ['approved','completed'] else None
            rows.append((f'marq-tr-{i}-{j}', eid, 'Business travel', locs[(i+j)%5],
                sd, ed, ['flight','train'][i%2], random.randint(5000,50000),
                ab, st, aa, 'Travel request', NOW, NOW))
    c = ev(cur, 'TravelRequest',
        ['id','employeeId','purpose','destination','startDate','endDate','mode','estimatedCost',
         'approvedBy','status','approvedAt','notes','createdAt','updatedAt'], rows)
    print(f"  TravelRequest: {c}")

    # ---- ExpenseClaim ----
    rows = []
    cats = ['travel','food','accommodation','transport','medical']
    for i, eid in enumerate(emp_ids[:10]):
        for j in range(2):
            cat = cats[(i+j)%5]; amt = random.randint(500,20000)
            st = random.choice(['pending','approved','paid'])
            ab = emp_ids[0] if st in ['approved','paid'] else None
            apa = date(2025,6,15) if st in ['approved','paid'] else None
            pa = date(2025,6,20) if st=='paid' else None
            rows.append((f'marq-ec-{i}-{j}', eid, f'{cat.title()} expense', cat,
                amt, 'INR', date(2025,6,10+j), 'Business expense', st, ab, apa, pa, NOW, NOW))
    c = ev(cur, 'ExpenseClaim',
        ['id','employeeId','title','category','amount','currency','date','description','status',
         'approvedBy','approvedAt','paidAt','createdAt','updatedAt'], rows)
    print(f"  ExpenseClaim: {c}")

    # ---- Asset + AssetAssignment ----
    a_rows = []
    a_ids = []
    for j, (nm, cat, br, mdl) in enumerate([
        ('MacBook Pro','laptop','Apple','MK183'),('Dell Latitude','laptop','Dell','5540'),
        ('iPhone 15','phone','Apple','A2848'),('ThinkPad X1','laptop','Lenovo','20XW'),
        ('iPad Air','tablet','Apple','A2696'),('HP EliteBook','laptop','HP','840-G10'),
        ('Samsung Galaxy','phone','Samsung','SM-S921'),('LG Monitor','monitor','LG','27UK')]):
        aid = f'marq-asset-{j}'
        a_ids.append(aid)
        cost = random.randint(40000,200000)
        stat = 'assigned' if j<len(emp_ids) else 'available'
        cond = 'new' if j<3 else 'good'
        a_rows.append((aid, nm, f'MARQ-TAG-{j+1001}', cat, br, mdl,
            f'SN-{br[:3].upper()}-{j+5000}', date(2024,random.randint(1,12),1), cost,
            stat, cond, 'Hyderabad Office', date(2027,random.randint(1,12),1), NOW, NOW))
    c1 = ev(cur, 'Asset',
        ['id','name','assetTag','category','brand','model','serialNumber','purchaseDate','purchaseCost',
         'status','condition','location','warrantyExpiry','createdAt','updatedAt'],
        a_rows, conflict='("assetTag") DO NOTHING')

    aa_rows = []
    for j in range(min(len(a_ids), len(emp_ids))):
        aa_rows.append((f'marq-aa-{j}', a_ids[j], emp_ids[j],
            date(2024,random.randint(1,6),random.randint(1,28)), 'good', 'Assignment', 'assigned', NOW, NOW))
    c2 = ev(cur, 'AssetAssignment',
        ['id','assetId','employeeId','assignedDate','condition','notes','status','createdAt','updatedAt'], aa_rows)
    print(f"  Asset: {c1}, AssetAssignment: {c2}")

    # ---- Document ----
    rows = []
    for i, eid in enumerate(emp_ids):
        for j, (nm, ty) in enumerate([('Offer Letter','offer_letter'),('ID Proof','id_proof'),('Contract','contract')]):
            exp = date(2026,12,31) if j==2 else None
            rows.append((f'marq-doc-{i}-{j}', eid, nm, ty, f'/docs/{eid}/{ty}.pdf',
                'active', NOW, exp, 'Employee document', NOW, NOW))
    c = ev(cur, 'Document',
        ['id','employeeId','name','type','fileUrl','status','uploadedAt','expiryDate','description','createdAt','updatedAt'], rows)
    print(f"  Document: {c}")

    # ---- Notification ----
    rows = []
    for i, uid in enumerate(user_ids):
        for j, (nt, cat, tit, msg) in enumerate([
            ('info','system','System Update','New features available'),
            ('success','leave','Leave Approved','Leave request approved'),
            ('warning','payroll','Payroll Processing','Payroll started'),
            ('info','workflow','Pending Approval','Pending approvals')]):
            rows.append((f'marq-notif-{i}-{j}', tenant_id, uid, tit, msg, nt, cat,
                f'/{cat}', random.choice([True,False]), False, NOW, NOW))
    c = ev(cur, 'Notification',
        ['id','tenantId','userId','title','message','type','category','link','isRead','isEmailSent','createdAt','updatedAt'], rows)
    print(f"  Notification: {c}")

    # ---- Announcement ----
    rows = []
    for j, (t, cont, pri) in enumerate([
        ('Town Hall Meeting','Quarterly town hall this Friday 2PM.','important'),
        ('Health Insurance Update','Updated health insurance policy.','normal'),
        ('System Maintenance','HRMS maintenance Saturday 10PM.','urgent'),
        ('Annual Review','Complete self-assessment by month end.','important')]):
        rows.append((f'marq-ann-{j}', t, cont, pri, 'all', True, NOW, date(2025,12,31), NOW, NOW))
    c = ev(cur, 'Announcement',
        ['id','title','content','priority','targetAudience','isActive','publishedAt','expiresAt','createdAt','updatedAt'], rows)
    print(f"  Announcement: {c}")

    # ---- OnboardingTask ----
    rows = []
    for i, eid in enumerate(emp_ids[:10]):
        for j, (task, cat) in enumerate([('IT Setup','it_setup'),('HR Documents','hr_docs'),('Orientation','training'),('Policy Review','general')]):
            st = random.choice(['pending','in_progress','completed'])
            cd = date(2025,7,3+j) if st=='completed' else None
            rows.append((f'marq-ot-{i}-{j}', eid, task, cat, st, date(2025,7,5+j), cd, emp_ids[0], 'Auto onboarding task', NOW, NOW))
    c = ev(cur, 'OnboardingTask',
        ['id','employeeId','task','category','status','dueDate','completedDate','assignedBy','notes','createdAt','updatedAt'], rows)
    print(f"  OnboardingTask: {c}")

    # ---- Project + ProjectMember ----
    p_rows = []
    p_ids = []
    for j, (nm, code, pt, bt, bud, hrs) in enumerate([
        ('Project Alpha','ALPHA','internal','fixed',1500000,2000),
        ('Client Portal','CPR','client','time_and_material',2500000,3000),
        ('Mobile App','MOBDEV','internal','fixed',1800000,2500),
        ('Data Migration','DATAM','support','non_billable',0,800),
        ('API Integration','APIINT','client','hourly',1200000,1500)]):
        pid = f'marq-proj-{j}'
        p_ids.append(pid)
        cid = comp_ids[j%len(comp_ids)]
        p_rows.append((pid, nm, code, cid,
            dept_ids[j%len(dept_ids)] if dept_ids else None,
            emp_ids[j%len(emp_ids)], pt, bt, 'INR', bud, hrs,
            int(hrs*0.4), 5000.0, 3000.0, date(2025,1,1), date(2025,12,31),
            random.choice(['planning','active','on_track']), NOW, NOW))
    c1 = ev(cur, 'Project',
        ['id','name','code','companyId','departmentId','projectManagerId','projectType','billingType',
         'currency','budgetAmount','estimatedHours','actualHours','billingRate','costRate',
         'startDate','endDate','status','createdAt','updatedAt'], p_rows)

    pm_rows = []
    for j, pid in enumerate(p_ids):
        emps = emp_ids[j*2:j*2+3] if j*2+3<=len(emp_ids) else emp_ids[:3]
        for k, eid in enumerate(emps):
            role = 'manager' if k==0 else 'member'
            pm_rows.append((f'marq-pm-{j}-{k}', pid, eid, role, emp_ids[0], NOW, NOW, NOW))
    c2 = ev(cur, 'ProjectMember',
        ['id','projectId','employeeId','role','assignedBy','assignedAt','createdAt','updatedAt'], pm_rows)
    print(f"  Project: {c1}, ProjectMember: {c2}")

    # ---- Loan ----
    rows = []
    for i, eid in enumerate(emp_ids[:8]):
        amt = random.randint(50000,500000); ten = random.choice([12,24,36])
        emi = round(amt/ten,2); st = random.choice(['pending','approved','active'])
        end_month = min((3+ten), 12)
        rows.append((f'marq-loan-{i}', eid,
            random.choice(['PERSONAL','EMERGENCY','HOUSING','VEHICLE','EDUCATION']),
            amt, 8.5, ten, emi, amt, amt if st=='active' else 0,
            date(2025,3,1) if st=='active' else None,
            date(2025,3,1), date(2025,end_month,1),
            round(emi*3,2) if st=='active' else 0, ten-3 if st=='active' else ten,
            st, emp_ids[0] if st in ['approved','active'] else None,
            date(2025,2,25) if st in ['approved','active'] else None,
            'Loan application', NOW, NOW))
    c = ev(cur, 'Loan',
        ['id','employeeId','loanType','loanAmount','interestRate','tenureMonths','emiAmount',
         'outstandingBalance','disbursedAmount','disbursedDate','startDate','endDate',
         'recoveredAmount','remainingEmis','status','approvedBy','approvedAt','remarks','createdAt','updatedAt'], rows)
    print(f"  Loan: {c}")

    # ---- Reimbursement ----
    rows = []
    for i, eid in enumerate(emp_ids[:10]):
        st = random.choice(['pending','approved','paid'])
        ab = emp_ids[0] if st in ['approved','paid'] else None
        apa = date(2025,6,10) if st in ['approved','paid'] else None
        pa = date(2025,6,20) if st=='paid' else None
        rows.append((f'marq-reimb-{i}', eid,
            random.choice(['medical','fuel','phone','internet','education']),
            random.randint(1000,50000), 'INR', 'Reimbursement claim', st, ab, apa, pa, NOW, NOW))
    c = ev(cur, 'Reimbursement',
        ['id','employeeId','type','amount','currency','description','status','approvedBy','approvedAt','paidAt','createdAt','updatedAt'], rows)
    print(f"  Reimbursement: {c}")

    # ---- WorkflowDefinition + WorkflowInstance ----
    wd_rows = []
    wd_ids = []
    for j, (nm, mod) in enumerate([
        ('Leave Approval','leave'),('Expense Approval','expense'),
        ('Payroll Approval','payroll'),('Travel Approval','travel'),
        ('Recruitment Approval','recruitment')]):
        wid = f'marq-wd-{j}'
        wd_ids.append(wid)
        cid = comp_ids[j%len(comp_ids)] if comp_ids else None
        wd_rows.append((wid, nm, mod, cid, f'{nm} workflow',
            '[{"step":1,"role":"manager"},{"step":2,"role":"hr"}]', True, 1, NOW, NOW))
    c1 = ev(cur, 'WorkflowDefinition',
        ['id','name','module','companyId','description','steps','isActive','version','createdAt','updatedAt'], wd_rows)

    wi_rows = []
    etypes = ['leave_request','expense_claim','payroll_run','travel_request','requisition']
    for j, wid in enumerate(wd_ids):
        for k in range(3):
            wi_rows.append((f'marq-wi-{j}-{k}', wid, etypes[j],
                f'marq-entity-{j}-{k}', random.randint(0,2),
                random.choice(['pending','approved','rejected']), NOW, NOW))
    c2 = ev(cur, 'WorkflowInstance',
        ['id','workflowDefinitionId','entityType','entityId','currentStep','status','createdAt','updatedAt'], wi_rows)
    print(f"  WorkflowDefinition: {c1}, WorkflowInstance: {c2}")

    conn.close()
    print("  MarqAI DB seeded!\n")


def verify():
    print("=" * 60)
    print("VERIFICATION")
    print("=" * 60)
    TABLES = [
        'Tenant','User','CompanyGroup','Company','Department','Designation','Branch',
        'Employee','EmployeeCompanyMapping',
        'Role','Module','Permission','RolePermission','UserRoleAssignment',
        'LeaveType','Holiday','LeaveBalance',
        'AttendancePolicyConfig','Attendance','Shift',
        'SalaryStructure','PayrollComponent','PayrollRun',
        'PerformanceReview','Goal','Training','TrainingEnrollment',
        'TravelRequest','ExpenseClaim','Asset','AssetAssignment','Document',
        'Notification','Announcement','OnboardingTask',
        'Project','ProjectMember','Loan','Reimbursement',
        'WorkflowDefinition','WorkflowInstance','TenantConfiguration',
    ]
    DEMO_DB = 'tenant_demo'
    for dbn, lbl in [(DEMO_DB,'Demo'),(MARQAI_DB,'MarqAI')]:
        conn = get_conn(dbn)
        cur = conn.cursor()
        print(f"\n  {lbl}:")
        empty = []
        for t in TABLES:
            try:
                cur.execute(f'SELECT COUNT(*) FROM "{t}";')
                c = cur.fetchone()[0]
                s = 'OK' if c > 0 else 'EMPTY'
                print(f'    {s:>5} {t}: {c}')
                if c == 0: empty.append(t)
            except Exception as e:
                print(f'    ERR  {t}: {str(e)[:50]}')
        cur.execute('SELECT id FROM "Tenant" LIMIT 1;')
        tid = cur.fetchone()[0]
        cur.execute('SELECT COUNT(*) FROM "User" WHERE "tenantId" != %s;', (tid,))
        w = cur.fetchone()[0]
        print(f'    {"OK" if w==0 else "CONTAM!"} Cross-tenant users: {w}')
        if empty: print(f'    Still empty: {", ".join(empty)}')
        conn.close()


if __name__ == '__main__':
    seed_marqai()
    verify()
    print("\nDONE! MarqAI database fully seeded.")
