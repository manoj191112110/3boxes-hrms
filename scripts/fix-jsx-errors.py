#!/usr/bin/env python3
"""Fix common JSX syntax errors introduced by the NexusUI redesign agents."""

import os
import re
import glob

PROJECT = '/home/z/my-project'

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    original = content
    changed = False
    
    # Fix 1: gradient={ from: '...', to: '...'} => gradient={{ from: '...', to: '...'}}
    # This pattern matches: gradient={ from: ... to: ... } without double braces
    pattern = r'gradient=\{\s*from:\s*[\'"][^\'"]+[\'"],\s*to:\s*[\'"][^\'"]+[\'"]\s*\}'
    def replacer(m):
        inner = m.group(0)
        # Extract from the { after =
        idx = inner.find('{')
        obj_part = inner[idx+1:].rstrip('}')
        return f'gradient={{{{{obj_part}}}}}'
    
    content = re.sub(pattern, replacer, content)
    
    # Fix 2: Same pattern but with different spacing
    pattern2 = r'gradient=\{ from: [^}]+to: [^}]+\}'
    if re.search(pattern2, content):
        # More flexible approach
        def fix_gradient(m):
            text = m.group(0)
            # Add double braces around the object
            return text.replace('gradient={ ', 'gradient={{ ').replace(' from:', ' from:').replace(' to:', ' to:').rstrip('}') + '}}'
    
    # Fix 3: Look for lines with gradient={ from:
    lines = content.split('\n')
    new_lines = []
    for line in lines:
        if 'gradient={' in line and 'from:' in line and 'to:' in line and 'gradient={{' not in line:
            # Fix single-brace gradient objects
            line = line.replace('gradient={ from:', 'gradient={{ from:').replace(', to:', ', to:')
            # Find the closing } for the gradient prop
            # Count braces after gradient={
            idx = line.find('gradient={{')
            if idx >= 0:
                # Find closing }}
                rest = line[idx + len('gradient={{'):]
                # Find the position where we need to add the extra }
                depth = 2  # We opened 2 braces
                pos = 0
                for i, ch in enumerate(rest):
                    if ch == '{':
                        depth += 1
                    elif ch == '}':
                        depth -= 1
                        if depth == 1:
                            # This is where we need an extra }
                            line = line[:idx + len('gradient={{') + i + 1] + '}' + line[idx + len('gradient={{') + i + 1:]
                            break
            new_lines.append(line)
        else:
            new_lines.append(line)
    content = '\n'.join(new_lines)
    
    if content != original:
        changed = True
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return changed

# Find all files with TS errors
error_files = []
result = os.popen(f'cd {PROJECT} && npx tsc --noEmit 2>&1 | rg "error TS" | rg -o "^.*\\.tsx" | sort -u').read()
error_files = [f.strip() for f in result.strip().split('\n') if f.strip() and f.strip().startswith('src/')]

print(f"Found {len(error_files)} files with TS errors")

fixed_count = 0
for fpath in error_files:
    full_path = os.path.join(PROJECT, fpath)
    if os.path.exists(full_path):
        if fix_file(full_path):
            fixed_count += 1
            print(f"Fixed: {fpath}")
        else:
            print(f"No gradient fix needed: {fpath}")
    else:
        print(f"File not found: {full_path}")

print(f"\nFixed {fixed_count} files")
