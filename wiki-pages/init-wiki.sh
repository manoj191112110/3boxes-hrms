#!/bin/bash
# NEXUS HRMS Wiki Initialization Script
# Run this script to push all wiki pages to GitHub

set -e

REPO="maheshkpreddy/nexus-hrms"
WIKI_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Initializing NEXUS HRMS Wiki..."
echo ""
echo "⚠️  IMPORTANT: Before running this script, you must first create the first wiki page:"
echo "   1. Go to https://github.com/$REPO/wiki"
echo "   2. Click 'Create the first page' (or 'New Page')
echo "   3. Title it 'Home' and add any content
echo "   4. Click 'Save Page'
echo ""
read -p "Have you created the first wiki page? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please create the first wiki page first, then re-run this script."
    exit 1
fi

# Clone the wiki repository
echo "📥 Cloning wiki repository..."
TMP_DIR=$(mktemp -d)
git clone "https://github.com/$REPO.wiki.git" "$TMP_DIR/wiki"

# Copy all wiki pages
echo "📝 Copying wiki pages..."
cp "$WIKI_DIR"/*.md "$TMP_DIR/wiki/"

# Commit and push
cd "$TMP_DIR/wiki"
git config user.name "NEXUS HRMS Wiki Bot"
git config user.email "wiki@nexus-hrms.com"
git add -A
git commit -m "docs: add comprehensive wiki documentation for NEXUS HRMS

- Home: Welcome page with overview and navigation
- System-Architecture: Technical architecture, tech stack, three-tier design
- Getting-Started: Setup guide with prerequisites and installation
- API-Reference: Complete API docs with 26+ endpoints
- Database-Schema: All 24 models with relationships and Prisma reference
- Module-Guide: User guide for all 22+ modules
- Role-Based-Access: 14 user roles with permission matrix
- Troubleshooting: Common issues, solutions, and FAQ
- Training-Videos: 26 training videos with scripts and durations
- Development-Guidelines: Code style, patterns, Git workflow, testing"

git push origin master

# Cleanup
cd /
rm -rf "$TMP_DIR"

echo ""
echo "✅ Wiki pages pushed successfully!"
echo "🌐 Visit https://github.com/$REPO/wiki to view the wiki."
