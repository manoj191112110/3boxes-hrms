#!/bin/bash
# Comprehensive rebranding and improvement script for Nexus HRMS
set -e

cd /home/z/my-project

echo "=== Step 1: Copy logo if not present ==="
if [ ! -f "public/marq-ai-logo.png" ]; then
  cp "upload/ChatGPT Image Apr 20, 2026, 07_36_46 PM.png" "public/marq-ai-logo.png"
  echo "Logo copied"
else
  echo "Logo already exists"
fi

echo "=== Step 2: Bulk find-and-replace in source files ==="

# Replace company names in all source files (excluding email domains which are functional)
find src -name "*.ts" -o -name "*.tsx" | while read f; do
  sed -i \
    -e 's/3 Boxes HRMS/Nexus HRMS/g' \
    -e 's/3Boxes HRMS/Nexus HRMS/g' \
    -e 's/3 Boxes Technologies/Marq AI Tech Pvt Ltd/g' \
    -e 's/3 Boxes Corp/Marq AI Tech Pvt Ltd/g' \
    -e 's/3 Boxes AI/Nexus AI/g' \
    -e "s/3 Boxes Predictive/Nexus Predictive/g" \
    -e "s/3Boxes Technologies/Marq AI Tech Pvt Ltd/g" \
    -e "s/3Boxes Corp/Marq AI Tech Pvt Ltd/g" \
    "$f"
done

echo "Source files updated"

# Update CSS comment
sed -i 's/3 Boxes HRMS Brand Colors/Nexus HRMS Brand Colors/g' src/app/globals.css

# Update package.json
sed -i 's/"name": "3boxes-hrms"/"name": "nexus-hrms"/g' package.json

# Update manifest.json
cat > public/manifest.json << 'MANIFEST'
{
  "name": "Nexus HRMS - AI-Powered Human Resource Management",
  "short_name": "Nexus HRMS",
  "description": "Nexus HRMS — People · Process · Technology. A Proud Product of Marq AI Tech Pvt Ltd. SaaS-Based AI HRMS Platform with AI-powered interviews, recruitment, payroll, and more.",
  "start_url": "/login",
  "display": "standalone",
  "background_color": "#0F172A",
  "theme_color": "#3B82F6",
  "orientation": "portrait-primary",
  "scope": "/",
  "lang": "en",
  "dir": "ltr",
  "categories": ["business", "productivity", "utilities"],
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "screenshots": [],
  "prefer_related_applications": false
}
MANIFEST

# Update service worker
sed -i \
  -e 's/3 Boxes HRMS Service Worker/Nexus HRMS Service Worker/g' \
  -e "s/3boxes-hrms-v1/nexus-hrms-v1/g" \
  -e "s/\[3 Boxes SW\]/[Nexus SW]/g" \
  public/sw.js

# Update SVG logos
cat > public/nexus-logo.svg << 'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" fill="none">
  <defs>
    <linearGradient id="nexusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3B82F6"/>
      <stop offset="50%" style="stop-color:#10B981"/>
      <stop offset="100%" style="stop-color:#8B5CF6"/>
    </linearGradient>
  </defs>
  <rect x="8" y="8" width="30" height="30" rx="6" fill="url(#nexusGrad)"/>
  <text x="14" y="30" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="22" font-weight="900" fill="white">N</text>
  <text x="48" y="28" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="20" font-weight="800" fill="#0F172A">Nexus</text>
  <text x="48" y="42" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#3B82F6" letter-spacing="2">HRMS</text>
</svg>
SVG

cat > public/nexus-logo-white.svg << 'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" fill="none">
  <defs>
    <linearGradient id="nexusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3B82F6"/>
      <stop offset="50%" style="stop-color:#10B981"/>
      <stop offset="100%" style="stop-color:#8B5CF6"/>
    </linearGradient>
  </defs>
  <rect x="8" y="8" width="30" height="30" rx="6" fill="url(#nexusGrad)"/>
  <text x="14" y="30" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="22" font-weight="900" fill="white">N</text>
  <text x="48" y="28" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="20" font-weight="800" fill="white">Nexus</text>
  <text x="48" y="42" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#93C5FD" letter-spacing="2">HRMS</text>
</svg>
SVG

echo "=== Step 2 complete: Bulk replacements done ==="
echo "Now run the Python script for detailed component-level changes"
