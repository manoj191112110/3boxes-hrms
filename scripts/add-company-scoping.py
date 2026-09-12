#!/usr/bin/env python3
"""
Add companyId scoping from company switcher to pages that are missing it.
This script reads each page.tsx, checks if it already uses useCompanyContextStore,
and if not, adds the import and scopeQuery pattern, then updates fetch calls.
"""
import os
import re
import sys

BASE = "/home/z/my-project/src/app/(dashboard)"

# Pages that need fixing (not already using useCompanyContextStore)
PAGES_TO_FIX = [
    # Payroll
    "payroll/page.tsx",
    "payroll/payslips/page.tsx",
    "payroll/salary-settings/page.tsx",
    "payroll/statutory/page.tsx",
    "payroll/overtime/page.tsx",
    "payroll/components/page.tsx",
    "payroll/ctc-templates/page.tsx",
    "payroll/ctc-calculator/page.tsx",
    "payroll/bank-files/page.tsx",
    "payroll/tax-slabs/page.tsx",
    "payroll/holds/page.tsx",
    "payroll/dimensions/page.tsx",
    "payroll/inputs/page.tsx",
    "payroll/fnf/page.tsx",
    "payroll/group-dashboard/page.tsx",
    "payroll/payment-methods/page.tsx",
    "payroll/loans/page.tsx",
    "payroll/gratuity/page.tsx",
    "payroll/compliance/page.tsx",
    "payroll/gl-mapping/page.tsx",
    "payroll/income-tax/page.tsx",
    "payroll/secondment/page.tsx",
    "payroll/approvals/page.tsx",
    "payroll/ai-insights/page.tsx",
    "payroll/currency/page.tsx",
    "payroll/masters/page.tsx",
    "payroll/transactions/page.tsx",
    # Core HR
    "expenses/page.tsx",
    "documents/page.tsx",
    "assets/page.tsx",
    "projects/page.tsx",
    "training/page.tsx",
    "travel/page.tsx",
    "performance/page.tsx",
    "helpdesk/page.tsx",
    "insights/page.tsx",
    # Attendance
    "attendance/biometric/page.tsx",
    "attendance/muster-roll/page.tsx",
    # Recruitment
    "recruitment/settings/page.tsx",
    "recruitment/analytics/page.tsx",
    "recruitment/reports/page.tsx",
]

STORE_IMPORT = "import { useCompanyContextStore } from '@/store/companyContextStore';"

def fix_file(rel_path):
    full_path = os.path.join(BASE, rel_path)
    if not os.path.exists(full_path):
        print(f"  SKIP (not found): {rel_path}")
        return False
    
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if already properly scoped
    if 'useCompanyContextStore' in content and 'effectiveCompanyId' in content:
        # Check if scopeQuery or companyId is actually used in fetch calls
        if 'scopeQuery' in content or 'companyId=${cid}' in content or 'companyId=' in content:
            print(f"  ALREADY SCOPED: {rel_path}")
            return False
    
    original = content
    modified = False
    
    # 1. Add import if not present
    if 'useCompanyContextStore' not in content:
        # Find the last import line
        import_lines = [i for i, line in enumerate(content.split('\n')) if line.strip().startswith('import ')]
        if import_lines:
            lines = content.split('\n')
            last_import_idx = import_lines[-1]
            # Find the end of the import block (might be multi-line)
            insert_idx = last_import_idx
            for i in range(last_import_idx, len(lines)):
                if lines[i].strip() and not lines[i].strip().startswith('import') and not lines[i].strip().startswith('}'):
                    insert_idx = i
                    break
                insert_idx = i + 1
            
            lines.insert(insert_idx, STORE_IMPORT)
            content = '\n'.join(lines)
            modified = True
    
    # 2. Add the store hook and scopeQuery in the component
    # Find the main export default function
    # Look for pattern: const { user } = useAuthStore();
    if 'effectiveCompanyId' not in content:
        # Add after useAuthStore usage
        auth_pattern = r"(const\s+\{\s*user\s*(?:,\s*\w+)*\s*\}\s*=\s*useAuthStore\(\);?)"
        if re.search(auth_pattern, content):
            content = re.sub(
                auth_pattern,
                r"\1\n  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);",
                content,
                count=1
            )
            modified = True
        else:
            # Try to find another pattern - function component start
            fn_pattern = r"(export default function \w+\([^)]*\)\s*\{)"
            match = re.search(fn_pattern, content)
            if match:
                insert_after = match.end()
                content = content[:insert_after] + "\n  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);" + content[insert_after:]
                modified = True
    
    # 3. Add scopeQuery calculation before fetch calls
    if 'scopeQuery' not in content and 'effectiveCompanyId' in content:
        # Add scopeQuery before the first useEffect or useCallback
        scope_calc = "  const cid = effectiveCompanyId();\n  const scopeQuery = cid ? `companyId=${cid}&` : '';\n"
        
        # Find first useEffect
        effect_pattern = r"(  useEffect\()"
        if re.search(effect_pattern, content):
            content = re.sub(effect_pattern, scope_calc + r"\1", content, count=1)
            modified = True
        else:
            # Find first fetch call
            fetch_pattern = r"(  (?:const|let|var)\s+\w+\s*=\s*(?:await\s+)?fetch\()"
            if re.search(fetch_pattern, content):
                content = re.sub(fetch_pattern, scope_calc + r"\1", content, count=1)
                modified = True
    
    # 4. Update fetch URLs to include scopeQuery
    if 'scopeQuery' in content:
        # Pattern: fetch(`/api/something?...) or fetch('/api/something?...')
        # Add ${scopeQuery} after the ? in the URL
        
        # Handle template literal URLs: fetch(`/api/xxx?yyy`)
        # We need to be careful not to double-add scopeQuery
        if '${scopeQuery}' not in content:
            # Find fetch calls with template literals that have query params
            # Pattern: `/api/xxx?param=value` -> `/api/xxx?${scopeQuery}param=value`
            content = re.sub(
                r"fetch\(`(/api/[^?`]+)\?([^`]+)`\)",
                r"fetch(`\1?${scopeQuery}\2`)",
                content
            )
            # Pattern: `/api/xxx` (no query params) -> `/api/xxx?${scopeQuery}` 
            # But only for URLs that don't already have ? - be careful
            # Actually, for URLs without query params, adding ?& looks ugly
            # Better to leave those as is since the API route should handle it via getCompanyFilter
            modified = True
    
    if modified and content != original:
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  FIXED: {rel_path}")
        return True
    else:
        print(f"  NO CHANGE: {rel_path}")
        return False

def main():
    fixed_count = 0
    for page in PAGES_TO_FIX:
        if fix_file(page):
            fixed_count += 1
    print(f"\nTotal files fixed: {fixed_count}")

if __name__ == '__main__':
    main()
