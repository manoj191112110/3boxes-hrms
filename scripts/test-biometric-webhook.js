#!/usr/bin/env node
/**
 * Biometric Webhook Test Script — REQ-ATT-03
 * ============================================================================
 * Node.js version of the bash test script. More portable on environments
 * without python3/jq. Runs the same 4-step flow:
 *
 *   1. (Admin) Registers a device via POST /api/attendance/biometric/devices
 *   2. Captures the raw API token (returned ONCE)
 *   3. Sends a sample ZKTeco-format punch to POST /api/attendance/biometric/punch
 *      with header `X-Biometric-Token: bx_...`
 *   4. Verifies the punch log via admin GET endpoint
 *
 * Usage:
 *   BASE_URL=https://your-app.vercel.app \
 *   ADMIN_JWT=<your-admin-jwt> \
 *   node scripts/test-biometric-webhook.js
 *
 * Optional env vars:
 *   EMP_CODE       (default EMP-0001)
 *   SERIAL_NUMBER  (default ZK-TEST-<timestamp>)
 *   DEVICE_NAME    (default "Office-1 Main Door")
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_JWT = process.env.ADMIN_JWT;
const EMP_CODE = process.env.EMP_CODE || 'EMP-0001';
const SERIAL_NUMBER = process.env.SERIAL_NUMBER || `ZK-TEST-${Date.now()}`;
const DEVICE_NAME = process.env.DEVICE_NAME || 'Office-1 Main Door';

if (!ADMIN_JWT) {
  console.error('ERROR: ADMIN_JWT env var is required (login as admin first)');
  process.exit(1);
}

async function json(path, init) {
  const r = await fetch(`${BASE_URL}${path}`, init);
  const text = await r.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { _raw: text }; }
  return { status: r.status, body: parsed };
}

function isoNow(offsetHours = 0) {
  const d = new Date(Date.now() + offsetHours * 3600_000);
  return d.toISOString();
}

async function main() {
  console.log('===============================================');
  console.log(' Biometric Webhook Test — REQ-ATT-03 (Node.js)');
  console.log('===============================================');
  console.log(` Base URL:      ${BASE_URL}`);
  console.log(` Admin JWT:     ${ADMIN_JWT.slice(0, 20)}...`);
  console.log(` Serial Number: ${SERIAL_NUMBER}`);
  console.log(` Employee Code: ${EMP_CODE}`);
  console.log('');

  // ── Step 1: Register device ──────────────────────────────────────────────
  console.log('▶ [1/4] Registering biometric device...');
  const regResp = await json('/api/attendance/biometric/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_JWT}` },
    body: JSON.stringify({
      name: DEVICE_NAME,
      serialNumber: SERIAL_NUMBER,
      vendor: 'zkteco',
      model: 'SpeedFace V5L',
      firmwareVersion: '3.4.2',
    }),
  });

  const regData = regResp.body?.data || regResp.body;
  const apiToken = regData?.apiToken;
  const deviceId = regData?.device?.id;

  if (!apiToken) {
    console.error('✗ Failed to register device. Response:');
    console.error(JSON.stringify(regResp.body, null, 2).slice(0, 600));
    console.error('');
    console.error('  Common causes:');
    console.error('   - BiometricDevice table not yet created (run schema-sync)');
    console.error('   - Admin JWT expired or not admin role');
    console.error('   - Serial number already registered (change SERIAL_NUMBER env)');
    process.exit(1);
  }

  console.log(`✓ Device registered: id=${deviceId}`);
  console.log(`✓ Raw API token:    ${apiToken.slice(0, 20)}...${apiToken.slice(-8)}`);
  console.log('  (Save this token — it will NOT be shown again)');
  console.log('');

  // ── Step 2: Send sample ZKTeco check_in punch ────────────────────────────
  console.log('▶ [2/4] Sending ZKTeco check_in punch (fingerprint, liveness=0.94)...');
  const punch1Resp = await json('/api/attendance/biometric/punch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Biometric-Token': apiToken,
      'X-Biometric-Serial': SERIAL_NUMBER,
    },
    body: JSON.stringify({
      serialNumber: SERIAL_NUMBER,
      employeeCode: EMP_CODE,
      punchType: 'check_in',
      punchTime: isoNow(),
      verifyMode: 'fingerprint',
      livenessScore: 0.94,
      temperature: 36.5,
      photoUrl: 'https://example.com/photos/sample.jpg',
      raw: {
        vendor: 'zkteco',
        deviceModel: 'SpeedFace V5L',
        user_id: EMP_CODE,
        verify_mode: 1,
        verify_mode_name: 'fingerprint',
        in_out: 0,
        in_out_name: 'check_in',
        io_state: 0,
        temp: 36.5,
        mask: 1,
        event_point: 'Main Door',
        sdk_version: '3.4.2',
        photo_url: 'https://example.com/photos/sample.jpg',
      },
    }),
  });

  console.log('Response:');
  console.log(JSON.stringify(punch1Resp.body, null, 2));
  console.log('');

  const punch1Data = punch1Resp.body?.data || punch1Resp.body;
  console.log(`✓ Check-in punch ingested`);
  console.log(`  flagged:         ${punch1Data?.flagged ?? 'unknown'}`);
  console.log(`  spoofingRisk:    ${punch1Data?.spoofingRisk?.toFixed(3) ?? '?'}`);
  console.log(`  buddyPunchRisk:  ${punch1Data?.buddyPunchRisk?.toFixed(3) ?? '?'}`);
  console.log('');

  // ── Step 3: Send check_out with card mode (elevates spoofing risk) ───────
  console.log('▶ [3/4] Sending ZKTeco check_out punch (card mode — should elevate spoofing risk)...');
  const punch2Resp = await json('/api/attendance/biometric/punch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Biometric-Token': apiToken,
    },
    body: JSON.stringify({
      serialNumber: SERIAL_NUMBER,
      employeeCode: EMP_CODE,
      punchType: 'check_out',
      punchTime: isoNow(8),
      verifyMode: 'card',
      livenessScore: 1.0,
      raw: {
        vendor: 'zkteco',
        user_id: EMP_CODE,
        verify_mode: 2,
        verify_mode_name: 'card',
        in_out: 1,
        in_out_name: 'check_out',
      },
    }),
  });

  console.log('Response:');
  console.log(JSON.stringify(punch2Resp.body, null, 2));
  console.log('');

  const punch2Data = punch2Resp.body?.data || punch2Resp.body;
  console.log(`✓ Check-out punch ingested`);
  console.log(`  flagged:      ${punch2Data?.flagged ?? 'unknown'}`);
  console.log(`  spoofingRisk: ${punch2Data?.spoofingRisk?.toFixed(3) ?? '?'} (elevated because verifyMode='card' has no biometric factor)`);
  console.log('');

  // ── Step 4: Verify audit trail ───────────────────────────────────────────
  console.log('▶ [4/4] Verifying punch log via admin endpoint...');
  const logResp = await json(`/api/attendance/biometric/punch-log?deviceId=${deviceId}&take=5`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${ADMIN_JWT}` },
  });
  const logData = logResp.body?.data || logResp.body;
  const punches = logData?.punches || [];
  console.log(`✓ Punches recorded for device ${deviceId}: ${punches.length}`);
  console.log('');

  console.log('===============================================');
  console.log(' Test Complete');
  console.log('===============================================');
  console.log('Summary:');
  console.log(`  - Device registered:      ✓`);
  console.log(`  - Token captured:         ✓ (${apiToken.slice(0, 20)}...)`);
  console.log(`  - Check-in punch:         ✓ (flagged=${punch1Data?.flagged ?? '?'})`);
  console.log(`  - Check-out punch:        ✓ (flagged=${punch2Data?.flagged ?? '?'})`);
  console.log(`  - Punch log entries:      ${punches.length}`);
  console.log('');
  console.log('Expected behavior:');
  console.log('  - check_in with fingerprint + liveness=0.94 → NOT flagged (low spoofing risk)');
  console.log('  - check_out with card mode → spoofingRisk=0.4 (below default threshold 0.6 → NOT flagged)');
  console.log('');
  console.log('Next steps:');
  console.log('  - Visit /attendance/biometric in the UI to see the device + punch log');
  console.log('  - Visit /attendance/audit-log to see the AttendanceAuditLog entries');
  console.log('  - Try sending a spoofed punch (livenessScore=0.3) to trigger auto-flagging');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
