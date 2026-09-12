#!/usr/bin/env node
/**
 * Fix script: Add `const db = await getDb(request)` inside handler functions
 * for files that were originally importing { db } from '@/lib/db'.
 * 
 * These files use `db.xxx` directly but no longer have `db` imported —
 * they need the runtime `getDb(request)` call inside each handler.
 */

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '..', 'src', 'app', 'api');

function findRouteFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findRouteFiles(fullPath));
    } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
      files.push(fullPath);
    }
  }
  return files;
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = filePath.replace(API_DIR, '/api');

  // Skip if already has `const db = await getDb(request)`
  if (content.includes('const db = await getDb(request)')) {
    return 'skipped';
  }

  // Only process files that have `getDb` import AND use `db.` pattern
  if (!content.includes("from '@/lib/tenant-db'")) return 'no-tenant-import';
  if (!content.match(/\bdb\.\w/)) return 'no-db-usage';

  // Find all exported async functions that have a Request/NextRequest parameter
  const handlerPattern = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS)\s*\(\s*(\w+)\s*(?::\s*(?:Request|NextRequest))?\s*(?:,\s*\{[^}]*\})?\s*\)\s*(?::\s*Promise<[^>]*>)?\s*\{/g;

  let match;
  const edits = [];

  while ((match = handlerPattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const paramName = match[2]; // e.g., 'request', 'req'

    // Check if this handler already has `const db = await getDb(`
    const handlerStart = match.index;
    const nextHandler = content.indexOf('export async function', handlerStart + 1);
    const handlerBody = nextHandler > 0 ? content.substring(handlerStart, nextHandler) : content.substring(handlerStart);
    
    if (handlerBody.includes('const db = await getDb(')) continue;

    // Add db initialization after the function opening brace
    const newHandler = fullMatch + `\n  const db = await getDb(${paramName});`;
    edits.push({ old: fullMatch, new: newHandler });
  }

  if (edits.length === 0) return 'no-handlers';

  // Apply edits
  for (const edit of edits) {
    content = content.replace(edit.old, edit.new);
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`  ✅ Fixed: ${relativePath} (${edits.length} handlers)`);
  return 'fixed';
}

// Main
console.log('🔧 Adding getDb(request) initialization to handlers...\n');

const routeFiles = findRouteFiles(API_DIR);
let fixedCount = 0;

for (const file of routeFiles) {
  const result = fixFile(file);
  if (result === 'fixed') fixedCount++;
}

console.log(`\n📊 Fixed ${fixedCount} files`);
