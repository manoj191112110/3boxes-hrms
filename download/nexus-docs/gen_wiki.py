#!/usr/bin/env python3
"""Generate NEXUS HRMS GitHub Wiki Knowledge Hub Index PDF"""
import sys, os
sys.path.insert(0, '/home/z/my-project/download/nexus-docs')
from doc_utils import *

register_fonts()
s = make_styles()

OUT_DIR = '/home/z/my-project/download/nexus-docs'
BODY_PATH = os.path.join(OUT_DIR, 'wiki_body.pdf')
OUTPUT_PATH = os.path.join(OUT_DIR, 'NEXUS-HRMS-GitHub-Wiki-Knowledge-Hub.pdf')

doc = TocDocTemplate(BODY_PATH, pagesize=A4, leftMargin=LM, rightMargin=RM, topMargin=TM, bottomMargin=BM)
story = []

# ── TOC ──
story.append(Paragraph('<b>Table of Contents</b>', s['H1']))
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle('TOC1', fontName='DejaVuSansBold', fontSize=13, leftIndent=20, leading=22),
    ParagraphStyle('TOC2', fontName='DejaVuSans', fontSize=11, leftIndent=40, leading=18),
]
story.append(toc)
story.append(PageBreak())

# ── 1. Knowledge Hub Architecture ──
story.append(heading('1. Knowledge Hub Architecture', 'H1', s, 0))
story.append(body('The NEXUS HRMS GitHub Wiki Knowledge Hub serves as the central documentation repository and navigation system for all platform documentation. It provides a structured, searchable, and maintainable documentation framework that serves all stakeholders — from developers to end users, from administrators to auditors.', s))
story.append(Spacer(1, 6))

story.append(heading('1.1 Wiki Structure', 'H2', s, 1))
story.append(body('The Knowledge Hub is organized into a hierarchical wiki structure with the following levels:', s))
wiki_structure = [
    '<b>Home Page:</b> The landing page providing a welcome message, quick links, and a visual documentation map.',
    '<b>Category Pages:</b> Top-level pages for each documentation category (Technical, Functional, Workflow, Security, AI, SOP, Training).',
    '<b>Document Pages:</b> Individual wiki pages for each complete document, containing the full content with internal navigation.',
    '<b>Quick Reference Pages:</b> Condensed one-page summaries for each module category for fast lookups.',
    '<b>Index Pages:</b> Cross-reference and index pages enabling multi-dimensional navigation across the documentation set.',
    '<b>Contribution Guide:</b> Guidelines for documentation contributors including style, format, and review processes.'
]
for item in wiki_structure:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('1.2 Sidebar Navigation', 'H2', s, 1))
story.append(body('The GitHub Wiki sidebar provides persistent navigation across all pages. It is organized hierarchically with category headings and document links, enabling one-click access to any document from any page.', s))
story.append(Spacer(1, 4))
sidebar_items = [
    '<b>Navigation Depth:</b> Maximum 3 levels in the sidebar — Category → Document → Section. Deeper nesting is avoided for usability.',
    '<b>Visual Hierarchy:</b> Category headings are bold, document links are regular weight, and section links are indented and smaller.',
    '<b>Category Icons:</b> Each category uses an emoji icon for quick visual identification in the sidebar.',
    '<b>Current Page Indicator:</b> The current page link is highlighted or marked in the sidebar for orientation.',
    '<b>Search Integration:</b> GitHub\'s built-in wiki search is supplemented with a custom index page for topic-based discovery.',
    '<b>Mobile Consideration:</b> Sidebar content is concise enough to be usable on mobile viewports where sidebar space is limited.'
]
for item in sidebar_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('1.3 Category Organization', 'H2', s, 1))
cat_org = make_table(
    ['Category', 'Icon', 'Description', 'Document Count'],
    [
        ['Technical', '⚙', 'Architecture, API, database, deployment documentation', '2'],
        ['Functional', '📋', 'Module features, user guides, configuration references', '1'],
        ['Workflow', '🔄', 'Process flows, status transitions, cross-module workflows', '1'],
        ['Security', '🔒', 'Authentication, authorization, data protection, compliance', '1'],
        ['AI', '🤖', 'AI features, SDK integration, configuration, ethics', '1'],
        ['SOP', '📝', 'Standard operating procedures, emergency procedures', '1'],
        ['Training', '🎬', 'Video scripts, production guides, learning content', '1'],
        ['Index', '📑', 'Cross-references, navigation, maintenance guides', '1'],
    ],
    s, [80, 40, 280, 80]
)
story.append(cat_org)
story.append(Spacer(1, 12))

# ── 2. Documentation Index ──
story.append(heading('2. Documentation Index', 'H1', s, 0))
story.append(body('The Documentation Index provides a comprehensive listing of all documents in the NEXUS HRMS Knowledge Hub. This is the primary reference for locating specific documentation and understanding the documentation coverage.', s))
story.append(Spacer(1, 6))

story.append(heading('2.1 Complete Document Listing', 'H2', s, 1))
doc_index = make_table(
    ['Document Name', 'Category', 'Target Audience', 'File Location', 'Last Updated'],
    [
        ['Technical Documentation', 'Technical', 'Developers, Architects, DevOps', '/docs/NEXUS-HRMS-Technical-Documentation.pdf', '2026-06-01'],
        ['Functional Documentation', 'Functional', 'HR, Managers, Admins', '/docs/NEXUS-HRMS-Functional-Documentation.pdf', '2026-06-01'],
        ['Workflow Documentation', 'Workflow', 'HR, Managers, Process Owners', '/docs/NEXUS-HRMS-Workflow-Documentation.pdf', '2026-06-01'],
        ['Security Features Documentation', 'Security', 'Security Team, Admins, Auditors', '/docs/NEXUS-HRMS-Security-Documentation.pdf', '2026-06-01'],
        ['AI Documentation', 'AI', 'AI Admins, HR, Developers', '/docs/NEXUS-HRMS-AI-Documentation.pdf', '2026-06-01'],
        ['SOP Documents', 'SOP', 'HR, Admins, All Users', '/docs/NEXUS-HRMS-SOP-Documents.pdf', '2026-06-01'],
        ['Training Video Scripts', 'Training', 'Training Team, Content Creators', '/docs/NEXUS-HRMS-Training-Video-Scripts.pdf', '2026-06-01'],
        ['GitHub Wiki Knowledge Hub', 'Index', 'All Stakeholders', '/docs/NEXUS-HRMS-GitHub-Wiki-Knowledge-Hub.pdf', '2026-06-01'],
    ],
    s, [120, 60, 110, 120, 70]
)
story.append(doc_index)
story.append(Spacer(1, 8))

story.append(heading('2.2 Document Detail Cards', 'H2', s, 1))
story.append(body('Each document in the Knowledge Hub has an associated detail card providing metadata for management and maintenance:', s))
detail_items = [
    '<b>Document Title:</b> Full official title of the document.',
    '<b>Document ID:</b> Unique identifier (e.g., NEXUS-DOC-TECH-001).',
    '<b>Category:</b> Primary classification category from the 8 defined categories.',
    '<b>Version:</b> Current version number following semver (e.g., 1.0.0).',
    '<b>Status:</b> Draft, Review, Published, or Archived.',
    '<b>Owner:</b> Team or individual responsible for content accuracy.',
    '<b>Target Audience:</b> Primary and secondary audience roles.',
    '<b>Module Coverage:</b> List of NEXUS modules covered in the document.',
    '<b>Page Count:</b> Approximate page count for the PDF.',
    '<b>Last Updated:</b> Date of the most recent content revision.',
    '<b>Next Review Date:</b> Scheduled date for the next content review.',
    '<b>Dependencies:</b> Other documents this document references or depends on.'
]
for item in detail_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 12))

# ── 3. Wiki Sidebar Navigation Structure ──
story.append(heading('3. Wiki Sidebar Navigation Structure', 'H1', s, 0))
story.append(body('The sidebar navigation provides persistent, one-click access to all wiki content. Below is the complete sidebar structure in Markdown format, ready for deployment to the GitHub Wiki _Sidebar.md file.', s))
story.append(Spacer(1, 6))

story.append(heading('3.1 Sidebar Markdown Code', 'H2', s, 1))
sidebar_md = """## NEXUS HRMS

**[[Home|Welcome]]**

### ⚙ Technical
- [[Technical Docs]]
  - Architecture
  - API Reference
  - Database Schema
  - Deployment Guide

### 📋 Functional
- [[Functional Docs]]
  - Module Features
  - User Guides
  - Configuration Ref

### 🔄 Workflow
- [[Workflow Docs]]
  - Module Workflows
  - Cross-Module Flows
  - Rules Engine
  - Config Guide

### 🔒 Security
- [[Security Docs]]
  - Auth System
  - RBAC
  - Data Security
  - Vulnerability Assessment

### 🤖 AI
- [[AI Docs]]
  - AI Interview
  - AI Assistant
  - AI Recruitment
  - Configuration Guide

### 📝 SOPs
- [[SOP Documents]]
  - Module SOPs
  - Emergency Procedures
  - Revision History

### 🎬 Training
- [[Training Scripts]]
  - Video Scripts
  - Production Guide

### 📑 Index
- [[Cross-Reference]]
- [[Quick Reference]]
- [[Contributing]]
- [[Maintenance]]"""

# Use a monospace style for the code block
code_style = ParagraphStyle('Code', fontName='DejaVuMono', fontSize=8, leading=12, textColor=TEXT_PRIMARY, 
                           leftIndent=10, spaceAfter=2, backColor=BG_SURFACE)
for line in sidebar_md.split('\n'):
    safe_line = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace(' ', '&nbsp;')
    if safe_line.strip():
        story.append(Paragraph(safe_line, code_style))
    else:
        story.append(Spacer(1, 6))

story.append(Spacer(1, 12))

# ── 4. Wiki Home Page Content ──
story.append(heading('4. Wiki Home Page Content', 'H1', s, 0))
story.append(body('The Wiki Home Page is the first page users see when they access the Knowledge Hub. It provides a welcome message, quick navigation links, and a visual overview of the documentation structure.', s))
story.append(Spacer(1, 6))

story.append(heading('4.1 Welcome Message', 'H2', s, 1))
story.append(body('Welcome to the NEXUS HRMS Knowledge Hub — your comprehensive reference for everything about the NEXUS Human Resource Management System. This wiki contains complete documentation covering technical architecture, functional features, workflows, security, AI capabilities, standard operating procedures, and training materials.', s))
story.append(Spacer(1, 6))

story.append(heading('4.2 Quick Links', 'H2', s, 1))
quick_links = make_table(
    ['Quick Link', 'Description', 'Audience'],
    [
        ['Getting Started', 'New to NEXUS? Start here for an overview and setup guide', 'Everyone'],
        ['Technical Architecture', 'System architecture, API reference, and database documentation', 'Developers'],
        ['Module Features', 'Feature descriptions and configuration for all 35+ modules', 'HR, Admins'],
        ['Workflow Reference', 'Process flows, status transitions, and workflow configuration', 'Process Owners'],
        ['Security & Compliance', 'Authentication, authorization, data protection, and audit', 'Security Team'],
        ['AI Features Guide', 'AI Interview, AI Assistant, and AI configuration', 'AI Admins, HR'],
        ['Standard Operating Procedures', 'Step-by-step procedures for all critical operations', 'All Users'],
        ['Training Materials', 'Video scripts and learning content for platform training', 'Training Team'],
    ],
    s, [120, 230, 100]
)
story.append(quick_links)
story.append(Spacer(1, 8))

story.append(heading('4.3 Documentation Map', 'H2', s, 1))
story.append(body('The documentation map provides a visual overview of the Knowledge Hub structure, showing how documents relate to each other and to the platform modules:', s))
doc_map = [
    '<b>Core Documentation Layer:</b> Technical Documentation and Functional Documentation form the foundation, providing system architecture and feature descriptions that all other documents reference.',
    '<b>Process Documentation Layer:</b> Workflow Documentation and SOP Documents build on the core layer, providing operational procedures and process specifications.',
    '<b>Specialized Documentation Layer:</b> Security Documentation and AI Documentation provide deep-dive references for specialized domains.',
    '<b>Enablement Layer:</b> Training Video Scripts translate documentation into learning content for end-user training.',
    '<b>Navigation Layer:</b> This Knowledge Hub Index provides cross-referencing and navigation across all layers.'
]
for item in doc_map:
    story.append(bullet(item, s))
story.append(Spacer(1, 12))

# ── 5. Module Documentation Cross-Reference ──
story.append(heading('5. Module Documentation Cross-Reference', 'H1', s, 0))
story.append(body('The Module Documentation Cross-Reference table shows which documents cover each NEXUS module. This enables users to quickly find all relevant documentation for a specific module across the entire document set.', s))
story.append(Spacer(1, 6))

cross_ref = make_table(
    ['Module', 'Technical', 'Functional', 'Workflow', 'Security', 'AI', 'SOP', 'Training'],
    [
        ['Super Admin', '✓', '✓', '✓', '✓', '✓', '✓', ''],
        ['Tenant Admin', '✓', '✓', '✓', '✓', '', '✓', '✓'],
        ['Employee Mgmt', '✓', '✓', '✓', '✓', '', '✓', '✓'],
        ['Recruitment', '✓', '✓', '✓', '', '✓', '✓', '✓'],
        ['Offers', '✓', '✓', '✓', '', '', '✓', ''],
        ['AI Interview', '✓', '✓', '✓', '', '✓', '✓', '✓'],
        ['Onboarding', '✓', '✓', '✓', '', '', '✓', '✓'],
        ['Attendance', '✓', '✓', '✓', '', '', '✓', '✓'],
        ['Leave Mgmt', '✓', '✓', '✓', '', '', '✓', '✓'],
        ['Payroll', '✓', '✓', '✓', '✓', '', '✓', '✓'],
        ['Performance', '✓', '✓', '✓', '', '✓', '✓', '✓'],
        ['Training', '✓', '✓', '✓', '', '✓', '✓', '✓'],
        ['Separation', '✓', '✓', '✓', '', '', '✓', ''],
        ['FNF', '✓', '✓', '✓', '', '', '✓', ''],
        ['Helpdesk', '✓', '✓', '✓', '', '✓', '✓', '✓'],
        ['Projects', '✓', '✓', '✓', '', '', '✓', '✓'],
        ['Expenses', '✓', '✓', '✓', '', '', '✓', ''],
        ['Assets', '✓', '✓', '✓', '', '', '✓', ''],
        ['AI Assistant', '✓', '✓', '✓', '', '✓', '', '✓'],
        ['Reports', '✓', '✓', '✓', '', '', '', '✓'],
        ['Settings', '✓', '✓', '✓', '✓', '✓', '', '✓'],
    ],
    s, [80, 55, 55, 55, 55, 40, 40, 55]
)
story.append(cross_ref)
story.append(Spacer(1, 8))

story.append(body('The ✓ symbol indicates that the module is covered in the respective document. Use this cross-reference to locate all documentation relevant to a specific module or to identify gaps in documentation coverage.', s))
story.append(Spacer(1, 12))

# ── 6. Quick Reference Cards ──
story.append(heading('6. Quick Reference Cards', 'H1', s, 0))
story.append(body('Quick Reference Cards provide condensed, one-page summaries for each module category. They are designed for printing or quick on-screen reference, containing the most essential information from the full documentation set.', s))
story.append(Spacer(1, 6))

story.append(heading('6.1 Core HR Quick Reference', 'H2', s, 1))
core_qr = make_table(
    ['Module', 'Key Feature', 'Primary Users', 'Critical Workflow'],
    [
        ['Employee Mgmt', 'Profile, Documents, Org Chart', 'HR, Employees', 'Profile Update → Approval'],
        ['Attendance', 'Check-in/Out, Regularization', 'Employees, Managers', 'Check-in → Anomaly → Regularize → Approve'],
        ['Leave Mgmt', 'Application, Balance, Calendar', 'Employees, Managers', 'Apply → Validate → Approve → Deduct'],
        ['Payroll', 'Salary Processing, Payslips', 'HR, Finance', 'Initiate → Compute → Approve → Disburse'],
        ['Onboarding', 'Task Checklist, Welcome, Docs', 'HR, IT, New Hires', 'Auto-create → Tasks → Verify → Complete'],
        ['Separation', 'Resignation, Exit, FNF', 'HR, Finance, IT', 'Submit → Notice → Exit → FNF'],
    ],
    s, [80, 100, 90, 180]
)
story.append(core_qr)
story.append(Spacer(1, 8))

story.append(heading('6.2 Talent Management Quick Reference', 'H2', s, 1))
talent_qr = make_table(
    ['Module', 'Key Feature', 'Primary Users', 'Critical Workflow'],
    [
        ['Recruitment', 'Requisition, Screening, Pipeline', 'HR, Managers', 'Requisition → Post → Screen → Interview → Offer'],
        ['AI Interview', 'AI Questions, Scoring, Feedback', 'Recruiters, AI', 'Configure → Schedule → Evaluate → Score'],
        ['Performance', 'Reviews, Goals, Calibration', 'All Users', 'Initiate → Self-Assess → Manager → Calibrate → Publish'],
        ['Training', 'Courses, Enrollment, Certificates', 'HR, Employees', 'Create → Enroll → Complete → Certify'],
        ['Goals & OKR', 'Objectives, Key Results, Alignment', 'All Users', 'Set → Align → Track → Evaluate'],
    ],
    s, [80, 100, 90, 180]
)
story.append(talent_qr)
story.append(Spacer(1, 8))

story.append(heading('6.3 Operations Quick Reference', 'H2', s, 1))
ops_qr = make_table(
    ['Module', 'Key Feature', 'Primary Users', 'Critical Workflow'],
    [
        ['Projects', 'Tasks, Timesheets, Milestones', 'PM, Team Members', 'Create → Assign → Track → Complete → Close'],
        ['Expenses', 'Claims, Approval, Reimbursement', 'Employees, Finance', 'Submit → Approve → Verify → Reimburse'],
        ['Assets', 'Inventory, Allocation, Recovery', 'IT, Admin, Employees', 'Register → Allocate → Track → Recover'],
        ['Travel', 'Requests, Advances, Settlement', 'Employees, Finance', 'Request → Approve → Advance → Settle'],
        ['Helpdesk', 'Tickets, AI Routing, Resolution', 'All Users, Agents', 'Create → Route → Resolve → Close'],
    ],
    s, [80, 100, 90, 180]
)
story.append(ops_qr)
story.append(Spacer(1, 8))

story.append(heading('6.4 Administration Quick Reference', 'H2', s, 1))
admin_qr = make_table(
    ['Module', 'Key Feature', 'Primary Users', 'Critical Workflow'],
    [
        ['Super Admin', 'Tenant Mgmt, Platform Config', 'Super Admin', 'Create Tenant → Configure → Activate'],
        ['Tenant Admin', 'Org Setup, Policy Config', 'Tenant Admin', 'Setup → Policies → Modules → Users'],
        ['Security', 'Auth, RBAC, Audit Logs', 'Admins, Security', 'Configure → Monitor → Audit → Remediate'],
        ['AI Admin', 'Model Config, Templates, Costs', 'Super Admin, Tenant Admin', 'Select Model → Template → Deploy → Monitor'],
        ['Reports', 'Analytics, Exports, Schedules', 'All Authorized', 'Select → Configure → Generate → Export'],
        ['Settings', 'Platform Config, Preferences', 'Admins', 'Navigate → Configure → Save → Publish'],
    ],
    s, [80, 100, 90, 180]
)
story.append(admin_qr)
story.append(Spacer(1, 12))

# ── 7. Contributing to the Wiki ──
story.append(heading('7. Contributing to the Wiki', 'H1', s, 0))
story.append(body('The NEXUS HRMS Knowledge Hub is a collaborative documentation resource. This section defines the guidelines and processes for contributing to, reviewing, and maintaining the wiki content.', s))
story.append(Spacer(1, 6))

story.append(heading('7.1 Editing Guidelines', 'H2', s, 1))
editing_guidelines = [
    '<b>Markdown Format:</b> All wiki content must be written in GitHub Flavored Markdown. Use proper heading hierarchy (H1 → H2 → H3), code blocks with language specification, and tables for structured data.',
    '<b>Writing Style:</b> Use clear, concise language. Write in active voice. Use present tense for descriptions and imperative mood for instructions. Avoid jargon unless the audience is technical.',
    '<b>Document Structure:</b> Follow the standard document structure: Title → Introduction → Content Sections → Related References. Each page should be self-contained but link to related content.',
    '<b>Code Examples:</b> All code examples must be tested and working. Include language specification in code block markers. Add comments explaining non-obvious logic.',
    '<b>Screenshots:</b> Screenshots should be current (within the last release), at standard resolution, and annotated with callouts where needed. Use the training tenant data only.',
    '<b>Links:</b> Use relative wiki links for internal references and absolute URLs for external resources. Verify all links after editing. Broken links must be fixed within 48 hours of discovery.',
    '<b>Length:</b> Individual wiki pages should be under 3000 words. If a topic requires more content, split into multiple pages with a hub page linking them.',
    '<b>Review Before Commit:</b> Always preview your changes before committing. Check for formatting issues, broken links, and factual accuracy.'
]
for guideline in editing_guidelines:
    story.append(bullet(guideline, s))
story.append(Spacer(1, 8))

story.append(heading('7.2 Review Process', 'H2', s, 1))
story.append(body('All significant wiki changes must go through the review process to ensure accuracy and consistency:', s))
review_steps = [
    '<b>Step 1 — Draft:</b> Create or edit the wiki content in a branch or fork. Mark the page status as "Draft" in the page metadata.',
    '<b>Step 2 — Self-Review:</b> Review your own changes for formatting, links, accuracy, and completeness before requesting peer review.',
    '<b>Step 3 — Peer Review:</b> Request review from at least one subject matter expert. The reviewer checks for technical accuracy, completeness, and clarity.',
    '<b>Step 4 — Editorial Review:</b> The documentation lead reviews for style consistency, cross-reference integrity, and adherence to wiki standards.',
    '<b>Step 5 — Approval:</b> The module owner or documentation lead approves the changes for publication.',
    '<b>Step 6 — Publication:</b> Merge the reviewed changes into the main wiki. Update the "Last Updated" date and version number.',
    '<b>Step 7 — Notification:</b> Announce significant documentation updates through the team communication channel.'
]
for step in review_steps:
    story.append(bullet(step, s))
story.append(Spacer(1, 8))

story.append(heading('7.3 Naming Conventions', 'H2', s, 1))
naming_items = [
    '<b>Page Names:</b> Use PascalCase for wiki page names (e.g., "AiInterviewModule", "SecurityArchitecture"). This ensures consistent URL generation and readability.',
    '<b>Headings:</b> Use sentence case for headings (e.g., "Getting started with NEXUS" not "Getting Started With NEXUS"). This follows modern documentation style guides.',
    '<b>Document IDs:</b> Follow the format NEXUS-[CATEGORY]-[NUMBER] (e.g., NEXUS-TECH-001, NEXUS-SOP-015). Category codes: TECH, FUNC, WORK, SEC, AI, SOP, TRN, IDX.',
    '<b>File Names:</b> PDF files follow the format NEXUS-HRMS-[DescriptiveName].pdf (e.g., NEXUS-HRMS-Technical-Documentation.pdf).',
    '<b>Branch Names:</b> Documentation branches follow the format docs/[category]/[brief-description] (e.g., docs/security/add-vulnerability-assessment).',
    '<b>Commit Messages:</b> Use the format "docs: [action] [subject]" (e.g., "docs: add AI interview configuration guide", "docs: fix broken links in security section").',
    '<b>Tags:</b> Apply version tags to documentation snapshots following the pattern docs/v[major].[minor] (e.g., docs/v1.0, docs/v1.1).'
]
for item in naming_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 12))

# ── 8. Documentation Maintenance Schedule ──
story.append(heading('8. Documentation Maintenance Schedule', 'H1', s, 0))
story.append(body('Regular documentation maintenance ensures the Knowledge Hub remains accurate, current, and useful. This section defines the maintenance schedule, responsibilities, and processes.', s))
story.append(Spacer(1, 6))

story.append(heading('8.1 Review Schedule', 'H2', s, 1))
schedule_tbl = make_table(
    ['Frequency', 'Activity', 'Scope', 'Responsible', 'Deadline'],
    [
        ['Weekly', 'Link check and formatting review', 'All wiki pages', 'Documentation Lead', 'Every Friday'],
        ['Monthly', 'Content accuracy review', 'SOPs and Workflow docs', 'Module Owners', 'Last week of month'],
        ['Quarterly', 'Comprehensive content review', 'All documents', 'Documentation Team', 'End of quarter'],
        ['Release-Based', 'Update for new features', 'Affected documents', 'Feature Teams', 'Within 1 week of release'],
        ['Incident-Based', 'Update for issues/gaps found', 'Specific documents', 'Any contributor', 'Within 48 hours'],
        ['Annual', 'Full documentation audit', 'Complete Knowledge Hub', 'Documentation Lead + QA', 'January'],
    ],
    s, [70, 110, 100, 100, 80]
)
story.append(schedule_tbl)
story.append(Spacer(1, 8))

story.append(heading('8.2 Version Management', 'H2', s, 1))
version_items = [
    '<b>Semantic Versioning:</b> Documentation versions follow semver: MAJOR.MINOR.PATCH. Major for restructuring, Minor for new content, Patch for corrections.',
    '<b>Version Tracking:</b> Each document maintains a version history table at the end of the document. Every change updates the version number and history.',
    '<b>Changelog:</b> A global CHANGELOG.md in the wiki root tracks all documentation changes with dates, authors, and descriptions.',
    '<b>Archive Policy:</b> Major version superseded documents are archived to an "Archive" section but remain accessible for reference.',
    '<b>Branching Strategy:</b> Documentation changes are made in feature branches and merged through the review process. The main branch always reflects the current published state.'
]
for item in version_items:
    story.append(bullet(item, s))
story.append(Spacer(1, 8))

story.append(heading('8.3 Quality Metrics', 'H2', s, 1))
story.append(body('Documentation quality is measured through the following metrics, tracked quarterly:', s))
quality_tbl = make_table(
    ['Metric', 'Target', 'Current', 'Measurement Method'],
    [
        ['Content Accuracy', '> 95%', 'Baseline', 'Expert review sampling'],
        ['Link Integrity', '100%', 'Baseline', 'Automated link checker'],
        ['Coverage Completeness', '> 90% of modules', 'Baseline', 'Cross-reference audit'],
        ['Freshness (updated within 90 days)', '> 80% of pages', 'Baseline', 'Automated date checker'],
        ['User Satisfaction', '> 4.0/5', 'Baseline', 'Quarterly survey'],
        ['Broken Links', '0', 'Baseline', 'Weekly automated scan'],
        ['Orphaned Pages', '0', 'Baseline', 'Wiki structure audit'],
    ],
    s, [140, 90, 60, 150]
)
story.append(quality_tbl)
story.append(Spacer(1, 8))

story.append(heading('8.4 Maintenance Responsibilities', 'H2', s, 1))
responsibilities = make_table(
    ['Role', 'Responsibility', 'Time Commitment'],
    [
        ['Documentation Lead', 'Overall quality, review process, maintenance schedule', '20% of time'],
        ['Module Owners', 'Content accuracy for their module, review approvals', '5% of time'],
        ['Technical Writers', 'Content creation, editing, formatting', 'Full-time (allocated)'],
        ['Contributors', 'Draft content, fix issues, suggest improvements', 'As needed'],
        ['QA Reviewer', 'Link checking, formatting review, test instructions', '10% of time'],
    ],
    s, [120, 240, 110]
)
story.append(responsibilities)

# ── Build ──
doc.multiBuild(story)

cover_pdf = generate_cover('GitHub Wiki<br/>Knowledge Hub', 'Complete Documentation Index &amp; Navigation Guide', 'wiki_cover')
size = merge_cover_body(cover_pdf, BODY_PATH, OUTPUT_PATH, 'NEXUS HRMS GitHub Wiki Knowledge Hub')
print(f'PDF created: {OUTPUT_PATH} ({size:,} bytes)')
