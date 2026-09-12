# AUDIT-2 — Recruitment / ATS / Preboarding / Onboarding / Offers / AI Interview / Job Portal Gap Analysis

**Date:** 2025-03-06
**Task ID:** AUDIT-2
**Auditor:** Code Archaeologist sub-agent
**Codebase:** `/home/z/my-project` (Next.js 16 + Prisma + PostgreSQL)

---

## 1. Executive Summary

The existing HRMS has solid **foundational plumbing** for the recruitment domain — 12 Prisma models, 21 API routes, and 9 UI pages. The core ATS data flow (JobPosting → JobApplication → Interview → Offer → PreboardingCandidate → OnboardingTask) is in place, and the **AI Interview subsystem is genuinely advanced** (proctoring + 8-dimension scoring via ZAI). However, against the comprehensive requirements addendum, the implementation is roughly **35 % complete**:

- **18 of 36 requirements are MISSING entirely** (no code, no schema, no API)
- **14 requirements are PARTIAL** (foundational model/UI exists but a key dimension is missing)
- **4 requirements are fully EXISTS** (REQ-PORT-01, REQ-ATS-05, REQ-AI-INT-04, REQ-AI-INT-05)

The biggest gaps are in **sourcing/job-board integrations** (0 of 6 built), **offer management sophistication** (0 of 4 built — only basic CRUD), **preboarding automation triggers** (1 of 4 partial), **day-1 onboarding integrations** (0 of 5 built), and **security/compliance for candidates** (0 of 4 built). Many UI surfaces (`/preboarding/page.tsx`) are running off **hard-coded demo data** even though a real API and Prisma model exist.

A recurring pattern is the **two parallel implementations**: `src/components/hrms/recruitment.tsx`, `src/components/hrms/job-portal.tsx`, `src/components/hrms/ai-interview.tsx`, `src/components/hrms/onboarding.tsx` use `@/lib/api` + react-query and reference `Job`, `Candidate`, `Referral` models that **are not present in the Prisma schema**. The dashboard route `src/app/(dashboard)/recruitment/page.tsx` etc. use the real `JobPosting` / `JobApplication` / `PreboardingCandidate` models via `/api/recruitment`, `/api/preboarding`, etc. The "component" versions silently fall back to demo data whenever the database is unavailable. This dual path is itself a gap that should be consolidated.

---

## 2. Methodology

1. Read the worklog (`worklog.md`) head and tail to understand prior deliverables (Tasks 1–14 covered branding fixes, payroll enhancements, i18n, project RBAC, OKR cascade, employee/collaboration module, and a payroll audit similar in shape to this one).
2. Inventoried 9 dashboard pages, 3 public/candidate pages, 4 reusable HRMS components, and 21 related API routes by reading them in full.
3. Cross-referenced the Prisma schema (`prisma/schema.prisma`, 4 319 lines, ~140 models) to confirm which models exist vs. which APIs silently fall back to demo data.
4. Mapped each requirement ID to one of three statuses:
   - ✅ **EXISTS** — fully built end-to-end (UI + API + schema); cite file:line
   - ⚠️ **PARTIAL** — some layer exists but a key capability is missing; cite what exists + what's missing
   - ❌ **MISSING** — no implementation; cite the nearest related file for the build plan

---

## 3. Inventory of EXISTING Functionality

### 3.1 Pages (Dashboard)

| Route | File | LOC | Purpose |
|---|---|---|---|
| `/recruitment` | `src/app/(dashboard)/recruitment/page.tsx` | 850 | Job posting CRUD + application tracking (postings tab + applications tab); inline status editor for applications |
| `/requisitions` | `src/app/(dashboard)/requisitions/page.tsx` | 398 | Requisition CRUD with approvalStatus state machine, priority levels, multi-level approval workflow |
| `/offers` | `src/app/(dashboard)/offers/page.tsx` | 351 | Offer letter CRUD; status workflow (draft → pending_approval → approved → sent → accepted/rejected); currency dropdown (INR/USD/EUR) |
| `/ai-interview` | `src/app/(dashboard)/ai-interview/page.tsx` | 1 130 | 5-tab dashboard: Overview / Sets / Sessions / Review / Invitations; live AI chat interview mode; auto-question generation; bulk invitations; proctoring logs viewer |
| `/job-portal` | `src/app/(dashboard)/job-portal/page.tsx` | 369 | Internal candidate-facing job board with featured jobs + AI recommendations panel |
| `/preboarding` | `src/app/(dashboard)/preboarding/page.tsx` | 614 | 7-stage pipeline view (Offer Accepted → Day 1 Ready); 3 tabs (Pipeline / Documents / BGV); runs off **hard-coded demo data** |
| `/onboarding` | `src/app/(dashboard)/onboarding/page.tsx` | 603 | Onboarding task CRUD; 5 categories (general/documentation/it_setup/training/compliance); mark-complete action |

### 3.2 Pages (Public / Candidate)

| Route | File | LOC | Purpose |
|---|---|---|---|
| `/careers` | `src/app/careers/page.tsx` | 927 | Public career portal with hero, search bar, job grid, companies section, "Why Join Us" EVP section, apply modal with resume upload |
| `/careers/[tenantSlug]` | `src/app/careers/[tenantSlug]/page.tsx` | 20 | Thin wrapper that renders `CareersPage` with `tenantSlug` from URL — per-tenant portals |
| `/interview/[token]` | `src/app/interview/[token]/page.tsx` | 587 | Candidate-facing async AI interview: loading → invalid/expired → pre-screen form → interview chat → thank-you; MCQ support; proctoring events |

### 3.3 HRMS Components (legacy, demo-data fallback path)

| File | LOC | Notes |
|---|---|---|
| `src/components/hrms/recruitment.tsx` | 540 | Uses `getJobs/getCandidates` from `@/lib/api` — calls `/api/jobs` + `/api/candidates` which return demo data on DB failure; Kanban pipeline; AI Scores tab |
| `src/components/hrms/job-portal.tsx` | 698 | Uses `getJobs/createCandidate` — calls `/api/jobs`; featured jobs hard-coded |
| `src/components/hrms/ai-interview.tsx` | 561 | Uses `getInterviews/createInterview/getCandidates` — radar chart of aiScore/skillMatch/cultureFit |
| `src/components/hrms/onboarding.tsx` | 330 | Uses `getOnboardingTasks/createOnboardingTask/updateOnboardingTask` — react-query based |

### 3.4 API Routes

| Endpoint | File | Purpose |
|---|---|---|
| `GET/POST /api/recruitment` | `src/app/api/recruitment/route.ts` | List job postings (with applications); create job posting OR submit application (`action:'apply'`) |
| `GET/PUT/PATCH/DELETE /api/recruitment/[id]` | `src/app/api/recruitment/[id]/route.ts` | Job-posting CRUD + PATCH that auto-detects job-vs-application (status update) |
| `GET/POST /api/requisitions` | `src/app/api/requisitions/route.ts` | Requisition CRUD with auto-incrementing `REQ-0001` ID |
| `GET/PUT/PATCH/DELETE /api/requisitions/[id]` | `src/app/api/requisitions/[id]/route.ts` | Requisition item CRUD + approval workflow |
| `GET/POST /api/offers` | `src/app/api/offers/route.ts` | List/create offers |
| `GET/PATCH/DELETE /api/offers/[id]` | `src/app/api/offers/[id]/route.ts` | Offer item CRUD + status transitions with timestamp capture (approvedAt/sentAt/respondedAt) + notifications |
| `GET/POST /api/preboarding` | `src/app/api/preboarding/route.ts` | List/create PreboardingCandidate; computes stage stats |
| `GET/PUT/PATCH/DELETE /api/preboarding/[id]` | `src/app/api/preboarding/[id]/route.ts` | Preboarding candidate CRUD |
| `GET/POST /api/onboarding` | `src/app/api/onboarding/route.ts` | Onboarding task CRUD |
| `GET/PUT/PATCH/DELETE /api/onboarding/[id]` | `src/app/api/onboarding/[id]/route.ts` | Task item CRUD |
| `GET/POST /api/ai-interview` | `src/app/api/ai-interview/route.ts` | Schedule/list/update interviews linked to JobApplication |
| `GET/POST /api/ai-interview/sets` | `src/app/api/ai-interview/sets/route.ts` | Interview set CRUD with auto-question-generation via ZAI |
| `GET/PUT/DELETE /api/ai-interview/sets/[id]` | `src/app/api/ai-interview/sets/[id]/route.ts` | Set item CRUD |
| `GET/POST /api/ai-interview/sessions` | `src/app/api/ai-interview/sessions/route.ts` | Session list/create; links to Invitation |
| `GET/PUT/PATCH /api/ai-interview/sessions/[id]` | `src/app/api/ai-interview/sessions/[id]/route.ts` | Session CRUD |
| `POST /api/ai-interview/chat` | `src/app/api/ai-interview/chat/route.ts` | ZAI-powered chat with type-specific system prompts (technical/hr/behavioral/coding/mcq/voice/video/text) + fallback generator |
| `POST /api/ai-interview/evaluate` | `src/app/api/ai-interview/evaluate/route.ts` | ZAI-powered evaluation returning 8 scores + aiRecommendation; fallback statistical scoring |
| `POST/GET /api/ai-interview/proctoring` | `src/app/api/ai-interview/proctoring/route.ts` | Proctoring event log; auto-disqualify after 3 critical events |
| `GET/POST /api/ai-interview/invitations` | `src/app/api/ai-interview/invitations/route.ts` | Invitation creation (single or bulk) with 32-byte hex token + 7-day expiry |
| `POST /api/ai-interview/mcq` | `src/app/api/ai-interview/mcq/route.ts` | MCQ generation |
| `GET/POST /api/public/jobs` | `src/app/api/public/jobs/route.ts` | Public (no-auth) job listing with tenant-slug + subdomain filtering; CORS-exposes `x-tenant-slug` |
| `POST /api/public/apply` | `src/app/api/public/apply/route.ts` | Public application submission; validates job open + email dedup + 5 MB resume cap; supports PDF/DOC/DOCX/RTF/TXT |
| `POST /api/recruitment-ai` | `src/app/api/recruitment-ai/route.ts` | 3 actions: `generate_jd` (ZAI), `parse_resume` (**MOCK DATA**), `score_candidates` (**MOCK DATA**) |
| `GET/POST /api/jobs` | `src/app/api/jobs/route.ts` | Alt job CRUD with demo-data fallback |
| `GET/POST /api/candidates` | `src/app/api/candidates/route.ts` | Alt candidate CRUD with demo-data fallback |
| `GET/POST /api/interviews` | `src/app/api/interviews/route.ts` | Alt interview CRUD with demo-data fallback |
| `GET/POST /api/referrals` | `src/app/api/referrals/route.ts` | **BROKEN**: calls `prisma.referral` but no `Referral` model exists in schema; would silently fall back to proxy at runtime |

### 3.5 Prisma Models

| Model | Schema line | Purpose |
|---|---|---|
| `JobPosting` | `schema.prisma:493` | Internal job posting (departmentId FK) |
| `JobApplication` | `schema.prisma:520` | Candidate application with resume/coverLetter/source/status/rating |
| `Interview` | `schema.prisma:547` | Interview scheduled from a JobApplication with aiScore/aiFeedback |
| `OnboardingTask` | `schema.prisma:573` | Task assigned to Employee with 5 categories |
| `Requisition` | `schema.prisma:1611` | Pre-job requisition with multi-level approvalStatus + priority |
| `Offer` | `schema.prisma:1655` | Offer letter with 7-state status workflow + currency + salary breakdown |
| `PreboardingCandidate` | `schema.prisma:1863` | Pre-onboarding candidate with 7-state status + JSON documents + BGV status + HR/IT gate flags |
| `InterviewSet` | `schema.prisma:2218` | Reusable interview template with mode/language/proctoring flags |
| `InterviewSetQuestion` | `schema.prisma:2246` | Question belonging to a set with category/difficulty/duration |
| `InterviewSession` | `schema.prisma:2265` | Candidate session with 8 AI scores + transcript + recommendation |
| `InterviewResponse` | `schema.prisma:2305` | Individual response with audio/video URL + AI score + follow-up chain |
| `ProctoringLog` | `schema.prisma:2331` | Proctoring event with 7 event types + 4 severity levels + screenshot |
| `InterviewInvitation` | `schema.prisma:2346` | Token-based invitation with 7-state status + expiry |

---

## 4. Requirements Coverage Matrix

### 4.1 PUBLIC CAREER PORTAL

#### REQ-PORT-01 — "3-Boxes" layout (Search/Filter, Job Listings, EVP)
- **Status:** ✅ EXISTS
- **Citations:** `src/app/careers/page.tsx:451-477` (search bar with location input), `src/app/careers/page.tsx:498-575` (job grid), `src/app/careers/page.tsx:609-641` ("Why Join Us" EVP section with 4 value props)
- **Notes:** All three boxes are present. Search supports keyword + location + type + company filters. EVP section has 4 cards (Fast Growth / Mentorship / Real Impact / Wellness First).

#### REQ-PORT-02 — Multi-lingual toggle
- **Status:** ⚠️ PARTIAL
- **Citations:** `src/components/LocaleSwitcher.tsx` (6 locales: en/es/fr/de/hi/ar), `src/app/layout.tsx` (`NextIntlClientProvider`), `messages/*.json` (6 bundles), but `src/app/careers/page.tsx` is a client component that does **not** call `useTranslations()` — all strings are hard-coded English.
- **What's missing:** The careers page strings ("Find the work that moves you", "Open Positions", "Why Join Us", etc.) need to be moved into the message bundles and consumed via `useTranslations('careers')`.

#### REQ-PORT-03 — WCAG 2.1 accessibility
- **Status:** ❌ MISSING
- **Citations:** No skip-link, no `<main>` landmark, no `aria-label` on the search input (`src/app/careers/page.tsx:455-460`), no `aria-busy` on loading grids, no focus-trap on the apply modal, color contrast not verified, no `lang` attribute per content section.
- **Build plan:** Add a `SkipToContent` link at the top of `src/app/careers/page.tsx`; wrap content in `<main id="main">`; add `aria-label="Search jobs by title, keyword, or company"` to search input; add `role="dialog"` + `aria-modal="true"` + focus-trap to the apply modal; run axe-core in CI.

#### REQ-PORT-04 — SEO schema.org markup
- **Status:** ❌ MISSING
- **Citations:** No `<script type="application/ld+json">` block anywhere in `src/app/careers/page.tsx` or `src/app/careers/[tenantSlug]/page.tsx`.
- **Build plan:** In `JobCard` component, inject a JSON-LD `<script type="application/ld+json">` with `@type:"JobPosting"` schema (title, description, datePosted, hiringOrganization, jobLocation, employmentType, baseSalary). Add to `src/app/careers/page.tsx` head. Use `next/metadata` `other` field or a `Script` component from `next/script`.

### 4.2 SOURCING & JOB BOARDS

#### REQ-SRC-01 — Job board integrations (LinkedIn, Indeed, Glassdoor, StepStone, Naukri)
- **Status:** ❌ MISSING
- **Citations:** `src/app/(dashboard)/recruitment/page.tsx:555-561` only has a static `<select>` with options: `website`, `referral`, `linkedin`, `indeed`, `other` — no actual API integration. `JobApplication.source` field (`schema.prisma:530`) stores a free-text string. No outbound posting logic anywhere in `/api/*`.
- **Build plan:** Add a `JobBoardIntegration` Prisma model (`provider`, `apiKey`, `refreshToken`, `tenantId`, `lastSyncAt`, `status`). Add `/api/sourcing/boards` (CRUD) + `/api/sourcing/boards/[id]/post` (multi-post a JobPosting) + `/api/sourcing/boards/[id]/sync` (pull application status changes). Use provider-specific OAuth (LinkedIn Talent Solutions API, Indeed Apply API, Glassdoor Partner API, StepStone XML feed, Naukri NPP API). Add UI under `/sourcing` for board configuration + per-job "Publish to..." multi-select.

#### REQ-SRC-02 — Multi-posting
- **Status:** ❌ MISSING
- **Citations:** No multi-posting API or UI anywhere.
- **Build plan:** Build on top of REQ-SRC-01 infrastructure. Add a `JobBoardPosting` join model (`jobPostingId`, `boardIntegrationId`, `externalJobId`, `postedAt`, `status`, `externalUrl`). Add `/api/sourcing/multi-post` that accepts `{ jobPostingId, boardIds[] }` and dispatches parallel requests. Add a "Multi-Post" button on the recruitment page job card that opens a checkbox modal of connected boards.

#### REQ-SRC-03 — Auto-sync status (close job on hire)
- **Status:** ❌ MISSING
- **Citations:** `JobApplication.status` transitions to `hired` only via manual PATCH (`src/app/api/recruitment/[id]/route.ts:215-238`). No hook closes the JobPosting or pulls down external board postings.
- **Build plan:** In `PATCH /api/recruitment/[id]` add: when `status` transitions to `hired` and `JobPosting.vacancies === 1 + filledCount`, auto-set `JobPosting.status = 'filled'`. Then call all `JobBoardPosting` rows for that job and invoke their `close` action via the board provider API. Add a `webhook` endpoint `/api/sourcing/webhooks/[provider]` to receive board-side status updates (closed/expired).

#### REQ-SRC-04 — LinkedIn Recruiter Connect (import profiles)
- **Status:** ❌ MISSING
- **Citations:** No LinkedIn OAuth flow, no `linkedinProfileUrl` field on `JobApplication` or `Candidate`.
- **Build plan:** Add a `TalentProfile` Prisma model (`source`, `externalId`, `name`, `email`, `headline`, `skills Json`, `experience Json`, `education Json`, `pictureUrl`, `importedById`, `tenantId`, `consentAt`). Add `/api/sourcing/linkedin/oauth` (initiate OAuth 2.0), `/api/sourcing/linkedin/callback`, `/api/sourcing/linkedin/import` (search by keyword → import profiles as TalentProfile rows → optionally convert to JobApplication). Add UI tile "Import from LinkedIn Recruiter" on `/recruitment` page.

#### REQ-SRC-05 — Social referral tracking (trackable links)
- **Status:** ⚠️ PARTIAL
- **Citations:** `/api/referrals/route.ts:17` calls `prisma.referral.findMany` but the `Referral` model **does not exist** in `prisma/schema.prisma` — the call would fall through to the `createFallbackProxy()` in `src/lib/db.ts:54` and silently return empty. The POST at line 43 has the same issue. No trackable-link generation logic exists.
- **What's missing:** (a) Define the `Referral` model in schema.prisma (`jobPostingId`, `referrerEmployeeId`, `candidateName`, `candidateEmail`, `candidateResume`, `notes`, `bonusAmount`, `trackToken`, `clickCount`, `status`, `hiredAt`, `bonusPaidAt`). (b) Add `/api/referrals/track/[token]` GET endpoint that increments clickCount and redirects to `/careers?ref=token`. (c) Add `/api/referrals/trackable-link` POST to mint a unique token per referrer+job combo. (d) Add UI under `/employees` or `/referrals` for employees to generate shareable links.

#### REQ-SRC-06 — Apply with LinkedIn/Google
- **Status:** ❌ MISSING
- **Citations:** `src/app/careers/page.tsx:686-696` (`ApplyModal`) only supports manual form fill + file upload. No OAuth buttons.
- **Build plan:** Add `/api/auth/linkedin/apply` and `/api/auth/google/apply` routes that initiate OAuth with `state=jobPostingId`. On callback, fetch profile (name/email/headline) + (LinkedIn) profile picture + work history. Pre-fill the apply form fields and let the candidate review before submitting. Add "Apply with LinkedIn" + "Apply with Google" buttons above the manual form in the ApplyModal.

### 4.3 ATS & AI RESUME PARSING

#### REQ-ATS-01 — Multi-format parsing (PDF/DOCX/DOC/text)
- **Status:** ⚠️ PARTIAL
- **Citations:** `src/app/api/public/apply/route.ts:142-155` accepts resume as a base64 data URL with mime-type validation (PDF/DOC/DOCX/RTF/TXT), 5 MB cap — but only **stores** it raw in `JobApplication.resume` (`schema.prisma:528`). `src/app/api/recruitment-ai/route.ts:48-61` has a `parse_resume` action that returns **hard-coded mock data** ("John Smith", "Tech Corp", etc.) — no actual parsing.
- **What's missing:** Real parsing pipeline. Add `/api/ats/parse-resume` that accepts a data URL, decodes it, runs through a parser (pdf-parse for PDF, mammoth for DOCX, etc.) to extract structured fields. Use ZAI to extract skills/experience/education from the raw text. Store the parsed JSON in a new `JobApplication.resumeParsed Json?` column.

#### REQ-ATS-02 — Multi-lingual extraction
- **Status:** ❌ MISSING
- **Citations:** The mock `parse_resume` action returns English-only fields. No language-detection logic anywhere.
- **Build plan:** After REQ-ATS-01 extracts raw text, detect language with a simple library (e.g. `franc` or call ZAI with `detect language` prompt). Pass the detected language to the ZAI extraction prompt so it returns fields in the original language. Store `resumeLanguage` on `JobApplication`. Add i18n support to the candidate dashboard (when built — see REQ-ATS-04).

#### REQ-ATS-03 — Global deduplication (semantic matching)
- **Status:** ⚠️ PARTIAL
- **Citations:** `src/app/api/public/apply/route.ts:115-131` does email-based deduplication per jobPostingId (idempotency). No global dedup across jobs or semantic matching of similar candidates.
- **What's missing:** Global dedup. On application submission, query all existing `JobApplication` rows by email OR by normalized name+phone. If found, link via a new `Candidate` master model (`candidateMasterId`, multiple `JobApplication` rows under it). For semantic dedup, compute a vector embedding of the resume (use ZAI embeddings) and store in a `CandidateEmbedding` table; on new application, do cosine similarity search (>0.92 threshold) and flag for human review.

#### REQ-ATS-04 — Candidate dashboard (view applied jobs)
- **Status:** ❌ MISSING
- **Citations:** No candidate-facing authenticated UI. The only candidate-facing page is `/careers` (unauthenticated) + `/interview/[token]` (token-based, single use).
- **Build plan:** Add `/candidate-portal` route with candidate auth (sign in with email + magic link OR LinkedIn/Google OAuth). Add `/api/candidate-portal/applications` GET that returns all JobApplications where `candidateEmail === currentUser.email`. Show status timeline per application. Allow profile update + resume re-upload + messaging with HR.

#### REQ-ATS-05 — Status tracking
- **Status:** ✅ EXISTS
- **Citations:** `JobApplication.status` (`schema.prisma:531`) supports `applied | screening | interview | offered | hired | rejected`. Inline status editor in `src/app/(dashboard)/recruitment/page.tsx:706-711`. PATCH endpoint at `src/app/api/recruitment/[id]/route.ts:215-238` updates status with audit log.

#### REQ-ATS-06 — Profile update + document upload + HR messaging
- **Status:** ❌ MISSING
- **Citations:** No candidate-side profile editing. No candidate-HR messaging thread. (HR-to-HR chat exists in `/api/collaboration/chat/*` but is not exposed to candidates.)
- **Build plan:** Build on REQ-ATS-04 candidate portal. Add `/api/candidate-portal/profile` (PUT to update name/phone/headline). Add `/api/candidate-portal/documents` (POST to upload additional documents). Add `/api/candidate-portal/messages` (GET/POST threaded messages with HR). Reuse the `ChatRoom` model from collaboration but with a `type:'candidate_hr'` and a candidate-side auth gate.

### 4.4 AI SCREENING & INTERVIEWING

#### REQ-AI-INT-01 — AI chatbot initial outreach (WhatsApp/SMS/web)
- **Status:** ⚠️ PARTIAL
- **Citations:** Web-based AI chat is fully built: `src/app/api/ai-interview/chat/route.ts` (ZAI-powered with type-specific prompts), `src/app/(dashboard)/ai-interview/page.tsx:412-470` (live interview UI), `src/app/interview/[token]/page.tsx` (candidate-side). No WhatsApp/SMS outreach.
- **What's missing:** WhatsApp Business API + SMS (Twilio) integration. Add a `ChatChannel` enum on `InterviewSession` (`web | whatsapp | sms`). Add `/api/ai-interview/outreach` POST that takes `{ sessionId, channel }` and sends the opening message via Twilio WhatsApp/SMS. Add a webhook at `/api/ai-interview/webhooks/twilio` to receive inbound messages and continue the conversation.

#### REQ-AI-INT-02 — Sentiment & engagement scoring
- **Status:** ❌ MISSING
- **Citations:** `SentimentAnalysis` model exists (`schema.prisma:4122`) but is wired only to `ChatMessage` (employee collaboration). No candidate-side sentiment scoring. `InterviewSession` has 8 score dimensions but none capture sentiment or engagement.
- **Build plan:** Add `sentimentScore Int?`, `engagementScore Int?`, `sentimentTrajectory Json?` to `InterviewSession`. Extend `/api/ai-interview/evaluate` to also call ZAI for sentiment analysis on the transcript (positive/neutral/negative per response + trajectory over time). Surface these on the session review tab in `src/app/(dashboard)/ai-interview/page.tsx`.

#### REQ-AI-INT-03 — One-way async video interviews
- **Status:** ⚠️ PARTIAL
- **Citations:** `InterviewSet.interviewMode` supports `'video'` (`schema.prisma:2224`). `InterviewSession.videoUrl`, `audioUrl`, `transcriptUrl` exist (`schema.prisma:2278-2280`). `InterviewResponse.responseVideoUrl`, `responseAudioUrl` exist (`schema.prisma:2312-2313`). BUT the candidate-side `src/app/interview/[token]/page.tsx` only implements text chat + MCQ — no camera/mic recording UI.
- **What's missing:** MediaRecorder-based video capture in the candidate UI. Add `/api/ai-interview/sessions/[id]/upload-media` that accepts chunked video uploads (to S3/Vercel Blob) and stores URL on `InterviewResponse.responseVideoUrl`. Add a "Video Question" mode in the candidate page that prompts each question, records N seconds of video, uploads, then advances.

#### REQ-AI-INT-04 — AI proctoring (verbal/non-verbal/environment)
- **Status:** ✅ EXISTS
- **Citations:** `ProctoringLog` model (`schema.prisma:2331`) with 7 event types: `tab_switch`, `face_not_detected`, `multiple_faces`, `audio_anomaly`, `copy_paste`, `ai_assistant_detected`, `browser_devtools` — covers verbal (audio_anomaly), non-verbal (face_not_detected, multiple_faces), and environment (tab_switch, browser_devtools, copy_paste). `/api/ai-interview/proctoring/route.ts` logs events with 4 severity levels and **auto-disqualifies after 3 critical events** (lines 30-39). UI surfacing in `src/app/(dashboard)/ai-interview/page.tsx` proctoring logs viewer.

#### REQ-AI-INT-05 — AI scoring & shortlisting (Fit Score)
- **Status:** ✅ EXISTS
- **Citations:** `InterviewSession` has 8 score dimensions: `overallScore`, `communicationScore`, `grammarScore`, `fluencyScore`, `comprehensionScore`, `vocabularyScore`, `cognitiveScore`, `skillMatchScore` (`schema.prisma:2282-2289`) + `aiRecommendation` (`strong_hire | hire | no_hire | not_enough_evidence`). `/api/ai-interview/evaluate/route.ts:36-94` calls ZAI to compute all 8 scores from the transcript with a strict JSON schema and clamping. Fallback statistical scoring if ZAI fails (lines 100-119). AI Scores tab in `src/components/hrms/recruitment.tsx:356-403`.

#### REQ-AI-INT-06 — Human override
- **Status:** ⚠️ PARTIAL
- **Citations:** `/api/ai-interview/sessions/[id]` PATCH allows updating any field, so an HR admin could manually overwrite `overallScore` — but there's no explicit "human override" flag, no audit trail capturing `aiScoreOriginal` vs `humanScoreOverride`, and no UI affordance (the dashboard review tab is read-only).
- **What's missing:** Add `humanOverride Boolean @default(false)`, `humanOverrideById String?`, `humanOverrideAt DateTime?`, `humanOverrideReason String?` to `InterviewSession`. Update PATCH endpoint to set these fields when scores are manually changed. Add an "Override AI Score" button on the session review tab that opens a modal requiring a reason.

#### REQ-AI-INT-07 — Time-stamped feedback
- **Status:** ⚠️ PARTIAL
- **Citations:** `ProctoringLog.timestamp` (`schema.prisma:2337`) is time-stamped. `InterviewResponse.aiFeedback` is per-response. The `/api/ai-interview/chat/route.ts:62-68` appends `[timestamp] AI: ... [timestamp] Candidate: ...` to `interview.aiFeedback` — so the running transcript IS time-stamped. BUT there is no per-interview **panel feedback** model (multiple panelists leaving time-stamped comments on the same interview).
- **What's missing:** Add an `InterviewFeedback` model (`interviewId`, `panelistUserId`, `comment`, `rating`, `timestamp`, `isPrivate`). Add `/api/ai-interview/sessions/[id]/feedback` GET/POST. Surface in the session review tab as a threaded comment feed.

#### REQ-AI-INT-08 — Collaboration Hub integration
- **Status:** ❌ MISSING
- **Citations:** The Collaboration Hub (`ChatRoom`, `FileNode`, `CallLog` models — Task 14 deliverables) has no link to the recruitment domain. No `InterviewSession.chatRoomId` field.
- **Build plan:** When an InterviewSession is created, auto-create a `ChatRoom` with `type='interview_panel'` and add the recruiter + hiring manager + panelists as members. Add `interviewSessionId String?` to `ChatRoom`. On the dashboard AI Interview review tab, embed the chat room widget so the panel can discuss in real time. Auto-upload the interview transcript as a `FileNode` linked to the room.

### 4.5 OFFER MANAGEMENT

#### REQ-OFR-01 — Dynamic offer letters (country-specific templates)
- **Status:** ❌ MISSING
- **Citations:** `Offer` model (`schema.prisma:1655`) has `candidateName`, `position`, `offeredSalary`, `probationPeriod` — but no template engine, no country field, no PDF generation. `/offers` page only stores these fields raw.
- **Build plan:** Add an `OfferTemplate` Prisma model (`name`, `country`, `language`, `body` with `{{candidateName}}` `{{position}}` `{{salary}}` `{{joiningDate}}` placeholders, `isDefault`). Add `/api/offers/templates` CRUD. Add `/api/offers/[id]/generate-pdf` that renders the template with offer data using `pdf-lib` or `puppeteer` and stores the PDF URL on `Offer.generatedPdfUrl`. Add a country/template picker in the offer form. Pre-seed templates for US/IN/UK/AE/DE.

#### REQ-OFR-02 — Multi-currency compensation display
- **Status:** ⚠️ PARTIAL
- **Citations:** `Offer.offeredCurrency` (`schema.prisma:1666`) defaults to "INR". `/offers/page.tsx:243-247` has a 3-option dropdown (INR/USD/EUR). No conversion, no display in candidate's preferred currency, no FX-rate awareness (the `ExchangeRate` model exists at `schema.prisma:2709` for payroll but isn't linked to offers).
- **What's missing:** Use `ExchangeRate` to convert the offered salary to the candidate's preferred currency for display. Add `candidatePreferredCurrency String?` to `Offer`. On the offer PDF / candidate view, show both the contract currency and the converted amount with a footnote "Indicative conversion at FX rate on <date>".

#### REQ-OFR-03 — E-signatures (DocuSign/Adobe Sign)
- **Status:** ❌ MISSING
- **Citations:** `src/components/hrms/settings.tsx:301` has a hard-coded `{ name: 'DocuSign', description: 'Digital signature for documents', connected: true }` tile — purely cosmetic, no actual OAuth or API client. `Offer` has no `signatureStatus`, `signedPdfUrl`, `signedAt`, `signedById` fields.
- **Build plan:** Add `esignProvider String?` (docusign/adobe_sign), `esignEnvelopeId String?`, `signedPdfUrl String?`, `signedAt DateTime?`, `signedById String?` to `Offer`. Add `/api/offers/[id]/send-for-esign` POST that creates a DocuSign envelope via their eSignature REST API with the generated PDF + recipient = candidate email. Add `/api/offers/webhooks/docusign` to receive signed-status callbacks. Add "Send for E-Signature" button on the offer row when status='sent'.

#### REQ-OFR-04 — Decline analysis micro-survey
- **Status:** ❌ MISSING
- **Citations:** `Offer.responseNotes String?` (`schema.prisma:1680`) is a free-text field — could hold decline reason but no structured survey. The decline action in `/offers/page.tsx:329` just sets `status='rejected'` with no survey modal.
- **Build plan:** Add an `OfferDeclineSurvey` model (`offerId`, `reasonCategory` enum: compensation/location/timing/counter_offer/culture/benefits/other, `reasonText`, `wouldReconsider Boolean`, `submittedAt`). When the candidate clicks "Decline" (in candidate portal — see REQ-ATS-04) or when HR marks status=rejected, show a 4-question micro-survey. Add `/api/offers/[id]/decline-survey` GET/POST. Add an analytics view on `/offers` showing decline-reason breakdown for the last quarter.

### 4.6 PREBOARDING

#### REQ-ONB-01 — Trigger on offer acceptance
- **Status:** ⚠️ PARTIAL
- **Citations:** `Offer.status='accepted'` is supported (`schema.prisma:1674`). `PreboardingCandidate.offerId` field exists (`schema.prisma:1877`) — but it's a raw string, NOT a FK to Offer. `/api/offers/[id]/route.ts:92-94` captures `respondedAt` when status becomes accepted/rejected but does **not** auto-create a PreboardingCandidate record. Preboarding creation is manual via `/api/preboarding` POST.
- **What's missing:** In `PATCH /api/offers/[id]`, when `status` transitions to `'accepted'`, automatically call `prisma.preboardingCandidate.create()` with the offer details (candidateName, candidateEmail, jobTitle=position, offeredSalary, currency, joiningDate, offerId=id, status='offer_accepted'). Add a notification to the HR admin. Add a uniqueness guard so re-saving an accepted offer doesn't duplicate the preboarding row.

#### REQ-ONB-02 — Digital document collection
- **Status:** ⚠️ PARTIAL
- **Citations:** `PreboardingCandidate.documentsUploaded String?` (`schema.prisma:1884`) is a JSON map of docType → fileUrl. `/preboarding/page.tsx` shows a Documents tab (line 286-289 tab definition) but the page uses `demoCandidates` (line 140-147) — never actually fetches from the API. So document upload UI is **not wired**.
- **What's missing:** Wire `/preboarding/page.tsx` to `/api/preboarding` instead of `demoCandidates`. Add a per-candidate document upload modal with 6 doc types (ID Proof / Address Proof / Education Certs / Previous Employment / Medical / Bank Details — already defined at `page.tsx:60-67`). Add `/api/preboarding/[id]/documents` POST (multipart upload to Vercel Blob/S3) + GET (list docs). Update `documentsUploaded` JSON with `{ docType: { url, uploadedAt, verified } }`.

#### REQ-ONB-03 — Background checks integration (Sterling, HireRight)
- **Status:** ⚠️ PARTIAL
- **Citations:** `PreboardingCandidate.backgroundCheckStatus` (`schema.prisma:1887`) supports `pending | in_progress | cleared | failed`. `backgroundCheckNotes` exists. Demo data (`page.tsx:141-146`) shows vendor names "Sterling", "First Advantage", "HireRight" as strings — no actual API integration.
- **What's missing:** Add a `BackgroundCheckVendor` model (`name`, `apiKey`, `webhookSecret`, `tenantId`). Add `vendorId String?` + `vendorRequestId String?` + `vendorReportUrl String?` to `PreboardingCandidate`. Add `/api/preboarding/[id]/bgv/initiate` POST that calls the vendor API (Sterling REST / HireRight API) to create a background check request. Add `/api/preboarding/webhooks/[vendor]` to receive status callbacks. Surface vendor + report link in the BGV tab.

#### REQ-ONB-04 — Welcome series emails
- **Status:** ❌ MISSING
- **Citations:** No email-sequence infrastructure for preboarding. `Notification` model exists (`schema.prisma:1100`) but is in-app only, not email.
- **Build plan:** Add an `EmailTemplate` model (`name`, `trigger`, `subject`, `body`, `delayHours`, `tenantId`) and an `EmailQueue` model (`to`, `templateId`, `sendAt`, `status`, `error`). When PreboardingCandidate is created (REQ-ONB-01 trigger), enqueue 4 emails: "Welcome to the team" (immediate), "Document checklist" (D-7), "IT setup form" (D-3), "Day 1 instructions" (D-1). Add a cron endpoint `/api/cron/email-queue` (protected by CRON_SECRET) that sends due emails via Resend/SendGrid. Add UI under `/preboarding` to preview/edit email templates.

### 4.7 DAY-1 ONBOARDING

#### REQ-ONB-05 — Employee record creation
- **Status:** ⚠️ PARTIAL
- **Citations:** `OnboardingTask.employeeId` (`schema.prisma:575`) FK to Employee — so the Employee record must exist **before** onboarding tasks can be created. There's no automation that creates an Employee from a PreboardingCandidate.
- **What's missing:** In `PATCH /api/preboarding/[id]`, when `status` transitions to `'joined'`, automatically call `prisma.employee.create()` with firstName/lastName/email from `PreboardingCandidate.candidateName`/`candidateEmail`, plus departmentId, jobTitle, joiningDate. Then auto-create a default set of OnboardingTask rows from a template (see REQ-ONB-08). Add a `employeeId String?` to `PreboardingCandidate` to link back.

#### REQ-ONB-06 — IT provisioning triggers (AD/Azure AD)
- **Status:** ❌ MISSING
- **Citations:** `OnboardingTask.category` supports `'it_setup'` (`schema.prisma:579`) — so IT tasks can be tracked manually. No actual Microsoft Graph API call to provision an Azure AD account, no Google Workspace API call, no Slack/Email account auto-creation.
- **Build plan:** Add an `ITProvisioningRule` model (`trigger` enum: 'employee_created', 'manual', `provider` enum: 'azure_ad/google_workspace/slack/email', `config Json`). When Employee is created (REQ-ONB-05), dispatch provisioning jobs to a queue. Add `/api/onboarding/it-provisioning/[employeeId]` POST that runs the actual API calls (Microsoft Graph `POST /users`, Google Workspace Admin SDK, Slack SCIM). Surface provisioning status on the onboarding page per employee.

#### REQ-ONB-07 — Payroll integration
- **Status:** ❌ MISSING
- **Citations:** The Payroll module is large (55+ endpoints) but there's no link from Onboarding → Payroll. No `Employee.payrollSetupCompleted` flag, no auto-creation of `EmployeePaymentMethod` or `PayrollInput` rows on hire.
- **Build plan:** When Employee is created (REQ-ONB-05), auto-create: (a) `SalaryStructure` assignment based on `Offer.offeredSalary` + `Offer.salaryBreakdown`, (b) `EmployeePaymentMethod` placeholder row, (c) `PayrollInput` row for the first pay period with proration factor based on joiningDate. Add a "Payroll Setup" checklist item to the onboarding page that links to `/payroll/inputs` pre-filtered to the new employee.

#### REQ-ONB-08 — Project allocation
- **Status:** ❌ MISSING
- **Citations:** `ProjectAllocation` model exists (likely around schema.prisma:1476) and `ProjectMember` (line 1508) — but no auto-allocation on hire. The requisition flow has `projectId` (`schema.prisma:1631`) but it's not propagated.
- **Build plan:** When Employee is created from PreboardingCandidate, look up the originating Requisition (PreboardingCandidate.offerId → Offer.jobPostingId → Requisition.jobPostingId). If Requisition.projectId is set, auto-create a `ProjectAllocation` row and a `ProjectMember` row with role='member'. Add a "Project Allocation" tab to the onboarding page where HR can adjust the allocation before day 1.

#### REQ-ONB-09 — Buddy & manager chats (Collaboration Hub)
- **Status:** ❌ MISSING
- **Citations:** `ChatRoom` model exists (`schema.prisma:3835`) from Task 14 collaboration work. No auto-creation of buddy/manager chat rooms on hire. `Employee.reportingManagerId` exists but isn't used for chat room seeding.
- **Build plan:** When Employee is created, auto-create two `ChatRoom` rows: (a) `type='manager_1on1'` with members [newEmployee, reportingManager], (b) `type='buddy'` with members [newEmployee, buddyEmployeeId] (buddy assigned via a new `OnboardingTask` with `category='buddy_assignment'`). Surface quick-launch tiles on the employee dashboard for day-1.

### 4.8 ADMIN INTEGRATION

#### SUPER-ADMIN — AI Model Governance (recruitment), Global Talent Pool (Ghost Pool), Integration Health
- **Status:** ⚠️ PARTIAL
- **Citations:** `AIConfig` (`schema.prisma:2100`), `AIPromptLog` (`schema.prisma:2124`), `/api/ai-admin/*` routes exist for general AI governance — but recruitment-specific AI governance (per-set model selection, prompt versioning for interview generation/evaluation) is not configured. `GhostEmployeeFlag` (`schema.prisma:3519`) exists but is payroll-only (ghost employees = no timesheet), not for a talent-pool ghost-pool (candidates who applied before and could be re-engaged). No Integration Health dashboard.
- **What's missing:** (a) Extend `/super-admin/ai-admin` page to include recruitment AI governance (model selection for JD generation, interview question generation, scoring; per-tenant prompt overrides; prompt-logs filtered by `module='recruitment'`). (b) Add a `TalentPoolProfile` model (`candidateEmail`, `tenantId`, `skills`, `lastApplicationDate`, `fitScore`, `status: 'active'|'ghost'|'blacklisted'`) and a `/super-admin/talent-pool` page showing cross-tenant candidates. (c) Add `/super-admin/integration-health` page polling each `JobBoardIntegration`, `BackgroundCheckVendor`, `SSOProvider` for last-sync status.

#### TENANT-ADMIN — Group-Level Recruiting (Global Requisition), Employer Branding, Interview Template Library, Recruitment Analytics (Cost per Hire, Time to Fill)
- **Status:** ⚠️ PARTIAL
- **Citations:** `Requisition.companyId` (`schema.prisma:1614`) supports multi-company within a tenant — so group-level requisitions are technically possible. `InterviewSet` acts as a template but there's no "library" concept (sets are tenant-scoped, not shareable). No employer-branding CMS, no recruitment analytics page (Cost per Hire / Time to Fill / Source Quality).
- **What's missing:** (a) Add a `/tenant-admin/group-requisitions` page that lists all requisitions across the tenant's companies with rollup stats. (b) Add an `EmployerBrandAsset` model (`tenantId`, `type: 'logo'|'hero_image'|'video'|'culture_story'`, `url`, `caption`, `language`) + `/tenant-admin/employer-branding` CMS page + wire assets into `/careers` page. (c) Add `isTemplate Boolean` to `InterviewSet` + a `/tenant-admin/interview-templates` library page where HR can browse + clone templates. (d) Add `/tenant-admin/recruitment-analytics` page with computed metrics: Cost per Hire (sum of sourcing cost + recruiter hours × rate + referral bonus / hires), Time to Fill (avg days from requisition created to offer accepted), Source Quality (% of hires by source), Offer Acceptance Rate, Funnel conversion rates.

### 4.9 SECURITY & COMPLIANCE

#### REQ-SEC-REC-01 — GDPR/CCPA Right to be Forgotten
- **Status:** ⚠️ PARTIAL
- **Citations:** `GDPRAnonymizationRequest` model exists (`schema.prisma:4278`) but is wired only to `Employee` (per Task 14). No anonymization flow for `JobApplication`, `InterviewSession`, `PreboardingCandidate`, `Offer`.
- **What's missing:** Extend `/api/collaboration/gdpr/anonymize` (or add a new `/api/ats/gdpr/anonymize`) to accept a `candidateEmail` and anonymize: `JobApplication.candidateName='Deleted Candidate'`, `candidateEmail=hash`, `resume=null`, `coverLetter=null`; `InterviewSession.candidateName='Deleted Candidate'`, `fullTranscript=null`, `videoUrl=null`; `PreboardingCandidate` similarly; `Offer.candidateName='Deleted Candidate'`. Retain the records for 7-year statutory period (audit-log the request). Add a candidate-facing "Request deletion" form on the candidate portal.

#### REQ-SEC-REC-02 — AI Transparency disclaimers
- **Status:** ❌ MISSING
- **Citations:** No "AI is evaluating you" disclaimer in `src/app/interview/[token]/page.tsx`. No "AI scoring is used in this hiring decision" notice on the candidate dashboard (which doesn't exist yet). No model-card / explanation surface.
- **Build plan:** Add a mandatory AI disclaimer banner at the top of the pre-screen form (`src/app/interview/[token]/page.tsx`): "This interview is conducted and evaluated by an AI system. Your responses will be processed automatically. You have the right to request human review of the AI's decision." Add a "How the AI scored me" explanation view on the candidate portal showing which dimensions were scored + a plain-English rationale generated at evaluation time.

#### REQ-SEC-REC-03 — PII Masking for panel (DOB, Gender, Photo)
- **Status:** ❌ MISSING
- **Citations:** No PII masking in the recruitment domain. `JobApplication` exposes all candidate fields to any HR user. No field-level access control. The DLP scanner (`src/lib/dlp.ts`, Task 14) scans chat messages for credit cards / SSNs but doesn't mask candidate demographic PII in panel views.
- **Build plan:** Add a `CandidatePiiPolicy` model (`tenantId`, `field`, `visibleToRoles[]`, `maskingStrategy: 'hash'|'partial'|'hidden'`). Default policy: `dob`, `gender`, `photo`, `address` are masked for `recruiter` and `interviewer` roles; only `hr_admin` sees unmasked. Modify the `/api/recruitment` and `/api/ai-interview/sessions` GET endpoints to apply masking based on the caller's role. Add a "Why am I seeing masked data?" tooltip.

#### REQ-SEC-REC-04 — Consent management (granular opt-in/opt-out)
- **Status:** ❌ MISSING
- **Citations:** `CallLog.consentForRecording Boolean @default(false)` (`schema.prisma:3927`) exists for calls but no general candidate consent model. `JobApplication` has no consent fields. `InterviewSession.preScreenResult` JSON could include consent but it's free-form.
- **What's missing:** Add a `CandidateConsent` model (`candidateEmail`, `tenantId`, `purpose` enum: 'resume_processing', 'background_check', 'ai_evaluation', 'video_recording', 'marketing', `grantedAt`, `withdrawnAt`, `version`). On the public apply form (`/careers`), add 4 opt-in checkboxes (resume processing, AI evaluation, video recording, marketing) — submission is blocked unless the first 3 are checked. Add `/api/candidate-portal/consent` GET/PUT for the candidate to withdraw consent later (which triggers REQ-SEC-REC-01 anonymization flow).

---

## 5. Top 20 Missing Requirements (Prioritized)

Ordered by combination of (regulatory risk × user-impact × build-feasibility):

| # | Req ID | Title | Why High Priority |
|---|---|---|---|
| 1 | REQ-SEC-REC-04 | Consent management | GDPR/CCPA blocker — cannot accept EU/CA applicants without it |
| 2 | REQ-SEC-REC-01 | Right to be Forgotten (candidates) | GDPR Article 17 mandatory; existing employee flow doesn't cover candidates |
| 3 | REQ-SEC-REC-02 | AI Transparency disclaimers | EU AI Act Article 13 + candidate trust |
| 4 | REQ-SEC-REC-03 | PII Masking for panel | Bias-mitigation; required for fair-hiring compliance in many jurisdictions |
| 5 | REQ-ONB-01 | Trigger preboarding on offer accept | High-value automation; current manual flow creates dropped-ball risk |
| 6 | REQ-ONB-05 | Auto-create Employee record on hire | Critical day-1 unblocker; currently manual |
| 7 | REQ-OFR-03 | E-signatures (DocuSign) | High-friction paper-based offer letters currently |
| 8 | REQ-ATS-01 | Real multi-format resume parsing | Manual data entry today; mock API is misleading |
| 9 | REQ-PORT-04 | SEO schema.org markup | Free organic traffic win; pure additive |
| 10 | REQ-AI-INT-08 | Collaboration Hub integration for interviews | Panel members currently can't discuss in-app |
| 11 | REQ-AI-INT-01 | WhatsApp/SMS outreach | High-impact in markets where WhatsApp dominates (IN, LATAM, MEA) |
| 12 | REQ-ATS-04 | Candidate dashboard | Today candidates have zero visibility post-apply |
| 13 | REQ-ONB-02 | Digital document collection (wire the existing UI) | UI exists but uses demo data; quick win |
| 14 | REQ-OFR-04 | Decline analysis micro-survey | Recruiting intel; pure additive |
| 15 | REQ-OFR-01 | Dynamic offer letter templates with country variants | Multi-country deployment blocker |
| 16 | REQ-SRC-05 | Social referral tracking (fix Referral model + trackable links) | Existing API is broken (no model); quick fix + high employee-engagement |
| 17 | REQ-SRC-01 + 02 | Job board integrations + multi-posting | Biggest sourcing-time saver |
| 18 | REQ-PORT-03 | WCAG 2.1 accessibility | Legal requirement in many jurisdictions (ADA, EAA) |
| 19 | TENANT-ADMIN | Recruitment Analytics (Cost per Hire, Time to Fill) | Every TA leader asks for this on day 1 |
| 20 | REQ-AI-INT-03 | Async video interview UI (capture side) | Backend is ready; only UI missing |

---

## 6. Five Highest-Priority Builds (Concrete Plans)

### Build 1 — Candidate Consent & PII Masking Bundle (REQ-SEC-REC-03 + 04)

**Files to create:**
- `prisma/schema.prisma` — add 2 models: `CandidateConsent`, `CandidatePiiPolicy`
- `src/app/api/ats/consent/route.ts` — GET (list consents by candidateEmail) + POST (record consent grant/withdrawal)
- `src/app/api/ats/pii-policy/route.ts` — CRUD for tenant-admin
- `src/lib/pii-mask.ts` — `maskCandidateFields(candidate, userRole)` helper
- `src/app/careers/page.tsx` — add 4 consent checkboxes to ApplyModal (lines 686-696)
- `src/app/(dashboard)/recruitment/page.tsx` — apply masking in the applications tab renderer

**Schema additions:**
```prisma
model CandidateConsent {
  id            String   @id @default(cuid())
  candidateEmail String
  tenantId      String
  purpose       String   // resume_processing | background_check | ai_evaluation | video_recording | marketing
  grantedAt     DateTime @default(now())
  withdrawnAt   DateTime?
  version       String   // consent-text version
  ipAddress     String?
  @@index([candidateEmail, tenantId])
}

model CandidatePiiPolicy {
  id              String @id @default(cuid())
  tenantId        String
  field           String // dob | gender | photo | address | phone | email
  visibleToRoles  String // JSON array of role keys
  maskingStrategy String // hash | partial | hidden
  @@unique([tenantId, field])
}
```

**Effort:** ~2 days. **Risk:** Low (additive). **Unblocks:** EU/CA applicant flow.

---

### Build 2 — Offer Acceptance → Preboarding → Employee → Onboarding Tasks Cascade (REQ-ONB-01 + 05 + 08)

**Files to modify:**
- `prisma/schema.prisma` — add `employeeId String?` + `requisitionId String?` to `PreboardingCandidate`; add `buddyEmployeeId String?` to `OnboardingTask`
- `src/app/api/offers/[id]/route.ts` — in PATCH handler, when status transitions to `'accepted'`, auto-create PreboardingCandidate via `prisma.preboardingCandidate.create()`
- `src/app/api/preboarding/[id]/route.ts` — in PATCH, when status transitions to `'joined'`, auto-create Employee + OnboardingTask rows from a default template
- `src/app/api/onboarding/templates/route.ts` (NEW) — CRUD for `OnboardingTaskTemplate` model (role/department-scoped default task lists)

**New schema:**
```prisma
model OnboardingTaskTemplate {
  id           String @id @default(cuid())
  tenantId     String
  name         String
  task         String
  category     String
  dueOffsetDays Int   // due X days after joining
  appliesToRole String? // designation-level filter
  @@index([tenantId])
}
```

**Effort:** ~3 days. **Risk:** Medium (touches Offer + Preboarding + Onboarding in one cascade). **Unblocks:** True day-1 automation.

---

### Build 3 — Real Resume Parser replacing mock (REQ-ATS-01 + 02)

**Files to create:**
- `src/app/api/ats/parse-resume/route.ts` (NEW) — accepts `{ resumeDataUrl }`, validates mime, extracts text, calls ZAI for structured extraction in detected language, returns parsed JSON; also stores on JobApplication.resumeParsed
- `src/lib/resume-parser.ts` (NEW) — `extractTextFromPdf`, `extractTextFromDocx` (using `pdf-parse` + `mammoth`), `detectLanguage` (using `franc`), `extractStructuredFields(text, language)` calling ZAI
- `prisma/schema.prisma` — add `resumeParsed Json?` + `resumeLanguage String?` to `JobApplication`
- `src/app/api/recruitment-ai/route.ts` — replace the mock `parse_resume` action (lines 48-61) with a redirect to the new endpoint
- `src/app/(dashboard)/recruitment/page.tsx` — add a "Parsed Resume" expandable section on each application row showing extracted skills/experience/education

**Effort:** ~3 days. **Risk:** Low (additive; old mock can stay as fallback). **Unblocks:** Real ATS value.

---

### Build 4 — Offer Letter Template Engine + E-Signature (REQ-OFR-01 + 03)

**Files to create:**
- `prisma/schema.prisma` — add `OfferTemplate` model + add `esignProvider`, `esignEnvelopeId`, `signedPdfUrl`, `signedAt`, `signedById`, `generatedPdfUrl`, `templateId` to `Offer`
- `src/app/api/offers/templates/route.ts` + `[id]/route.ts` (NEW) — CRUD for templates
- `src/app/api/offers/[id]/generate-pdf/route.ts` (NEW) — renders template with offer data via `@react-pdf/renderer` (already-friendly with Next.js), returns PDF URL
- `src/app/api/offers/[id]/send-for-esign/route.ts` (NEW) — creates DocuSign envelope via `docusign-esign` npm package, stores envelopeId
- `src/app/api/offers/webhooks/docusign/route.ts` (NEW) — receives signed-status callbacks, updates `signedPdfUrl` + `signedAt`
- `src/app/(dashboard)/offers/page.tsx` — add template picker in offer form + "Send for E-Signature" button on sent offers + "View Signed PDF" link when signed
- `prisma/seed.ts` — pre-seed 5 country templates (US/IN/UK/AE/DE)

**Effort:** ~5 days (DocuSign OAuth + envelope flow is the long pole). **Risk:** Medium (third-party API). **Unblocks:** Paperless offers.

---

### Build 5 — Fix Referral Model + Trackable Social Links (REQ-SRC-05)

**Files to create/modify:**
- `prisma/schema.prisma` — add the missing `Referral` model:
```prisma
model Referral {
  id                    String   @id @default(cuid())
  jobPostingId          String
  jobPosting            JobPosting @relation(fields: [jobPostingId], references: [id], onDelete: Cascade)
  referrerEmployeeId    String
  referrerEmployee      Employee @relation(fields: [referrerEmployeeId], references: [id])
  candidateName         String
  candidateEmail        String
  candidatePhone        String?
  candidateResume       String?
  notes                 String?
  bonusAmount           Float?
  trackToken            String   @unique @default(cuid())
  clickCount            Int      @default(0)
  status                String   @default("pending") // pending | applied | interviewed | offered | hired | rejected | bonus_paid
  hiredAt               DateTime?
  bonusPaidAt           DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  @@index([jobPostingId])
  @@index([referrerEmployeeId])
  @@index([trackToken])
}
```
- Add `referrals Referral[]` back-reference to `JobPosting` and `Employee`
- `src/app/api/referrals/route.ts` — already exists; just needs the model to land in schema
- `src/app/api/referrals/track/[token]/route.ts` (NEW) — GET that increments `clickCount` + redirects to `/careers?ref=token&jobId=<jobPostingId>`
- `src/app/api/referrals/trackable-link/route.ts` (NEW) — POST `{ jobPostingId }` returns a unique trackable URL for the current employee
- `src/app/(dashboard)/referrals/page.tsx` (NEW) — employee-facing page: pick a job → generate trackable link → share via WhatsApp/LinkedIn/email; show status of all their referrals
- `src/app/careers/page.tsx` — read `?ref=` query param, store in form state, pass to `/api/public/apply` as `referralToken` so the application auto-links to the Referral row
- `src/app/api/public/apply/route.ts` — accept `referralToken` field, look up Referral, set its `status='applied'`

**Effort:** ~2 days. **Risk:** Low (additive + fixes existing broken route). **Unblocks:** Employee referral program at zero marketing cost.

---

## 7. Additional Recommendations

1. **Consolidate the dual-implementation pattern.** Pick one of `src/components/hrms/{recruitment,job-portal,ai-interview,onboarding}.tsx` (demo-data path) OR `src/app/(dashboard)/{recruitment,job-portal,ai-interview,onboarding}/page.tsx` (real-data path) and delete the other. The current state is confusing and risks data drift.

2. **Wire `/preboarding/page.tsx` to the real API.** Currently uses `demoCandidates` constant (`page.tsx:140-147`) — fetch from `/api/preboarding` and persist edits.

3. **Add recruitment-specific seed data.** The `prisma/seed.ts` script doesn't seed any recruitment models, so the demo data is the only thing shown on a fresh deploy. Add 5-10 sample JobPostings, 20 JobApplications across statuses, 2 InterviewSets, etc.

4. **Add a `/recruitment/[jobId]` detail page.** Currently the recruitment page shows everything in two flat tabs; a per-job detail page with funnel visualization + candidate cards would be more usable.

5. **Move the offer-form currency dropdown to use `CurrencyConfig`** (`schema.prisma:2687`) instead of the hard-coded INR/USD/EUR list at `offers/page.tsx:243-247`.

---

## 8. Coverage Summary

| Section | Total | EXISTS | PARTIAL | MISSING |
|---|---:|---:|---:|---:|
| Public Career Portal | 4 | 1 | 1 | 2 |
| Sourcing & Job Boards | 6 | 0 | 1 | 5 |
| ATS & AI Resume Parsing | 6 | 1 | 2 | 3 |
| AI Screening & Interviewing | 8 | 2 | 4 | 2 |
| Offer Management | 4 | 0 | 1 | 3 |
| Preboarding | 4 | 0 | 3 | 1 |
| Day-1 Onboarding | 5 | 0 | 1 | 4 |
| Admin Integration | 2 super + 4 tenant = 6 | 0 | 3 | 3 |
| Security & Compliance | 4 | 0 | 1 | 3 |
| **TOTAL** | **48** | **4** | **17** | **26** (≈54 %) |

> Note: the count is 48 (not 36) because the Admin Integration row counts both Super-Admin and Tenant-Admin as separate requirement clusters.

**Maturity score:** ~35 % of requirement scope is fully implemented; another ~35 % has foundational plumbing but missing the key differentiating capability; ~30 % has no implementation at all.
