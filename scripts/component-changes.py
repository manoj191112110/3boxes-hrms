#!/usr/bin/env python3
"""
Comprehensive component-level changes for Nexus HRMS rebranding + improvements.
This handles changes that simple sed can't do (multi-line replacements, structural changes).
"""
import re, os

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w') as f:
        f.write(content)
    print(f"  Updated: {path}")

def replace_in_file(path, old, new):
    content = read_file(path)
    if old in content:
        content = content.replace(old, new)
        write_file(path, content)
        return True
    return False

PROJECT = '/home/z/my-project'

# ============================================================
# 1. LAYOUT.TSX - Update metadata + SW console logs
# ============================================================
print("=== Updating layout.tsx ===")
f = os.path.join(PROJECT, 'src/app/layout.tsx')
content = read_file(f)
# Add Marq AI Tech to description
content = content.replace(
    'Nexus HRMS — SaaS-Based AI HRMS Platform. People · Process · Technology.',
    'Nexus HRMS — SaaS-Based AI HRMS Platform by Marq AI Tech Pvt Ltd. People · Process · Technology.'
)
content = content.replace(
    'Nexus HRMS — People · Process · Technology. SaaS-Based AI HRMS Platform with AI-powered interviews',
    'Nexus HRMS — People · Process · Technology. A Proud Product of Marq AI Tech Pvt Ltd. SaaS-Based AI HRMS Platform with AI-powered interviews'
)
write_file(f, content)

# ============================================================
# 2. SIDEBAR.TSX - Replace 3-box SVG with logo image + add Proud Product
# ============================================================
print("=== Updating Sidebar.tsx ===")
f = os.path.join(PROJECT, 'src/components/Sidebar.tsx')
content = read_file(f)

# Replace the brand header section
old_brand = '''<div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
            <svg viewBox="0 0 35 11" className="w-5 h-3" fill="none">
              <rect x="0" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
              <rect x="13" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
              <rect x="26" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
            </svg>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-lg font-bold text-white tracking-tight whitespace-nowrap">
                Nexus <span className="text-[11px] font-semibold text-blue-300 tracking-wider">HRMS</span>
              </h1>
              <p className="text-[10px] text-nexus-sidebar-text leading-none -mt-0.5">People · Process · Technology</p>
            </div>
          )}'''

new_brand = '''{/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marq-ai-logo.png" alt="Marq AI Tech" className="flex-shrink-0 w-9 h-9 rounded-xl object-contain shadow-lg ring-1 ring-white/10" />
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-lg font-bold text-white tracking-tight whitespace-nowrap">
                Nexus <span className="text-[11px] font-semibold text-blue-300 tracking-wider">HRMS</span>
              </h1>
              <p className="text-[9px] text-nexus-sidebar-text leading-none -mt-0.5">A Proud Product of Marq AI Tech Pvt Ltd</p>
            </div>
          )}'''

content = content.replace(old_brand, new_brand)

# Add Proud Product branding at the bottom of sidebar (before the closing </div> of the bottom section)
old_collapse = '''        {/* Collapse Toggle */}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center py-2 text-nexus-sidebar-text hover:text-slate-300 hover:bg-white/[0.03] transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <FiChevronRight className="w-4 h-4" />
          ) : (
            <FiChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
      )}
    </aside>'''

new_collapse = '''        {/* Collapse Toggle */}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center py-2 text-nexus-sidebar-text hover:text-slate-300 hover:bg-white/[0.03] transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <FiChevronRight className="w-4 h-4" />
          ) : (
            <FiChevronLeft className="w-4 h-4" />
          )}
        </button>

        {/* Proud Product Branding */}
        {!collapsed && (
          <div className="px-4 pb-3 pt-1 text-center">
            <div className="flex items-center justify-center gap-1.5 opacity-40 hover:opacity-70 transition-opacity">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/marq-ai-logo.png" alt="Marq AI" className="w-4 h-4 rounded object-contain" />
              <span className="text-[9px] text-nexus-sidebar-text whitespace-nowrap">A Proud Product of Marq AI Tech Pvt Ltd</span>
            </div>
          </div>
        )}
      </div>
      )}
    </aside>'''

content = content.replace(old_collapse, new_collapse)
write_file(f, content)

# ============================================================
# 3. HEADER.TSX - Replace 3-box SVG with logo image
# ============================================================
print("=== Updating Header.tsx ===")
f = os.path.join(PROJECT, 'src/components/Header.tsx')
content = read_file(f)

old_header = '''      {/* Nexus HRMS Logo + Name in Header */}
      <div className="flex items-center gap-2.5 pr-3 border-r border-slate-200">
        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shadow-blue-500/15">
          <svg viewBox="0 0 35 11" className="w-5 h-3.5" fill="none">
            <rect x="0" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
            <rect x="13" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
            <rect x="26" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
          </svg>
        </div>
        <div className="hidden sm:block">
          <span className="text-sm font-extrabold text-slate-800 tracking-tight">Nexus</span>
          <span className="text-[10px] font-bold text-blue-500 ml-1 tracking-wider">HRMS</span>
        </div>
      </div>'''

new_header = '''      {/* Nexus HRMS Logo + Name in Header */}
      <div className="flex items-center gap-2.5 pr-3 border-r border-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/marq-ai-logo.png" alt="Marq AI Tech" className="flex-shrink-0 w-8 h-8 rounded-xl object-contain shadow-sm" />
        <div className="hidden sm:block">
          <span className="text-sm font-extrabold text-slate-800 tracking-tight">Nexus</span>
          <span className="text-[10px] font-bold text-blue-500 ml-1 tracking-wider">HRMS</span>
        </div>
      </div>'''

content = content.replace(old_header, new_header)
write_file(f, content)

# ============================================================
# 4. DASHBOARD LAYOUT.TSX - Update loading + mobile header
# ============================================================
print("=== Updating dashboard layout.tsx ===")
f = os.path.join(PROJECT, 'src/app/(dashboard)/layout.tsx')
content = read_file(f)

# Update loading spinner
old_loading = '''          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 mb-4 shadow-xl shadow-blue-500/20 animate-pulse-subtle ring-2 ring-blue-400/10">
            <svg viewBox="0 0 30 30" className="w-7 h-7" fill="none">
              <path d="M15 2L3 8V16C3 24 8.1 31.2 15 33C21.9 31.2 27 24 27 16V8L15 2Z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="0.5"/>
              <path d="M9 23V11H12.5L20 20V11H23V23H19.5L12 14V23H9Z" fill="white"/>
            </svg>
          </div>'''

new_loading = '''          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 mb-4 shadow-xl shadow-blue-500/20 animate-pulse-subtle ring-2 ring-blue-400/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marq-ai-logo.png" alt="Marq AI Tech" className="w-8 h-8 rounded-xl object-contain" />
          </div>'''

content = content.replace(old_loading, new_loading)

# Update mobile header logo
old_mobile = '''            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 flex items-center justify-center shadow-sm ring-1 ring-blue-400/15">
              <svg viewBox="0 0 35 11" className="w-4 h-3" fill="none">
                <rect x="0" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
                <rect x="13" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
                <rect x="26" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9"/>
              </svg>
            </div>'''

new_mobile = '''            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/marq-ai-logo.png" alt="Marq AI Tech" className="flex-shrink-0 w-8 h-8 rounded-lg object-contain shadow-sm ring-1 ring-blue-400/15" />'''

content = content.replace(old_mobile, new_mobile)

# Update mobile header text from "3 Boxes" to "Nexus"
content = content.replace(
    'Nexus <span className="text-[9px] font-bold text-blue-500 tracking-wider">HRMS</span>',
    'Nexus <span className="text-[9px] font-bold text-blue-500 tracking-wider">HRMS</span>'
)

write_file(f, content)

# ============================================================
# 5. WELCOME GREETING - Replace SVGs with logo images
# ============================================================
print("=== Updating WelcomeGreeting.tsx ===")
f = os.path.join(PROJECT, 'src/components/WelcomeGreeting.tsx')
content = read_file(f)

# Inside card logo
old_welcome_logo1 = '''              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 flex items-center justify-center shadow-lg mx-auto mb-4">
                <svg viewBox="0 0 35 11" className="w-9 h-4" fill="none">
                  <rect x="0" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9" />
                  <rect x="13" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9" />
                  <rect x="26" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9" />
                </svg>
              </div>'''

new_welcome_logo1 = '''              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 flex items-center justify-center shadow-lg mx-auto mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/marq-ai-logo.png" alt="Marq AI Tech" className="w-12 h-12 rounded-xl object-contain" />
              </div>'''

content = content.replace(old_welcome_logo1, new_welcome_logo1)

# Envelope flap logo
old_welcome_logo2 = '''              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 35 11" className="w-7 h-3" fill="none">
                  <rect x="0" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9" />
                  <rect x="13" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9" />
                  <rect x="26" y="0" width="9" height="9" rx="2" fill="white" opacity="0.9" />
                </svg>
              </div>'''

new_welcome_logo2 = '''              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/marq-ai-logo.png" alt="Marq AI Tech" className="w-9 h-9 rounded-lg object-contain" />
              </div>'''

content = content.replace(old_welcome_logo2, new_welcome_logo2)
write_file(f, content)

# ============================================================
# 6. LOGIN PAGE - Replace ThreeBoxesLogo with NexusLogo + add Proud Product + redesign colors
# ============================================================
print("=== Updating login/page.tsx ===")
f = os.path.join(PROJECT, 'src/app/login/page.tsx')
content = read_file(f)

# Replace ThreeBoxesLogo component with NexusLogo (using image)
old_logo_component = re.search(
    r'const ThreeBoxesLogo = \({[^}]*}\) => \{[\s\S]*?\};',
    content
)
if old_logo_component:
    new_logo_component = '''const NexusLogo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
    const dims = { sm: 'w-8 h-8', md: 'w-11 h-11', lg: 'w-14 h-14', xl: 'w-18 h-18' };
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/marq-ai-logo.png" alt="Marq AI Tech" className={`${dims[size]} rounded-xl object-contain`} />
    );
  };'''
    content = content.replace(old_logo_component.group(), new_logo_component)

# Replace ThreeBoxesLogo references with NexusLogo
content = content.replace('ThreeBoxesLogo', 'NexusLogo')

# Update "three pillars converge" text
content = content.replace(
    'where three pillars converge — empowering businesses to manage people, streamline processes, and leverage technology seamlessly.',
    '— empowering businesses to manage people, streamline processes, and leverage technology seamlessly. A Proud Product of Marq AI Tech Pvt Ltd.'
)

# Update placeholder
content = content.replace('e.g. 3boxes / acme / your-company', 'e.g. nexus / acme / your-company')

# Add Proud Product to login footer
content = content.replace(
    '&copy; {new Date().getFullYear()} Nexus HRMS',
    '&copy; {new Date().getFullYear()} Nexus HRMS · A Proud Product of Marq AI Tech Pvt Ltd'
)

# ===== LOGIN PAGE REDESIGN: Color changes =====
# Left panel gradient: deep indigo → dark navy
content = content.replace('from-[#1a1145] via-[#2d1b69] to-[#0f2b5e]', 'from-[#0a1628] via-[#0f2847] to-[#0a1f3c]')

# Glowing orbs
content = content.replace('bg-violet-500/20 rounded-full blur-[120px]', 'bg-blue-400/15 rounded-full blur-[120px]')
content = content.replace('bg-indigo-600/25 rounded-full blur-[100px]', 'bg-cyan-500/20 rounded-full blur-[100px]')

# Badge colors
content = content.replace('bg-violet-400/15 border-white/[0.1]', 'bg-blue-400/15 border-white/[0.08]')
content = content.replace('bg-violet-400 animate-pulse', 'bg-blue-400 animate-pulse')
content = content.replace('text-violet-300 font-semibold', 'text-blue-300 font-semibold')

# Hero text gradient
content = content.replace('from-white via-violet-200 to-white', 'from-white via-blue-200 to-white')

# Pillar icons
content = content.replace('bg-violet-400/20', 'bg-blue-400/20')
content = content.replace('text-violet-300', 'text-blue-300')
content = content.replace('bg-indigo-400/20', 'bg-teal-400/20')
content = content.replace('text-indigo-300', 'text-teal-300')
content = content.replace('bg-fuchsia-400/20', 'bg-cyan-400/20')
content = content.replace('text-fuchsia-300', 'text-cyan-300')

# Avatar dot
content = content.replace("bg-violet-500', 'bg-amber-500'", "bg-blue-500', 'bg-amber-500'")

# Right panel
content = content.replace('via-violet-50/30', 'via-blue-50/30')
content = content.replace('#7C3AED', '#3B82F6')

# Mobile brand
content = content.replace('from-[#2d1b69] to-[#4F6BF6]', 'from-[#0f2847] to-[#4F6BF6]')
content = content.replace('text-[#1a1145]', 'text-[#0a1628]')

# Add FiExternalLink to imports if not already there
if 'FiExternalLink' not in content:
    content = content.replace(
        "FiUser, FiKey, FiAlertCircle,",
        "FiUser, FiKey, FiAlertCircle, FiExternalLink,"
    )

# Add Proud Product branding to left panel (after compliance badges)
old_compliance = '''            <div className="flex items-center gap-4 text-[11px] text-white/40">
              <span className="flex items-center gap-1.5">
                <FiShield className="w-3.5 h-3.5" />
                SOC 2 Compliant
              </span>
              <span className="flex items-center gap-1.5">
                <FiGlobe className="w-3.5 h-3.5" />
                GDPR Ready
              </span>
              <span className="flex items-center gap-1.5">
                <FiZap className="w-3.5 h-3.5" />
                99.9% Uptime
              </span>
            </div>
          </div>
        </div>
      </div>'''

new_compliance = '''            <div className="flex items-center gap-4 text-[11px] text-white/40">
              <span className="flex items-center gap-1.5">
                <FiShield className="w-3.5 h-3.5" />
                SOC 2 Compliant
              </span>
              <span className="flex items-center gap-1.5">
                <FiGlobe className="w-3.5 h-3.5" />
                GDPR Ready
              </span>
              <span className="flex items-center gap-1.5">
                <FiZap className="w-3.5 h-3.5" />
                99.9% Uptime
              </span>
            </div>

            {/* Proud Product Branding */}
            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/marq-ai-logo.png" alt="Marq AI Tech" className="w-6 h-6 rounded object-contain opacity-70" />
                <p className="text-[10px] text-white/40 tracking-wide">A Proud Product of <span className="text-white/60 font-semibold">Marq AI Tech Pvt Ltd</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>'''

content = content.replace(old_compliance, new_compliance)

# ===== ADD CANDIDATE JOB PORTALS =====
# Find the candidate section and add job portals
# Look for the section after candidate login form where we can add portals
candidate_portal_section = '''
          {/* Third-Party Job Portals */}
          {loginMode === 'candidate' && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <FiGlobe className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-700">Explore Opportunities</h3>
              </div>
              <p className="text-xs text-slate-400 mb-3">Browse jobs across top portals</p>
              <div className="grid grid-cols-2 gap-2">
                <a href="https://www.linkedin.com/jobs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-[#0A66C2] flex items-center justify-center text-white text-[10px] font-bold shrink-0">in</div>
                  <div className="min-w-0"><p className="text-xs font-semibold text-slate-700 truncate">LinkedIn</p><p className="text-[10px] text-slate-400">Professional network</p></div>
                  <FiExternalLink className="w-3 h-3 text-slate-300 group-hover:text-blue-500 ml-auto shrink-0" />
                </a>
                <a href="https://www.naukri.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-[#4A90D9] flex items-center justify-center text-white text-[10px] font-bold shrink-0">N</div>
                  <div className="min-w-0"><p className="text-xs font-semibold text-slate-700 truncate">Naukri</p><p className="text-[10px] text-slate-400">India&apos;s #1 job site</p></div>
                  <FiExternalLink className="w-3 h-3 text-slate-300 group-hover:text-blue-500 ml-auto shrink-0" />
                </a>
                <a href="https://www.indeed.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-[#2557A7] flex items-center justify-center text-white text-[10px] font-bold shrink-0">IN</div>
                  <div className="min-w-0"><p className="text-xs font-semibold text-slate-700 truncate">Indeed</p><p className="text-[10px] text-slate-400">Global job search</p></div>
                  <FiExternalLink className="w-3 h-3 text-slate-300 group-hover:text-blue-500 ml-auto shrink-0" />
                </a>
                <a href="https://www.glassdoor.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-[#0CAA41] flex items-center justify-center text-white text-[10px] font-bold shrink-0">G</div>
                  <div className="min-w-0"><p className="text-xs font-semibold text-slate-700 truncate">Glassdoor</p><p className="text-[10px] text-slate-400">Reviews &amp; jobs</p></div>
                  <FiExternalLink className="w-3 h-3 text-slate-300 group-hover:text-blue-500 ml-auto shrink-0" />
                </a>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                <a href="https://www.monster.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors text-[11px] text-slate-500 hover:text-slate-700">Monster <FiExternalLink className="w-2.5 h-2.5" /></a>
                <a href="https://www.foundit.in" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors text-[11px] text-slate-500 hover:text-slate-700">Foundit <FiExternalLink className="w-2.5 h-2.5" /></a>
              </div>
            </div>
          )}'''

# Add the job portals section before the footer in the right panel
old_footer = '''          {/* Footer */}
          <div className="mt-6 pt-5 border-t border-slate-100">'''

content = content.replace(old_footer, candidate_portal_section + '\n          {/* Footer */}\n          <div className="mt-6 pt-5 border-t border-slate-100">')

write_file(f, content)

# ============================================================
# 7. AUTH.TS - Update JWT secret fallback
# ============================================================
print("=== Updating auth.ts ===")
replace_in_file(
    os.path.join(PROJECT, 'src/lib/auth.ts'),
    "3boxes-hrms-fallback-secret",
    "nexus-hrms-fallback-secret"
)

# ============================================================
# 8. APP STORE - Update demo company
# ============================================================
print("=== Updating app-store.ts ===")
f = os.path.join(PROJECT, 'src/store/app-store.ts')
content = read_file(f)
# The sed already changed 3 Boxes Technologies to Marq AI Tech Pvt Ltd
# but we need to update the code too
content = content.replace("'3BOXES'", "'NEXUS'")
write_file(f, content)

# ============================================================
# 9. HRMS LOGIN SCREEN - Update demo name
# ============================================================
print("=== Updating hrms/login-screen.tsx ===")
f = os.path.join(PROJECT, 'src/components/hrms/login-screen.tsx')
content = read_file(f)
# Update demo admin name
content = content.replace("Admin 3Boxes", "Admin Nexus")
# Update footer
content = content.replace("AI-Powered Enterprise HR Platform.", "A Proud Product of Marq AI Tech Pvt Ltd.")
write_file(f, content)

# ============================================================
# 10. COMPANY MANAGEMENT - Update placeholder
# ============================================================
print("=== Updating company-management.tsx ===")
replace_in_file(
    os.path.join(PROJECT, 'src/components/hrms/company-management.tsx'),
    'e.g. 3BOXES',
    'e.g. NEXUS'
)

# ============================================================
# 11. SETTINGS PAGE - Update fallback company name
# ============================================================
print("=== Updating settings page ===")
f = os.path.join(PROJECT, 'src/app/(dashboard)/settings/page.tsx')
content = read_file(f)
content = content.replace(
    "!n.toLowerCase().includes('3 boxes') ? '3 Boxes Corp'",
    "!n.toLowerCase().includes('nexus') ? 'Marq AI Tech Pvt Ltd'"
)
write_file(f, content)

# ============================================================
# 12. CAREERS PAGE - Update URLs
# ============================================================
print("=== Updating careers page ===")
f = os.path.join(PROJECT, 'src/app/careers/page.tsx')
content = read_file(f)
content = content.replace('https://3boxes.com', 'https://nexushrms.com')
write_file(f, content)

# ============================================================
# 13. DECLINE SURVEY - Update link
# ============================================================
print("=== Updating decline-survey ===")
f = os.path.join(PROJECT, 'src/app/candidates/decline-survey/[token]/page.tsx')
content = read_file(f)
content = content.replace('https://3boxes.tech', 'https://marqai.tech')
write_file(f, content)

# ============================================================
# 14. DASHBOARD LAYOUT - Performance optimizations
# ============================================================
print("=== Adding performance optimizations to dashboard layout ===")
f = os.path.join(PROJECT, 'src/app/(dashboard)/layout.tsx')
content = read_file(f)

# Add Suspense import if not present
if 'Suspense' not in content:
    content = content.replace(
        "import { useEffect, useState, useCallback } from 'react';",
        "import { useEffect, useState, useCallback, Suspense, useMemo } from 'react';"
    )

# Wrap Sidebar and Header dynamic imports with Suspense
content = content.replace(
    "const Sidebar = dynamic(() => import('@/components/Sidebar'), { ssr: false });",
    "const Sidebar = dynamic(() => import('@/components/Sidebar'), { ssr: false, loading: () => <div className=\"w-[260px] h-full bg-nexus-sidebar flex-shrink-0\" /> });"
)
content = content.replace(
    "const Header = dynamic(() => import('@/components/Header'), { ssr: false });",
    "const Header = dynamic(() => import('@/components/Header'), { ssr: false, loading: () => <div className=\"h-16 border-b border-slate-200\" /> });"
)

write_file(f, content)

# ============================================================
# DONE
# ============================================================
print("\n=== ALL CHANGES APPLIED SUCCESSFULLY ===")
