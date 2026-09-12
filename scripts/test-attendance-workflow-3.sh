#!/bin/bash
# Continuation E2E #2 — gate pass QR at security level
BASE="http://localhost:3210"
SLUG="3boxes-hrms-demo"
cjson() { local T=$1; shift; curl -s -H "Content-Type: application/json" -H "Authorization: Bearer $T" -H "x-tenant-slug: $SLUG" "$@"; }

EMP_TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" -H "x-tenant-slug: $SLUG" -d '{"email":"amit.reddy@innovatech.demo","password":"MarqAI@2026"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
ADM_TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" -H "x-tenant-slug: $SLUG" -d '{"email":"admin@3boxeshrms.com","password":"MarqAI@2026"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
TODAY=$(date +%F)

echo "══ A. Old stuck pass — admin final-approve → fallback QR"
RID4=cmttoxn5a000ywjoe782bpbql
cjson $ADM_TOKEN -X PATCH $BASE/api/attendance/requests/$RID4 -d '{"action":"approve"}' | python3 -c "
import json,sys; d=json.load(sys.stdin)
r=d.get('request') or {}
print('  msg:', d.get('message'), '| status:', r.get('status'), '| QR:', r.get('qrToken'))"

echo "══ B. NEW personal gate pass — L1 approve → reaches security → QR issued immediately"
R=$(cjson $EMP_TOKEN -X POST $BASE/api/attendance/requests -d "{\"requestType\":\"GATE_PASS\",\"subtype\":\"personal\",\"date\":\"$TODAY\",\"departureTime\":\"16:00\",\"expectedReturn\":\"17:00\",\"destination\":\"Bank\",\"reason\":\"Personal bank work\"}")
RID=$(echo "$R" | python3 -c "import json,sys; print(json.load(sys.stdin)['request']['id'])")
cjson $ADM_TOKEN -X PATCH $BASE/api/attendance/requests/$RID -d '{"action":"approve"}' | python3 -c "
import json,sys; d=json.load(sys.stdin)
r=d.get('request') or {}
print('  after L1 approve:', d.get('message'), '| level:', r.get('currentLevel'), '| QR:', r.get('qrToken'))"

echo "══ C. Scan OUT + IN on the new pass"
QRT=$(cjson $ADM_TOKEN $BASE/api/attendance/requests/$RID | python3 -c "import json,sys; print((json.load(sys.stdin)['request'] or {}).get('qrToken') or '')")
echo "  token: $QRT"
cjson $ADM_TOKEN -X POST $BASE/api/attendance/requests/gate-scan -d "{\"token\":\"$QRT\",\"scanType\":\"out\"}" | python3 -c "import json,sys; d=json.load(sys.stdin); print('  out:', d.get('message') or d.get('error'))"
cjson $ADM_TOKEN -X POST $BASE/api/attendance/requests/gate-scan -d "{\"token\":\"$QRT\",\"scanType\":\"in\"}" | python3 -c "import json,sys; d=json.load(sys.stdin); print('  in:', d.get('message') or d.get('error'), '| recon:', d.get('reconciliation'))"
cjson $ADM_TOKEN $BASE/api/attendance/requests/$RID | python3 -c "
import json,sys; r=json.load(sys.stdin)['request']
print('  final status:', r.get('status'), '| minutes out:', (r.get('payload') or {}).get('totalMinutesOut'))
print('  timeline:', [(a['level'], a['actorType'], a['status']) for a in r.get('approvals', [])])"

echo "══ D. Double-scan guard — scan out again must fail"
cjson $ADM_TOKEN -X POST $BASE/api/attendance/requests/gate-scan -d "{\"token\":\"$QRT\",\"scanType\":\"out\"}" | python3 -c "import json,sys; d=json.load(sys.stdin); print('  guard:', d.get('error') or d.get('message'))"
echo "══ DONE ══"
