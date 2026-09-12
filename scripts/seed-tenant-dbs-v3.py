#!/usr/bin/env python3
"""
Optimized tenant DB seeder v3 - seeds all empty tables in both tenant databases.
Uses ON CONFLICT handling for all unique constraints.
"""

import psycopg2
import random
from datetime import date, datetime, timedelta

POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'
DEMO_DB = 'tenant_demo'
MARQAI_DB = 'tenant_marqaitechgroup'

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


def try_insert(cur, query, params, label=''):
    """Try single insert, return True if succeeded."""
    try:
        cur.execute(query, params)
        return cur.rowcount > 0
    except Exception as e:
        if 'duplicate' not in str(e).lower() and 'unique' not in str(e).lower():
            if label:
                print(f'    WARN [{label}]: {str(e)[:80]}')
        return False


def seed_db(dbname, label, prefix, currency, country, locations):
    """Seed one tenant database with all missing data."""
    print(f"\n=== SEEDING {label} DATABASE ===")
    conn = get_conn(dbname)
    conn.autocommit = True
    cur = conn.cursor()

    # Fetch existing data
    tenant_id = get_ids(cur, "Tenant")[0]
    comp_ids = get_ids(cur, "Company")
    dept_ids = get_ids(cur, "Department")
    desig_ids = get_ids(cur, "Designation")
    branch_ids = get_ids(cur, "Branch")
    emp_ids = get_ids(cur, "Employee")
    user_ids = get_ids(cur, "User")
    lt_ids = get_ids(cur, "LeaveType")

    # Check which EmployeeCompanyMappings already exist
    cur.execute('SELECT "employeeId", "companyId" FROM "EmployeeCompanyMapping";')
    existing_ecm = set((r[0], r[1]) for r in cur.fetchall())

    print(f"  Found: {len(emp_ids)} emps, {len(comp_ids)} comps, {len(dept_ids)} depts, {len(lt_ids)} LTs")

    # ---- EmployeeCompanyMapping ----
    c = 0
    for i, eid in enumerate(emp_ids):
        cid = comp_ids[i % len(comp_ids)]
        if (eid, cid) in existing_ecm:
            continue
        c += try_insert(cur,
            '''INSERT INTO "EmployeeCompanyMapping" (id,"employeeId","companyId","employeeCode","departmentId","designationId","branchId",status,"isPrimary","dateOfJoining","createdAt","updatedAt")
               VALUES (%s,%s,%s,%s,%s,%s,%s,'active',%s,%s,NOW(),NOW()) ON CONFLICT ("employeeId","companyId") DO NOTHING''',
            (f'{prefix}-ecm-{i}', eid, cid, f'EMP-{1000+i}',
             dept_ids[i%len(dept_ids)] if dept_ids else None,
             desig_ids[i%len(desig_ids)] if desig_ids else None,
             branch_ids[i%len(branch_ids)] if branch_ids else None,
             i%len(comp_ids)==0, date(2024, (i%12)+1, min((i%28)+1, 28))),
            'ECM')
    print(f"  EmployeeCompanyMapping: {c} new")

    # ---- LeaveBalance ----
    cur.execute('SELECT "employeeId", "leaveTypeId", year FROM "LeaveBalance";')
    existing_lb = set((r[0], r[1], r[2]) for r in cur.fetchall())
    c = 0
    year = 2025
    for eid in emp_ids:
        for ltid in lt_ids:
            if (eid, ltid, year) in existing_lb:
                continue
            total = random.choice([10, 12, 15, 20, 30])
            used = random.randint(0, min(total, 8))
            c += try_insert(cur,
                '''INSERT INTO "LeaveBalance" (id,"employeeId","leaveTypeId",year,total,used,remaining,"carryForward","createdAt","updatedAt")
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW()) ON CONFLICT ("employeeId","leaveTypeId",year) DO NOTHING''',
                (f'{prefix}-lb-{c}', eid, ltid, year, total, used, total-used, random.randint(0,3)),
                'LB')
    print(f"  LeaveBalance: {c} new")

    # ---- AttendancePolicyConfig ----
    c = 0
    for i, cid in enumerate(comp_ids):
        c += try_insert(cur,
            '''INSERT INTO "AttendancePolicyConfig" (id,name,"companyId","roundEnabled","roundMinutes","roundDirection",
               "lateGraceMinutes","earlyGraceMinutes","autoOvertimeEnabled","overtimeThresholdMinutes",
               "autoApprovePermissionMinutes","autoApproveMinAttendancePct","autoApproveLeaveSingleDay",
               "autoApproveLeaveTypes","autoApproveOvertimeHours","autoApproveGatepassMinutes","createdAt","updatedAt")
               VALUES (%s,%s,%s,true,15,'nearest',10,10,true,480,30,90.0,false,'[]',2.0,30,NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
            (f'{prefix}-apc-{i}', f'Standard Policy {i+1}', cid),
            'APC')
    print(f"  AttendancePolicyConfig: {c}")

    # ---- Attendance ----
    c = 0
    base = date(2025, 6, 22)
    for eid in emp_ids[:15]:
        for doff in range(14):
            d = base - timedelta(days=doff)
            if d.weekday() >= 5: continue
            if random.random() < 0.3: continue
            ch = 8 + random.randint(0,1); cm = random.randint(0,59)
            coh = 17 + random.randint(0,2); com = random.randint(0,59)
            wh = coh - ch + (com-cm)/60.0
            ot = max(0, wh-9) if wh>9 else 0
            st = random.choices(['present','late','absent','half_day'], weights=[80,10,5,5])[0]
            c += try_insert(cur,
                '''INSERT INTO "Attendance" (id,"employeeId",date,"checkIn","checkOut",status,"workHours",overtime,notes,location,"createdAt","updatedAt")
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NULL,'Office',NOW(),NOW()) ON CONFLICT ("employeeId",date) DO NOTHING''',
                (f'{prefix}-att-{c}', eid, d,
                 datetime(d.year,d.month,d.day,ch,cm), datetime(d.year,d.month,d.day,coh,com),
                 st, round(wh,2), round(ot,2)),
                'ATT')
    print(f"  Attendance: {c}")

    # ---- Shift ----
    c = 0
    for i, cid in enumerate(comp_ids):
        for j, (nm,s,e,bk,gr) in enumerate([('General','09:00','18:00',60,15),('Morning','06:00','14:00',45,10),
            ('Evening','14:00','22:00',45,10),('Night','22:00','06:00',60,15)]):
            c += try_insert(cur,
                '''INSERT INTO "Shift" (id,name,"startTime","endTime","breakDuration","graceTime",status,"companyId","createdAt","updatedAt")
                   VALUES (%s,%s,%s,%s,%s,%s,'active',%s,NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
                (f'{prefix}-shift-{i}-{j}', nm, s, e, bk, gr, cid),
                'Shift')
    print(f"  Shift: {c}")

    # ---- SalaryStructure + SalaryComponent ----
    c1 = c2 = 0
    for i, cid in enumerate(comp_ids):
        ssid = f'{prefix}-ss-{i}'
        ok = try_insert(cur,
            '''INSERT INTO "SalaryStructure" (id,name,"companyId",country,currency,description,status,"createdAt","updatedAt")
               VALUES (%s,%s,%s,'US',%s,'Standard structure','active',NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
            (ssid, f'Standard {i+1}', cid, currency), 'SS')
        c1 += ok
        if ok:
            for j, (nm,ty,val,ct,pb,tax) in enumerate([
                ('Basic Salary','earning',50,'PERCENTAGE','GROSS',True),
                ('HRA','earning',20,'PERCENTAGE','BASIC',True),
                ('Transport Allowance','earning',10,'PERCENTAGE','BASIC',False),
                ('Special Allowance','earning',15,'PERCENTAGE','GROSS',True),
                ('Provident Fund','deduction',12,'PERCENTAGE','BASIC',False),
                ('Professional Tax','deduction',200,'FLAT_AMOUNT',None,False)]):
                c2 += try_insert(cur,
                    '''INSERT INTO "SalaryComponent" (id,"salaryStructureId",name,type,"defaultValue","calculationType","percentageBase","isTaxable","createdAt","updatedAt")
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
                    (f'{prefix}-sc-{i}-{j}', ssid, nm, ty, val, ct, pb, tax), 'SC')
    print(f"  SalaryStructure: {c1}, SalaryComponent: {c2}")

    # ---- PayrollComponent ----
    c = 0
    for j, (code,nm,ct,cat,dv,calt,pb,tax) in enumerate([
        ('BASIC','Basic Salary','EARNING','NORMAL',50.0,'PERCENTAGE','GROSS',True),
        ('HRA','HRA','EARNING','NORMAL',20.0,'PERCENTAGE','BASIC',True),
        ('TA','Transport Allowance','EARNING','NORMAL',1600.0,'FLAT_AMOUNT',None,False),
        ('SA','Special Allowance','EARNING','NORMAL',15.0,'PERCENTAGE','GROSS',True),
        ('PF_EE','PF Employee','EMPLOYEE_CONTRIB','STATUTORY',12.0,'PERCENTAGE','BASIC',False),
        ('PF_ER','PF Employer','EMPLOYER_CONTRIB','STATUTORY',12.0,'PERCENTAGE','BASIC',False),
        ('PT','Professional Tax','DEDUCTION','STATUTORY',200.0,'FLAT_AMOUNT',None,False),
        ('IT','Income Tax','DEDUCTION','STATUTORY',0,'SLAB_BASED','GROSS',True),
        ('BONUS','Bonus','EARNING','NORMAL',0,'MANUAL_ENTRY',None,True)]):
        c += try_insert(cur,
            '''INSERT INTO "PayrollComponent" (id,code,name,"componentType","componentCategory","countryCode","calculationType","defaultValue","percentageBase","isTaxable","affectsGross","affectsNet","affectsCTC","paymentFrequency","prorationApplicable","isActive","effectiveFrom","companyId","createdAt","updatedAt")
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,true,true,true,'MONTHLY',true,true,NOW(),%s,NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
            (f'{prefix}-pc-{j}', code, nm, ct, cat, country, calt, dv, pb, tax,
             comp_ids[0] if comp_ids else None), 'PC')
    print(f"  PayrollComponent: {c}")

    # ---- PayrollRun ----
    c = 0
    for i, cid in enumerate(comp_ids[:3]):
        for m in range(3):
            month = 6 - m
            yr = 2025
            sd = date(yr, month, 1)
            ed = date(yr, month, 28)
            pd_ = date(yr, month, 28)
            te = random.randint(15,40)
            gr = te * random.randint(4000,7000)
            dd = int(gr*0.25); nt = gr-dd; er = int(gr*0.15)
            c += try_insert(cur,
                '''INSERT INTO "PayrollRun" (id,"legalEntityId","payrollPeriod","periodStartDate","periodEndDate","payDate","runType","runStatus","currencyCode","includeStatutory","processingMode","totalEmployees","totalGrossPay","totalDeductions","totalNetPay","totalEmployerContrib","companyId","createdAt","updatedAt")
                   VALUES (%s,%s,%s,%s,%s,%s,'REGULAR','DISBURSED',%s,true,'FULL',%s,%s,%s,%s,%s,%s,NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
                (f'{prefix}-pr-{i}-{m}', cid, f'{yr}-{month:02d}', sd, ed, pd_, currency, te, gr, dd, nt, er, cid), 'PR')
    print(f"  PayrollRun: {c}")

    # ---- TenantConfiguration ----
    cur.execute('SELECT COUNT(*) FROM "TenantConfiguration" WHERE "tenantId" = %s;', (tenant_id,))
    if cur.fetchone()[0] == 0:
        try_insert(cur,
            '''INSERT INTO "TenantConfiguration" (id,"tenantId","autoProvisionPayroll","autoProvisionCompliance","autoProvisionTaxSlabs","autoProvisionMinWage","activeCountryCount","activeCurrencyCount","activeLanguageCount","createdAt","updatedAt")
               VALUES (%s,%s,true,true,true,true,8,8,5,NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
            (f'{prefix}-tc', tenant_id), 'TC')
        print(f"  TenantConfiguration: created")
    else:
        print(f"  TenantConfiguration: exists")

    # ---- PerformanceReview ----
    c = 0
    for i, eid in enumerate(emp_ids):
        for j, cyc in enumerate(['Q1 2025','Q2 2025']):
            r = round(random.uniform(2.5,5.0),1); o = round(random.uniform(2.5,5.0),1)
            st = random.choice(['pending','in_progress','completed'])
            rd = date(2025,3+j*3,28) if st=='completed' else None
            c += try_insert(cur,
                '''INSERT INTO "PerformanceReview" (id,"employeeId","reviewCycle","reviewPeriod","reviewerId",rating,"goalsRating","skillsRating","behaviorRating","overallRating",comments,strengths,improvements,status,"reviewDate","createdAt","updatedAt")
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'Good progress','Technical skills','Time management',%s,%s,NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
                (f'{prefix}-rev-{i}-{j}', eid, cyc, cyc, emp_ids[(i+3)%len(emp_ids)],
                 r, round(r*0.9,1), round(r*1.05,1), round(r*0.95,1), o, st, rd), 'PR')
    print(f"  PerformanceReview: {c}")

    # ---- Goal ----
    c = 0
    for i, eid in enumerate(emp_ids):
        for j, (t,cat,pri) in enumerate([('Complete Project','performance','high'),('Learn Skills','development','medium'),('Improve Comms','behavioral','medium')]):
            st = random.choice(['not_started','in_progress','completed'])
            pr = 0 if st=='not_started' else (100 if st=='completed' else random.randint(20,80))
            cd = date(2025,6,1) if st=='completed' else None
            c += try_insert(cur,
                '''INSERT INTO "Goal" (id,"employeeId",title,description,category,priority,status,progress,"startDate","endDate","completedDate","createdAt","updatedAt")
                   VALUES (%s,%s,%s,'Auto goal',%s,%s,%s,%s,'2025-01-01','2025-12-31',%s,NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
                (f'{prefix}-goal-{i}-{j}', eid, t, cat, pri, st, pr, cd), 'Goal')
    print(f"  Goal: {c}")

    # ---- Training ----
    c1 = 0
    t_ids = []
    for j, (t,cat,tr,mode) in enumerate([
        ('Leadership','leadership','John Parker','online'),('Python Deep Dive','technical','Sarah Chen','hybrid'),
        ('Cloud Architecture','technical','Mike Roberts','online'),('Project Mgmt','management','Lisa Wong','offline'),
        ('Communication','soft_skills','Amy Brooks','online')]):
        tid = f'{prefix}-train-{j}'
        t_ids.append(tid)
        sd = date(2025,7+(j%6),1)
        ed = sd + timedelta(days=14)
        c1 += try_insert(cur,
            '''INSERT INTO "Training" (id,title,description,category,trainer,"startDate","endDate",location,mode,status,"maxParticipants",cost,"createdAt","updatedAt")
               VALUES (%s,%s,'Training course',%s,%s,%s,%s,'Room A' if %s!='online' else 'Zoom',%s,'upcoming',20,1000,NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
            (tid, t, cat, tr, sd, ed, mode, mode), 'Train')

    # ---- TrainingEnrollment ----
    c2 = 0
    for j, tid in enumerate(t_ids):
        emps = emp_ids[j*2:j*2+3] if j*2+3<=len(emp_ids) else emp_ids[:3]
        for k, eid in enumerate(emps):
            st = random.choice(['enrolled','completed'])
            sc = round(random.uniform(60,100),1) if st=='completed' else None
            cd = date(2025,5,15) if st=='completed' else None
            c2 += try_insert(cur,
                '''INSERT INTO "TrainingEnrollment" (id,"trainingId","employeeId",status,score,feedback,"completedDate","createdAt","updatedAt")
                   VALUES (%s,%s,%s,%s,%s,'Good',%s,NOW(),NOW()) ON CONFLICT ("trainingId","employeeId") DO NOTHING''',
                (f'{prefix}-te-{j}-{k}', tid, eid, st, sc, cd), 'TE')
    print(f"  Training: {c1}, TrainingEnrollment: {c2}")

    # ---- TravelRequest ----
    c = 0
    for i, eid in enumerate(emp_ids[:8]):
        for j in range(2):
            sd = date(2025,7+j,min(5+i,28))
            ed = sd + timedelta(days=random.randint(2,5))
            st = random.choice(['pending','approved','completed'])
            ab = emp_ids[0] if st=='approved' else None
            aa = sd-timedelta(days=3) if st=='approved' else None
            c += try_insert(cur,
                '''INSERT INTO "TravelRequest" (id,"employeeId",purpose,destination,"startDate","endDate",mode,"estimatedCost","approvedBy",status,"approvedAt",notes,"createdAt","updatedAt")
                   VALUES (%s,%s,'Business travel',%s,%s,%s,'flight',%s,%s,%s,%s,'Travel request',NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
                (f'{prefix}-tr-{i}-{j}', eid, locations[(i+j)%len(locations)], sd, ed,
                 random.randint(500,5000), ab, st, aa), 'TR')
    print(f"  TravelRequest: {c}")

    # ---- ExpenseClaim ----
    c = 0
    for i, eid in enumerate(emp_ids[:10]):
        for j in range(2):
            cat = random.choice(['travel','food','accommodation','transport','medical'])
            amt = random.randint(50,2000)
            st = random.choice(['pending','approved','paid'])
            ab = emp_ids[0] if st in ['approved','paid'] else None
            apa = date(2025,6,15) if st in ['approved','paid'] else None
            pa = date(2025,6,20) if st=='paid' else None
            c += try_insert(cur,
                '''INSERT INTO "ExpenseClaim" (id,"employeeId",title,category,amount,currency,date,description,status,"approvedBy","approvedAt","paidAt","createdAt","updatedAt")
                   VALUES (%s,%s,%s,%s,%s,%s,'2025-06-10','Expense',%s,%s,%s,%s,NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
                (f'{prefix}-ec-{i}-{j}', eid, f'{cat.title()} expense', cat, amt, currency, st, ab, apa, pa), 'EC')
    print(f"  ExpenseClaim: {c}")

    # ---- Asset + AssetAssignment ----
    c1 = c2 = 0
    a_ids = []
    for j, (nm,cat,br,mdl) in enumerate([
        ('MacBook Pro','laptop','Apple','MK183'),('Dell Latitude','laptop','Dell','5540'),
        ('iPhone 15','phone','Apple','A2848'),('Galaxy S24','phone','Samsung','SM-S921'),
        ('UltraSharp 27','monitor','Dell','U2723'),('ThinkPad X1','laptop','Lenovo','20XW'),
        ('iPad Air','tablet','Apple','A2696'),('HP EliteBook','laptop','HP','840-G10')]):
        aid = f'{prefix}-asset-{j}'
        a_ids.append(aid)
        cost = random.randint(500,3000)
        c1 += try_insert(cur,
            '''INSERT INTO "Asset" (id,name,"assetTag",category,brand,model,"serialNumber","purchaseDate","purchaseCost",status,condition,location,"warrantyExpiry","createdAt","updatedAt")
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'good','Office',%s,NOW(),NOW()) ON CONFLICT ("assetTag") DO NOTHING''',
            (aid, nm, f'{prefix.upper()}-TAG-{j+1001}', cat, br, mdl, f'SN-{br[:3].upper()}-{j+5000}',
             date(2024,random.randint(1,12),1), cost,
             'assigned' if j<len(emp_ids) else 'available',
             date(2027,random.randint(1,12),1)), 'Asset')

    for j in range(min(len(a_ids), len(emp_ids))):
        c2 += try_insert(cur,
            '''INSERT INTO "AssetAssignment" (id,"assetId","employeeId","assignedDate",condition,notes,status,"createdAt","updatedAt")
               VALUES (%s,%s,%s,%s,'good','Assignment','assigned',NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
            (f'{prefix}-aa-{j}', a_ids[j], emp_ids[j], date(2024,random.randint(1,6),random.randint(1,28))), 'AA')
    print(f"  Asset: {c1}, AssetAssignment: {c2}")

    # ---- Document ----
    c = 0
    for i, eid in enumerate(emp_ids):
        for j, (nm,ty) in enumerate([('Offer Letter','offer_letter'),('ID Proof','id_proof'),('Contract','contract')]):
            c += try_insert(cur,
                '''INSERT INTO "Document" (id,"employeeId",name,type,"fileUrl",status,"expiryDate",description,"createdAt","updatedAt")
                   VALUES (%s,%s,%s,%s,%s,'active',%s,'Document',NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
                (f'{prefix}-doc-{i}-{j}', eid, nm, ty, f'/docs/{eid}/{ty}.pdf',
                 date(2026,12,31) if j==2 else None), 'Doc')
    print(f"  Document: {c}")

    # ---- Notification ----
    c = 0
    for i, uid in enumerate(user_ids):
        for j, (nt,cat,tit,msg) in enumerate([
            ('info','system','System Update','New features available.'),
            ('success','leave','Leave Approved','Your leave was approved.'),
            ('warning','payroll','Payroll Processing','Payroll started.'),
            ('info','workflow','Pending Approval','You have pending approvals.')]):
            c += try_insert(cur,
                '''INSERT INTO "Notification" (id,"tenantId","userId",title,message,type,category,link,"isRead","isEmailSent","createdAt","updatedAt")
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,false,NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
                (f'{prefix}-notif-{i}-{j}', tenant_id, uid, tit, msg, nt, cat,
                 f'/{cat}', random.choice([True,False])), 'Notif')
    print(f"  Notification: {c}")

    # ---- Announcement ----
    c = 0
    for j, (t,cont,pri) in enumerate([
        ('Company Town Hall','Quarterly meeting this Friday 2PM.','important'),
        ('New Health Insurance','Updated coverage. Review policy.','normal'),
        ('System Maintenance','HRMS maintenance Saturday 10PM.','urgent'),
        ('Annual Review','Complete self-assessment by month end.','important')]):
        c += try_insert(cur,
            '''INSERT INTO "Announcement" (id,title,content,priority,"targetAudience","isActive","expiresAt","createdAt","updatedAt")
               VALUES (%s,%s,%s,%s,'all',true,'2025-12-31',NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
            (f'{prefix}-ann-{j}', t, cont, pri), 'Ann')
    print(f"  Announcement: {c}")

    # ---- OnboardingTask ----
    c = 0
    for i, eid in enumerate(emp_ids[:8]):
        for j, (task,cat) in enumerate([('IT Setup','it_setup'),('HR Documents','hr_docs'),('Orientation','training'),('Policy Review','general')]):
            st = random.choice(['pending','in_progress','completed'])
            cd = date(2025,7,3+j) if st=='completed' else None
            c += try_insert(cur,
                '''INSERT INTO "OnboardingTask" (id,"employeeId",task,category,status,"dueDate","completedDate","assignedBy",notes,"createdAt","updatedAt")
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'Auto task',NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
                (f'{prefix}-ot-{i}-{j}', eid, task, cat, st, date(2025,7,5+j), cd, emp_ids[0]), 'OT')
    print(f"  OnboardingTask: {c}")

    # ---- Project + ProjectMember ----
    c1 = c2 = 0
    p_ids = []
    for j, (nm,code,pt,bt,bud,hrs) in enumerate([
        ('Project Alpha','ALPHA','internal','fixed',150000,2000),
        ('Portal Redesign','CPR','client','time_and_material',250000,3000),
        ('Mobile App','MOBDEV','internal','fixed',180000,2500),
        ('Data Migration','DATAM','support','non_billable',0,800),
        ('API Integration','APIINT','client','hourly',120000,1500)]):
        pid = f'{prefix}-proj-{j}'
        p_ids.append(pid)
        cid = comp_ids[j%len(comp_ids)]
        c1 += try_insert(cur,
            '''INSERT INTO "Project" (id,name,code,"companyId","departmentId","projectManagerId","projectType","billingType",currency,"budgetAmount","estimatedHours","actualHours","billingRate","costRate","startDate","endDate",status,"createdAt","updatedAt")
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,75.0,45.0,'2025-01-01','2025-12-31',%s,NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
            (pid, nm, code, cid,
             dept_ids[j%len(dept_ids)] if dept_ids else None,
             emp_ids[j%len(emp_ids)], pt, bt, currency, bud, hrs, int(hrs*0.4),
             random.choice(['planning','active','on_track'])), 'Proj')

    for j, pid in enumerate(p_ids):
        emps = emp_ids[j*2:j*2+3] if j*2+3<=len(emp_ids) else emp_ids[:3]
        for k, eid in enumerate(emps):
            role = 'manager' if k==0 else 'member'
            c2 += try_insert(cur,
                '''INSERT INTO "ProjectMember" (id,"projectId","employeeId",role,"assignedBy","assignedAt","createdAt","updatedAt")
                   VALUES (%s,%s,%s,%s,%s,NOW(),NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
                (f'{prefix}-pm-{j}-{k}', pid, eid, role, emp_ids[0]), 'PM')
    print(f"  Project: {c1}, ProjectMember: {c2}")

    # ---- Loan ----
    c = 0
    for i, eid in enumerate(emp_ids[:6]):
        amt = random.randint(5000,50000); ten = random.choice([12,24,36])
        emi = round(amt/ten,2); st = random.choice(['pending','approved','active'])
        c += try_insert(cur,
            '''INSERT INTO "Loan" (id,"employeeId","loanType","loanAmount","interestRate","tenureMonths","emiAmount","outstandingBalance","disbursedAmount","startDate","endDate","recoveredAmount","remainingEmis",status,"approvedBy",remarks,"createdAt","updatedAt")
               VALUES (%s,%s,%s,%s,5.5,%s,%s,%s,%s,'2025-03-01','2026-03-01',%s,%s,%s,%s,%s,NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
            (f'{prefix}-loan-{i}', eid, random.choice(['PERSONAL','EMERGENCY','HOUSING','VEHICLE','EDUCATION']),
             amt, ten, emi, amt, amt if st=='active' else 0,
             round(emi*3,2) if st=='active' else 0, ten-3 if st=='active' else ten,
             st, emp_ids[0] if st in ['approved','active'] else None, 'Loan request'), 'Loan')
    print(f"  Loan: {c}")

    # ---- Reimbursement ----
    c = 0
    for i, eid in enumerate(emp_ids[:8]):
        st = random.choice(['pending','approved','paid'])
        ab = emp_ids[0] if st in ['approved','paid'] else None
        apa = date(2025,6,10) if st in ['approved','paid'] else None
        pa = date(2025,6,20) if st=='paid' else None
        c += try_insert(cur,
            '''INSERT INTO "Reimbursement" (id,"employeeId",type,amount,currency,description,status,"approvedBy","approvedAt","paidAt","createdAt","updatedAt")
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
            (f'{prefix}-reimb-{i}', eid, random.choice(['medical','fuel','phone','internet','education']),
             random.randint(100,5000), currency, 'Reimbursement claim', st, ab, apa, pa), 'Reimb')
    print(f"  Reimbursement: {c}")

    # ---- WorkflowDefinition + WorkflowInstance ----
    c1 = c2 = 0
    wd_ids = []
    for j, (nm,mod) in enumerate([('Leave Approval','leave'),('Expense Approval','expense'),
        ('Payroll Approval','payroll'),('Travel Approval','travel')]):
        wid = f'{prefix}-wd-{j}'
        wd_ids.append(wid)
        cid = comp_ids[j%len(comp_ids)] if comp_ids else None
        c1 += try_insert(cur,
            '''INSERT INTO "WorkflowDefinition" (id,name,module,"companyId",description,steps,"isActive",version,"createdAt","updatedAt")
               VALUES (%s,%s,%s,%s,%s,'[{"step":1,"role":"manager"},{"step":2,"role":"hr"}]',true,1,NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
            (wid, nm, mod, cid, f'{nm} workflow'), 'WD')

    for j, wid in enumerate(wd_ids):
        et = ['leave_request','expense_claim','payroll_run','travel_request'][j]
        for k in range(3):
            c2 += try_insert(cur,
                '''INSERT INTO "WorkflowInstance" (id,"workflowDefinitionId","entityType","entityId","currentStep",status,"createdAt","updatedAt")
                   VALUES (%s,%s,%s,%s,%s,%s,NOW(),NOW()) ON CONFLICT (id) DO NOTHING''',
                (f'{prefix}-wi-{j}-{k}', wid, et, f'{prefix}-entity-{j}-{k}',
                 random.randint(0,2), random.choice(['pending','approved','rejected'])), 'WI')
    print(f"  WorkflowDefinition: {c1}, WorkflowInstance: {c2}")

    conn.close()
    print(f"  {label} DB seeded!\n")


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
        'TravelRequest','ExpenseClaim','Asset','Document',
        'Notification','Announcement','OnboardingTask',
        'Project','ProjectMember','Loan','Reimbursement',
        'WorkflowDefinition','WorkflowInstance','TenantConfiguration',
    ]
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
    seed_db(DEMO_DB, 'DEMO', 'demo', 'USD', 'US',
            ['New York','San Francisco','Chicago','London','Singapore'])
    seed_db(MARQAI_DB, 'MARQAI', 'marq', 'INR', 'IND',
            ['Mumbai','Bangalore','Delhi','Chennai','Pune'])
    verify()
    print("\nDONE! Both tenant databases fully seeded.")
