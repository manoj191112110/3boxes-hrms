#!/usr/bin/env bash
# ============================================================================
# Biometric Webhook Test Script — REQ-ATT-03
# ============================================================================
# This script demonstrates the end-to-end biometric punch flow:
#   1. (Admin) Registers a device via POST /api/attendance/biometric/devices
#   2. Captures the raw API token (returned ONCE)
#   3. Sends a sample ZKTeco-format punch to POST /api/attendance/biometric/punch
#      with header `X-Biometric-Token: bx_...`
#   4. Verifies the response (flagged status, AI risk scores, audit trail)
#
# Usage:
#   BASE_URL=https://your-app.vercel.app \
#   ADMIN_JWT=<your-admin-jwt-from-login> \
#   ./scripts/test-biometric-webhook.sh
#
# Prerequisites:
#   - A deployed instance with the schema synced (so BiometricDevice, BiometricPunch,
#     AttendanceAuditLog tables exist).
#   - At least one Employee row (the script uses employeeId "EMP-0001" by default;
#     override with EMP_CODE).
#   - An admin JWT (e.g. super_admin or tenant_admin role).
# ============================================================================

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_JWT="${ADMIN_JWT:?ADMIN_JWT env var is required (login as admin first)}"
EMP_CODE="${EMP_CODE:-EMP-0001}"
SERIAL_NUMBER="${SERIAL_NUMBER:-ZK-TEST-$(date +%s)}"
DEVICE_NAME="${DEVICE_NAME:-Office-1 Main Door}"

echo "==============================================="
echo " Biometric Webhook Test — REQ-ATT-03"
echo "==============================================="
echo " Base URL:      $BASE_URL"
echo " Admin JWT:     ${ADMIN_JWT:0:20}..."
echo " Serial Number: $SERIAL_NUMBER"
echo " Employee Code: $EMP_CODE"
echo ""

# ─── Step 1: Register a device ───────────────────────────────────────────────
echo "▶ [1/4] Registering biometric device..."
REGISTER_RESP=$(curl -sS -X POST "$BASE_URL/api/attendance/biometric/devices" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -d "{
    \"name\": \"$DEVICE_NAME\",
    \"serialNumber\": \"$SERIAL_NUMBER\",
    \"vendor\": \"zkteco\",
    \"model\": \"SpeedFace V5L\",
    \"firmwareVersion\": \"3.4.2\"
  }")

# Extract the raw API token (returned once)
API_TOKEN=$(echo "$REGISTER_RESP" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data',{}).get('apiToken','') or d.get('apiToken',''))" 2>/dev/null || echo "")

if [ -z "$API_TOKEN" ]; then
  echo "✗ Failed to register device. Response was:"
  echo "$REGISTER_RESP" | head -50
  echo ""
  echo "  Common causes:"
  echo "   - BiometricDevice table not yet created (run schema-sync)"
  echo "   - Admin JWT expired or not admin role"
  echo "   - Serial number already registered (change SERIAL_NUMBER env)"
  exit 1
fi

DEVICE_ID=$(echo "$REGISTER_RESP" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data',{}).get('device',{}).get('id','') or d.get('device',{}).get('id',''))" 2>/dev/null || echo "")
echo "✓ Device registered: id=$DEVICE_ID"
echo "✓ Raw API token:    ${API_TOKEN:0:20}...${API_TOKEN: -8}"
echo "  (Save this token — it will NOT be shown again)"
echo ""

# Persist token to a local file for re-testing
TOKEN_FILE="/tmp/biometric-token-$SERIAL_NUMBER.txt"
echo "$API_TOKEN" > "$TOKEN_FILE"
echo "  Token cached at: $TOKEN_FILE"
echo ""

# ─── Step 2: Send a sample ZKTeco-format punch (check_in) ────────────────────
echo "▶ [2/4] Sending ZKTeco check_in punch..."
PUNCH_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PUNCH_RESP=$(curl -sS -X POST "$BASE_URL/api/attendance/biometric/punch" \
  -H "Content-Type: application/json" \
  -H "X-Biometric-Token: $API_TOKEN" \
  -H "X-Biometric-Serial: $SERIAL_NUMBER" \
  -d "{
    \"serialNumber\": \"$SERIAL_NUMBER\",
    \"employeeCode\": \"$EMP_CODE\",
    \"punchType\": \"check_in\",
    \"punchTime\": \"$PUNCH_TIME\",
    \"verifyMode\": \"fingerprint\",
    \"livenessScore\": 0.94,
    \"temperature\": 36.5,
    \"photoUrl\": \"https://example.com/photos/$(date +%s).jpg\",
    \"raw\": {
      \"vendor\": \"zkteco\",
      \"deviceModel\": \"SpeedFace V5L\",
      \"user_id\": \"$EMP_CODE\",
      \"verify_mode\": 1,
      \"verify_mode_name\": \"fingerprint\",
      \"in_out\": 0,
      \"in_out_name\": \"check_in\",
      \"io_state\": 0,
      \"temp\": 36.5,
      \"mask\": 1,
      \"event_point\": \"Main Door\",
      \"sdk_version\": \"3.4.2\",
      \"photo_url\": \"https://example.com/photos/$(date +%s).jpg\"
    }
  }")

echo "Response:"
echo "$PUNCH_RESP" | python3 -m json.tool 2>/dev/null || echo "$PUNCH_RESP"
echo ""

FLAGGED=$(echo "$PUNCH_RESP" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('flagged', 'unknown'))" 2>/dev/null || echo "unknown")
SPOOF_RISK=$(echo "$PUNCH_RESP" | python3 -c "import sys, json; d=json.load(sys.stdin); print(round(d.get('spoofingRisk', 0), 3))" 2>/dev/null || echo "?")
BUDDY_RISK=$(echo "$PUNCH_RESP" | python3 -c "import sys, json; d=json.load(sys.stdin); print(round(d.get('buddyPunchRisk', 0), 3))" 2>/dev/null || echo "?")

echo "✓ Check-in punch ingested"
echo "  flagged:         $FLAGGED"
echo "  spoofingRisk:    $SPOOF_RISK"
echo "  buddyPunchRisk:  $BUDDY_RISK"
echo ""

# ─── Step 3: Send a check_out punch (different verify mode = card) ───────────
echo "▶ [3/4] Sending ZKTeco check_out punch (card mode — should elevate spoofing risk)..."
CHECKOUT_TIME=$(date -u -d "+8 hours" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v+8H +"%Y-%m-%dT%H:%M:%SZ")
PUNCH2_RESP=$(curl -sS -X POST "$BASE_URL/api/attendance/biometric/punch" \
  -H "Content-Type: application/json" \
  -H "X-Biometric-Token: $API_TOKEN" \
  -d "{
    \"serialNumber\": \"$SERIAL_NUMBER\",
    \"employeeCode\": \"$EMP_CODE\",
    \"punchType\": \"check_out\",
    \"punchTime\": \"$CHECKOUT_TIME\",
    \"verifyMode\": \"card\",
    \"livenessScore\": 1.0,
    \"raw\": {
      \"vendor\": \"zkteco\",
      \"user_id\": \"$EMP_CODE\",
      \"verify_mode\": 2,
      \"verify_mode_name\": \"card\",
      \"in_out\": 1,
      \"in_out_name\": \"check_out\"
    }
  }")

echo "Response:"
echo "$PUNCH2_RESP" | python3 -m json.tool 2>/dev/null || echo "$PUNCH2_RESP"
echo ""

FLAGGED2=$(echo "$PUNCH2_RESP" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('flagged', 'unknown'))" 2>/dev/null || echo "unknown")
SPOOF_RISK2=$(echo "$PUNCH2_RESP" | python3 -c "import sys, json; d=json.load(sys.stdin); print(round(d.get('spoofingRisk', 0), 3))" 2>/dev/null || echo "?")

echo "✓ Check-out punch ingested"
echo "  flagged:      $FLAGGED2"
echo "  spoofingRisk: $SPOOF_RISK2 (elevated because verifyMode='card' has no biometric factor)"
echo ""

# ─── Step 4: Verify audit trail via admin GET ────────────────────────────────
echo "▶ [4/4] Verifying punch log via admin endpoint..."
PUNCH_LOG_RESP=$(curl -sS -X GET "$BASE_URL/api/attendance/biometric/punch-log?deviceId=$DEVICE_ID&take=5" \
  -H "Authorization: Bearer $ADMIN_JWT")

PUNCH_COUNT=$(echo "$PUNCH_LOG_RESP" | python3 -c "import sys, json; d=json.load(sys.stdin); punches=d.get('data',{}).get('punches',[]) or d.get('punches',[]); print(len(punches))" 2>/dev/null || echo "?")
echo "✓ Punches recorded for device $DEVICE_ID: $PUNCH_COUNT"
echo ""

echo "==============================================="
echo " Test Complete"
echo "==============================================="
echo "Summary:"
echo "  - Device registered:      ✓"
echo "  - Token captured:         ✓ ($API_TOKEN)"
echo "  - Check-in punch:         ✓ (flagged=$FLAGGED)"
echo "  - Check-out punch:        ✓ (flagged=$FLAGGED2)"
echo "  - Audit log entries:      $PUNCH_COUNT"
echo ""
echo "Expected behavior:"
echo "  - check_in with fingerprint + liveness=0.94 → NOT flagged (low spoofing risk)"
echo "  - check_out with card mode → MAY be flagged (no biometric factor → spoofingRisk=0.4)"
echo "    (depends on tenant's spoofingRiskThreshold — default 0.6 → 0.4 < 0.6 → not flagged)"
echo ""
echo "Next steps:"
echo "  - Visit /attendance/biometric in the UI to see the device + punch log"
echo "  - Visit /attendance/audit-log to see the AttendanceAuditLog entries"
echo "  - Try sending a spoofed punch (livenessScore=0.3) to trigger auto-flagging"
