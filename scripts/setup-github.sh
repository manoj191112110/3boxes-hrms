#!/bin/bash
# NEXUS HRMS - GitHub Setup Script
# Run this script to push the project to GitHub

set -e

REPO_NAME="nexus-hrms"
REPO_DESC="Enterprise Multi-Company AI-Driven HRMS Platform - Next.js 16, TypeScript, Tailwind CSS, Prisma, AI-Powered"

echo "🚀 NEXUS HRMS - GitHub Setup"
echo "=============================="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo ""
    echo "Please install it first:"
    echo "  macOS: brew install gh"
    echo "  Linux: https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
    echo "  Windows: winget install GitHub.cli"
    echo ""
    echo "After installation, run: gh auth login"
    echo ""
    echo "Then create the repo manually at: https://github.com/new"
    echo "And push with:"
    echo "  git remote add origin https://github.com/YOUR_USERNAME/$REPO_NAME.git"
    echo "  git push -u origin main"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub."
    echo "Run: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI is authenticated."
echo ""

# Create the repository
echo "📦 Creating GitHub repository: $REPO_NAME"
gh repo create "$REPO_NAME" \
    --public \
    --description "$REPO_DESC" \
    --source=. \
    --push

echo ""
echo "✅ Repository created and code pushed!"
echo ""
echo "🌐 Repository URL: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo ""
echo "Next steps for Vercel deployment:"
echo "1. Go to https://vercel.com/new"
echo "2. Import the repository"
echo "3. Add environment variable: DATABASE_URL"
echo "4. Deploy!"
