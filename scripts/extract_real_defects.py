#!/usr/bin/env python3
"""Extract only rows where Actual column describes a defect (not a passing result)."""
import openpyxl

wb = openpyxl.load_workbook('/home/z/my-project/upload/3BOXES HRMS_Test_Execution_Tracker (1).xlsx', data_only=True)

# Keywords that indicate a real defect in the Actual column
defect_keywords = [
    'no validation', 'no block', 'navigates to next', 'accepting', 'failed',
    'not displayed', 'not showing', 'missing', 'error', 'incorrect', 'wrong',
    'cannot', 'not able', 'unable', 'crash', 'broken', 'undefined', 'null',
    'not working', 'does not', "doesn't", 'doesnt', 'no message', 'no mandatory',
    'not set', 'not configured', 'stale', 'duplicate', 'leak', 'leaking',
    'dummy', 'fake', 'sample', 'placeholder',
]

results = {'Employee Management': [], 'Leave Management': [], 'Attendance Module': []}

for sheet_name in results:
    ws = wb[sheet_name]
    seen_test_ids = set()

    for section_start in [1, 12]:
        for row in range(3, ws.max_row + 1):
            test_id_raw = ws.cell(row=row, column=section_start).value
            if not test_id_raw:
                continue
            test_id = str(test_id_raw).strip()
            # Skip header rows
            if 'Test_ID' in test_id or 'Test Id' in test_id or 'Test ID' in test_id:
                continue

            status_raw = ws.cell(row=row, column=section_start + 7).value or ''
            status = str(status_raw).strip().upper()
            # Only pure FAIL
            if 'FAIL' not in status or 'PASS' in status:
                continue

            actual_raw = ws.cell(row=row, column=section_start + 6).value or ''
            actual = str(actual_raw).strip()

            # Skip if the Actual column describes PASSING behavior
            passing_keywords = [
                'successfully', 'is displayed', 'are displayed', 'appears',
                'shown correctly', 'recorded', 'created', 'submitted',
                'updated', 'displayed', 'refresh', 'validation is displayed',
                'validation displayed', 'is shown', 'are shown', 'available',
                'opens successfully', 'is selected', 'is created', 'is rejected',
                'is prevented', 'is working', 'correct', 'accurate',
            ]
            actual_lower = actual.lower()
            is_passing = any(pk in actual_lower for pk in passing_keywords)

            # Only keep if it's a real defect (not passing)
            if not is_passing:
                module = ws.cell(row=row, column=section_start + 1).value or ''
                feature = ws.cell(row=row, column=section_start + 2).value or ''
                scenario = ws.cell(row=row, column=section_start + 3).value or ''
                steps = ws.cell(row=row, column=section_start + 4).value or ''
                test_data = ws.cell(row=row, column=section_start + 5).value or ''
                expected = ws.cell(row=row, column=section_start + 6).value or ''

                # Dedupe by test_id + scenario
                key = f'{test_id}|{scenario}'
                if key not in seen_test_ids:
                    seen_test_ids.add(key)
                    results[sheet_name].append({
                        'test_id': test_id,
                        'module': module,
                        'feature': feature,
                        'scenario': scenario,
                        'steps': steps,
                        'test_data': test_data,
                        'expected': expected,
                        'actual': actual,
                        'row': row,
                    })

for sheet_name, bugs in results.items():
    print(f'\n{"="*80}')
    print(f'{sheet_name}: {len(bugs)} real defects')
    print(f'{"="*80}')
    for b in bugs:
        print(f'\n  [{b["test_id"]}] (row {b["row"]})')
        print(f'    Module: {b["module"]} | Feature: {b["feature"]}')
        print(f'    Scenario: {b["scenario"]}')
        print(f'    Steps: {b["steps"]}')
        print(f'    Test Data: {b["test_data"]}')
        print(f'    Expected: {b["expected"]}')
        print(f'    Actual: {b["actual"]}')
