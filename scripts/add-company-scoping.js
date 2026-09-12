/**
 * Script to add companyId scoping from company switcher to pages missing it.
 * It reads each page, adds the import + hook + scopeQuery, and updates fetch URLs.
 */
const fs = require('fs');
const path = require('path');

const BASE = '/home/z/my-project/src/app/(dashboard)';

const PAGES_TO_FIX = [
  // Payroll (most critical - financial data)
  'payroll/page.tsx', 'payroll/payslips/page.tsx', 'payroll/salary-settings/page.tsx',
  'payroll/statutory/page.tsx', 'payroll/overtime/page.tsx', 'payroll/components/page.tsx',
  'payroll/ctc-templates/page.tsx', 'payroll/ctc-calculator/page.tsx', 'payroll/bank-files/page.tsx',
  'payroll/tax-slabs/page.tsx', 'payroll/holds/page.tsx', 'payroll/dimensions/page.tsx',
  'payroll/inputs/page.tsx', 'payroll/fnf/page.tsx', 'payroll/group-dashboard/page.tsx',
  'payroll/payment-methods/page.tsx', 'payroll/loans/page.tsx', 'payroll/gratuity/page.tsx',
  'payroll/compliance/page.tsx', 'payroll/gl-mapping/page.tsx', 'payroll/income-tax/page.tsx',
  'payroll/secondment/page.tsx', 'payroll/approvals/page.tsx', 'payroll/ai-insights/page.tsx',
  'payroll/currency/page.tsx', 'payroll/masters/page.tsx', 'payroll/transactions/page.tsx',
  // Core HR
  'expenses/page.tsx', 'documents/page.tsx', 'assets/page.tsx', 'projects/page.tsx',
  'training/page.tsx', 'travel/page.tsx', 'performance/page.tsx',
  'helpdesk/page.tsx', 'insights/page.tsx',
  // Attendance sub-pages
  'attendance/biometric/page.tsx', 'attendance/muster-roll/page.tsx',
];

const STORE_IMPORT = "import { useCompanyContextStore } from '@/store/companyContextStore';";

let fixedCount = 0;

for (const relPath of PAGES_TO_FIX) {
  const fullPath = path.join(BASE, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  SKIP (not found): ${relPath}`);
    continue;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  const original = content;

  // Check if already properly scoped
  if (content.includes('effectiveCompanyId') && (content.includes('scopeQuery') || content.includes('companyId=${cid}'))) {
    console.log(`  ALREADY SCOPED: ${relPath}`);
    continue;
  }

  // 1. Add import if not present
  if (!content.includes('useCompanyContextStore')) {
    // Find the last import statement
    const lines = content.split('\n');
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('import ') || (trimmed.startsWith('}') && trimmed.includes('from '))) {
        lastImportIdx = i;
      } else if (lastImportIdx >= 0 && trimmed && !trimmed.startsWith('import') && !trimmed.startsWith('}') && !trimmed.startsWith(',')) {
        break;
      }
    }
    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, STORE_IMPORT);
      content = lines.join('\n');
    }
  }

  // 2. Add the store hook after useAuthStore
  if (!content.includes('effectiveCompanyId')) {
    // Pattern: const { user } = useAuthStore();
    const authPattern = /const\s*\{\s*user(\s*,\s*\w+)*\s*\}\s*=\s*useAuthStore\(\);?/;
    const match = content.match(authPattern);
    if (match) {
      content = content.replace(
        authPattern,
        match[0] + '\n  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);'
      );
    } else {
      // Try: const { user, ... } = useAuthStore();
      const authPattern2 = /useAuthStore\(\);?/;
      const match2 = content.match(authPattern2);
      if (match2) {
        const idx = content.indexOf(match2[0]) + match2[0].length;
        content = content.slice(0, idx) + '\n  const effectiveCompanyId = useCompanyContextStore(s => s.effectiveCompanyId);' + content.slice(idx);
      }
    }
  }

  // 3. Add scopeQuery calculation - find the best insertion point
  if (!content.includes('scopeQuery') && content.includes('effectiveCompanyId')) {
    const scopeCalc = '  const cid = effectiveCompanyId();\n  const scopeQuery = cid ? `companyId=${cid}&` : \'\';\n';
    
    // Find first useEffect( or useCallback(
    const useEffectMatch = content.match(/\n(\s*)useEffect\(/);
    const useCallbackMatch = content.match(/\n(\s*)useCallback\(/);
    
    let insertPoint = -1;
    if (useEffectMatch) {
      insertPoint = content.indexOf(useEffectMatch[0]);
    } else if (useCallbackMatch) {
      insertPoint = content.indexOf(useCallbackMatch[0]);
    } else {
      // Find first fetch(
      const fetchMatch = content.match(/\n(\s*)(?:const|let|var)\s+\w+\s*=\s*(?:await\s+)?fetch\(/);
      if (fetchMatch) {
        insertPoint = content.indexOf(fetchMatch[0]);
      }
    }
    
    if (insertPoint >= 0) {
      content = content.slice(0, insertPoint) + '\n' + scopeCalc + content.slice(insertPoint);
    }
  }

  // 4. Update fetch URLs to include ${scopeQuery}
  if (content.includes('scopeQuery')) {
    // Pattern: fetch(`/api/xxx?param=val`) -> fetch(`/api/xxx?${scopeQuery}param=val`)
    // Only for template literal URLs with ? already
    content = content.replace(
      /fetch\(`(\/api\/[^?`]+)\?([^`]+)`\)/g,
      (full, path, params) => {
        if (params.includes('${scopeQuery}')) return full; // already has it
        return `fetch(\`${path}?${scopeQuery}${params}\`)`;
      }
    );
    
    // Pattern: fetch('/api/xxx?param=val') -> fetch(`/api/xxx?${scopeQuery}param=val`)
    // Convert single-quote fetch to template literals
    content = content.replace(
      /fetch\('(\/api\/[^?']+)\?([^']+)'\)/g,
      (full, path, params) => {
        if (params.includes('${scopeQuery}')) return full;
        return `fetch(\`${path}?${scopeQuery}${params}\`)`;
      }
    );
    
    // Pattern: fetch(`/api/xxx`) with NO query params -> fetch(`/api/xxx?${scopeQuery}`)
    // But only add if it's a simple API call, not already having ? 
    content = content.replace(
      /fetch\(`(\/api\/[^?`]+)`\)/g,
      (full, path) => {
        // Don't modify URLs that already have query params handled above
        if (full.includes('scopeQuery')) return full;
        return `fetch(\`${path}?${scopeQuery}\`)`;
      }
    );
    
    // Pattern: fetch('/api/xxx') -> fetch(`/api/xxx?${scopeQuery}`)
    content = content.replace(
      /fetch\('(\/api\/[^?']+)'\)/g,
      (full, path) => {
        if (full.includes('scopeQuery')) return full;
        return `fetch(\`${path}?${scopeQuery}\`)`;
      }
    );
  }

  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`  FIXED: ${relPath}`);
    fixedCount++;
  } else {
    console.log(`  NO CHANGE: ${relPath}`);
  }
}

console.log(`\nTotal files fixed: ${fixedCount}`);
