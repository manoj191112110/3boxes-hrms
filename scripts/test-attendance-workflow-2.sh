#!/bin/bash
# Continuation E2E — fix verification (skip-resolved-levels in advanceWorkflow)
BASE="http://localhost:3210"
SLUG="3boxes-hrms-demo"
cjson() { local T=$1; shift; curl -s -H "Content-Type: application/json" -H "Authorization: Bearer $T" -H "x-tenant-slug: $SLUG" "$@"; }

EMP_TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" -H "x-tenant-slug: $SLUG" -d '{"email":"amit.reddy@innovatech.demo","password":"MarqAI@2026"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
ADM_TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" -H "x-tenant-slug: $SLUG" -d '{"email":"admin@3boxeshrms.com","password":"MarqAI@2026"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
TODAY=$(date +%F)

# Find the previously stuck requests by reason
RID1=$(cjson $EMP_TOKEN "$BASE/api/attendance/requests?scope=mine" | python3 -c "
import json,sys
d=json.load(sys.stdin)
m=[r for r in d['requests'] if r['requestType']=='REGULARIZATION' and r['status']=='pending']
print(m[0]['id'] if m else '')")
RID3=$(cjson $EMP_TOKEN "$BASE/api/attendance/requests?scope=mine" | python3 -c "
import json,sys
d=json.load(sys.stdin)
m=[r for r in d['requests'] if r['requestType']=='WFH' and r['status']=='pending' and (r.get('payload') or {}).get('remoteLocation')]
print(m[0]['id'] if m else '')")
RID4=$(cjson $EMP_TOKEN "$BASE/api/attendance/requests?scope=mine" | python3 -c "
import json,sys
d=json.load(sys.stdin)
m=[r for r in d['requests'] if r['requestType']=='GATE_PASS' and r['status']=='pending']
print(m[0]['id'] if m else '')")
RID14=$(cjson $EMP_TOKEN "$BASE/api/attendance/requests?scope=mine" | python3 -c "
import json,sys
d=json.load(sys.stdin)
m=[r for r in d['requests'] if r['requestType']=='WFH' and r['status']=='pending' and not (r.get('payload') or {}).get('remoteLocation')]
print(m[0]['id'] if m else '')")
echo "stuck ids: REG=$RID1 WFH=$RID3 GATE=$RID4 WFH5d=$RID14"

echo "══ A. Re-approve REGULARIZATION → expect finalized + attendance update"
cjson $ADM_TOKEN -X PATCH $BASE/api/attendance/requests/$RID1 -d '{"action":"approve","comments":"Verified"}' | python3 -c "
import json,sys; d=json.load(sys.stdin)
r=d.get('request') or {}
sa=r.get('systemActions')
print('  msg:', d.get('message'), '| final:', r.get('status'))
print('  actions:', json.loads(sa)['actions'] if sa else 'NONE')"

echo "══ B. Re-approve WFH (1-day) → expect finalized + 'Present - WFH'"
cjson $ADM_TOKEN -X PATCH $BASE/api/attendance/requests/$RID3 -d '{"action":"approve"}' | python3 -c "
import json,sys; d=json.load(sys.stdin)
r=d.get('request') or {}
sa=r.get('systemActions')
print('  msg:', d.get('message'), '| final:', r.get('status'))
print('  actions:', json.loads(sa)['actions'][0][:80] if sa else 'NONE')"

echo "══ C. Re-approve GATE_PASS → expect QR issued (L3 security pending)"
cjson $ADM_TOKEN -X PATCH $BASE/api/attendance/requests/$RID4 -d '{"action":"approve"}' | python3 -c "
import json,sys; d=json.load(sys.stdin)
r=d.get('request') or {}
print('  msg:', d.get('message'), '| status:', r.get('status'), '| currentLevel:', r.get('currentLevel'), '| QR:', r.get('qrToken'))"
QRT=$(cjson $ADM_TOKEN $BASE/api/attendance/requests/$RID4 | python3 -c "import json,sys; print((json.load(sys.stdin)['request'] or {}).get('qrToken') or '')")

echo "══ D. Gate scans OUT + IN ($QRT)"
cjson $ADM_TOKEN -X POST $BASE/api/attendance/requests/gate-scan -d "{\"token\":\"$QRT\",\"scanType\":\"out\"}" | python3 -c "import json,sys; d=json.load(sys.stdin); print('  out:', d.get('message') or d.get('error'))"
cjson $ADM_TOKEN -X POST $BASE/api/attendance/requests/gate-scan -d "{\"token\":\"$QRT\",\"scanType\":\"in\"}" | python3 -c "import json,sys; d=json.load(sys.stdin); print('  in:', d.get('message') or d.get('error'), '| recon:', d.get('reconciliation'))"
cjson $ADM_TOKEN $BASE/api/attendance/requests/$RID4 | python3 -c "import json,sys; r=json.load(sys.stdin)['request']; print('  final status:', r.get('status'), '| minutes out:', (r.get('payload') or {}).get('totalMinutesOut'))"

echo "══ E. 5-day WFH full chain: L1 mgr → L2 HOD → L3 VP → finalized"
L1RES=$(cjson $ADM_TOKEN -X PATCH $BASE/api/attendance/requests/$RID14 -d '{"action":"approve","comments":"Team coverage OK"}')
echo "$L1RES" | python3 -c "import json,sys; d=json.load(sys.stdin); print('  after L1:', d.get('message'))"
L2RES=$(cjson $ADM_TOKEN -X PATCH $BASE/api/attendance/requests/$RID14 -d '{"action":"approve","comments":"HOD signoff"}')
echo "$L2RES" | python3 -c "import json,sys; d=json.load(sys.stdin); print('  after L2:', d.get('message'))"
L3RES=$(cjson $ADM_TOKEN -X PATCH $BASE/api/attendance/requests/$RID14 -d '{"action":"approve","comments":"VP approved"}')
echo "$L3RES" | python3 -c "
import json,sys; d=json.load(sys.stdin)
r=d.get('request') or {}
sa=r.get('systemActions')
print('  after L3:', d.get('message'), '| final:', r.get('status'))
print('  actions:', json.loads(sa)['actions'][0][:80] if sa else 'NONE')"
cjson $ADM_TOKEN $BASE/api/attendance/requests/$RID14 | python3 -c "
import json,sys; r=json.load(sys.stdin)['request']
for a in r.get('approvals', []): print('   L%s %s -> %s (%s)' % (a['level'], a['actorType'], a['status'], a.get('comments') or '-'))"

echo "══ F. Inbox now — expect only the L3 security pass? (should be empty)"
cjson $ADM_TOKEN "$BASE/api/attendance/requests?scope=inbox" | python3 -c "
import json,sys; d=json.load(sys.stdin)
print('  inbox count:', len(d.get('requests', [])))"
echo "══ DONE ══"
