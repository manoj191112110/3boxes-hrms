#!/usr/bin/env python3
"""Replace all blue/indigo/violet colors with green/emerald equivalents in the login page."""

import re

filepath = '/home/z/my-project/src/app/login/page.tsx'

with open(filepath, 'r') as f:
    content = f.read()

# Color mapping: old -> new
replacements = [
    # Gradient backgrounds
    ('from-[#0B1120] via-[#0F1D3A] to-[#1A0F2E]', 'from-[#0B1120] via-[#0F2D1A] to-[#0F2E1A]'),
    
    # Glowing orbs
    ('bg-blue-500/15', 'bg-green-500/15'),
    ('bg-violet-500/15', 'bg-emerald-500/15'),
    
    # Gradient text
    ('from-blue-400 via-emerald-400 to-violet-400', 'from-green-400 via-emerald-400 to-teal-400'),
    
    # Violet icon backgrounds/text
    ('bg-violet-500/15', 'bg-emerald-500/15'),
    ('text-violet-400', 'text-emerald-400'),
    ('text-violet-500', 'text-emerald-500'),
    ('text-violet-600', 'text-green-600'),
    ('text-violet-700', 'text-green-700'),
    
    # Candidate tab colors
    ('bg-white text-violet-600', 'bg-white text-green-600'),
    ('bg-white text-violet-700', 'bg-white text-green-700'),
    
    # Gradient from-violet to sky
    ('from-violet-500 via-indigo-500 to-sky-500', 'from-green-500 via-emerald-500 to-teal-500'),
    ('hover:from-violet-600 hover:to-sky-600', 'hover:from-green-600 hover:to-teal-600'),
    ('shadow-violet-500/25', 'shadow-green-500/25'),
    ('focus:ring-violet-500/50', 'focus:ring-green-500/50'),
    
    # Gradient from-blue to violet (main login button)
    ('from-blue-500 via-indigo-500 to-violet-600', 'from-green-500 via-emerald-500 to-teal-600'),
    ('shadow-blue-500/25', 'shadow-green-500/25'),
    ('hover:shadow-blue-500/30', 'hover:shadow-green-500/30'),
    ('hover:from-blue-600 hover:via-indigo-600 hover:to-violet-700', 'hover:from-green-600 hover:via-emerald-600 hover:to-teal-700'),
    ('focus:ring-blue-500/50', 'focus:ring-green-500/50'),
    
    # Input focus rings
    ('focus:ring-violet-500/20 focus:border-violet-400', 'focus:ring-green-500/20 focus:border-green-400'),
    ('focus:ring-blue-500/20 focus:border-blue-400', 'focus:ring-green-500/20 focus:border-green-400'),
    
    # Tenant badge gradients
    ('from-blue-50 to-violet-50 border border-blue-100', 'from-green-50 to-emerald-50 border border-green-100'),
    ('from-blue-500 to-violet-600', 'from-green-500 to-emerald-600'),
    ('from-indigo-500 to-violet-600', 'from-green-500 to-emerald-600'),
    
    # Demo/tenant blocks
    ('from-indigo-50/60 to-violet-50/60', 'from-green-50/60 to-emerald-50/60'),
    ('hover:from-indigo-50 hover:to-violet-50', 'hover:from-green-50 hover:to-emerald-50'),
    ('border-indigo-100', 'border-green-100'),
    ('border-indigo-200', 'border-green-200'),
    ('hover:border-indigo-200', 'hover:border-green-200'),
    ('bg-gradient-to-br from-indigo-500 to-violet-600', 'bg-gradient-to-br from-green-500 to-emerald-600'),
    ('text-indigo-700', 'text-green-700'),
    ('text-indigo-500', 'text-green-500'),
    
    # Small violet backgrounds
    ('bg-violet-50', 'bg-green-50'),
    ('bg-blue-50', 'bg-green-50'),
    
    # Blue text -> green
    ('text-blue-400', 'text-green-400'),
    ('text-blue-500', 'text-green-500'),
    
    # Password/OTP gradient from blue to violet
    ('bg-gradient-to-r from-blue-500 to-violet-600', 'bg-gradient-to-r from-green-500 to-emerald-600'),
    ('hover:from-blue-600 hover:to-violet-700', 'hover:from-green-600 hover:to-emerald-700'),
    ('shadow-blue-500/20', 'shadow-green-500/20'),
    
    # Feature gradient from blue to violet
    ('bg-gradient-to-br from-blue-50 to-violet-50', 'bg-gradient-to-br from-green-50 to-emerald-50'),
]

for old, new in replacements:
    content = content.replace(old, new)

with open(filepath, 'w') as f:
    f.write(content)

# Count remaining blue/indigo/violet references
remaining = 0
for pattern in ['indigo-', 'violet-', 'blue-5', 'blue-6', '#3B82F6', '#8B5CF6', '#1D4ED8']:
    count = content.count(pattern)
    if count > 0:
        print(f'  Remaining "{pattern}": {count}')
        remaining += count

print(f'Total remaining blue/indigo/violet: {remaining}')
