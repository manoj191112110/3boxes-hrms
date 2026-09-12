/**
 * Fix misplaced import statements that got inserted inside multi-line imports.
 * Moves "import { useCompanyContextStore } from '@/store/companyContextStore';"
 * to be after the last proper import statement.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE = '/home/z/my-project/src/app/(dashboard)';

// Find all files with the company store import
const files = execSync(
  `grep -rl "useCompanyContextStore" "${BASE}/" --include="page.tsx" 2>/dev/null`,
  { encoding: 'utf-8' }
).trim().split('\n').filter(Boolean);

let fixedCount = 0;

for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  
  // Check if the import is misplaced (inside another import)
  const lines = content.split('\n');
  let misplacedLine = -1;
  let lastProperImportEnd = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    
    // Check if this line has the store import but is NOT a standalone import line
    if (trimmed === "import { useCompanyContextStore } from '@/store/companyContextStore';") {
      // Check if the previous line starts an import block (import {)
      if (i > 0 && lines[i-1].trim().startsWith('import {') && !lines[i-1].trim().includes('from')) {
        misplacedLine = i;
      }
    }
    
    // Track the end of proper import blocks
    if (trimmed.startsWith('import ') && (trimmed.includes('from ') || trimmed.includes("from'"))) {
      lastProperImportEnd = i;
    } else if (trimmed.startsWith('}') && trimmed.includes('from ')) {
      lastProperImportEnd = i;
    }
  }
  
  if (misplacedLine >= 0) {
    // Remove the misplaced line
    lines.splice(misplacedLine, 1);
    
    // Find the new last proper import end
    let newLastImportEnd = -1;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('import ') && (trimmed.includes('from ') || trimmed.includes("from'"))) {
        newLastImportEnd = i;
      } else if (trimmed.startsWith('}') && trimmed.includes('from ')) {
        newLastImportEnd = i;
      }
    }
    
    // Insert the store import after the last proper import
    if (newLastImportEnd >= 0) {
      lines.splice(newLastImportEnd + 1, 0, "import { useCompanyContextStore } from '@/store/companyContextStore';");
    }
    
    content = lines.join('\n');
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`  FIXED IMPORT: ${path.relative(BASE, filePath)}`);
      fixedCount++;
    }
  }
}

console.log(`\nTotal import placements fixed: ${fixedCount}`);
