#!/bin/bash
# Re-seed the demo site (nexus-hrms-mu.vercel.app) after the wipe.
# 1. Login as super admin  2. Run seed phases 1..6  3. Verify.
set -u
BASE="https://nexus-hrms-mu.vercel.app"

echo "=== 1. Login ==="
LOGIN=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"superadmin@3boxeshrms.com","password":"MarqAI@2026"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
if [ -z "$TOKEN" ]; then echo "LOGIN FAILED: $LOGIN"; exit 1; fi
echo "token acquired (${#TOKEN} chars)"

echo "=== 2. Seed phases ==="
RESET_FLAG="${RESET:-0}"
for PHASE in 1 2 3 4 5 6; do
  echo "--- phase $PHASE ---"
  EXTRA=""
  if [ "$RESET_FLAG" = "1" ] && [ "$PHASE" = "1" ]; then EXTRA="&reset=true"; fi
  RES=$(curl -s -X POST "$BASE/api/admin/seed-demo-full?phase=$PHASE$EXTRA" \
    -H "Authorization: Bearer $TOKEN" --max-time 120)
  echo "$RES" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    print('NON-JSON RESPONSE:', sys.stdin.read()[:300]); sys.exit(0)
if not d.get('success', True) and d.get('error'):
    print('ERROR:', d.get('error'), '|', d.get('details', ''))
r = d.get('report', {})
for k, v in r.items():
    if isinstance(v, dict):
        print(f\"  {k}: +{v.get('created',0)} skipped={v.get('skipped',0)}\" + (f\" note={v.get('note')}\" if v.get('note') else ''))
s = d.get('summary')
if s: print('  summary:', s)
m = d.get('message')
if m: print('  msg:', m[:160])
"
  sleep 2
done

echo "=== 3. Verify demo-credentials ==="
curl -s "$BASE/api/public/demo-credentials" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('site:', d.get('site'), '| hasAutoFill:', d.get('hasAutoFill'))
print('superAdmins:', len(d.get('superAdmins', [])), [u['email'] for u in d.get('superAdmins', [])])
print('tenantAdmins:', len(d.get('tenantAdmins', [])), [u['email'] for u in d.get('tenantAdmins', [])])
"
