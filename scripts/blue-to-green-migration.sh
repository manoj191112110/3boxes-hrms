#!/bin/bash
# Mass replace blue Tailwind classes with green/emerald equivalents across all TSX files
# This converts the entire UI from blue theme to green theme

cd /home/z/my-project/src

# Mapping of blue→green replacements:
# blue-50 → green-50
# blue-100 → green-100
# blue-200 → green-200
# blue-300 → green-300
# blue-400 → green-400  (most common for active text/icons)
# blue-500 → green-500  (most common for active bg, highlights)
# blue-600 → green-600  (buttons, strong accents)
# blue-700 → green-700  (dark text on light bg)
# blue-800 → green-800
# blue-900 → green-900

# Also handle opacity variants:
# blue-500/15 → green-500/15
# blue-500/20 → green-500/20
# blue-500/25 → green-500/25
# blue-500/30 → green-500/30
# blue-500/40 → green-500/40
# blue-500/50 → green-500/50

# Indigo/violet (used in WelcomeGreeting and some accents):
# indigo → emerald (or keep indigo in WelcomeGreeting since it's a welcome animation)

# We need to be careful with from-blue/via-blue/to-blue gradients
# from-blue-500 → from-green-500
# via-blue-500 → via-green-500  
# to-blue-500 → to-green-500

echo "Starting blue→green color migration..."

# Step 1: Replace all blue-xxx patterns with green-xxx
find . -name "*.tsx" -o -name "*.ts" | while read file; do
  # Skip landing pages (already green) and node_modules
  if [[ "$file" == *"node_modules"* ]]; then continue; fi
  
  # Replace blue color classes (handle all variants)
  sed -i \
    -e 's/blue-50/green-50/g' \
    -e 's/blue-100/green-100/g' \
    -e 's/blue-200/green-200/g' \
    -e 's/blue-300/green-300/g' \
    -e 's/blue-400/green-400/g' \
    -e 's/blue-500/green-500/g' \
    -e 's/blue-600/green-600/g' \
    -e 's/blue-700/green-700/g' \
    -e 's/blue-800/green-800/g' \
    -e 's/blue-900/green-900/g' \
    "$file"
done

# Step 2: Replace indigo-xxx → emerald-xxx (but NOT in WelcomeGreeting.tsx which uses it for the card animation)
find . -name "*.tsx" -o -name "*.ts" | while read file; do
  if [[ "$file" == *"node_modules"* ]]; then continue; fi
  if [[ "$file" == *"WelcomeGreeting"* ]]; then continue; fi  # Keep WelcomeGreeting indigo
  
  sed -i \
    -e 's/indigo-50/emerald-50/g' \
    -e 's/indigo-100/emerald-100/g' \
    -e 's/indigo-200/emerald-200/g' \
    -e 's/indigo-300/emerald-300/g' \
    -e 's/indigo-400/emerald-400/g' \
    -e 's/indigo-500/emerald-500/g' \
    -e 's/indigo-600/emerald-600/g' \
    -e 's/indigo-700/emerald-700/g' \
    -e 's/indigo-800/emerald-800/g' \
    -e 's/indigo-900/emerald-900/g' \
    "$file"
done

# Step 3: Replace violet-xxx → teal-xxx in non-WelcomeGreeting files
find . -name "*.tsx" -o -name "*.ts" | while read file; do
  if [[ "$file" == *"node_modules"* ]]; then continue; fi
  if [[ "$file" == *"WelcomeGreeting"* ]]; then continue; fi
  
  sed -i \
    -e 's/violet-50/teal-50/g' \
    -e 's/violet-100/teal-100/g' \
    -e 's/violet-200/teal-200/g' \
    -e 's/violet-300/teal-300/g' \
    -e 's/violet-400/teal-400/g' \
    -e 's/violet-500/teal-500/g' \
    -e 's/violet-600/teal-600/g' \
    -e 's/violet-700/teal-700/g' \
    -e 's/violet-800/teal-800/g' \
    -e 's/violet-900/teal-900/g' \
    "$file"
done

# Step 4: Replace purple-xxx → teal-xxx in non-WelcomeGreeting files
find . -name "*.tsx" -o -name "*.ts" | while read file; do
  if [[ "$file" == *"node_modules"* ]]; then continue; fi
  if [[ "$file" == *"WelcomeGreeting"* ]]; then continue; fi
  
  sed -i \
    -e 's/purple-50/teal-50/g' \
    -e 's/purple-100/teal-100/g' \
    -e 's/purple-200/teal-200/g' \
    -e 's/purple-300/teal-300/g' \
    -e 's/purple-400/teal-400/g' \
    -e 's/purple-500/teal-500/g' \
    -e 's/purple-600/teal-600/g' \
    -e 's/purple-700/teal-700/g' \
    -e 's/purple-800/teal-800/g' \
    -e 's/purple-900/teal-900/g' \
    "$file"
done

echo "Blue→Green migration complete!"
echo ""
echo "Verifying remaining blue references..."

# Count remaining blue references (should be minimal)
remaining=$(grep -r "blue-" --include="*.tsx" --include="*.ts" . | grep -v node_modules | wc -l)
echo "Remaining blue references: $remaining"

remaining_indigo=$(grep -r "indigo-" --include="*.tsx" --include="*.ts" . | grep -v node_modules | grep -v WelcomeGreeting | wc -l)
echo "Remaining indigo references (outside WelcomeGreeting): $remaining_indigo"
