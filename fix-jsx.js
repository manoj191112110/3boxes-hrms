#!/usr/bin/env node
/**
 * Fix JSX structural issues in converted files.
 * The automated conversion left some files with missing closing tags.
 */

const fs = require('fs');
const path = require('path');

const dashboardDir = path.join(__dirname, 'src/app/(dashboard)');

// Files with parsing errors from lint
const filesToFix = [
  'requisitions/page.tsx',
  'salary-structures/page.tsx',
  'separation/page.tsx',
  'super-admin/page.tsx',
  'timesheets/page.tsx',
  'training/page.tsx',
  'travel/page.tsx',
  'vendors/page.tsx',
  'workflows/page.tsx',
  'helpdesk/page.tsx',
  'projects/page.tsx',
  'clients/page.tsx',
  'offers/page.tsx',
  'fnf/page.tsx',
];

function fixJsxStructure(content, filename) {
  // Count opening and closing tags to find imbalances
  const openDivs = (content.match(/<div[\s>]/g) || []).length;
  const closeDivs = (content.match(/<\/div>/g) || []).length;
  const diff = openDivs - closeDivs;
  
  if (diff === 0) {
    console.log(`  ✓ ${filename}: Tags balanced`);
    return content;
  }
  
  console.log(`  ${filename}: ${openDivs} opens, ${closeDivs} closes, diff=${diff}`);
  
  // Add missing closing </div> tags before the final </div> and );
  // The pattern at the end should be:
  //   </div>  (closes the last form/section)
  //   )}      (closes the conditional)
  //   </div>  (closes the page wrapper)
  //   );
  //   }
  
  // Strategy: Find the last </div> in the return statement and add extra closing divs before it
  const lines = content.split('\n');
  const result = [];
  
  // Find the return statement closing pattern
  // Look for the final closing structure: </div>\n  );\n}
  let lastContentDivIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === '</div>' && i + 1 < lines.length && lines[i + 1].trim() === ');') {
      lastContentDivIdx = i;
      break;
    }
  }
  
  if (lastContentDivIdx === -1) {
    // Try alternate pattern
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim() === '</div>') {
        lastContentDivIdx = i;
        break;
      }
    }
  }
  
  if (lastContentDivIdx >= 0 && diff > 0) {
    // Add missing closing divs before the last </div>
    const indent = '    ';
    for (let d = 0; d < diff; d++) {
      lines.splice(lastContentDivIdx, 0, `${indent}</div>`);
    }
    console.log(`  + Added ${diff} closing </div> tags`);
  }
  
  // Also check for missing )} closings for conditional renders
  const openConditionals = (content.match(/\{[\w.]+\s*&&\s*\(/g) || []).length;
  const closeConditionals = (content.match(/\)\}/g) || []).length;
  const condDiff = openConditionals - closeConditionals;
  
  if (condDiff > 0) {
    console.log(`  ! Missing ${condDiff} )} closings for conditional renders`);
    // Add missing )} before the final </div>
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim() === '</div>' && i + 1 < lines.length && lines[i + 1].trim().startsWith(')')) {
        // Add the missing )} before this line
        const indent = lines[i].match(/^(\s*)/)[1];
        lines.splice(i, 0, `${indent})}`);
        console.log(`  + Added missing )}`);
        break;
      }
    }
  }
  
  return lines.join('\n');
}

let fixed = 0;
for (const file of filesToFix) {
  const filePath = path.join(dashboardDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP: ${file}`);
    continue;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const fixedContent = fixJsxStructure(content, file);
  
  if (fixedContent !== content) {
    try {
      fs.writeFileSync(filePath, fixedContent, 'utf8');
      console.log(`  ✓ Fixed: ${file}`);
      fixed++;
    } catch (err) {
      // Try install command
      const tmpFile = `/tmp/fix_${file.replace(/\//g, '_')}`;
      fs.writeFileSync(tmpFile, fixedContent, 'utf8');
      const { execSync } = require('child_process');
      try {
        execSync(`install -m 644 "${tmpFile}" "${filePath}"`);
        console.log(`  ✓ Fixed (install): ${file}`);
        fixed++;
      } catch (e) {
        console.log(`  ✗ Write failed: ${file}`);
      }
    }
  }
}

console.log(`\n=== Fixed ${fixed} files ===`);
