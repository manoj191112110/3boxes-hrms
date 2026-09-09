#!/usr/bin/env python3
"""
Copy tenant data and register databases.
"""

import psycopg2
import uuid
import time

HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
POOLER_HOST = "ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"
PARAMS = "?sslmode=require&connect_timeout=30"

DEMO_TENANT_ID = "cmrmxegjy000604jv9ntgcshh"
MARQAI_TENANT_ID = "cmrmr3ntfe522ce1f3f1e37c6e7"

def get_conn(dbname, host=None):
    h = host or HOST
    return psycopg2.connect(f"postgresql://{USER}:{PASS}@{h}/{dbname}{PARAMS}")

def copy_table_data(src_cur, tgt_cur, table, where_clause=None):
    """Copy all rows from source to target table."""
    try:
        query = f'SELECT * FROM "{table}"'
        if where_clause:
            query += f" WHERE {where_clause}"
        src_cur.execute(query)
        cols = [desc[0] for desc in src_cur.description]
        rows = src_cur.fetchall()
        if not rows:
            return 0
        
        copied = 0
        for row in rows:
            try:
                placeholders = ','.join(['%s'] * len(cols))
                col_names = ','.join([f'"{c}"' for c in cols])
                tgt_cur.execute(f"""INSERT INTO "{table}" ({col_names}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING""", row)
                copied += 1
            except Exception as e:
                pass  # Skip conflicts and errors
        return copied
    except Exception as e:
        return -1

def copy_tenant_data(tenant_name, dbname, tenant_id):
    """Copy all data for a tenant from neondb to their dedicated database."""
    print(f"\n{'='*50}")
    print(f"Copying data for: {tenant_name}")
    print(f"Target DB: {dbname}")
    print(f"{'='*50}")
    
    src = get_conn("neondb")
    src.autocommit = True
    src_cur = src.cursor()
    
    tgt = get_conn(dbname)
    tgt.autocommit = True
    tgt_cur = tgt.cursor()
    
    # 1. Copy Tenant record
    c = copy_table_data(src_cur, tgt_cur, "Tenant", f"id = '{tenant_id}'")
    print(f"  Tenant: {c} records")
    
    # 2. Copy CompanyGroup records
    c = copy_table_data(src_cur, tgt_cur, "CompanyGroup", f'"tenantId\' = \'{tenant_id}\'')
    print(f"  CompanyGroup: {c} records")
    
    # 3. Get company IDs
    src_cur.execute(f"""
        SELECT c.id FROM "Company" c 
        JOIN "CompanyGroup" cg ON c."companyGroupId" = cg.id 
        WHERE cg."tenantId" = '{tenant_id}'
    """)
    company_ids = [r[0] for r in src_cur.fetchall()]
    print(f"  Companies found: {len(company_ids)}")
    
    if not company_ids:
        src.close()
        tgt.close()
        return
    
    cid_list = ','.join([f"'{cid}'" for cid in company_ids])
    
    # 4. Copy Company records
    c = copy_table_data(src_cur, tgt_cur, "Company", f"id IN ({cid_list})")
    print(f"  Company: {c} records")
    
    # 5. Copy company-scoped tables
    company_tables = [
        "Branch", "Department", "Designation", "Employee",
        "Holiday", "LeaveType", "Shift", "Policy",
    ]
    
    for table in company_tables:
        c = copy_table_data(src_cur, tgt_cur, table, f'"companyId" IN ({cid_list})')
        if c >= 0:
            print(f"  {table}: {c} records")
    
    # 6. Copy User records
    c = copy_table_data(src_cur, tgt_cur, "User", f'"tenantId" = \'{tenant_id}\'')
    print(f"  User: {c} records")
    
    # 7. Copy Role records
    c = copy_table_data(src_cur, tgt_cur, "Role", f'"tenantId" = \'{tenant_id}\'')
    print(f"  Role: {c} records")
    
    # 8. Get employee IDs for this tenant
    src_cur.execute(f"""SELECT id FROM "Employee" WHERE "companyId" IN ({cid_list})""")
    emp_ids = [r[0] for r in src_cur.fetchall()]
    
    if emp_ids:
        eid_list = ','.join([f"'{eid}'" for eid in emp_ids])
        
        emp_tables = [
            ("Attendance", '"employeeId"'),
            ("LeaveRequest", '"employeeId"'),
            ("LeaveBalance", '"employeeId"'),
            ("EmployeeCompanyMapping", '"employeeId"'),
            ("Payroll", '"employeeId"'),
        ]
        
        for table, col in emp_tables:
            c = copy_table_data(src_cur, tgt_cur, table, f'{col} IN ({eid_list})')
            if c >= 0:
                print(f"  {table}: {c} records")
    
    # 9. Copy TenantConfiguration
    c = copy_table_data(src_cur, tgt_cur, "TenantConfiguration", f'"tenantId" = \'{tenant_id}\'')
    if c >= 0:
        print(f"  TenantConfiguration: {c} records")
    
    # 10. Copy FeatureFlags
    c = copy_table_data(src_cur, tgt_cur, "FeatureFlag", f'"tenantId" = \'{tenant_id}\'')
    if c >= 0:
        print(f"  FeatureFlag: {c} records")
    
    # 11. Copy Notification
    c = copy_table_data(src_cur, tgt_cur, "Notification", f'"companyId" IN ({cid_list})')
    if c >= 0:
        print(f"  Notification: {c} records")
    
    # 12. Copy AuditLog
    c = copy_table_data(src_cur, tgt_cur, "AuditLog", f'"companyId" IN ({cid_list})')
    if c >= 0:
        print(f"  AuditLog: {c} records")
    
    src.close()
    tgt.close()

# Copy data for both tenants
copy_tenant_data("Marq AI Tech Group", "tenant_marqaitechgroup", MARQAI_TENANT_ID)
copy_tenant_data("3 Boxes HRMS Demo", "tenant_demo", DEMO_TENANT_ID)

# ─── Register databases in TenantDatabase table ────────
print(f"\n{'='*50}")
print("Registering TenantDatabase records")
print(f"{'='*50}")

neondb = get_conn("neondb")
neondb.autocommit = True
cur = neondb.cursor()

demo_conn_str = f"postgresql://{USER}:{PASS}@{POOLER_HOST}/tenant_demo?channel_binding=require&connect_timeout=15&sslmode=require"
demo_direct_str = f"postgresql://{USER}:{PASS}@{HOST}/tenant_demo?sslmode=require"
marqai_conn_str = f"postgresql://{USER}:{PASS}@{POOLER_HOST}/tenant_marqaitechgroup?channel_binding=require&connect_timeout=15&sslmode=require"
marqai_direct_str = f"postgresql://{USER}:{PASS}@{HOST}/tenant_marqaitechgroup?sslmode=require"

# Use cuid-like IDs
demo_db_id = f"tdb_{uuid.uuid4().hex[:20]}"
marqai_db_id = f"tdb_{uuid.uuid4().hex[:20]}"

# Register demo
cur.execute(f"""SELECT id FROM "TenantDatabase" WHERE "tenantId" = '{DEMO_TENANT_ID}'""")
if cur.fetchone():
    cur.execute(f"""
        UPDATE "TenantDatabase" SET 
            "connectionString" = %s,
            "directUrl" = %s,
            "databaseName" = 'tenant_demo',
            "neonBranchId" = 'br-dawn-rice-aq1wo6yz',
            "neonProjectId" = 'dark-resonance-26207403',
            "isActive" = true
        WHERE "tenantId" = %s
    """, (demo_conn_str, demo_direct_str, DEMO_TENANT_ID))
    print(f"  ✅ Updated TenantDatabase for demo")
else:
    cur.execute(f"""
        INSERT INTO "TenantDatabase" (id, "tenantId", "connectionString", "directUrl", "databaseName", "neonBranchId", "neonProjectId", "isActive")
        VALUES (%s, %s, %s, %s, 'tenant_demo', 'br-dawn-rice-aq1wo6yz', 'dark-resonance-26207403', true)
    """, (demo_db_id, DEMO_TENANT_ID, demo_conn_str, demo_direct_str))
    print(f"  ✅ Created TenantDatabase for demo")

# Register MarqAI
cur.execute(f"""SELECT id FROM "TenantDatabase" WHERE "tenantId" = '{MARQAI_TENANT_ID}'""")
if cur.fetchone():
    cur.execute(f"""
        UPDATE "TenantDatabase" SET 
            "connectionString" = %s,
            "directUrl" = %s,
            "databaseName" = 'tenant_marqaitechgroup',
            "neonBranchId" = 'br-dawn-rice-aq1wo6yz',
            "neonProjectId" = 'dark-resonance-26207403',
            "isActive" = true
        WHERE "tenantId" = %s
    """, (marqai_conn_str, marqai_direct_str, MARQAI_TENANT_ID))
    print(f"  ✅ Updated TenantDatabase for MarqAI")
else:
    cur.execute(f"""
        INSERT INTO "TenantDatabase" (id, "tenantId", "connectionString", "directUrl", "databaseName", "neonBranchId", "neonProjectId", "isActive")
        VALUES (%s, %s, %s, %s, 'tenant_marqaitechgroup', 'br-dawn-rice-aq1wo6yz', 'dark-resonance-26207403', true)
    """, (marqai_db_id, MARQAI_TENANT_ID, marqai_conn_str, marqai_direct_str))
    print(f"  ✅ Created TenantDatabase for MarqAI")

# Verify
cur.execute("""SELECT td."databaseName", td."isActive", t.name, t.slug FROM "TenantDatabase" td JOIN "Tenant" t ON td."tenantId" = t.id""")
for r in cur.fetchall():
    print(f"  📋 {r[2]} ({r[3]}): DB={r[0]}, Active={r[1]}")

neondb.close()

# ─── Verify data in tenant databases ──────────────────
print(f"\n{'='*50}")
print("Final verification")
print(f"{'='*50}")

for name, dbname in [("Demo", "tenant_demo"), ("MarqAI", "tenant_marqaitechgroup")]:
    try:
        conn = get_conn(dbname)
        cur = conn.cursor()
        print(f"\n  📂 {name} ({dbname}):")
        for table in ['Tenant', 'CompanyGroup', 'Company', 'Department', 'Employee', 'User', 'Role', 'Branch', 'Designation', 'Attendance', 'LeaveRequest', 'Holiday']:
            try:
                cur.execute(f'SELECT count(*) FROM "{table}"')
                count = cur.fetchone()[0]
                print(f"    {table}: {count}")
            except:
                pass
        conn.close()
    except Exception as e:
        print(f"  ❌ Error: {e}")

print("\n✅ Done!")
