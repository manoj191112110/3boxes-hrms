/**
 * Verify demo user passwords via bcryptjs. DEMO DB ONLY.
 * Usage: node scripts/verify-demo-passwords.mjs
 */
import pg from 'pg';
import bcryptjs from 'bcryptjs';

const HOST = 'ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech';
const USER = 'neondb_owner';
const PASS = 'npg_pxZd8woKe4WB';
const DB = 'tenant_3boxes-hrms-demo';

const CANDIDATE_PASSWORDS = ['MarqAI@2026', 'Password@123', 'Demo@2026', 'Admin@123', 'password123', '3boxes@2026', 'marqai@2026'];

const EMAILS = [
  'superadmin@3boxeshrms.com',
  'admin@3boxeshrms.com',
  'admin@marqaitechgroup.com',
  'amit.reddy@innovatech.demo',
  'bala.mukherjee@innovatech.demo',
  'meera.bansal@technova.demo',
];

const conn = new pg.Client({ host: HOST, user: USER, password: PASS, database: DB, ssl: { rejectUnauthorized: false } });
await conn.connect();

for (const email of EMAILS) {
  const res = await conn.query('SELECT email, password FROM "User" WHERE email = $1', [email]);
  if (!res.rows.length) { console.log(`${email}: NOT FOUND`); continue; }
  const pwhash = res.rows[0].password;
  let matched = null;
  for (const pwd of CANDIDATE_PASSWORDS) {
    if (await bcryptjs.compare(pwd, pwhash)) { matched = pwd; break; }
  }
  console.log(`${email}: ${matched ? 'MATCH -> ' + matched : 'NO MATCH among candidates'}`);
}
await conn.end();
