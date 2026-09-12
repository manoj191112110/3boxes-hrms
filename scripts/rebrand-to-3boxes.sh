#!/bin/bash
# Rebrand Nexus HRMS → 3Boxes HRMS
# CSS classes can't start with digits, so nexus- → thb- (three boxes) in CSS
# Display text: Nexus → 3Boxes

set -e

echo "=== Starting Rebrand: Nexus HRMS → 3Boxes HRMS ==="

# ============================================================
# PHASE 1: CSS class names and variables (nexus- → thb-)
# These MUST be done first before we touch display text
# ============================================================

echo "Phase 1: Replacing CSS class names and variable names..."

# Replace CSS custom properties: --nexus- → --thb-
find src -type f \( -name "*.css" -o -name "*.tsx" -o -name "*.ts" \) -exec sed -i \
  -e 's/--nexus-/--thb-/g' \
  -e 's/--color-nexus-/--color-thb-/g' \
  {} +

# Replace CSS class usage in templates: bg-nexus- → bg-thb-, text-nexus- → text-thb-, etc.
find src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i \
  -e 's/bg-nexus-/bg-thb-/g' \
  -e 's/text-nexus-/text-thb-/g' \
  -e 's/border-nexus-/border-thb-/g' \
  -e 's/from-nexus-/from-thb-/g' \
  -e 's/to-nexus-/to-thb-/g' \
  -e 's/via-nexus-/via-thb-/g' \
  -e 's/hover:bg-nexus-/hover:bg-thb-/g' \
  -e 's/hover:text-nexus-/hover:text-thb-/g' \
  -e 's/focus:border-nexus-/focus:border-thb-/g' \
  -e 's/focus:ring-nexus-/focus:ring-thb-/g' \
  -e 's/focus:bg-nexus-/focus:bg-thb-/g' \
  -e 's/active:bg-nexus-/active:bg-thb-/g' \
  -e 's/placeholder:text-nexus-/placeholder:text-thb-/g' \
  {} +

# Replace CSS class definitions in globals.css: .nexus- → .thb-
find src -type f -name "*.css" -exec sed -i \
  -e 's/\.nexus-card-hover/.thb-card-hover/g' \
  -e 's/\.nexus-card/.thb-card/g' \
  -e 's/\.nexus-badge-primary/.thb-badge-primary/g' \
  -e 's/\.nexus-badge-success/.thb-badge-success/g' \
  -e 's/\.nexus-badge-warning/.thb-badge-warning/g' \
  -e 's/\.nexus-badge-error/.thb-badge-error/g' \
  -e 's/\.nexus-badge-info/.thb-badge-info/g' \
  -e 's/\.nexus-badge-purple/.thb-badge-purple/g' \
  -e 's/\.nexus-badge/.thb-badge/g' \
  {} +

# Replace nexus-card, nexus-badge class usage in JSX
find src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i \
  -e 's/nexus-card-hover/thb-card-hover/g' \
  -e 's/nexus-card/thb-card/g' \
  -e 's/nexus-badge-primary/thb-badge-primary/g' \
  -e 's/nexus-badge-success/thb-badge-success/g' \
  -e 's/nexus-badge-warning/thb-badge-warning/g' \
  -e 's/nexus-badge-error/thb-badge-error/g' \
  -e 's/nexus-badge-info/thb-badge-info/g' \
  -e 's/nexus-badge-purple/thb-badge-purple/g' \
  -e 's/nexus-badge/thb-badge/g' \
  {} +

# Replace bg-nexus-background → bg-thb-background (used in layout.tsx etc)
find src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i \
  -e 's/nexus-background/thb-background/g' \
  -e 's/nexus-sidebar-bg/thb-sidebar-bg/g' \
  -e 's/nexus-sidebar-text/thb-sidebar-text/g' \
  -e 's/nexus-sidebar-active/thb-sidebar-active/g' \
  -e 's/nexus-sidebar-hover/thb-sidebar-hover/g' \
  -e 's/nexus-card-bg/thb-card-bg/g' \
  -e 's/nexus-border/thb-border/g' \
  -e 's/nexus-text-primary/thb-text-primary/g' \
  -e 's/nexus-text-secondary/thb-text-secondary/g' \
  -e 's/nexus-text-muted/thb-text-muted/g' \
  -e 's/nexus-primary-dark/thb-primary-dark/g' \
  -e 's/nexus-primary-light/thb-primary-light/g' \
  -e 's/nexus-accent-light/thb-accent-light/g' \
  -e 's/nexus-primary/thb-primary/g' \
  -e 's/nexus-accent/thb-accent/g' \
  -e 's/nexus-success/thb-success/g' \
  -e 's/nexus-warning/thb-warning/g' \
  -e 's/nexus-error/thb-error/g' \
  -e 's/nexus-info/thb-info/g' \
  {} +

echo "Phase 1 complete."

# ============================================================
# PHASE 2: Display text (Nexus → 3Boxes)
# ============================================================

echo "Phase 2: Replacing display text..."

# Nexus HRMS → 3Boxes HRMS (display text)
find src -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) -exec sed -i \
  -e 's/Nexus HRMS/3Boxes HRMS/g' \
  -e 's/Nexus AI/3Boxes AI/g' \
  -e 's/Nexus Predictive/3Boxes Predictive/g' \
  -e 's/Nexus SW/3Boxes SW/g' \
  -e 's/Nexus Service Worker/3Boxes Service Worker/g' \
  {} +

# Handle lowercase "nexus hrms" in strings  
find src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i \
  -e 's/nexus hrms/3boxes hrms/g' \
  -e 's/nexus-hrms/3boxes-hrms/g' \
  {} +

# Nexus as standalone brand word (careful not to hit variable names already changed)
# Only in visible strings/comments
find src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i \
  -e 's/"Nexus"/"3Boxes"/g' \
  -e "s/'Nexus'/'3Boxes'/g" \
  -e 's/`Nexus`/`3Boxes`/g' \
  {} +

# Comments
find src -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) -exec sed -i \
  -e 's/# Nexus /# 3Boxes /g' \
  -e 's/# Nexus$/# 3Boxes/g' \
  -e 's/\/\/ Nexus /\/\/ 3Boxes /g' \
  -e 's/\/\/ Nexus$/\/\/ 3Boxes/g' \
  {} +

echo "Phase 2 complete."

# ============================================================
# PHASE 3: localStorage keys
# ============================================================

echo "Phase 3: Replacing localStorage keys..."

find src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i \
  -e "s/nexus_welcomed/3boxes_welcomed/g" \
  -e "s/nexus_onboarding_completed/3boxes_onboarding_completed/g" \
  -e "s/nexus-onboarding/3boxes-onboarding/g" \
  -e "s/nexus-walkthrough/3boxes-walkthrough/g" \
  -e "s/nexus_tour/3boxes_tour/g" \
  -e "s/'nexus-/'3boxes-/g" \
  -e 's/"nexus-/"3boxes-/g' \
  {} +

echo "Phase 3 complete."

# ============================================================
# PHASE 4: Config files (package.json, manifest.json, sw.js)
# ============================================================

echo "Phase 4: Updating config files..."

# package.json
sed -i \
  -e 's/"name": "nexus-hrms"/"name": "3boxes-hrms"/g' \
  -e 's/Nexus HRMS/3Boxes HRMS/g' \
  package.json

# manifest.json
sed -i \
  -e 's/"name": "Nexus HRMS/"name": "3Boxes HRMS/g' \
  -e 's/"short_name": "Nexus HRMS"/"short_name": "3Boxes HRMS"/g' \
  -e 's/Nexus HRMS/3Boxes HRMS/g' \
  public/manifest.json

# Service worker
sed -i \
  -e 's/Nexus HRMS Service Worker/3Boxes HRMS Service Worker/g' \
  -e "s/nexus-hrms-v1/3boxes-hrms-v1/g" \
  -e 's/\[Nexus SW\]/[3Boxes SW]/g' \
  -e 's/Nexus SW/3Boxes SW/g' \
  public/sw.js

# layout.tsx metadata  
sed -i \
  -e 's/Nexus HRMS/3Boxes HRMS/g' \
  src/app/layout.tsx

echo "Phase 4 complete."

# ============================================================
# PHASE 5: Title/page titles in src/app
# ============================================================

echo "Phase 5: Updating page titles..."

# Page titles that use | Nexus HRMS format
find src/app -type f -name "page.tsx" -exec sed -i \
  -e 's/| Nexus HRMS/| 3Boxes HRMS/g' \
  -e 's/Nexus HRMS/3Boxes HRMS/g' \
  {} +

find src/app -type f -name "layout.tsx" -exec sed -i \
  -e 's/Nexus HRMS/3Boxes HRMS/g' \
  {} +

echo "Phase 5 complete."

# ============================================================
# PHASE 6: API routes and seed files
# ============================================================

echo "Phase 6: Updating API routes and seed files..."

find src/app/api -type f -name "*.ts" -exec sed -i \
  -e 's/Nexus HRMS/3Boxes HRMS/g' \
  -e 's/Nexus AI/3Boxes AI/g' \
  -e 's/nexus-hrms/3boxes-hrms/g' \
  {} +

find src/lib -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  -e 's/Nexus HRMS/3Boxes HRMS/g' \
  -e 's/Nexus AI/3Boxes AI/g' \
  -e 's/nexus-hrms/3boxes-hrms/g' \
  {} +

# Prisma seed
sed -i \
  -e 's/Nexus HRMS/3Boxes HRMS/g' \
  -e 's/nexus-hrms/3boxes-hrms/g' \
  prisma/seed-payroll.ts 2>/dev/null || true

# Store
sed -i \
  -e 's/Nexus HRMS/3Boxes HRMS/g' \
  -e 's/nexus-hrms/3boxes-hrms/g' \
  src/store/app-store.ts

# Middleware
sed -i \
  -e 's/Nexus HRMS/3Boxes HRMS/g' \
  -e 's/nexus-hrms/3boxes-hrms/g' \
  src/middleware.ts

echo "Phase 6 complete."

# ============================================================
# PHASE 7: Remaining "nexus" references in source
# ============================================================

echo "Phase 7: Catching remaining 'nexus' references in source..."

# Any remaining "Nexus" (capital N) in source code that's display text
find src -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) -exec sed -i \
  -e 's/Nexus/3Boxes/g' \
  {} +

# Remaining lowercase "nexus" in strings (careful with variable names)
# Only replace nexus in string contexts, not in already-changed thb- contexts
find src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i \
  -e 's/nexus-hrms/3boxes-hrms/g' \
  -e 's/nexus_/3boxes_/g' \
  {} +

echo "Phase 7 complete."

# ============================================================
# PHASE 8: CSS comment about brand colors
# ============================================================

echo "Phase 8: Updating CSS comments..."

sed -i \
  -e 's/Nexus HRMS Brand Colors/3Boxes HRMS Brand Colors/g' \
  -e 's/Nexus/3Boxes/g' \
  src/app/globals.css

echo "Phase 8 complete."

echo ""
echo "=== Rebrand Complete: Nexus HRMS → 3Boxes HRMS ==="
echo "Please verify the changes before committing."

