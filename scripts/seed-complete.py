#!/usr/bin/env python3
"""Seed tenant databases. Demo=SAMPLE data, MarqAI=REAL data."""
import psycopg2
from datetime import date

POOLER = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
OWNER_USER = 'neondb_owner'
OWNER_PWD = 'npg_pxZd8woKe4WB'
ACCESS_USER = 'tenant_access'
ACCESS_PWD = 'npg_CNPkcted1B5p'
PLATFORM = 'neondb'
DEMO = 'tenant_demo'
MARQAI = 'tenant_marqaitechgroup'

PERM_ACTIONS = ['view','create','edit','delete','export','approve']

def conn(db, owner=True):
    u = OWNER_USER if owner else ACCESS_USER
    p = OWNER_PWD if owner else ACCESS_PWD
    c = psycopg2.connect(host=POOLER, database=db, user=u, password=p, sslmode='require')
    c.autocommit = True
    return c

def ensure_modules_and_perms(cur):
    """Ensure modules and permissions exist. Use existing if already present."""
    cur.execute('SELECT COUNT(*) FROM "Module";')
    mod_count = cur.fetchone()[0]
    
    if mod_count > 0:
        # Modules already exist - get their IDs
        cur.execute('SELECT key, id FROM "Module";')
        mod_ids = {r[0]: r[1] for r in cur.fetchall()}
        print(f"  Using existing {len(mod_ids)} modules")
    else:
        # Create modules
        modules_data = [
            ('dashboard','Dashboard','Core HR','LayoutDashboard',1),
            ('employees','Employees','Core HR','Users',2),
            ('company','Company','Core HR','Building2',3),
            ('recruitment','Recruitment','Talent','UserPlus',4),
            ('requisitions','Requisitions','Talent','ClipboardList',5),
            ('offers','Offers','Talent','FileText',6),
            ('job_portal','Job Portal','Talent','Globe',7),
            ('ai_interview','AI Interview','Talent','Bot',8),
            ('onboarding','Onboarding','Lifecycle','UserCheck',9),
            ('preboarding','Preboarding','Lifecycle','ClipboardCheck',10),
            ('attendance','Attendance','Time','Clock',11),
            ('leave','Leave','Time','CalendarOff',12),
            ('timesheets','Timesheets','Time','Timer',13),
            ('payroll','Payroll','Compensation','Banknote',14),
            ('salary_structures','Salary Structures','Compensation','Coins',15),
            ('performance','Performance','Performance','TrendingUp',16),
            ('training','Training','Performance','GraduationCap',17),
            ('engagement','Engagement','Performance','Heart',18),
            ('succession','Succession','Performance','ArrowUpRight',19),
            ('projects','Projects','Operations','FolderKanban',20),
            ('travel','Travel','Operations','Plane',21),
            ('expenses','Expenses','Operations','Receipt',22),
            ('assets','Assets','Operations','Monitor',23),
            ('documents','Documents','Operations','FileStack',24),
            ('clients','Clients','External','Handshake',25),
            ('vendors','Vendors','External','Truck',26),
            ('helpdesk','Helpdesk','Support','Headphones',27),
            ('grievances','Grievances','Support','AlertTriangle',28),
            ('ai_assistant','AI Assistant','Support','Sparkles',29),
            ('docs','Documentation','Knowledge','BookOpen',30),
            ('workflows','Workflows','Governance','GitBranch',31),
            ('reports','Reports','Governance','BarChart3',32),
            ('settings','Settings','Governance','Settings',33),
            ('notifications','Notifications','Governance','Bell',34),
            ('super_admin','Super Admin','Admin','Shield',35),
            ('tenant_admin','Tenant Admin','Admin','ShieldCheck',36),
            ('ai_admin','AI Admin','Admin','Brain',37),
            ('tenant_configuration','Tenant Configuration','Admin','Settings',38),
            ('subscriptions','Subscriptions','Admin','CreditCard',39),
            ('packages','Packages','Admin','Package',40),
            ('domain_management','Domain Management','Admin','Globe',41),
            ('rbac','RBAC Management','Admin','Shield',48),
            ('separation','Separation','Lifecycle','UserMinus',54),
            ('insurance','Insurance','Benefits','HeartShield',55),
            ('loans','Loans','Compensation','Banknote',56),
            ('claims','Claims','Compensation','FileCheck',57),
            ('crm','CRM','External','Users',53),
        ]
        mod_ids = {}
        for key, name, cat, icon, sort in modules_data:
            import uuid
            mid = str(uuid.uuid4())
            mod_ids[key] = mid
            cur.execute(
                """INSERT INTO "Module" (id, key, name, category, icon, "sortOrder", "createdAt", "updatedAt")
                   VALUES (%s,%s,%s,%s,%s,%s,NOW(),NOW()) ON CONFLICT (key) DO NOTHING""",
                (mid, key, name, cat, icon, sort))
        # Re-fetch after potential conflicts
        cur.execute('SELECT key, id FROM "Module";')
        mod_ids = {r[0]: r[1] for r in cur.fetchall()}
        print(f"  Created {len(mod_ids)} modules")

    # Ensure permissions exist
    cur.execute('SELECT COUNT(*) FROM "Permission";')
    perm_count = cur.fetchone()[0]
    
    if perm_count > 0:
        cur.execute('SELECT id FROM "Permission";')
        perm_ids = [r[0] for r in cur.fetchall()]
        print(f"  Using existing {len(perm_ids)} permissions")
    else:
        perm_ids = []
        for key, mid in mod_ids.items():
            for action in PERM_ACTIONS:
                import uuid
                pid = str(uuid.uuid4())
                perm_ids.append(pid)
                cur.execute(
                    """INSERT INTO "Permission" (id, "moduleId", action, description, "createdAt", "updatedAt")
                       VALUES (%s,%s,%s,%s,NOW(),NOW())""",
                    (pid, mid, action, f'{action} {key}'))
        print(f"  Created {len(perm_ids)} permissions")
    
    return mod_ids, perm_ids

def assign_perms_to_role(cur, rid, perm_ids):
    for pid in perm_ids:
        try:
            cur.execute(
                """INSERT INTO "RolePermission" ("roleId","permissionId","createdAt","updatedAt")
                   VALUES (%s,%s,NOW(),NOW()) ON CONFLICT DO NOTHING""", (rid, pid))
        except:
            pass

def seed_demo():
    c = conn(DEMO)
    cur = c.cursor()
    print("=== SEEDING DEMO DB ===")

    cur.execute('SELECT id FROM "Tenant" LIMIT 1;')
    tid = cur.fetchone()[0]
    cur.execute('SELECT id FROM "Company" LIMIT 1;')
    first_comp = cur.fetchone()[0]
    cur.execute('SELECT id FROM "Company";')
    comp_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT id FROM "Department" LIMIT 30;')
    dept_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT id FROM "Designation" LIMIT 80;')
    desig_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT id FROM "Branch" LIMIT 10;')
    branch_ids = [r[0] for r in cur.fetchall()]

    # 1. Modules & Permissions
    mod_ids, perm_ids = ensure_modules_and_perms(cur)

    # 2. Users
    pc = conn(PLATFORM, owner=False)
    pcur = pc.cursor()
    pcur.execute('SELECT password FROM "User" LIMIT 1;')
    pwd = pcur.fetchone()[0]
    pc.close()

    demo_users = [
        ('demo-superadmin','superadmin@3boxeshrms.com','3Boxes Super Admin','super_admin'),
        ('demo-tenantadmin','admin@3boxeshrms.com','3Boxes Demo Admin','tenant_admin'),
        ('demo-hradmin','hr@3boxeshrms.com','HR Admin Demo','hr_admin'),
        ('demo-hrmanager','hrmanager@3boxeshrms.com','HR Manager Demo','hr_manager'),
        ('demo-financeadmin','finance@3boxeshrms.com','Finance Admin Demo','finance_admin'),
        ('demo-manager1','manager1@3boxeshrms.com','Project Manager','manager'),
        ('demo-employee1','john.doe@3boxeshrms.com','John Doe','employee'),
        ('demo-employee2','jane.smith@3boxeshrms.com','Jane Smith','employee'),
        ('demo-employee3','mike.wilson@3boxeshrms.com','Mike Wilson','employee'),
    ]
    user_ids = []
    for uid, email, name, role in demo_users:
        user_ids.append(uid)
        cur.execute(
            """INSERT INTO "User" (id,email,password,name,"tenantId",role,status,"createdAt","updatedAt")
               VALUES (%s,%s,%s,%s,%s,%s,'active',NOW(),NOW())
               ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email,name=EXCLUDED.name,role=EXCLUDED.role,"tenantId"=EXCLUDED."tenantId" """,
            (uid, email, pwd, name, tid, role))
    print(f"  Users: {len(demo_users)}")

    # 3. Roles
    demo_roles = [
        ('demo-role-super-admin','Super Administrator','super_admin','Full system access',True,1),
        ('demo-role-tenant-admin','Tenant Administrator','tenant_admin','Tenant management',True,2),
        ('demo-role-hr-admin','HR Administrator','hr_admin','HR operations',True,3),
        ('demo-role-hr-manager','HR Manager','hr_manager','HR team management',True,3),
        ('demo-role-manager','Manager','manager','Team management',True,4),
        ('demo-role-employee','Employee','employee','Basic access',True,5),
        ('demo-role-finance-admin','Finance Administrator','finance_admin','Finance operations',True,3),
        ('demo-role-finance-manager','Finance Manager','finance_manager','Finance management',True,4),
        ('demo-role-travel-admin','Travel Administrator','travel_admin','Travel management',True,3),
        ('demo-role-crm-admin','CRM Administrator','crm_admin','CRM management',True,3),
    ]
    for rid, rname, rkey, rdesc, ris, rlvl in demo_roles:
        cur.execute(
            """INSERT INTO "Role" (id,name,key,description,"isSystem",level,"tenantId",status,"createdAt","updatedAt")
               VALUES (%s,%s,%s,%s,%s,%s,%s,'active',NOW(),NOW())
               ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,key=EXCLUDED.key,"tenantId"=EXCLUDED."tenantId" """,
            (rid, rname, rkey, rdesc, ris, rlvl, tid))

    # Assign permissions by role type
    hr_keys = ['employees','leave','attendance','recruitment','performance','training','onboarding','helpdesk','preboarding','engagement']
    fin_keys = ['payroll','expenses','travel','reports','salary_structures','loans','claims','insurance']
    emp_keys = ['dashboard','employees','leave','attendance','expenses','travel','documents','helpdesk','timesheets']
    
    # Get permission IDs by module key
    cur.execute('SELECT p.id, m.key FROM "Permission" p JOIN "Module" m ON p."moduleId" = m.id;')
    perm_by_mod = {}
    for pid, mkey in cur.fetchall():
        if mkey not in perm_by_mod: perm_by_mod[mkey] = []
        perm_by_mod[mkey].append(pid)
    
    for rid, rname, rkey, _, _, _ in demo_roles:
        if rkey in ['super_admin','tenant_admin']:
            assign_perms_to_role(cur, rid, perm_ids)
        elif rkey in ['hr_admin','hr_manager']:
            pids = []
            for k in hr_keys:
                pids.extend(perm_by_mod.get(k, []))
            assign_perms_to_role(cur, rid, pids)
        elif rkey in ['finance_admin','finance_manager']:
            pids = []
            for k in fin_keys:
                pids.extend(perm_by_mod.get(k, []))
            assign_perms_to_role(cur, rid, pids)
        elif rkey == 'manager':
            pids = [p for p in perm_ids if any(k in p for k in emp_keys) and '-view' in p]
            assign_perms_to_role(cur, rid, pids)
        elif rkey == 'employee':
            pids = [p for p in perm_ids if any(k in p for k in emp_keys) and '-view' in p]
            assign_perms_to_role(cur, rid, pids)
        elif rkey == 'travel_admin':
            pids = perm_by_mod.get('travel', []) + perm_by_mod.get('expenses', [])
            assign_perms_to_role(cur, rid, pids)
        elif rkey == 'crm_admin':
            pids = perm_by_mod.get('crm', []) + perm_by_mod.get('clients', []) + perm_by_mod.get('projects', [])
            assign_perms_to_role(cur, rid, pids)
    print(f"  Roles: {len(demo_roles)}")

    # UserRoleAssignments
    for uid, rid in [('demo-superadmin','demo-role-super-admin'),
                     ('demo-tenantadmin','demo-role-tenant-admin'),
                     ('demo-hradmin','demo-role-hr-admin'),
                     ('demo-hrmanager','demo-role-hr-manager'),
                     ('demo-financeadmin','demo-role-finance-admin'),
                     ('demo-manager1','demo-role-manager'),
                     ('demo-employee1','demo-role-employee'),
                     ('demo-employee2','demo-role-employee'),
                     ('demo-employee3','demo-role-employee')]:
        cur.execute(
            """INSERT INTO "UserRoleAssignment" ("userId","roleId","createdAt","updatedAt")
               VALUES (%s,%s,NOW(),NOW()) ON CONFLICT DO NOTHING""", (uid, rid))

    # 4. Employees
    fns = ['John','Sarah','Michael','Emily','David','Jessica','Robert','Amanda','William','Jennifer',
           'Richard','Lisa','James','Maria','Thomas','Patricia','Daniel','Linda','Matthew','Elizabeth']
    lns = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
           'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin']
    for i in range(20):
        f = fns[i%len(fns)]; l = lns[i%len(lns)]
        eid = f'demo-emp-{i+1}'
        email = f'{f.lower()}.{l.lower()}@3boxeshrms.com'
        uid = user_ids[i] if i < len(user_ids) else None
        sal = 50000 + i*5000
        cur.execute(
            """INSERT INTO "Employee" (id,"employeeId","firstName","lastName",email,phone,avatar,"userId",
                "departmentId","designationId","branchId","companyId","dateOfJoining","dateOfBirth",
                gender,"maritalStatus",nationality,address,city,state,"zipCode",country,
                "bloodGroup","emergencyContactName","emergencyContactPhone",status,
                "bankName","bankAccountNo","bankIfscCode","panNumber",salary,"salaryCurrency",
                "createdAt","updatedAt")
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())
               ON CONFLICT (id) DO UPDATE SET "firstName"=EXCLUDED."firstName","lastName"=EXCLUDED."lastName",email=EXCLUDED.email,"companyId"=EXCLUDED."companyId" """,
            (eid,f'EMP-{1000+i}',f,l,email,f'+1-555-{1000+i}',None,uid,
             dept_ids[i%len(dept_ids)] if dept_ids else None,
             desig_ids[i%len(desig_ids)] if desig_ids else None,
             branch_ids[i%len(branch_ids)] if branch_ids else None,
             comp_ids[i%len(comp_ids)],
             date(2024,(i%12)+1,(i%28)+1), date(1985+(i%15),(i%12)+1,(i%28)+1),
             'male' if i%2==0 else 'female','single','American',
             f'{100+i} Demo St','New York','NY','10001','United States',
             'O+','Emergency','+1-555-9111','active',
             'Demo Bank',f'DNBNK{1000+i}','DNBN0000001',f'DEMO{i}1234A',sal,'USD'))
    print(f"  Employees: 20")

    # 5. Leave Types
    for lid,name,code,days,paid in [
        ('demo-lt-casual','Casual Leave','CL',12,True),
        ('demo-lt-sick','Sick Leave','SL',10,True),
        ('demo-lt-earned','Earned Leave','EL',15,True),
        ('demo-lt-maternity','Maternity Leave','ML',180,True),
        ('demo-lt-paternity','Paternity Leave','PL',15,True),
        ('demo-lt-compoff','Compensatory Off','CO',5,True),
        ('demo-lt-restricted','Restricted Holiday','RH',2,True),
    ]:
        cur.execute(
            """INSERT INTO "LeaveType" (id,name,code,"defaultDays","isPaid","carryForward","maxCarryForward",
                status,"companyId","attachmentMandatory","attachmentMandatoryAfterDays",
                "collaborativeCheckEnabled","encashmentAllowed","encashmentBasis","maxEncashmentDays",
                "createdAt","updatedAt")
               VALUES (%s,%s,%s,%s,%s,false,0,'active',%s,false,0,true,false,'basic',0,NOW(),NOW())
               ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,code=EXCLUDED.code,"companyId"=EXCLUDED."companyId" """,
            (lid,name,code,days,paid,first_comp))
    print(f"  Leave Types: 7")

    # 6. Holidays
    for hid,hname,hdate,htype in [
        ('demo-hol-1',"New Year's Day",date(2025,1,1),'public'),
        ('demo-hol-2','MLK Day',date(2025,1,20),'public'),
        ('demo-hol-3',"Presidents' Day",date(2025,2,17),'public'),
        ('demo-hol-4','Memorial Day',date(2025,5,26),'public'),
        ('demo-hol-5','Independence Day',date(2025,7,4),'public'),
        ('demo-hol-6','Labor Day',date(2025,9,1),'public'),
        ('demo-hol-7','Thanksgiving',date(2025,11,27),'public'),
        ('demo-hol-8','Christmas',date(2025,12,25),'public'),
    ]:
        cur.execute(
            """INSERT INTO "Holiday" (id,name,date,type,"isOptional","optionalQuota","companyId","createdAt","updatedAt")
               VALUES (%s,%s,%s,%s,false,0,%s,NOW(),NOW())
               ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,"companyId"=EXCLUDED."companyId" """,
            (hid,hname,hdate,htype,first_comp))
    print(f"  Holidays: 8")

    # 7. TenantConfiguration
    cur.execute(
        """INSERT INTO "TenantConfiguration" (id,"tenantId","autoProvisionPayroll","autoProvisionCompliance",
           "autoProvisionTaxSlabs","autoProvisionMinWage","activeCountryCount","activeCurrencyCount",
           "activeLanguageCount","createdAt","updatedAt")
           VALUES ('demo-tcfg',%s,true,true,true,true,8,8,5,NOW(),NOW())
           ON CONFLICT (id) DO UPDATE SET "autoProvisionPayroll"=true """, (tid,))

    # 8. Clean platform tables
    for t in ['TenantDatabase','TrialRegistration','DataResidencyPolicy','SubscriptionPlan']:
        try: cur.execute(f'DELETE FROM "{t}"')
        except: pass

    c.close()
    print("  Demo DB done! ✅\n")


def seed_marqai():
    c = conn(MARQAI)
    cur = c.cursor()
    print("=== SEEDING MARQAI DB ===")

    cur.execute('SELECT id FROM "Tenant" LIMIT 1;')
    tid = cur.fetchone()[0]
    cur.execute('SELECT id FROM "Company" LIMIT 1;')
    first_comp = cur.fetchone()[0]
    cur.execute('SELECT id FROM "Company";')
    comp_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT id FROM "Department" LIMIT 20;')
    dept_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT id FROM "Designation" LIMIT 20;')
    desig_ids = [r[0] for r in cur.fetchall()]
    cur.execute('SELECT id FROM "Branch" LIMIT 10;')
    branch_ids = [r[0] for r in cur.fetchall()]

    # 1. Modules & Permissions
    mod_ids, perm_ids = ensure_modules_and_perms(cur)

    # 2. Assign perms to existing roles
    cur.execute('SELECT id FROM "Role" WHERE "tenantId" = %s;', (tid,))
    for rr in cur.fetchall():
        assign_perms_to_role(cur, rr[0], perm_ids)

    # 3. Employees for existing users
    cur.execute('SELECT id, email, name, role FROM "User";')
    users = cur.fetchall()
    ec = 0
    for uid, email, name, role in users:
        cur.execute('SELECT id FROM "Employee" WHERE "userId" = %s;', (uid,))
        if cur.fetchone(): continue
        parts = name.split(' ',1)
        f = parts[0]; l = parts[1] if len(parts)>1 else ''
        eid = f'marq-emp-{uid[:12].replace("-","").replace("_","")}'
        cur.execute(
            """INSERT INTO "Employee" (id,"employeeId","firstName","lastName",email,phone,avatar,"userId",
                "departmentId","designationId","branchId","companyId","dateOfJoining","dateOfBirth",
                gender,"maritalStatus",nationality,address,city,state,"zipCode",country,
                "bloodGroup","emergencyContactName","emergencyContactPhone",status,
                "bankName","bankAccountNo","bankIfscCode","panNumber",salary,"salaryCurrency",
                "createdAt","updatedAt")
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())
               ON CONFLICT (id) DO NOTHING""",
            (eid,f'MARQ-{1000+ec}',f,l,email,None,None,uid,
             dept_ids[0] if dept_ids else None,desig_ids[0] if desig_ids else None,
             branch_ids[0] if branch_ids else None,comp_ids[0] if comp_ids else None,
             date(2024,1,15),date(1990,5,15),'male','single','Indian',
             '123 MarqAI St','Hyderabad','Telangana','500001','India',
             'O+','Emergency','+91-9876543210','active',
             'HDFC Bank','1234567890','HDFC0001234','ABCDE1234F',75000,'INR'))
        ec += 1
    print(f"  Employees for users: {ec}")

    # More MarqAI employees
    more = [
        ('marq-emp-raj','Rajesh','Kumar','rajesh.kumar@marqaitech.com'),
        ('marq-emp-pri','Priya','Sharma','priya.sharma@marqaitech.com'),
        ('marq-emp-aru','Arun','Reddy','arun.reddy@marqaitech.com'),
        ('marq-emp-sne','Sneha','Patil','sneha.patil@marqaitech.com'),
        ('marq-emp-mee','Meera','Nair','meera.nair@marqaitech.com'),
        ('marq-emp-vik','Vikram','Singh','vikram.singh@marqaitech.com'),
    ]
    for i,(eid,f,l,email) in enumerate(more):
        cid = comp_ids[i%len(comp_ids)]
        did = dept_ids[i%len(dept_ids)] if dept_ids else None
        gid = desig_ids[i%len(desig_ids)] if desig_ids else None
        bid = branch_ids[i%len(branch_ids)] if branch_ids else None
        cur.execute(
            """INSERT INTO "Employee" (id,"employeeId","firstName","lastName",email,phone,avatar,"userId",
                "departmentId","designationId","branchId","companyId","dateOfJoining","dateOfBirth",
                gender,"maritalStatus",nationality,address,city,state,"zipCode",country,
                "bloodGroup","emergencyContactName","emergencyContactPhone",status,
                "bankName","bankAccountNo","bankIfscCode","panNumber",salary,"salaryCurrency",
                "createdAt","updatedAt")
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),NOW())
               ON CONFLICT (id) DO NOTHING""",
            (eid,f'MARQ-{2000+i}',f,l,email,f'+91-98765{i}4321',None,None,
             did,gid,bid,cid,
             date(2024,(i%12)+1,(i%28)+1),date(1985+(i%15),(i%12)+1,(i%28)+1),
             'male' if i%2==0 else 'female','single','Indian',
             'MarqAI Campus','Hyderabad','Telangana','500001','India',
             'B+','Emergency','+91-9876543210','active',
             'HDFC Bank',f'1234{5678+i}','HDFC0001234',f'MARQ{i}1234F',60000+i*5000,'INR'))
    print(f"  Additional employees: {len(more)}")

    # Leave Types
    for lid,name,code,days,paid in [
        ('marq-lt-casual','Casual Leave','CL',12,True),
        ('marq-lt-sick','Sick Leave','SL',10,True),
        ('marq-lt-earned','Earned Leave','EL',15,True),
        ('marq-lt-maternity','Maternity Leave','ML',180,True),
        ('marq-lt-paternity','Paternity Leave','PL',15,True),
        ('marq-lt-compoff','Compensatory Off','CO',5,True),
    ]:
        cur.execute(
            """INSERT INTO "LeaveType" (id,name,code,"defaultDays","isPaid","carryForward","maxCarryForward",
                status,"companyId","attachmentMandatory","attachmentMandatoryAfterDays",
                "collaborativeCheckEnabled","encashmentAllowed","encashmentBasis","maxEncashmentDays",
                "createdAt","updatedAt")
               VALUES (%s,%s,%s,%s,%s,false,0,'active',%s,false,0,true,false,'basic',0,NOW(),NOW())
               ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,code=EXCLUDED.code,"companyId"=EXCLUDED."companyId" """,
            (lid,name,code,days,paid,first_comp))
    print(f"  Leave Types: 6")

    # Indian Holidays
    for hid,hname,hdate,htype in [
        ('marq-hol-1','Republic Day',date(2025,1,26),'public'),
        ('marq-hol-2','Holi',date(2025,3,14),'public'),
        ('marq-hol-3','Good Friday',date(2025,4,18),'public'),
        ('marq-hol-4','Independence Day',date(2025,8,15),'public'),
        ('marq-hol-5','Gandhi Jayanti',date(2025,10,2),'public'),
        ('marq-hol-6','Diwali',date(2025,10,20),'public'),
        ('marq-hol-7','Christmas',date(2025,12,25),'public'),
    ]:
        cur.execute(
            """INSERT INTO "Holiday" (id,name,date,type,"isOptional","optionalQuota","companyId","createdAt","updatedAt")
               VALUES (%s,%s,%s,%s,false,0,%s,NOW(),NOW())
               ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,"companyId"=EXCLUDED."companyId" """,
            (hid,hname,hdate,htype,first_comp))
    print(f"  Holidays: 7")

    # UserRoleAssignments
    cur.execute('SELECT id, role FROM "User" WHERE "tenantId" = %s;', (tid,))
    musers = cur.fetchall()
    cur.execute('SELECT id, key FROM "Role" WHERE "tenantId" = %s;', (tid,))
    rmap = {r[1]: r[0] for r in cur.fetchall()}
    for uid, role in musers:
        rid = rmap.get(role)
        if rid:
            cur.execute(
                """INSERT INTO "UserRoleAssignment" ("userId","roleId","createdAt","updatedAt")
                   VALUES (%s,%s,NOW(),NOW()) ON CONFLICT DO NOTHING""", (uid, rid))

    # TenantConfiguration
    cur.execute('SELECT COUNT(*) FROM "TenantConfiguration" WHERE "tenantId" = %s;', (tid,))
    if cur.fetchone()[0] == 0:
        cur.execute(
            """INSERT INTO "TenantConfiguration" (id,"tenantId","autoProvisionPayroll","autoProvisionCompliance",
               "autoProvisionTaxSlabs","autoProvisionMinWage","activeCountryCount","activeCurrencyCount",
               "activeLanguageCount","createdAt","updatedAt")
               VALUES ('marq-tcfg',%s,true,true,true,true,1,1,2,NOW(),NOW())""", (tid,))

    # Clean platform tables
    for t in ['TenantDatabase','TrialRegistration','DataResidencyPolicy','SubscriptionPlan']:
        try: cur.execute(f'DELETE FROM "{t}"')
        except: pass

    c.close()
    print("  MarqAI DB done! ✅\n")


def verify():
    print("=" * 60)
    print("VERIFICATION")
    print("=" * 60)
    for db, label in [(DEMO,'Demo'),(MARQAI,'MarqAI')]:
        c = conn(db)
        cur = c.cursor()
        print(f"\n  {label}:")
        for t in ['Tenant','User','CompanyGroup','Company','Department','Employee',
                  'Role','Module','Permission','LeaveType','Holiday','Designation','Branch']:
            try:
                cur.execute(f'SELECT COUNT(*) FROM "{t}";')
                n = cur.fetchone()[0]
                print(f'    {"✅" if n>0 else "⚠️ "} {t}: {n}')
            except Exception as e:
                print(f'    ❌ {t}: {str(e)[:50]}')
        cur.execute('SELECT id FROM "Tenant" LIMIT 1;')
        tid = cur.fetchone()[0]
        cur.execute('SELECT COUNT(*) FROM "User" WHERE "tenantId" != %s;', (tid,))
        w = cur.fetchone()[0]
        print(f'    {"✅" if w==0 else "❌"} Wrong-tenant users: {w}')
        c.close()


if __name__ == '__main__':
    seed_demo()
    seed_marqai()
    verify()
    print("\nDONE! Demo=SAMPLE | MarqAI=REAL")
