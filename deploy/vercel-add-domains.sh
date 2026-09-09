#!/bin/bash
# ============================================================
# 3Boxes HRMS - Vercel Domain Setup Script
# ============================================================
# This script adds custom domains to your Vercel project.
#
# Usage:
#   bash deploy/vercel-add-domains.sh YOUR_VERCEL_TOKEN
#
# Get your token from: https://vercel.com/account/tokens
# ============================================================

set -e

if [ -z "$1" ]; then
  echo "❌ Error: Vercel token required"
  echo ""
  echo "Usage: bash deploy/vercel-add-domains.sh YOUR_VERCEL_TOKEN"
  echo ""
  echo "Get your token from: https://vercel.com/account/tokens"
  exit 1
fi

TOKEN="$1"
API="https://api.vercel.com"

# Find the project ID from the Vercel deployment
echo "🔍 Finding your Vercel project..."
PROJECTS=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/v9/projects?limit=100")
PROJECT_ID=$(echo "$PROJECTS" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for p in data.get('projects', []):
    if 'nexus-hrms' in p.get('name', '').lower() or '3boxes' in p.get('name', '').lower():
        print(p['id'])
        break
else:
    # Print first project if no match
    if data.get('projects'):
        print(data['projects'][0]['id'])
" 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Could not find your Vercel project."
  echo "   Make sure your token has access to the project."
  exit 1
fi

echo "✅ Found project ID: $PROJECT_ID"

# Get project name
PROJECT_NAME=$(echo "$PROJECTS" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for p in data.get('projects', []):
    if p['id'] == '$PROJECT_ID':
        print(p.get('name', 'unknown'))
        break
" 2>/dev/null)
echo "   Project name: $PROJECT_NAME"

# Function to add a domain
add_domain() {
  local DOMAIN="$1"
  echo ""
  echo "🌐 Adding domain: $DOMAIN"
  
  RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$DOMAIN\"}" \
    "$API/v10/projects/$PROJECT_ID/domains")
  
  # Check if it was added or already exists
  ERROR=$(echo "$RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if 'error' in data:
    print(data.get('message', data.get('error', 'Unknown error')))
elif 'bought' in data:
    print('BOUGHT')
else:
    print('OK')
" 2>/dev/null)
  
  if [ "$ERROR" = "OK" ] || [ "$ERROR" = "BOUGHT" ]; then
    echo "   ✅ Domain $DOMAIN added successfully"
  elif echo "$ERROR" | grep -qi "already exists\|already configured"; then
    echo "   ✅ Domain $DOMAIN already configured"
  else
    echo "   ⚠️  Domain $DOMAIN: $ERROR"
  fi
}

# Add main domain
add_domain "3boxeshrms.com"

# Add www redirect
add_domain "www.3boxeshrms.com"

# Try wildcard (requires Pro plan)
echo ""
echo "🌐 Adding wildcard domain: *.3boxeshrms.com"
echo "   (This requires Vercel Pro plan - $20/month)"
WILDCARD_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"*.3boxeshrms.com"}' \
  "$API/v10/projects/$PROJECT_ID/domains")

WILDCARD_ERROR=$(echo "$WILDCARD_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if 'error' in data:
    msg = data.get('message', data.get('error', 'Unknown error'))
    if 'wildcard' in msg.lower() or 'pro' in msg.lower() or 'plan' in msg.lower():
        print('NEEDS_PRO')
    else:
        print(msg)
else:
    print('OK')
" 2>/dev/null)

if [ "$WILDCARD_ERROR" = "OK" ]; then
  echo "   ✅ Wildcard domain *.3boxeshrms.com added (you have Pro plan)"
elif [ "$WILDCARD_ERROR" = "NEEDS_PRO" ]; then
  echo "   ⚠️  Wildcard domain needs Vercel Pro plan"
  echo "   Adding individual subdomain instead..."
  add_domain "marqaitechgroup.3boxeshrms.com"
else
  echo "   ⚠️  Wildcard: $WILDCARD_ERROR"
  echo "   Adding individual subdomain instead..."
  add_domain "marqaitechgroup.3boxeshrms.com"
fi

# Show DNS instructions
echo ""
echo "========================================"
echo "  DNS Configuration Required"
echo "========================================"
echo ""
echo "Add these records at your domain registrar:"
echo ""
echo "  Type    Name                Value"
echo "  ─────   ───────────────     ──────────────────────────"
echo "  A       @                   76.76.21.21"
echo "  CNAME   www                 cname.vercel-dns.com"
echo "  CNAME   marqaitechgroup     cname.vercel-dns.com"
if [ "$WILDCARD_ERROR" = "OK" ]; then
echo "  CNAME   *                   cname.vercel-dns.com"
fi
echo ""
echo "After adding DNS records, wait 5-30 minutes for propagation."
echo "Vercel will auto-provision SSL certificates."
echo ""
echo "Test URLs after DNS propagation:"
echo "  https://3boxeshrms.com"
echo "  https://marqaitechgroup.3boxeshrms.com"
echo ""
