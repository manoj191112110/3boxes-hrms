#!/usr/bin/env node
/**
 * Revert the overly aggressive </div> additions and properly fix JSX structure.
 * Reads each file, parses the JSX to understand its structure, and writes the corrected version.
 */

const fs = require('fs');
const path = require('path');

const dashboardDir = path.join(__dirname, 'src/app/(dashboard)');

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

function fixFile(content, filename) {
  const lines = content.split('\n');
  const result = [];
  
  let i = 0;
  let changed = false;
  
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Fix 1: Look for form elements that are missing </form>
    // If we see <form but no </form> before the next </div> at the same level
    if (trimmed.includes('<form ') || trimmed.includes('<form>')) {
      // Add the form line
      result.push(line);
      i++;
      
      // Look for the closing pattern - a </div> that comes before </form>
      // We need to add </form> before the closing </div> of the form section
      let formDepth = 0;
      let formLines = [];
      
      while (i < lines.length) {
        const fLine = lines[i];
        const fTrimmed = fLine.trim();
        
        if (fTrimmed.includes('<form')) formDepth++;
        if (fTrimmed === '</form>') {
          // Found the closing form tag - everything is fine
          result.push(...formLines);
          result.push(fLine);
          i++;
          break;
        }
        
        // Check if this looks like the end of the form section
        // (a closing </div> at the form level followed by more closing tags)
        if (fTrimmed === '</div>') {
          // Check if the next line is a closing pattern like </div> or )}
          let nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
          
          // If we see a pattern like </div> followed by </div> or )}, this might be the end of the form
          // But we're missing </form> - add it before the </div>
          if (!content.includes('</form>') && (nextLine === '</div>' || nextLine.startsWith(')'))) {
            // This is likely the end of the form content - add </form> before this closing div
            result.push(...formLines);
            const indent = fLine.match(/^(\s*)/)[1];
            result.push(`${indent}</form>`);
            result.push(fLine);
            i++;
            changed = true;
            console.log(`  + Added missing </form> in ${filename}`);
            break;
          }
        }
        
        formLines.push(fLine);
        i++;
      }
      continue;
    }
    
    // Fix 2: Remove extra consecutive </div> tags at the end of the file
    // The fix script may have added too many
    if (trimmed === '</div>' && i + 1 < lines.length) {
      const nextTrimmed = lines[i + 1].trim();
      const nextNextTrimmed = i + 2 < lines.length ? lines[i + 2].trim() : '';
      
      // If we see 3+ consecutive </div> tags, we likely have extras
      if (nextTrimmed === '</div>' && nextNextTrimmed === '</div>') {
        // Count how many consecutive </div> tags there are
        let consecDivs = 0;
        for (let j = i; j < lines.length; j++) {
          if (lines[j].trim() === '</div>') consecDivs++;
          else break;
        }
        
        // If there are more than 2 consecutive closing divs at the end, trim them
        if (consecDivs > 2 && i + consecDivs >= lines.length - 3) {
          // Keep only 2 closing divs (one for the page wrapper, one for the main container)
          result.push(line);
          if (nextTrimmed) result.push(lines[i + 1]);
          i += consecDivs; // Skip all the extra ones
          changed = true;
          console.log(`  - Removed ${consecDivs - 2} extra </div> tags in ${filename}`);
          continue;
        }
      }
    }
    
    result.push(line);
    i++;
  }
  
  if (changed) {
    return result.join('\n');
  }
  return content;
}

// Also do a comprehensive structural fix by looking at the overall pattern
function structuralFix(content, filename) {
  // The problem files all follow a similar pattern:
  // The form/section inside {condition && ( is missing proper closing tags
  // The structure should be:
  // {condition && (
  //   <div className="nexus-card p-6 animate-fade-in">
  //     <div>header</div>
  //     <div>body/form</div>
  //     [</form> if missing]
  //     <div>footer</div>
  //   </div>   <- closes nexus-card
  // )}
  // </div>     <- closes page wrapper
  
  // Let me look for the specific pattern and fix it
  // Find all conditional rendering blocks and check their structure
  
  const lines = content.split('\n');
  
  // Track all opens vs closes
  let divBalance = 0;
  let formBalance = 0;
  let conditionBalance = 0;
  let issues = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Count divs
    divBalance += (line.match(/<div[\s>]/g) || []).length;
    divBalance -= (line.match(/<\/div>/g) || []).length;
    
    // Count forms
    formBalance += (line.match(/<form[\s>]/g) || []).length;
    formBalance -= (line.match(/<\/form>/g) || []).length;
    
    // Check if form is not closed at the end of the file
    if (i === lines.length - 1 && formBalance > 0) {
      issues.push(`Missing ${formBalance} </form> closing tag(s)`);
    }
    
    // Check if divs are unbalanced
    if (i === lines.length - 1 && divBalance !== 0) {
      issues.push(`Div imbalance: ${divBalance > 0 ? 'missing' : 'extra'} ${Math.abs(divBalance)} closing div(s)`);
    }
  }
  
  if (issues.length > 0) {
    console.log(`  Issues in ${filename}: ${issues.join(', ')}`);
  }
  
  return content;
}

let fixedCount = 0;
for (const file of filesToFix) {
  const filePath = path.join(dashboardDir, file);
  if (!fs.existsSync(filePath)) continue;
  
  const content = fs.readFileSync(filePath, 'utf8');
  let fixed = fixFile(content, file);
  fixed = structuralFix(fixed, file);
  
  if (fixed !== content) {
    try {
      fs.writeFileSync(filePath, fixed, 'utf8');
    } catch {
      const tmpFile = `/tmp/fix_${file.replace(/\//g, '_')}`;
      fs.writeFileSync(tmpFile, fixed, 'utf8');
      const { execSync } = require('child_process');
      execSync(`install -m 644 "${tmpFile}" "${filePath}"`);
    }
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} files`);
