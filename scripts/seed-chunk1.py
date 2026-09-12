#!/usr/bin/env python3
"""Seed chunk 1: employees, dependents, qualifications, experiences, skills, timesheets, payroll, promotions, separations, incidents, clients, vendors, OKRs"""
import psycopg2, random, uuid, sys
from datetime import datetime, timedelta, date
conn = psycopg2.connect(host='ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech', dbname='tenant_demo', user='neondb_owner', password='npg_pxZd8woKe4WB', sslmode='require', connect_timeout=30)
conn.autocommit = True
cur = conn.cursor()
cur.execute('SELECT id FROM "Employee"'); emp_ids = [e[0] for e in cur.fetchall()]
cur.execute('SELECT id FROM "User"'); user_ids = [u[0] for u in cur.fetchall()]
cur.execute('SELECT id FROM "Company"'); company_ids = [c[0] for c in cur.fetchall()]
cur.execute('SELECT id FROM "Tenant" LIMIT 1'); tenant_id = cur.fetchone()[0]
cur.execute('SELECT id, "defaultDays" FROM "LeaveType"'); leave_types = cur.fetchall()
cur.execute('SELECT id FROM "Project"'); project_ids = [p[0] for p in cur.fetchall()]
first_names = ['Aarav','Priya','Rohan','Ananya','Vikram','Meera','Arjun','Kavya','Rahul','Sneha','Aditya','Nisha','Suresh','Divya','Karthik','Pooja','Venkat','Swati','Nikhil','Ritu','Deepak','Suman','Rajesh','Neha','Amit','Shalini','Manish','Kavitha','Srinivas','Bhavna']
last_names = ['Sharma','Patel','Kumar','Singh','Reddy','Nair','Joshi','Gupta','Iyer','Rao','Chopra','Malhotra','Bhat','Das','Menon','Pillai','Hegde','Shetty','Kulkarni','Deshmukh']
skills = ['JavaScript','Python','Java','React','Node.js','AWS','Azure','Docker','Kubernetes','PostgreSQL','MongoDB','ML','Data Analysis','Agile','DevOps']
prev_comps = ['Infosys','TCS','Wipro','Cognizant','Capgemini','Deloitte','Accenture','HCL Tech']
prev_desgs = ['Software Engineer','Senior Engineer','Team Lead','Project Manager','Analyst','Consultant']
def cuid(): return 'sd_'+uuid.uuid4().hex[:20]
def pick(a): return random.choice(a)
def pick_n(a,n): return random.sample(a,min(n,len(a)))
def ri(a,b): return random.randint(a,b)
def rf(a,b): return round(random.uniform(a,b),2)
def rd(s,e): return s+timedelta(days=random.randint(0,max((e-s).days,1)))
def si(sql,params):
    try: cur.execute(sql, params); return True
    except: return False

# 1. Employees
print('=== Adding 30 employees ===')
new_emp_ids = []
emp_counter = len(emp_ids) + 1
for i in range(30):
    fn = first_names[i]; ln = last_names[i%len(last_names)]
    eid = cuid()
    if si('INSERT INTO "Employee" (id, "employeeId", "firstName", "lastName", email, phone, "departmentId", "designationId", "companyId", "branchId", "dateOfJoining", "dateOfBirth", gender, "maritalStatus", nationality, address, city, state, "zipCode", country, "bloodGroup", "emergencyContactName", "emergencyContactPhone", status, salary, "salaryCurrency", "bankName", "bankAccountNo", "bankIfscCode", "panNumber", "aadhaarNumber", "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())',
        (eid, f'EMP-{emp_counter:03d}', fn, ln, f'{fn.lower()}.{ln.lower()}@techcorp.com', f'+91{ri(7000000000,9999999999)}', pick(emp_ids), pick(emp_ids), pick(company_ids), None,
         rd(date(2020,1,1),date(2025,12,31)), rd(date(1975,1,1),date(2000,12,31)), pick(['Male','Female']), pick(['Single','Married']), 'Indian',
         f'{ri(1,999)} MG Road', pick(['Hyderabad','Mumbai','Bengaluru','Chennai','Pune','Delhi']), pick(['TG','MH','KA','TN','DL']), f'{ri(100000,999999)}', 'IN', pick(['A+','B+','O+','AB+']),
         f'Emergency Contact', f'+91{ri(7000000000,9999999999)}', 'active', rf(400000,3500000), 'INR', pick(['HDFC Bank','ICICI Bank','SBI','Axis Bank']), f'{ri(1000000000,9999999999)}', f'HDFC0{ri(10000,99999)}', f'ABCDE{ri(1000,9999)}P', f'{ri(100000000000,999999999999)}')):
        new_emp_ids.append(eid)
    emp_counter += 1
all_emp_ids = emp_ids + new_emp_ids
print(f'  Created {len(new_emp_ids)} employees (total: {len(all_emp_ids)})')

# 2. Dependents
dep_n = 0
for eid in all_emp_ids:
    for _ in range(random.choices([0,1,2],weights=[30,45,25])[0]):
        rel = pick(['Spouse','Son','Daughter','Father','Mother'])
        if si('INSERT INTO "Dependent" (id, "employeeId", name, relation, "dateOfBirth", gender, "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s,%s,NOW(),NOW())',
            (cuid(), eid, f'{pick(first_names)} {pick(last_names)}', rel, rd(date(1960,1,1),date(2020,12,31)), 'Female' if rel in ['Spouse','Daughter','Mother'] else 'Male')):
            dep_n += 1
print(f'  Dependents: {dep_n}')

# 3. Qualifications
qual_n = 0
for eid in all_emp_ids:
    for _ in range(random.choices([1,2],weights=[55,45])[0]):
        if si('INSERT INTO "Qualification" (id, "employeeId", degree, institution, year, percentage, "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s,%s,NOW(),NOW())',
            (cuid(), eid, pick(['B.Tech','M.Tech','MBA','B.Com','M.Sc','CA','BCA','MCA']), pick(['IIT Bombay','IIT Delhi','IIM Ahmedabad','ISB Hyderabad','BITS Pilani','NIT Trichy','JNTU Hyderabad','Anna University']), ri(2005,2023), rf(55,95))):
            qual_n += 1
print(f'  Qualifications: {qual_n}')

# 4. Experiences
exp_n = 0
for eid in all_emp_ids:
    for _ in range(random.choices([0,1,2],weights=[20,50,30])[0]):
        sd = rd(date(2008,1,1),date(2023,12,31))
        if si('INSERT INTO "Experience" (id, "employeeId", company, designation, "startDate", "endDate", "isCurrent", description, "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())',
            (cuid(), eid, pick(prev_comps), pick(prev_desgs), sd, rd(sd,date(2024,12,31)), False, 'Worked on various projects')):
            exp_n += 1
print(f'  Experiences: {exp_n}')

# 5. Skills
sk_n = 0
for eid in all_emp_ids:
    for skill in pick_n(skills, random.choices([1,2,3,4],weights=[10,30,35,25])[0]):
        if si('INSERT INTO "EmployeeSkill" (id, "employeeId", skill, level, "yearsOfExp", "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s,NOW(),NOW())',
            (cuid(), eid, skill, pick(['beginner','intermediate','advanced','expert']), ri(1,15))):
            sk_n += 1
print(f'  Skills: {sk_n}')

# 6. Timesheets
ts_n = 0
for eid in pick_n(all_emp_ids, min(30, len(all_emp_ids))):
    for day_offset in range(1, 15):
        ts_date = datetime.now() - timedelta(days=day_offset)
        if ts_date.weekday() >= 5: continue
        if si('INSERT INTO "Timesheet" (id, "employeeId", date, "projectId", project, task, hours, description, status, "approvedBy", "approvedAt", locked, invoiced, "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())',
            (cuid(), eid, ts_date.date(), pick(project_ids), pick(['HRMS Portal','Mobile App','API Integration']), pick(['Development','Code Review','Testing','Documentation']),
             rf(4,9), f'Worked on feature development', pick(['draft','submitted','approved','approved']),
             pick(user_ids), ts_date+timedelta(days=2), False, False)):
            ts_n += 1
print(f'  Timesheets: {ts_n}')

# 7. Payroll
pay_n = 0
for eid in all_emp_ids:
    for month in [1,2,3,4,5,6]:
        basic = rf(25000,150000); hra=basic*0.4; da=basic*0.1; gross=basic+hra+da+4250+rf(0,10000)
        pf=basic*0.12; tax=rf(0,basic*0.2); td=pf+tax+200+rf(0,5000); net=gross-td
        if si('INSERT INTO "Payroll" (id, "employeeId", month, year, "basicSalary", hra, da, conveyance, medical, "otherAllowances", "grossSalary", pf, esi, tax, "professionalTax", "otherDeductions", "totalDeductions", "netSalary", currency, status, "paidDate", "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())',
            (cuid(), eid, month, 2026, basic, hra, da, 3000, 1250, gross-basic-hra-da-3000-1250, gross, pf, 0, tax, 200, rf(0,5000), td, net, 'INR', pick(['processed','paid','paid']), date(2026,month,28) if random.random()>0.3 else None)):
            pay_n += 1
print(f'  Payroll: {pay_n}')

# 8. Promotions
promo_n = 0
for eid in pick_n(all_emp_ids, 15):
    eff = rd(date(2023,1,1),date(2026,6,30)); st = pick(['pending','approved','approved'])
    if si('INSERT INTO "Promotion" (id, "employeeId", "fromDesignation", "toDesignation", "fromDepartment", "toDepartment", "effectiveDate", "salaryChange", reason, status, "approvedBy", "approvedAt", "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())',
        (cuid(), eid, pick(['Associate','Junior Engineer','Senior Associate','Team Lead']), pick(['Senior Associate','Senior Engineer','Team Lead','Manager']),
         pick(['Engineering','HR','Finance','Operations']), pick(['Engineering','HR','Finance','Operations']), eff, rf(50000,500000), 'Excellent performance', st,
         pick(user_ids) if st=='approved' else None, eff+timedelta(days=1) if st=='approved' else None)):
        promo_n += 1
print(f'  Promotions: {promo_n}')

# 9. Separations
sep_n = 0
for eid in pick_n(all_emp_ids, 5):
    lwd = rd(date(2025,1,1),date(2026,6,30)); st = pick(['pending','notice_period','completed','completed'])
    if si('INSERT INTO "Separation" (id, "employeeId", type, reason, "noticePeriod", "lastWorkingDate", status, "settlementAmount", "approvedBy", "approvedAt", "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())',
        (cuid(), eid, pick(['resignation','termination','retirement']), pick(['Better opportunity','Personal reasons','Relocation']), ri(30,90), lwd, st,
         rf(50000,500000) if st=='completed' else None, pick(user_ids) if st=='completed' else None, lwd if st=='completed' else None)):
        sep_n += 1
print(f'  Separations: {sep_n}')

# 10. Incident Reports
inc_n = 0
for eid in pick_n(all_emp_ids, 10):
    st = pick(['open','investigating','resolved','closed'])
    if si('INSERT INTO "IncidentReport" (id, "employeeId", type, title, description, severity, status, "reportedDate", resolution, "resolvedDate", "reportedBy", "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())',
        (cuid(), eid, pick(['safety','security','harassment','other']), pick(['Workplace safety violation','Unauthorized access','Equipment malfunction','Data breach concern']),
         'Detailed incident description', pick(['low','medium','high','critical']), st, rd(date(2025,1,1),date(2026,6,30)),
         'Resolved through appropriate channels' if st in ['resolved','closed'] else None,
         rd(date(2026,1,1),date(2026,6,30)) if st in ['resolved','closed'] else None, pick(user_ids))):
        inc_n += 1
print(f'  Incident Reports: {inc_n}')

# 11. Clients
cl_n = 0
for cname in ['Acme Corp','GlobalTech Inc','Pinnacle Solutions','Vertex Systems','Quantum Analytics','Zenith Industries','Apex Digital','NovaTech Solutions','CrestView Partners','EagleEye Consulting']:
    if si('INSERT INTO "Client" (id, name, code, "companyId", industry, "contactName", "contactEmail", "contactPhone", status, "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW()) ON CONFLICT DO NOTHING',
        (cuid(), cname, f'CL-{ri(100,999)}', pick(company_ids), pick(['Technology','Finance','Healthcare','Manufacturing','Retail']),
         f'{pick(first_names)} {pick(last_names)}', f'contact@{cname.lower().replace(" ","")}.com', f'+91{ri(7000000000,9999999999)}', 'active')):
        cl_n += 1
print(f'  Clients: {cl_n}')

# 12. Vendors
vn_n = 0
for vname in ['CloudNine Services','TechSupply Co','OfficePro Solutions','DataVault Systems','SecureNet Solutions','GreenWorks Supplies','FastTrack Logistics','PrimeEdge Consulting','CoreTech Hardware','SmartBuild Corp']:
    if si('INSERT INTO "Vendor" (id, name, code, "companyId", type, "contactName", "contactEmail", "contactPhone", status, "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW()) ON CONFLICT DO NOTHING',
        (cuid(), vname, f'VN-{ri(100,999)}', pick(company_ids), pick(['IT Services','Office Supplies','Cloud Infrastructure','Security','Consulting','Hardware']),
         f'{pick(first_names)} {pick(last_names)}', f'info@{vname.lower().replace(" ","")}.com', f'+91{ri(7000000000,9999999999)}', 'active')):
        vn_n += 1
print(f'  Vendors: {vn_n}')

# 13. OKRs
okr_n = 0
for obj in ['Increase Revenue by 20%','Reduce Customer Churn to 5%','Launch New Product Line','Improve Employee Satisfaction','Achieve ISO Certification','Expand to 3 New Markets','Reduce Operating Costs by 15%','Achieve 95% On-time Delivery']:
    for comp in pick_n(company_ids, 2):
        sd = rd(date(2026,1,1),date(2026,3,31)); st = pick(['not_started','in_progress','in_progress','completed'])
        if si('INSERT INTO "OKR" (id, objective, "companyId", "ownerId", "startDate", "endDate", status, progress, "createdAt", "updatedAt") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW()) ON CONFLICT DO NOTHING',
            (cuid(), obj, comp, pick(all_emp_ids), sd, sd+timedelta(days=90), st, ri(0,100) if st=='in_progress' else (100 if st=='completed' else 0))):
            okr_n += 1
print(f'  OKRs: {okr_n}')

cur.close()
conn.close()
print('Chunk 1 done!')
