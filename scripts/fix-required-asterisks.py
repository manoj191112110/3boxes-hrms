#!/usr/bin/env python3
"""
Replace plain 'Label *' patterns in JSX with red asterisk spans.

Pattern: >Label Name *</label>  →  >Label Name <span className="text-red-500 font-bold">*</span></label>
Pattern: >Label Name *</span>   →  >Label Name <span className="text-red-500 font-bold">*</span></span>
"""

import re
import os
from pathlib import Path

# Pattern: text followed by " *" before a closing tag
# Matches: >Some Label *</label>  or  >Some Label *</span>
PATTERN = re.compile(r'>\s*([^<>*]+?)\s*\*\s*</(label|span)>')

def replace_asterisk(content: str) -> str:
    def replacer(m):
        text = m.group(1).strip()
        tag = m.group(2)
        return f'>{text} <span className="text-red-500 font-bold">*</span></{tag}>'
    return PATTERN.sub(replacer, content)

def process_file(filepath: str) -> int:
    """Process a single file. Returns number of replacements made."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return 0
    
    matches = PATTERN.findall(content)
    if not matches:
        return 0
    
    new_content = replace_asterisk(content)
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return len(matches)
    return 0

def main():
    base = Path('/home/z/my-project/src/app/(dashboard)')
    total_replaced = 0
    files_modified = 0
    
    for filepath in base.rglob('*.tsx'):
        count = process_file(str(filepath))
        if count > 0:
            files_modified += 1
            total_replaced += count
            print(f'  {filepath}: {count} replacements')
    
    print(f'\nDone. Modified {files_modified} files, {total_replaced} total replacements.')

if __name__ == '__main__':
    main()
