/**
 * 3Boxes HRMS — Seed SAMPLE CANDIDATE DATA (DEMO DATABASE ONLY)
 *
 * Adds rich sample candidates + applications + interviews + offers +
 * preboarding record + candidate portal users to tenant_3boxes-hrms-demo.
 * NEVER touches live (tenant_marqaitechgroup).
 *
 * Idempotent: skips rows that already exist (keyed by email / unique keys).
 *
 * Usage: node scripts/seed-demo-candidates.mjs
 */
import pg from 'pg';
import bcryptjs from 'bcryptjs';
import crypto from 'crypto';

const HOST = 'ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech';
const USER = 'neondb_owner';
const PASS = 'npg_pxZd8woKe4WB';
const DB = 'tenant_3boxes-hrms-demo'; // ← DEMO ONLY

const DEMO_PASSWORD = 'MarqAI@2026';
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (d) => new Date(now - d * DAY);
const daysAhead = (d) => new Date(now + d * DAY);

let cuidCounter = 0;
function cuid() {
  cuidCounter += 1;
  return `cm${now.toString(36)}${cuidCounter.toString(36)}${crypto.randomBytes(5).toString('hex')}`;
}
function accessToken() {
  return `off_${crypto.randomUUID().replace(/-/g, '')}${Date.now().toString(36)}`;
}
async function hash(pwd) {
  return bcryptjs.hash(pwd, await bcryptjs.genSalt(12));
}

const conn = new pg.Client({ host: HOST, user: USER, password: PASS, database: DB, ssl: { rejectUnauthorized: false } });
await conn.connect();

const results = { candidates: 0, applications: 0, interviews: 0, offers: 0, preboarding: 0, portalUsers: 0, passwordResets: 0 };

// ── 0. Resolve tenant + admin user + job postings (with company + department) ──
const tenant = (await conn.query(`SELECT id, slug FROM "Tenant" WHERE slug = '3boxes-hrms-demo'`)).rows[0];
if (!tenant) throw new Error('Demo tenant not found!');
console.log(`Tenant: ${tenant.name} (${tenant.slug})`);

const admin = (await conn.query(`SELECT id, email FROM "User" WHERE email = 'admin@3boxeshrms.com'`)).rows[0];

const postings = (await conn.query(`
  SELECT jp.id, jp.title, jp.position, jp.status, jp."departmentId",
         d.name AS dept_name, d."companyId", c.name AS company_name
  FROM "JobPosting" jp
  JOIN "Department" d ON d.id = jp."departmentId"
  JOIN "Company" c ON c.id = d."companyId"
  ORDER BY jp."postedDate" DESC`)).rows;

const postingByTitle = Object.fromEntries(postings.map((p) => [p.title, p]));
console.log('Job postings available:', postings.map((p) => `${p.title} @ ${p.company_name}`).join(' | '));

// ── 1. Reset employee demo passwords for consistent test credentials ──
const pwdHash = await hash(DEMO_PASSWORD);
for (const email of ['amit.reddy@innovatech.demo', 'meera.bansal@technova.demo', 'bala.mukherjee@innovatech.demo']) {
  const r = await conn.query(`UPDATE "User" SET password = $1 WHERE email = $2`, [pwdHash, email]);
  results.passwordResets += r.rowCount;
}
console.log(`Password resets: ${results.passwordResets}`);

// ── 2. Sample candidates ──
const CANDIDATES = [
  {
    firstName: 'Rohan', lastName: 'Iyer', email: 'rohan.iyer20@candidate.demo', phone: '+91 98200 11201',
    title: 'Senior Software Engineer', company: 'Zeta Systems', location: 'Bengaluru, KA',
    exp: 6, notice: 30, curCTC: 1200000, expCTC: 1800000,
    skills: 'React, Node.js, TypeScript, AWS, Microservices', qual: 'B.Tech', univ: 'VIT Vellore', grad: 2018,
    source: 'linkedin', status: 'shortlisted', match: 87, tags: '["react","frontend","immediate-joiner"]', category: 'engineering',
    posting: 'Senior Software Engineer', appStatus: 'screening', rating: 4,
    appliedDaysAgo: 18, expectedSalary: '18 LPA',
    coverLetter: 'Passionate about building scalable web platforms. Led a team of 4 engineers shipping a high-traffic e-commerce stack.',
    notes: 'Shortlisted after resume review — strong React + cloud background.',
  },
  {
    firstName: 'Divya', lastName: 'Nair', email: 'divya.nair21@candidate.demo', phone: '+91 99400 55211',
    title: 'Senior Backend Engineer', company: 'Infosys', location: 'Kochi, KL',
    exp: 7, notice: 60, curCTC: 1400000, expCTC: 2000000,
    skills: 'Python, Django, PostgreSQL, Docker, Kubernetes', qual: 'M.Tech', univ: 'NIT Calicut', grad: 2017,
    source: 'naukri', status: 'interviewing', match: 91, tags: '["python","backend"]', category: 'engineering',
    posting: 'Senior Software Engineer', appStatus: 'interview', rating: 5,
    appliedDaysAgo: 25, expectedSalary: '20 LPA',
    coverLetter: 'Backend specialist with deep experience in high-throughput payment systems and API design.',
    notes: null,
  },
  {
    firstName: 'Aravind', lastName: 'Menon', email: 'aravind.menon22@candidate.demo', phone: '+91 98111 33022',
    title: 'Financial Analyst', company: 'Deloitte', location: 'Chennai, TN',
    exp: 4, notice: 30, curCTC: 800000, expCTC: 1050000,
    skills: 'Financial Modeling, Excel, SQL, Power BI, FP&A', qual: 'MBA Finance', univ: 'Loyola College', grad: 2020,
    source: 'referral', status: 'offered', match: 84, tags: '["finance","referral-hire"]', category: 'finance',
    posting: 'Financial Analyst', appStatus: 'offered', rating: 4,
    appliedDaysAgo: 32, expectedSalary: '10.5 LPA',
    coverLetter: 'FP&A analyst experienced in budgeting cycles, variance analysis and board-level reporting.',
    notes: 'Offer sent via candidate portal — awaiting response.',
  },
  {
    firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma23@candidate.demo', phone: '+91 98660 77233',
    title: 'Product Manager', company: 'Swiggy', location: 'Hyderabad, TS',
    exp: 8, notice: 45, curCTC: 2600000, expCTC: 3400000,
    skills: 'Product Strategy, Agile, Roadmapping, SQL, A/B Testing', qual: 'MBA', univ: 'ISB Hyderabad', grad: 2016,
    source: 'linkedin', status: 'interviewing', match: 89, tags: '["product","leadership"]', category: 'product',
    posting: 'Product Manager', appStatus: 'interview', rating: 5,
    appliedDaysAgo: 21, expectedSalary: '34 LPA',
    coverLetter: 'Scaled two B2C products from 0 to 1M+ users. Data-driven PM with strong cross-functional leadership.',
    notes: null,
  },
  {
    firstName: 'Kabir', lastName: 'Singh', email: 'kabir.singh24@candidate.demo', phone: '+91 97000 88244',
    title: 'Sales Executive', company: 'BYJU\'S', location: 'Delhi, DL',
    exp: 3, notice: 15, curCTC: 550000, expCTC: 800000,
    skills: 'B2B Sales, CRM, Lead Generation, Negotiation', qual: 'B.Com', univ: 'Delhi University', grad: 2021,
    source: 'indeed', status: 'new', match: 72, tags: '["sales"]', category: 'sales',
    posting: 'Sales Executive', appStatus: 'applied', rating: 3,
    appliedDaysAgo: 4, expectedSalary: '8 LPA',
    coverLetter: 'Consistently exceeded quarterly targets — 130% of quota for the last 4 quarters.',
    notes: null,
  },
  {
    firstName: 'Anjali', lastName: 'Desai', email: 'anjali.desai25@candidate.demo', phone: '+91 98220 99255',
    title: 'HR Business Partner', company: 'TCS', location: 'Mumbai, MH',
    exp: 5, notice: 30, curCTC: 950000, expCTC: 1300000,
    skills: 'HRBP, Talent Management, Employee Relations, HRIS', qual: 'MBA HR', univ: 'NMIMS', grad: 2019,
    source: 'internal', status: 'screening', match: 81, tags: '["hrbp"]', category: 'human-resources',
    posting: 'HR Business Partner', appStatus: 'screening', rating: 4,
    appliedDaysAgo: 9, expectedSalary: '13 LPA',
    coverLetter: 'HRBP supporting 400+ engineering staff; ran annual comp cycles and org redesigns.',
    notes: null,
  },
  {
    firstName: 'Vikram', lastName: 'Rathore', email: 'vikram.rathore26@candidate.demo', phone: '+91 98330 44266',
    title: 'Operations Lead', company: 'Amazon', location: 'Pune, MH',
    exp: 9, notice: 60, curCTC: 2100000, expCTC: 2800000,
    skills: 'Operations, Lean Six Sigma, Vendor Management, SAP', qual: 'B.E.', univ: 'COEP Pune', grad: 2015,
    source: 'agency', status: 'new', match: 78, tags: '["operations","six-sigma"]', category: 'operations',
    posting: 'Operations Lead', appStatus: 'applied', rating: 3,
    appliedDaysAgo: 2, expectedSalary: '28 LPA',
    coverLetter: 'Green Belt certified; managed 3 fulfillment centers with 250+ associates.',
    notes: 'Sourced via TalentTrack agency.',
  },
  {
    firstName: 'Tanvi', lastName: 'Kulkarni', email: 'tanvi.kulkarni27@candidate.demo', phone: '+91 98450 66277',
    title: 'Senior Software Engineer', company: 'Flipkart', location: 'Bengaluru, KA',
    exp: 6, notice: 30, curCTC: 1500000, expCTC: 1750000,
    skills: 'Java, Spring Boot, Microservices, Kubernetes, Kafka', qual: 'B.Tech', univ: 'PES University', grad: 2018,
    source: 'referral', status: 'hired', match: 93, tags: '["java","backend","signed"]', category: 'engineering',
    posting: 'Senior Software Engineer', appStatus: 'hired', rating: 5,
    appliedDaysAgo: 45, expectedSalary: '17.5 LPA',
    coverLetter: 'Built Flipkart\'s catalog service handling 5k RPS peak. Excited to join a product-first team.',
    notes: 'Signed! Offer accepted — preboarding in progress.',
  },
];

const candidateIds = {};
for (const c of CANDIDATES) {
  const exists = await conn.query(`SELECT id FROM "Candidate" WHERE "tenantId" = $1 AND email = $2`, [tenant.id, c.email]);
  if (exists.rows.length) {
    candidateIds[c.email] = exists.rows[0].id;
    console.log(`  candidate exists, skip: ${c.email}`);
    continue;
  }
  const posting = postingByTitle[c.posting];
  if (!posting) throw new Error(`Posting not found: ${c.posting}`);
  const id = cuid();
  candidateIds[c.email] = id;
  await conn.query(
    `INSERT INTO "Candidate" (
       id, "tenantId", "companyId", "firstName", "lastName", email, phone,
       "currentJobTitle", "currentCompany", "currentLocation", "totalExperience", "noticePeriod",
       "currentCTC", "expectedCTC", currency, skills, "highestQualification", university, "graduationYear",
       source, "linkedinUrl", status, "aiMatchScore", tags, category,
       "consentGiven", "consentDate", "appliedAt", "hiredAt", "lastContactedAt", "nextFollowUpAt",
       "communicationCount", "recruiterId", "createdAt", "updatedAt"
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
       $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35
     )`,
    [
      id, tenant.id, posting.companyId, c.firstName, c.lastName, c.email, c.phone,
      c.title, c.company, c.location, c.exp, c.notice,
      c.curCTC, c.expCTC, 'INR', c.skills, c.qual, c.univ, c.grad,
      c.source, `https://linkedin.com/in/${c.firstName}.${c.lastName}`.toLowerCase(), c.status, c.match, c.tags, c.category,
      true, daysAgo(c.appliedDaysAgo), daysAgo(c.appliedDaysAgo),
      c.status === 'hired' ? daysAgo(15) : null,
      daysAgo(Math.max(1, c.appliedDaysAgo - 10)),
      ['new', 'screening'].includes(c.status) ? daysAhead(3) : null,
      Math.min(6, Math.max(1, Math.round(c.appliedDaysAgo / 6))),
      admin?.id ?? null,
      daysAgo(c.appliedDaysAgo), new Date(),
    ]
  );
  results.candidates += 1;
}
console.log(`Candidates inserted: ${results.candidates}`);

// ── 3. Job applications ──
const applicationIds = {};
for (const c of CANDIDATES) {
  const posting = postingByTitle[c.posting];
  const dup = await conn.query(
    `SELECT id FROM "JobApplication" WHERE "jobPostingId" = $1 AND "candidateEmail" = $2`,
    [posting.id, c.email]
  );
  if (dup.rows.length) {
    applicationIds[c.email] = dup.rows[0].id;
    continue;
  }
  const id = cuid();
  applicationIds[c.email] = id;
  await conn.query(
    `INSERT INTO "JobApplication" (
       id, "jobPostingId", "candidateId", "candidateName", "candidateEmail", "candidatePhone",
       "coverLetter", source, status, "appliedDate", rating, notes, "expectedSalary", "createdAt", "updatedAt"
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      id, posting.id, candidateIds[c.email], `${c.firstName} ${c.lastName}`, c.email, c.phone,
      c.coverLetter,
      c.source === 'naukri' ? 'job-portal' : c.source === 'agency' ? 'other' : c.source,
      c.appStatus, daysAgo(c.appliedDaysAgo), c.rating, c.notes, c.expectedSalary,
      daysAgo(c.appliedDaysAgo), new Date(),
    ]
  );
  results.applications += 1;
}
console.log(`Applications inserted: ${results.applications}`);

// ── 4. Interviews for interviewing / shortlisted applications ──
const INTERVIEWS = [
  { email: 'divya.nair21@candidate.demo', type: 'technical', status: 'completed', daysAhead: -3, duration: 60, interviewer: 'Karthik Raja (Engineering Manager)', score: 8, aiScore: 82, location: 'TechNova HQ — Meeting Room 1', meetingUrl: null, feedback: 'Excellent system design depth; strong on caching strategies and data modeling. Recommended: proceed to HR round.' },
  { email: 'divya.nair21@candidate.demo', type: 'hr', status: 'scheduled', daysAhead: 3, duration: 45, interviewer: 'Meera Bansal (HR)', score: null, aiScore: null, location: null, meetingUrl: 'https://meet.google.com/demo-hr-divya-nair', feedback: null },
  { email: 'priya.sharma23@candidate.demo', type: 'managerial', status: 'completed', daysAhead: -4, duration: 60, interviewer: 'Rahul Verma (Director of Product)', score: 7, aiScore: 78, location: null, meetingUrl: 'https://meet.google.com/demo-mgr-priya', feedback: 'Great product sense; roadmap prioritization was structured. Slightly light on B2B experience. Advance to final round.' },
  { email: 'priya.sharma23@candidate.demo', type: 'final', status: 'scheduled', daysAhead: 5, duration: 60, interviewer: 'CEO Panel', score: null, aiScore: null, location: 'Innovatech Systems — Board Room', meetingUrl: null, feedback: null },
  { email: 'rohan.iyer20@candidate.demo', type: 'technical', status: 'scheduled', daysAhead: 4, duration: 90, interviewer: 'Karthik Raja (Engineering Manager)', score: null, aiScore: null, location: 'TechNova HQ — Meeting Room 2', meetingUrl: null, feedback: null },
];
for (const iv of INTERVIEWS) {
  const appId = applicationIds[iv.email];
  if (!appId) continue;
  const dup = await conn.query(
    `SELECT id FROM "Interview" WHERE "jobApplicationId" = $1 AND type = $2 AND status = $3`,
    [appId, iv.type, iv.status]
  );
  if (dup.rows.length) continue;
  await conn.query(
    `INSERT INTO "Interview" (
       id, "jobApplicationId", type, date, time, duration, location, "meetingUrl",
       interviewer, status, feedback, score, "aiScore", "createdAt", "updatedAt"
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      cuid(), appId, iv.type,
      iv.daysAhead >= 0 ? daysAhead(iv.daysAhead) : daysAgo(-iv.daysAhead),
      iv.daysAhead >= 0 ? '11:00' : '15:30',
      iv.duration, iv.location, iv.meetingUrl,
      iv.interviewer, iv.status, iv.feedback, iv.score, iv.aiScore,
      new Date(), new Date(),
    ]
  );
  results.interviews += 1;
}
console.log(`Interviews inserted: ${results.interviews}`);

// ── 5. Offers ──
const OFFERS = [
  {
    email: 'aravind.menon22@candidate.demo', name: 'Aravind Menon', posting: 'Financial Analyst',
    salary: 1050000, joiningInDays: 30, status: 'sent', sentDaysAgo: 2, department: 'Finance',
    reportingTo: 'Head of Finance', probation: 90, mintToken: true,
  },
  {
    email: 'tanvi.kulkarni27@candidate.demo', name: 'Tanvi Kulkarni', posting: 'Senior Software Engineer',
    salary: 1750000, joiningInDays: 12, status: 'accepted', sentDaysAgo: 20, department: 'Engineering',
    reportingTo: 'Karthik Raja', probation: 90, mintToken: true,
    signature: 'Tanvi Kulkarni', signedDaysAgo: 15, esign: 'internal', approvedDaysAgo: 21,
  },
  {
    email: 'manish.malhotra3@candidate.demo', name: 'Manish Malhotra', posting: null, // resolve from existing application
    salary: 900000, joiningInDays: 25, status: 'approved', sentDaysAgo: null, department: null,
    reportingTo: null, probation: 90, mintToken: false, approvedDaysAgo: 1,
  },
  {
    email: 'rohan.iyer20@candidate.demo', name: 'Rohan Iyer', posting: 'Senior Software Engineer',
    salary: 1800000, joiningInDays: 35, status: 'draft', sentDaysAgo: null, department: 'Engineering',
    reportingTo: 'Karthik Raja', probation: 90, mintToken: false,
  },
];
const offerTokens = {};
for (const o of OFFERS) {
  const dup = await conn.query(`SELECT id FROM "Offer" WHERE "candidateEmail" = $1`, [o.email]);
  if (dup.rows.length) continue;

  let postingId = null;
  let position = null;
  let departmentId = null;
  if (o.posting) {
    position = o.posting;
    postingId = postingByTitle[o.posting]?.id ?? null;
    departmentId = postingByTitle[o.posting]?.departmentId ?? null;
  } else {
    // resolve from the candidate's existing application
    const appRow = (await conn.query(
      `SELECT a."jobPostingId", jp.title, jp."departmentId" FROM "JobApplication" a
       JOIN "JobPosting" jp ON jp.id = a."jobPostingId" WHERE a."candidateEmail" = $1 LIMIT 1`,
      [o.email]
    )).rows[0];
    if (appRow) { postingId = appRow.jobPostingId; position = appRow.title; departmentId = appRow.departmentId; }
  }
  if (!position) position = 'Team Member';

  const candidateRow = (await conn.query(`SELECT id FROM "Candidate" WHERE email = $1 AND "tenantId" = $2`, [o.email, tenant.id])).rows[0];
  const token = o.mintToken ? accessToken() : null;
  if (token) offerTokens[o.email] = token;

  await conn.query(
    `INSERT INTO "Offer" (
       id, "candidateId", "jobPostingId", "candidateName", "candidateEmail", position, department,
       "offeredSalary", "offeredCurrency", "joiningDate", "probationPeriod", "reportingTo",
       status, "approvedBy", "approvedAt", "sentAt", "respondedAt",
       "esignProvider", "candidateSignature", "candidateSignedAt", "accessToken", "createdAt", "updatedAt"
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
    [
      cuid(), candidateRow?.id ?? null, postingId, o.name, o.email, position, o.department,
      o.salary, 'INR', daysAhead(o.joiningInDays), o.probation, o.reportingTo,
      o.status,
      o.approvedDaysAgo != null ? (admin?.id ?? null) : null,
      o.approvedDaysAgo != null ? daysAgo(o.approvedDaysAgo) : null,
      o.sentDaysAgo != null ? daysAgo(o.sentDaysAgo) : null,
      o.status === 'accepted' || o.status === 'rejected' ? daysAgo(o.signedDaysAgo ?? 1) : null,
      o.esign ?? null, o.signature ?? null,
      o.signedDaysAgo != null ? daysAgo(o.signedDaysAgo) : null,
      token,
      new Date(), new Date(),
    ]
  );
  results.offers += 1;
}
console.log(`Offers inserted: ${results.offers}`);
for (const [email, token] of Object.entries(offerTokens)) {
  console.log(`  OFFER PORTAL LINK (${email}): https://nexus-hrms-mu.vercel.app/offer/${token}`);
}

// ── 6. Preboarding record for the accepted (hired) candidate ──
const tanviPosting = postingByTitle['Senior Software Engineer'];
const tanviOffer = (await conn.query(`SELECT id FROM "Offer" WHERE "candidateEmail" = 'tanvi.kulkarni27@candidate.demo' LIMIT 1`)).rows[0];
if (tanviOffer) {
  const dup = await conn.query(`SELECT id FROM "PreboardingCandidate" WHERE "candidateEmail" = 'tanvi.kulkarni27@candidate.demo'`);
  if (!dup.rows.length) {
    await conn.query(
      `INSERT INTO "PreboardingCandidate" (
         id, "candidateName", "candidateEmail", "candidatePhone", "jobTitle", "departmentId",
         "offeredSalary", currency, "offerDate", "joiningDate", notes, "offerId", status,
         "documentsUploaded", "backgroundCheckStatus", "backgroundCheckNotes", "createdAt", "updatedAt"
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        cuid(), 'Tanvi Kulkarni', 'tanvi.kulkarni27@candidate.demo', '+91 98450 66277',
        'Senior Software Engineer', tanviPosting?.departmentId ?? null,
        1750000, 'INR', daysAgo(21), daysAhead(12),
        'Referral hire — signed offer via candidate portal. Document collection underway.',
        tanviOffer.id, 'document_collection',
        JSON.stringify({ pan_card: null, aadhaar: null, bank_details: null, previous_payslips: null }),
        'in_progress', 'Vendor: AuthBridge — Standard package (ID + Address + Employment)',
        new Date(), new Date(),
      ]
    );
    results.preboarding += 1;
  }
}
console.log(`Preboarding records inserted: ${results.preboarding}`);

// ── 7. Candidate portal users (password login) for offer-portal testing ──
const PORTAL_USERS = [
  { email: 'aravind.menon22@candidate.demo', name: 'Aravind Menon' },
  { email: 'tanvi.kulkarni27@candidate.demo', name: 'Tanvi Kulkarni' },
];
const portalPwdHash = await hash(DEMO_PASSWORD);
for (const pu of PORTAL_USERS) {
  const dup = await conn.query(`SELECT id FROM "CandidatePortalUser" WHERE "candidateEmail" = $1`, [pu.email]);
  if (dup.rows.length) continue;
  await conn.query(
    `INSERT INTO "CandidatePortalUser" (id, "candidateEmail", "candidateName", "passwordHash", "passwordSetAt", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,NOW(),NOW(),NOW())`,
    [cuid(), pu.email, pu.name, portalPwdHash]
  );
  results.portalUsers += 1;
}
console.log(`Candidate portal users inserted: ${results.portalUsers}`);

// ── Summary ──
console.log('\n=== SEED SUMMARY (DEMO DB ONLY) ===');
console.log(JSON.stringify(results, null, 2));
console.log(`\nOffer portal links:`);
for (const [email, token] of Object.entries(offerTokens)) {
  console.log(`  ${email} -> /offer/${token}`);
}

await conn.end();
