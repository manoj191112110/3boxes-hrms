/**
 * Update ALL fetch() calls in the specified files to include companyId from scopeQuery.
 * Handles both single-quote and template-literal URLs.
 */
const fs = require('fs');
const path = require('path');

const BASE = '/home/z/my-project/src/app/(dashboard)';

const PAGES = [
  'payroll/page.tsx', 'payroll/payslips/page.tsx', 'payroll/salary-settings/page.tsx',
  'payroll/statutory/page.tsx', 'payroll/overtime/page.tsx', 'payroll/components/page.tsx',
  'payroll/ctc-templates/page.tsx', 'payroll/ctc-calculator/page.tsx', 'payroll/bank-files/page.tsx',
  'payroll/tax-slabs/page.tsx', 'payroll/holds/page.tsx', 'payroll/dimensions/page.tsx',
  'payroll/inputs/page.tsx', 'payroll/fnf/page.tsx', 'payroll/group-dashboard/page.tsx',
  'payroll/payment-methods/page.tsx', 'payroll/loans/page.tsx', 'payroll/gratuity/page.tsx',
  'payroll/compliance/page.tsx', 'payroll/gl-mapping/page.tsx', 'payroll/income-tax/page.tsx',
  'payroll/secondment/page.tsx', 'payroll/approvals/page.tsx', 'payroll/ai-insights/page.tsx',
  'payroll/currency/page.tsx', 'payroll/masters/page.tsx', 'payroll/transactions/page.tsx',
  'expenses/page.tsx', 'documents/page.tsx', 'assets/page.tsx', 'projects/page.tsx',
  'training/page.tsx', 'travel/page.tsx', 'performance/page.tsx',
  'helpdesk/page.tsx', 'insights/page.tsx',
  'attendance/biometric/page.tsx', 'attendance/muster-roll/page.tsx',
];

// The scopeQuery template literal pattern to insert
const SQ = '${scopeQuery}'; // Just a string, not a JS template

let fixedCount = 0;

for (const relPath of PAGES) {
  const fullPath = path.join(BASE, relPath);
  if (!fs.existsSync(fullPath)) continue;
  
  let content = fs.readFileSync(fullPath, 'utf-8');
  const original = content;
  
  if (!content.includes('scopeQuery')) continue;
  
  // 1. fetch('/api/xxx?param=val', ...) -> fetch(`/api/xxx?${scopeQuery}param=val`, ...)
  content = content.replace(
    /fetch\('(\/api\/[^?']+)\?([^']+)'(\s*,)/g,
    (full, urlPath, params, after) => {
      if (params.includes(SQ)) return full;
      return 'fetch(`' + urlPath + '?' + SQ + params + '`' + after;
    }
  );
  
  // 2. fetch('/api/xxx', ...) or fetch('/api/xxx') with NO query params
  content = content.replace(
    /fetch\('(\/api\/[^?']+)'\s*(,|\))/g,
    (full, urlPath, after) => {
      if (full.includes('scopeQuery')) return full;
      return 'fetch(`' + urlPath + '?' + SQ + '` ' + after;
    }
  );
  
  // 3. fetch(`/api/xxx?param=val`, ...) -> fetch(`/api/xxx?${scopeQuery}param=val`, ...)
  content = content.replace(
    /fetch\(`(\/api\/[^?`]+)\?([^`]+)`\s*(,|\))/g,
    (full, urlPath, params, after) => {
      if (params.includes(SQ)) return full;
      return 'fetch(`' + urlPath + '?' + SQ + params + '` ' + after;
    }
  );
  
  // 4. fetch(`/api/xxx`, ...) with NO query params
  content = content.replace(
    /fetch\(`(\/api\/[^?`]+)`\s*(,|\))/g,
    (full, urlPath, after) => {
      if (full.includes('scopeQuery')) return full;
      return 'fetch(`' + urlPath + '?' + SQ + '` ' + after;
    }
  );
  
  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log('  FIXED: ' + relPath);
    fixedCount++;
  } else {
    console.log('  NO CHANGE: ' + relPath);
  }
}

console.log('\nTotal files with updated fetch URLs: ' + fixedCount);
