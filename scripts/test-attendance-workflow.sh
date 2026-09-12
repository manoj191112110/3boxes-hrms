#!/bin/bash
# E2E test — Attendance Workflow Engine (demo tenant)
set -e
BASE="http://localhost:3210"
SLUG="3boxes-hrms-demo"
AUTH() { echo -e "Content-Type: application/json\nAuthorization: Bearer $1\nx-tenant-slug: $SLUG"; }
# proper curl wrapper with separate header flags
cjson() { local T=$1; shift; curl -s -H "Content-Type: application/json" -H "Authorization: Bearer $T" -H "x-tenant-slug: $SLUG" "$@"; }

EMP_TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" -H "x-tenant-slug: $SLUG" -d '{"email":"amit.reddy@innovatech.demo","password":"MarqAI@2026"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
ADM_TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" -H "x-tenant-slug: $SLUG" -d '{"email":"admin@3boxeshrms.com","password":"MarqAI@2026"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
echo "tokens OK (emp ${EMP_TOKEN:0:12}… adm ${ADM_TOKEN:0:12}…)"

YESTERDAY=$(date -d "yesterday" +%F)
TODAY=$(date +%F)
TOMORROW=$(date -d "tomorrow" +%F)
OLD=$(date -d "12 days ago" +%F)

echo "══ 1. REGULARIZATION (within window) — expect 201, L2 HR auto-approved"
R1=$(cjson $EMP_TOKEN -X POST $BASE/api/attendance/requests -d "{\"requestType\":\"REGULARIZATION\",\"date\":\"$YESTERDAY\",\"punchType\":\"check_in\",\"requestedTime\":\"$YESTERDAY 09:05\",\"reason\":\"Biometric device glitch at gate\"}")
echo "$R1" | python3 -c "
import json,sys; d=json.loads(sys.stdin.read().strip() or '{}')
r=d.get('request') or {}
ap=d.get('approvals') or []
print('  status:', d.get('workflowStatus'), '| request.status:', r.get('status'), '| msg:', d.get('message'))
for a in ap: print('   L%s %s -> %s' % (a['level'], a['actorType'], a['status']))
print('  ERROR' if not d.get('request') else '')
"
RID1=$(echo "$R1" | python3 -c "import json,sys; print((json.load(sys.stdin).get('request') or {}).get('id',''))")

echo "══ 2. REGULARIZATION 12 days old — expect 422 window exceeded"
cjson $EMP_TOKEN -X POST $BASE/api/attendance/requests -d "{\"requestType\":\"REGULARIZATION\",\"date\":\"$OLD\",\"punchType\":\"check_out\",\"requestedTime\":\"$OLD 18:10\",\"reason\":\"old test\"}" | head -c 220; echo

echo "══ 3. WFH 1 day — expect 201 pending at L1 (HOD skipped: weeklyDays<=2)"
R3=$(cjson $EMP_TOKEN -X POST $BASE/api/attendance/requests -d "{\"requestType\":\"WFH\",\"startDate\":\"$TOMORROW\",\"endDate\":\"$TOMORROW\",\"reason\":\"Home internet + client calls\",\"remoteLocation\":\"Home\"}")
echo "$R3" | python3 -c "
import json,sys; d=json.loads(sys.stdin.read().strip() or '{}')
r=d.get('request') or {}
print('  status:', d.get('workflowStatus'), '| currentLevel:', r.get('currentLevel'), '| msg:', d.get('message'))
for a in (d.get('approvals') or []): print('   L%s %s -> %s' % (a['level'], a['actorType'], a['status']))
"
RID3=$(echo "$R3" | python3 -c "import json,sys; print((json.load(sys.stdin).get('request') or {}).get('id',''))")

echo "══ 4. GATE_PASS official — expect 201 (HR skipped for official)"
R4=$(cjson $EMP_TOKEN -X POST $BASE/api/attendance/requests -d "{\"requestType\":\"GATE_PASS\",\"subtype\":\"official\",\"date\":\"$TODAY\",\"departureTime\":\"15:00\",\"expectedReturn\":\"16:30\",\"destination\":\"Client office\",\"reason\":\"Client demo delivery\"}")
echo "$R4" | python3 -c "
import json,sys; d=json.loads(sys.stdin.read().strip() or '{}')
r=d.get('request') or {}
print('  status:', d.get('workflowStatus'), '| currentLevel:', r.get('currentLevel'))
for a in (d.get('approvals') or []): print('   L%s %s -> %s' % (a['level'], a['actorType'], a['status']))
"
RID4=$(echo "$R4" | python3 -c "import json,sys; print((json.load(sys.stdin).get('request') or {}).get('id',''))")

echo "══ 5. HOURLY_PERMISSION — expect 201 pending L1"
R5=$(cjson $EMP_TOKEN -X POST $BASE/api/attendance/requests -d "{\"requestType\":\"HOURLY_PERMISSION\",\"date\":\"$TOMORROW\",\"startTime\":\"11:00\",\"endTime\":\"12:00\",\"reason\":\"Doctor appointment\"}")
echo "$R5" | python3 -c "
import json,sys; d=json.loads(sys.stdin.read().strip() or '{}')
r=d.get('request') or {}
print('  status:', d.get('workflowStatus'), '| currentLevel:', r.get('currentLevel'), '| hours:', (r.get('payload') or {}).get('hours'))
for a in (d.get('approvals') or []): print('   L%s %s -> %s' % (a['level'], a['actorType'], a['status']))
"
RID5=$(echo "$R5" | python3 -c "import json,sys; print((json.load(sys.stdin).get('request') or {}).get('id',''))")

echo "══ 6. Admin inbox — expect to see pending requests"
cjson $ADM_TOKEN "$BASE/api/attendance/requests?scope=inbox" | python3 -c "
import json,sys; d=json.loads(sys.stdin.read().strip() or '{}')
print('  inbox count:', len(d.get('requests', [])))
for r in d.get('requests', []): print('   ', r['requestType'], r['id'][:10], r['status'])
"

echo "══ 7. Admin approves REGULARIZATION $RID1 — expect finalized + attendance updated"
cjson $ADM_TOKEN -X PATCH $BASE/api/attendance/requests/$RID1 -d '{"action":"approve","comments":"Verified with gate log"}' | python3 -c "
import json,sys; d=json.loads(sys.stdin.read().strip() or '{}')
print('  msg:', d.get('message'), '| final status:', (d.get('request') or {}).get('status'))
sa=(d.get('request') or {}).get('systemActions')
print('  systemActions:', (json.loads(sa)['actions'] if sa else 'NONE'))
"

echo "══ 8. Admin approves WFH $RID3 — expect finalized, attendance marked WFH"
cjson $ADM_TOKEN -X PATCH $BASE/api/attendance/requests/$RID3 -d '{"action":"approve","comments":"OK"}' | python3 -c "
import json,sys; d=json.loads(sys.stdin.read().strip() or '{}')
print('  msg:', d.get('message'), '| final status:', (d.get('request') or {}).get('status'))
sa=(d.get('request') or {}).get('systemActions')
print('  systemActions:', (json.loads(sa)['actions'][0][:90] if sa else 'NONE'))
"

echo "══ 9. Admin approves GATE_PASS $RID4 — expect QR issued"
cjson $ADM_TOKEN -X PATCH $BASE/api/attendance/requests/$RID4 -d '{"action":"approve"}' | python3 -c "
import json,sys; d=json.loads(sys.stdin.read().strip() or '{}')
r=d.get('request') or {}
print('  msg:', d.get('message'), '| status:', r.get('status'), '| qrToken:', r.get('qrToken'))
" 
QRT=$(cjson $ADM_TOKEN $BASE/api/attendance/requests/$RID4 | python3 -c "import json,sys; print(json.load(sys.stdin)['request'].get('qrToken') or '')")

echo "══ 10. Gate scan OUT then IN ($QRT)"
cjson $ADM_TOKEN -X POST $BASE/api/attendance/requests/gate-scan -d "{\"token\":\"$QRT\",\"scanType\":\"out\"}" | python3 -c "import json,sys; d=json.loads(sys.stdin.read().strip() or '{}'); print('  out:', d.get('message') or d.get('error'))"
cjson $ADM_TOKEN -X POST $BASE/api/attendance/requests/gate-scan -d "{\"token\":\"$QRT\",\"scanType\":\"in\"}" | python3 -c "import json,sys; d=json.loads(sys.stdin.read().strip() or '{}'); print('  in:', d.get('message') or d.get('error'), '| reconciliation:', d.get('reconciliation'))"

echo "══ 11. Admin approves PERMISSION $RID5"
cjson $ADM_TOKEN -X PATCH $BASE/api/attendance/requests/$RID5 -d '{"action":"approve"}' | python3 -c "
import json,sys; d=json.loads(sys.stdin.read().strip() or '{}')
print('  msg:', d.get('message'))
sa=(d.get('request') or {}).get('systemActions')
print('  systemActions:', (json.loads(sa)['actions'] if sa else 'NONE'))
"

echo "══ 12. SLA sweep (admin) — expect 0 processed"
cjson $ADM_TOKEN -X POST $BASE/api/attendance/workflow-config -d '{"action":"sla-sweep"}' | head -c 150; echo

echo "══ 13. Employee cancel own WFH-like request — create + cancel"
R13=$(cjson $EMP_TOKEN -X POST $BASE/api/attendance/requests -d "{\"requestType\":\"WFH\",\"startDate\":\"$TOMORROW\",\"reason\":\"Cancel test\"}")
RID13=$(echo "$R13" | python3 -c "import json,sys; print((json.load(sys.stdin).get('request') or {}).get('id',''))")
cjson $EMP_TOKEN -X PATCH $BASE/api/attendance/requests/$RID13 -d '{"action":"cancel"}' | head -c 120; echo

echo "══ 14. WFH 5-day (VP + HOD routing) — expect HOD+VP pending levels"
R14=$(cjson $EMP_TOKEN -X POST $BASE/api/attendance/requests -d "{\"requestType\":\"WFH\",\"startDate\":\"$TOMORROW\",\"endDate\":\"$(date -d '+6 days' +%F)\",\"reason\":\"Extended remote — family relocation\"}")
echo "$R14" | python3 -c "
import json,sys; d=json.loads(sys.stdin.read().strip() or '{}')
r=d.get('request') or {}
print('  status:', d.get('workflowStatus'), '| currentLevel:', r.get('currentLevel'))
for a in (d.get('approvals') or []): print('   L%s %s -> %s' % (a['level'], a['actorType'], a['status']))
" 
RID14=$(echo "$R14" | python3 -c "import json,sys; print((json.load(sys.stdin).get('request') or {}).get('id',''))")

echo "══ 15. Workflow config PUT (admin) — tighten regularization cap to 2"
cjson $ADM_TOKEN -X PUT $BASE/api/attendance/workflow-config -d "{\"requestType\":\"REGULARIZATION\",\"companyId\":null,\"levels\":[{\"actorType\":\"reporting_manager\",\"label\":\"Reporting Manager\",\"slaHours\":48,\"onSla\":\"auto_escalate\",\"skipIf\":null,\"autoApproveIf\":null}],\"rules\":{\"windowDays\":5,\"monthlyCap\":2,\"overCapAction\":\"review\",\"autoDeductThresholdHours\":0,\"autoDeductLeaveDays\":0.5,\"geoFencingEnabled\":false,\"allowedIps\":[],\"requireQrVerification\":true}}" | python3 -c "import json,sys; d=json.loads(sys.stdin.read().strip() or '{}'); print('  saved:', 'config' in d or d)"

echo "══ DONE ══"
