#!/usr/bin/env python3
"""
Transform Sidebar.tsx from accordion-style to module-picker-style.

Changes:
 1. Add FiArrowLeft to icon imports
 2. Add useRouter to next/navigation import
 3. Add sectionIcon field to NavSection interface
 4. Add PINNED_ITEMS + PICKER_ROUTES constants before navSections
 5. Remove 'platform' section (Home is now pinned)
 6. Remove Dashboard from 'core-hr' (it's pinned) and add sectionIcon
 7. Add sectionIcon to every remaining section
 8. Replace the component body (state + render) with new picker/submenu logic
"""
import re

FILE = '/home/z/my-project/src/components/Sidebar.tsx'

with open(FILE, 'r') as f:
    content = f.read()

# ── 1. Add FiArrowLeft import ──
content = content.replace(
    "  FiShoppingCart,\n} from 'react-icons/fi';",
    "  FiShoppingCart,\n  FiArrowLeft,\n} from 'react-icons/fi';"
)

# ── 2. Add useRouter ──
content = content.replace(
    "import { usePathname } from 'next/navigation';",
    "import { usePathname, useRouter } from 'next/navigation';"
)

# ── 3. NavSection interface ──
content = content.replace(
    "interface NavSection {\n  key: string;\n  label: string;\n  items: NavItem[];\n}",
    "interface NavSection {\n  key: string;\n  label: string;\n  sectionIcon: React.ComponentType<{ className?: string }>;\n  items: NavItem[];\n}"
)

# ── 4. PINNED_ITEMS + PICKER_ROUTES ──
pinned_block = """// Pinned items always visible at the top of the sidebar (Home + Dashboard)
const PINNED_ITEMS: NavItem[] = [
  { label: 'Home', href: '/home', icon: <FiHome className=\"w-5 h-5\" /> },
  { label: 'Dashboard', href: '/dashboard', icon: <FiGrid className=\"w-5 h-5\" />, moduleKey: 'dashboard' },
];

// Routes where the module picker (icon grid) is shown — no module auto-selected
const PICKER_ROUTES = ['/', '/home', '/dashboard'];

const navSections: NavSection[] = ["""

content = content.replace(
    "const navSections: NavSection[] = [",
    pinned_block,
    1
)

# ── 5. Remove 'platform' section ──
content = content.replace(
    """  {
    key: 'platform',
    label: 'Platform',
    items: [
      { label: 'Home', href: '/home', icon: <FiGrid className=\"w-5 h-5\" /> },
    ],
  },
""", ""
)

# ── 6. Core HR: remove Dashboard, add sectionIcon ──
content = content.replace(
    """  {
    key: 'core-hr',
    label: 'Core HR',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: <FiHome className=\"w-5 h-5\" />, moduleKey: 'dashboard' },
      { label: 'My Profile', href: '/my-profile', icon: <FiUser className=\"w-5 h-5\" /> },
      { label: 'Employees', href: '/employees', icon: <FiUsers className=\"w-5 h-5\" />, moduleKey: 'employees' },
      { label: 'Company Management', href: '/company', icon: <FiLayers className=\"w-5 h-5\" />, moduleKey: 'company' },
    ],
  },""",
    """  {
    key: 'core-hr',
    label: 'Core HR',
    sectionIcon: FiUsers,
    items: [
      { label: 'My Profile', href: '/my-profile', icon: <FiUser className=\"w-5 h-5\" /> },
      { label: 'Employees', href: '/employees', icon: <FiUsers className=\"w-5 h-5\" />, moduleKey: 'employees' },
      { label: 'Company Management', href: '/company', icon: <FiLayers className=\"w-5 h-5\" />, moduleKey: 'company' },
    ],
  },"""
)

# ── 7. Add sectionIcon to every remaining section ──
section_icons = {
    'super-admin': 'FiShield',
    'tenant-admin': 'FiServer',
    'talent-acquisition': 'FiBriefcase',
    'employee-lifecycle': 'FiUserPlus',
    'attendance': 'FiClock',
    'leave': 'FiCalendar',
    'timesheet': 'FiWatch',
    'compensation': 'FiDollarSign',
    'performance-growth': 'FiTrendingUp',
    'operations': 'FiFolder',
    'external-relations': 'FiGlobe',
    'marketplace': 'FiShoppingBag',
    'support-intelligence': 'FiHelpCircle',
    'collaboration': 'FiMessageCircle',
    'knowledge-base': 'FiBookOpen',
    'governance': 'FiSettings',
}

for key, icon in section_icons.items():
    old = f"  {{\n    key: '{key}',\n    label: '"
    new = f"  {{\n    key: '{key}',\n    sectionIcon: {icon},\n    label: '"
    if old in content:
        content = content.replace(old, new, 1)

with open(FILE, 'w') as f:
    f.write(content)

print("Steps 1-7 complete. Section icons added, platform section removed, Dashboard de-duplicated.")
