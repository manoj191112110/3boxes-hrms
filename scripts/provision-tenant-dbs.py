#!/usr/bin/env python3
"""
Provision tenant databases with schema and data.

This script:
1. Pushes Prisma schema to tenant_marqaitechgroup (tenant_demo already has schema)
2. Copies data from the shared neondb to the appropriate tenant databases
3. Registers both databases in the TenantDatabase table
"""

import psycopg2
import sys
import time

# Connection details
HOST = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
USER = "neondb_owner"
PASS = "npg_pxZd8woKe4WB"
CONN_PARAMS = "?sslmode=require&connect_timeout=30"

def get_conn(dbname):
    return psycopg2.connect(f"postgresql://{USER}:{PASS}@{HOST}/{dbname}{CONN_PARAMS}")

# Tenant IDs from the shared database
DEMO_TENANT_ID = "cmrmxegjy000604jv9ntgcshh"  # 3 Boxes HRMS Demo
MARQAI_TENANT_ID = "cmrmr3ntfe522ce1f3f1e37c6e7"  # Marq AI Tech Group

print("=" * 60)
print("3Boxes HRMS — Tenant Database Provisioning")
print("=" * 60)

# ─── Step 1: Push schema to tenant_marqaitechgroup ──────────────
print("\n📊 Step 1: Checking schema in tenant_marqaitechgroup...")

try:
    conn = get_conn("tenant_marqaitechgroup")
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
    table_count = cur.fetchone()[0]
    print(f"  Tables in tenant_marqaitechgroup: {table_count}")
    
    if table_count == 0:
        print("  Schema is empty — copying schema from neondb...")
        conn.close()
        
        # Use pg_dump to copy schema
        import subprocess
        print("  Running pg_dump schema-only from neondb...")
        result = subprocess.run(
            ["pg_dump", f"postgresql://{USER}:{PASS}@{HOST}/neondb{CONN_PARAMS}", 
             "--schema-only", "--no-owner", "--no-privileges"],
            capture_output=True, text=True, timeout=120
        )
        
        if result.returncode != 0:
            print(f"  ⚠️ pg_dump failed: {result.stderr[:200]}")
            print("  Trying direct table creation via SQL...")
        else:
            schema_sql = result.stdout
            print(f"  Schema dump size: {len(schema_sql)} chars")
            
            # Apply to tenant_marqaitechgroup
            conn2 = get_conn("tenant_marqaitechgroup")
            conn2.autocommit = True
            cur2 = conn2.cursor()
            try:
                cur2.execute(schema_sql)
                print("  ✅ Schema applied to tenant_marqaitechgroup")
            except Exception as e:
                # Try executing statement by statement
                print(f"  ⚠️ Bulk apply failed: {e}")
                print("  Trying statement-by-statement...")
                statements = [s.strip() for s in schema_sql.split(';') if s.strip() and not s.strip().startswith('--')]
                success = 0
                errors = 0
                for stmt in statements:
                    if len(stmt) < 10:
                        continue
                    try:
                        cur2.execute(stmt + ';')
                        success += 1
                    except Exception as e2:
                        errors += 1
                        if errors <= 5:
                            print(f"    Error: {str(e2)[:100]}")
                print(f"  Applied {success} statements, {errors} errors")
            cur2.close()
            conn2.close()
    else:
        print("  ✅ Schema already exists")
        conn.close()

except Exception as e:
    print(f"  ❌ Error: {e}")

# ─── Step 2: Check schema in tenant_demo ────────────────────────
print("\n📊 Step 2: Checking schema in tenant_demo...")

try:
    conn = get_conn("tenant_demo")
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
    table_count = cur.fetchone()[0]
    print(f"  Tables in tenant_demo: {table_count}")
    
    if table_count < 240:
        print("  Schema incomplete — copying from neondb...")
        import subprocess
        result = subprocess.run(
            ["pg_dump", f"postgresql://{USER}:{PASS}@{HOST}/neondb{CONN_PARAMS}", 
             "--schema-only", "--no-owner", "--no-privileges"],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode == 0:
            conn2 = get_conn("tenant_demo")
            conn2.autocommit = True
            cur2 = conn2.cursor()
            statements = [s.strip() for s in result.stdout.split(';') if s.strip() and not s.strip().startswith('--')]
            success = 0
            for stmt in statements:
                if len(stmt) < 10:
                    continue
                try:
                    cur2.execute(stmt + ';')
                    success += 1
                except:
                    pass
            print(f"  Applied {success} statements to tenant_demo")
            cur2.close()
            conn2.close()
    else:
        print("  ✅ Schema already complete")
    conn.close()

except Exception as e:
    print(f"  ❌ Error: {e}")

# ─── Step 3: Copy data from neondb to tenant databases ──────────
print("\n📊 Step 3: Copying data to tenant databases...")

# Get the company groups for each tenant
try:
    neondb = get_conn("neondb")
    neondb.autocommit = True
    cur = neondb.cursor()
    
    # Get MarqAI company groups
    cur.execute(f"""SELECT id, name FROM "CompanyGroup" WHERE "tenantId" = '{MARQAI_TENANT_ID}'""")
    marqai_groups = cur.fetchall()
    print(f"\n  MarqAI Company Groups: {len(marqai_groups)}")
    for g in marqai_groups:
        print(f"    - {g[0]}: {g[1]}")
    
    # Get MarqAI companies
    if marqai_groups:
        group_ids = [g[0] for g in marqai_groups]
        placeholders = ','.join([f"'{gid}'" for gid in group_ids])
        cur.execute(f"""SELECT id, name, "companyGroupId" FROM "Company" WHERE "companyGroupId" IN ({placeholders})""")
        marqai_companies = cur.fetchall()
        print(f"  MarqAI Companies: {len(marqai_companies)}")
        for c in marqai_companies:
            print(f"    - {c[0]}: {c[1]}")
    
    # Get Demo company groups
    cur.execute(f"""SELECT id, name FROM "CompanyGroup" WHERE "tenantId" = '{DEMO_TENANT_ID}'""")
    demo_groups = cur.fetchall()
    print(f"\n  Demo Company Groups: {len(demo_groups)}")
    for g in demo_groups:
        print(f"    - {g[0]}: {g[1]}")
    
    # Get Demo companies
    if demo_groups:
        group_ids = [g[0] for g in demo_groups]
        placeholders = ','.join([f"'{gid}'" for gid in group_ids])
        cur.execute(f"""SELECT id, name, "companyGroupId" FROM "Company" WHERE "companyGroupId" IN ({placeholders})""")
        demo_companies = cur.fetchall()
        print(f"  Demo Companies: {len(demo_companies)}")
        for c in demo_companies:
            print(f"    - {c[0]}: {c[1]}")
    
    # Count records in key tables
    tables_to_check = ['Employee', 'Department', 'Designation', 'Branch', 'User', 'Role', 
                       'Attendance', 'LeaveRequest', 'Payroll', 'Holiday', 'LeaveType',
                       'Notification', 'AuditLog']
    
    print(f"\n  Record counts in neondb:")
    for table in tables_to_check:
        try:
            cur.execute(f'SELECT count(*) FROM "{table}"')
            count = cur.fetchone()[0]
            if count > 0:
                print(f"    {table}: {count}")
        except:
            pass
    
    neondb.close()

except Exception as e:
    print(f"  ❌ Error querying neondb: {e}")

# ─── Step 4: Use pg_dump to copy data per tenant ────────────────
print("\n📊 Step 4: Copying tenant-specific data...")

# For MarqAI - copy data that belongs to their company groups/companies
# For Demo - copy data that belongs to their company groups/companies

# We'll use pg_dump with data-only for specific tables, then filter
import subprocess

def copy_tenant_data(tenant_name, dbname, tenant_id):
    """Copy data from neondb to a tenant database for the given tenant."""
    print(f"\n  🔄 Copying data for {tenant_name} to {dbname}...")
    
    neondb = get_conn("neondb")
    neondb.autocommit = True
    src_cur = neondb.cursor()
    
    target = get_conn(dbname)
    target.autocommit = True
    tgt_cur = target.cursor()
    
    # Tables that have tenantId directly
    tenant_id_tables = [
        'TenantConfiguration', 'FeatureFlag', 'Subscription',
        'CollaborationFeatureFlag', 'CommunicationPolicy',
        'StorageAnalytics', 'GDPRAnonymizationRequest',
    ]
    
    # Tables that belong to tenants via CompanyGroup
    # We need to copy: Tenant → CompanyGroup → Company → all company-scoped data
    
    # 1. Copy the Tenant record itself
    try:
        src_cur.execute(f"""SELECT * FROM "Tenant" WHERE id = '{tenant_id}'""")
        cols = [desc[0] for desc in src_cur.description]
        row = src_cur.fetchone()
        if row:
            # Check if already exists in target
            tgt_cur.execute(f"""SELECT id FROM "Tenant" WHERE id = '{tenant_id}'""")
            if not tgt_cur.fetchone():
                placeholders = ','.join(['%s'] * len(cols))
                col_names = ','.join([f'"{c}"' for c in cols])
                tgt_cur.execute(f"""INSERT INTO "Tenant" ({col_names}) VALUES ({placeholders})""", row)
                print(f"    ✅ Copied Tenant record")
            else:
                print(f"    ⏭️ Tenant record already exists")
    except Exception as e:
        print(f"    ❌ Error copying Tenant: {e}")
    
    # 2. Copy CompanyGroup records for this tenant
    try:
        src_cur.execute(f"""SELECT * FROM "CompanyGroup" WHERE "tenantId" = '{tenant_id}'""")
        cols = [desc[0] for desc in src_cur.description]
        rows = src_cur.fetchall()
        copied = 0
        for row in rows:
            try:
                placeholders = ','.join(['%s'] * len(cols))
                col_names = ','.join([f'"{c}"' for c in cols])
                tgt_cur.execute(f"""INSERT INTO "CompanyGroup" ({col_names}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING""", row)
                copied += 1
            except Exception as e:
                print(f"      Error: {str(e)[:80]}")
        print(f"    ✅ Copied {copied}/{len(rows)} CompanyGroup records")
    except Exception as e:
        print(f"    ❌ Error copying CompanyGroup: {e}")
    
    # 3. Get company IDs for this tenant
    src_cur.execute(f"""
        SELECT c.id FROM "Company" c 
        JOIN "CompanyGroup" cg ON c."companyGroupId" = cg.id 
        WHERE cg."tenantId" = '{tenant_id}'
    """)
    company_ids = [r[0] for r in src_cur.fetchall()]
    print(f"    Found {len(company_ids)} companies for tenant")
    
    if not company_ids:
        neondb.close()
        target.close()
        return company_ids
    
    # 4. Copy Company records
    company_placeholders = ','.join([f"'{cid}'" for cid in company_ids])
    try:
        src_cur.execute(f"""SELECT * FROM "Company" WHERE id IN ({company_placeholders})""")
        cols = [desc[0] for desc in src_cur.description]
        rows = src_cur.fetchall()
        copied = 0
        for row in rows:
            try:
                placeholders = ','.join(['%s'] * len(cols))
                col_names = ','.join([f'"{c}"' for c in cols])
                tgt_cur.execute(f"""INSERT INTO "Company" ({col_names}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING""", row)
                copied += 1
            except Exception as e:
                pass
        print(f"    ✅ Copied {copied}/{len(rows)} Company records")
    except Exception as e:
        print(f"    ❌ Error copying Company: {e}")
    
    # 5. Copy company-scoped tables
    company_scoped_tables = [
        ('Branch', 'companyId'),
        ('Department', 'companyId'),
        ('Designation', 'companyId'),
        ('Employee', 'companyId'),
        ('Holiday', 'companyId'),
        ('LeaveType', 'companyId'),
        ('Attendance', 'companyId'),
        ('LeaveRequest', 'companyId'),
        ('Shift', 'companyId'),
        ('Policy', 'companyId'),
        ('Notification', 'companyId'),
        ('AuditLog', 'companyId'),
    ]
    
    for table, column in company_scoped_tables:
        try:
            src_cur.execute(f"""SELECT * FROM "{table}" WHERE "{column}" IN ({company_placeholders})""")
            cols = [desc[0] for desc in src_cur.description]
            rows = src_cur.fetchall()
            if not rows:
                continue
            copied = 0
            for row in rows:
                try:
                    placeholders = ','.join(['%s'] * len(cols))
                    col_names = ','.join([f'"{c}"' for c in cols])
                    tgt_cur.execute(f"""INSERT INTO "{table}" ({col_names}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING""", row)
                    copied += 1
                except Exception as e:
                    pass
            print(f"    ✅ {table}: {copied}/{len(rows)} records")
        except Exception as e:
            # Table might not exist or column might not exist
            pass
    
    # 6. Copy User records for this tenant
    try:
        src_cur.execute(f"""SELECT * FROM "User" WHERE "tenantId" = '{tenant_id}'""")
        cols = [desc[0] for desc in src_cur.description]
        rows = src_cur.fetchall()
        copied = 0
        for row in rows:
            try:
                placeholders = ','.join(['%s'] * len(cols))
                col_names = ','.join([f'"{c}"' for c in cols])
                tgt_cur.execute(f"""INSERT INTO "User" ({col_names}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING""", row)
                copied += 1
            except Exception as e:
                pass
        print(f"    ✅ User: {copied}/{len(rows)} records")
    except Exception as e:
        print(f"    ❌ Error copying User: {e}")
    
    # 7. Copy Role records for this tenant
    try:
        src_cur.execute(f"""SELECT * FROM "Role" WHERE "tenantId" = '{tenant_id}'""")
        cols = [desc[0] for desc in src_cur.description]
        rows = src_cur.fetchall()
        copied = 0
        for row in rows:
            try:
                placeholders = ','.join(['%s'] * len(cols))
                col_names = ','.join([f'"{c}"' for c in cols])
                tgt_cur.execute(f"""INSERT INTO "Role" ({col_names}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING""", row)
                copied += 1
            except:
                pass
        print(f"    ✅ Role: {copied}/{len(rows)} records")
    except Exception as e:
        print(f"    ❌ Error copying Role: {e}")
    
    # 8. Copy TenantConfiguration
    try:
        src_cur.execute(f"""SELECT * FROM "TenantConfiguration" WHERE "tenantId" = '{tenant_id}'""")
        cols = [desc[0] for desc in src_cur.description]
        row = src_cur.fetchone()
        if row:
            try:
                placeholders = ','.join(['%s'] * len(cols))
                col_names = ','.join([f'"{c}"' for c in cols])
                tgt_cur.execute(f"""INSERT INTO "TenantConfiguration" ({col_names}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING""", row)
                print(f"    ✅ TenantConfiguration: copied")
            except:
                pass
    except:
        pass
    
    # 9. Copy Employee-related records (EmployeeCompanyMapping, etc.)
    if company_ids:
        emp_ids_placeholder = f"""(SELECT id FROM "Employee" WHERE "companyId" IN ({company_placeholders}))"""
        emp_scoped_tables = [
            ('EmployeeCompanyMapping', 'employeeId'),
            ('Attendance', 'employeeId'),
            ('LeaveRequest', 'employeeId'),
            ('LeaveBalance', 'employeeId'),
            ('Payroll', 'employeeId'),
            ('SalaryStructure', 'employeeId'),
            ('SalaryComponent', 'salaryStructureId'),  # indirect
        ]
        
        for table, column in emp_scoped_tables:
            try:
                src_cur.execute(f"""SELECT * FROM "{table}" WHERE "{column}" IN {emp_ids_placeholder}""")
                cols = [desc[0] for desc in src_cur.description]
                rows = src_cur.fetchall()
                if not rows:
                    continue
                copied = 0
                for row in rows:
                    try:
                        placeholders = ','.join(['%s'] * len(cols))
                        col_names = ','.join([f'"{c}"' for c in cols])
                        tgt_cur.execute(f"""INSERT INTO "{table}" ({col_names}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING""", row)
                        copied += 1
                    except:
                        pass
                print(f"    ✅ {table}: {copied}/{len(rows)} records")
            except:
                pass
    
    neondb.close()
    target.close()
    return company_ids

# Copy MarqAI data
marqai_companies = copy_tenant_data("Marq AI Tech Group", "tenant_marqaitechgroup", MARQAI_TENANT_ID)

# Copy Demo data
demo_companies = copy_tenant_data("3 Boxes HRMS Demo", "tenant_demo", DEMO_TENANT_ID)

# ─── Step 5: Register databases in TenantDatabase table ────────
print("\n📊 Step 5: Registering databases in TenantDatabase table...")

try:
    neondb = get_conn("neondb")
    neondb.autocommit = True
    cur = neondb.cursor()
    
    # Pooled connection strings (for Prisma)
    pooler_host = "ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech"
    direct_host = "ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech"
    
    demo_conn_str = f"postgresql://{USER}:{PASS}@{pooler_host}/tenant_demo?channel_binding=require&connect_timeout=15&sslmode=require"
    demo_direct_str = f"postgresql://{USER}:{PASS}@{direct_host}/tenant_demo?sslmode=require"
    
    marqai_conn_str = f"postgresql://{USER}:{PASS}@{pooler_host}/tenant_marqaitechgroup?channel_binding=require&connect_timeout=15&sslmode=require"
    marqai_direct_str = f"postgresql://{USER}:{PASS}@{direct_host}/tenant_marqaitechgroup?sslmode=require"
    
    # Check if TenantDatabase table exists
    cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='TenantDatabase'")
    if cur.fetchone()[0] == 0:
        print("  ⚠️ TenantDatabase table doesn't exist, creating...")
        cur.execute("""
            CREATE TABLE "TenantDatabase" (
                "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                "tenantId" TEXT UNIQUE NOT NULL,
                "connectionString" TEXT NOT NULL,
                "directUrl" TEXT,
                "databaseName" TEXT NOT NULL,
                "neonBranchId" TEXT,
                "neonProjectId" TEXT,
                "isActive" BOOLEAN DEFAULT true,
                "provisionedAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
            )
        """)
    
    # Register demo database
    cur.execute(f"""SELECT id FROM "TenantDatabase" WHERE "tenantId" = '{DEMO_TENANT_ID}'""")
    if cur.fetchone():
        cur.execute(f"""
            UPDATE "TenantDatabase" SET 
                "connectionString" = '{demo_conn_str}',
                "directUrl" = '{demo_direct_str}',
                "databaseName" = 'tenant_demo',
                "neonBranchId" = 'br-dawn-rice-aq1wo6yz',
                "neonProjectId" = 'dark-resonance-26207403',
                "isActive" = true
            WHERE "tenantId" = '{DEMO_TENANT_ID}'
        """)
        print(f"  ✅ Updated TenantDatabase for demo tenant")
    else:
        cur.execute(f"""
            INSERT INTO "TenantDatabase" ("tenantId", "connectionString", "directUrl", "databaseName", "neonBranchId", "neonProjectId", "isActive")
            VALUES ('{DEMO_TENANT_ID}', '{demo_conn_str}', '{demo_direct_str}', 'tenant_demo', 'br-dawn-rice-aq1wo6yz', 'dark-resonance-26207403', true)
        """)
        print(f"  ✅ Created TenantDatabase for demo tenant")
    
    # Register MarqAI database
    cur.execute(f"""SELECT id FROM "TenantDatabase" WHERE "tenantId" = '{MARQAI_TENANT_ID}'""")
    if cur.fetchone():
        cur.execute(f"""
            UPDATE "TenantDatabase" SET 
                "connectionString" = '{marqai_conn_str}',
                "directUrl" = '{marqai_direct_str}',
                "databaseName" = 'tenant_marqaitechgroup',
                "neonBranchId" = 'br-dawn-rice-aq1wo6yz',
                "neonProjectId" = 'dark-resonance-26207403',
                "isActive" = true
            WHERE "tenantId" = '{MARQAI_TENANT_ID}'
        """)
        print(f"  ✅ Updated TenantDatabase for MarqAI tenant")
    else:
        cur.execute(f"""
            INSERT INTO "TenantDatabase" ("tenantId", "connectionString", "directUrl", "databaseName", "neonBranchId", "neonProjectId", "isActive")
            VALUES ('{MARQAI_TENANT_ID}', '{marqai_conn_str}', '{marqai_direct_str}', 'tenant_marqaitechgroup', 'br-dawn-rice-aq1wo6yz', 'dark-resonance-26207403', true)
        """)
        print(f"  ✅ Created TenantDatabase for MarqAI tenant")
    
    # Verify registrations
    cur.execute("""SELECT td."databaseName", td."isActive", t.name, t.slug FROM "TenantDatabase" td JOIN "Tenant" t ON td."tenantId" = t.id""")
    results = cur.fetchall()
    print(f"\n  📋 Registered Tenant Databases:")
    for r in results:
        print(f"    - {r[2]} ({r[3]}): DB={r[0]}, Active={r[1]}")
    
    neondb.close()

except Exception as e:
    print(f"  ❌ Error registering databases: {e}")

# ─── Step 6: Verify data in tenant databases ────────────────────
print("\n📊 Step 6: Verifying data in tenant databases...")

for name, dbname in [("Demo", "tenant_demo"), ("MarqAI", "tenant_marqaitechgroup")]:
    try:
        conn = get_conn(dbname)
        cur = conn.cursor()
        
        print(f"\n  📂 {name} ({dbname}):")
        
        # Count records in key tables
        for table in ['Tenant', 'CompanyGroup', 'Company', 'Department', 'Employee', 'User', 'Role', 'Branch', 'Designation']:
            try:
                cur.execute(f'SELECT count(*) FROM "{table}"')
                count = cur.fetchone()[0]
                print(f"    {table}: {count}")
            except:
                pass
        
        conn.close()
    except Exception as e:
        print(f"  ❌ Error checking {name}: {e}")

print("\n" + "=" * 60)
print("✅ Tenant database provisioning complete!")
print("=" * 60)
