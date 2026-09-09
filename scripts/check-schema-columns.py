#!/usr/bin/env python3
"""
Check actual column names for LeaveRequest, Requisition, Feedback, Survey, Grievance tables
in the demo database.
"""

import psycopg2

POOLER_HOST = 'ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech'
DB_USER = 'neondb_owner'
DB_PASSWORD = 'npg_pxZd8woKe4WB'

def get_conn(dbname):
    return psycopg2.connect(
        host=POOLER_HOST, database=dbname,
        user=DB_USER, password=DB_PASSWORD, sslmode='require',
        connect_timeout=30
    )

tables_to_check = [
    'LeaveRequest', 'Requisition', 'Feedback', 'Survey', 'SurveyResponse',
    'Grievance', 'CandidateResume', 'Bonus', 'TimesheetEntry', 'Resignation',
    'HelpdeskTicket', 'Recruitment', 'Job', 'Interview',
]

conn = get_conn('tenant_demo')
cur = conn.cursor()

for table in tables_to_check:
    try:
        cur.execute(f"""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = '{table}'
            ORDER BY ordinal_position;
        """)
        columns = cur.fetchall()
        if columns:
            print(f"\n{table} columns ({len(columns)}):")
            for col in columns:
                print(f"  {col[0]}: {col[1]}")
        else:
            print(f"\n{table}: TABLE DOES NOT EXIST")
    except Exception as e:
        print(f"\n{table}: ERR - {str(e)[:80]}")

conn.close()
