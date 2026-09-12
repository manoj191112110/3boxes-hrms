import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const body = await request.json();
    const { secret } = body;

    if (secret !== '3boxes-reseed-2025') {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 403 });
    }

    console.log('[Migrate] Creating AI Interview tables if they don\'t exist...');

    // Create tables using raw SQL
    const createTables = [
      `CREATE TABLE IF NOT EXISTS "InterviewSet" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "roleTitle" TEXT NOT NULL,
        "jobDescription" TEXT,
        "tenantId" TEXT NOT NULL,
        "interviewMode" TEXT NOT NULL DEFAULT 'text',
        "language" TEXT NOT NULL DEFAULT 'en',
        "timeLimit" INTEGER NOT NULL DEFAULT 30,
        "cvProbeDuration" INTEGER NOT NULL DEFAULT 10,
        "enablePreScreening" BOOLEAN NOT NULL DEFAULT true,
        "enableProctoring" BOOLEAN NOT NULL DEFAULT true,
        "enableDynamicFollowUp" BOOLEAN NOT NULL DEFAULT true,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "preScreenFilters" JSONB,
        "evaluationConfig" JSONB,
        "createdBy" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "InterviewSet_pkey" PRIMARY KEY ("id")
      )`,

      `CREATE TABLE IF NOT EXISTS "InterviewSetQuestion" (
        "id" TEXT NOT NULL,
        "setId" TEXT NOT NULL,
        "order" INTEGER NOT NULL,
        "category" TEXT NOT NULL,
        "question" TEXT NOT NULL,
        "expectedPoints" TEXT,
        "followUpPrompts" TEXT,
        "duration" INTEGER,
        "isMandatory" BOOLEAN NOT NULL DEFAULT true,
        "difficulty" TEXT NOT NULL DEFAULT 'medium',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "InterviewSetQuestion_pkey" PRIMARY KEY ("id")
      )`,

      `CREATE TABLE IF NOT EXISTS "InterviewSession" (
        "id" TEXT NOT NULL,
        "setId" TEXT NOT NULL,
        "candidateName" TEXT NOT NULL,
        "candidateEmail" TEXT NOT NULL,
        "candidatePhone" TEXT,
        "resumeUrl" TEXT,
        "resumeParsed" JSONB,
        "language" TEXT NOT NULL DEFAULT 'en',
        "status" TEXT NOT NULL DEFAULT 'invited',
        "preScreenResult" JSONB,
        "startedAt" TIMESTAMP(3),
        "completedAt" TIMESTAMP(3),
        "videoUrl" TEXT,
        "audioUrl" TEXT,
        "transcriptUrl" TEXT,
        "fullTranscript" TEXT,
        "overallScore" INTEGER,
        "communicationScore" INTEGER,
        "grammarScore" INTEGER,
        "fluencyScore" INTEGER,
        "comprehensionScore" INTEGER,
        "vocabularyScore" INTEGER,
        "cognitiveScore" INTEGER,
        "skillMatchScore" INTEGER,
        "aiSummary" TEXT,
        "aiRecommendation" TEXT,
        "durationSeconds" INTEGER,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
      )`,

      `CREATE TABLE IF NOT EXISTS "InterviewResponse" (
        "id" TEXT NOT NULL,
        "sessionId" TEXT NOT NULL,
        "questionId" TEXT,
        "order" INTEGER NOT NULL,
        "question" TEXT,
        "responseText" TEXT,
        "responseAudioUrl" TEXT,
        "responseVideoUrl" TEXT,
        "responseDuration" INTEGER,
        "aiScore" INTEGER,
        "aiFeedback" TEXT,
        "followUpFromId" TEXT,
        "isFollowUp" BOOLEAN NOT NULL DEFAULT false,
        "isCvBased" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "InterviewResponse_pkey" PRIMARY KEY ("id")
      )`,

      `CREATE TABLE IF NOT EXISTS "ProctoringLog" (
        "id" TEXT NOT NULL,
        "sessionId" TEXT NOT NULL,
        "eventType" TEXT NOT NULL,
        "severity" TEXT NOT NULL DEFAULT 'low',
        "details" TEXT,
        "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "screenshotUrl" TEXT,
        CONSTRAINT "ProctoringLog_pkey" PRIMARY KEY ("id")
      )`,

      `CREATE TABLE IF NOT EXISTS "InterviewInvitation" (
        "id" TEXT NOT NULL,
        "setId" TEXT NOT NULL,
        "candidateEmail" TEXT NOT NULL,
        "candidateName" TEXT NOT NULL,
        "invitationToken" TEXT NOT NULL,
        "invitationUrl" TEXT,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "sentAt" TIMESTAMP(3),
        "openedAt" TIMESTAMP(3),
        "expiresAt" TIMESTAMP(3),
        "emailDeliveryStatus" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "InterviewInvitation_pkey" PRIMARY KEY ("id")
      )`,

      // Add foreign keys
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'InterviewSetQuestion_setId_fkey') THEN
          ALTER TABLE "InterviewSetQuestion" ADD CONSTRAINT "InterviewSetQuestion_setId_fkey" FOREIGN KEY ("setId") REFERENCES "InterviewSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$`,

      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'InterviewSession_setId_fkey') THEN
          ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_setId_fkey" FOREIGN KEY ("setId") REFERENCES "InterviewSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$`,

      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'InterviewResponse_sessionId_fkey') THEN
          ALTER TABLE "InterviewResponse" ADD CONSTRAINT "InterviewResponse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$`,

      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'InterviewResponse_followUpFromId_fkey') THEN
          ALTER TABLE "InterviewResponse" ADD CONSTRAINT "InterviewResponse_followUpFromId_fkey" FOREIGN KEY ("followUpFromId") REFERENCES "InterviewResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$`,

      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ProctoringLog_sessionId_fkey') THEN
          ALTER TABLE "ProctoringLog" ADD CONSTRAINT "ProctoringLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$`,

      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'InterviewInvitation_setId_fkey') THEN
          ALTER TABLE "InterviewInvitation" ADD CONSTRAINT "InterviewInvitation_setId_fkey" FOREIGN KEY ("setId") REFERENCES "InterviewSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$`,

      // Create indexes
      `CREATE INDEX IF NOT EXISTS "InterviewSet_tenantId_idx" ON "InterviewSet"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "InterviewSet_status_idx" ON "InterviewSet"("status")`,
      `CREATE INDEX IF NOT EXISTS "InterviewSetQuestion_setId_idx" ON "InterviewSetQuestion"("setId")`,
      `CREATE INDEX IF NOT EXISTS "InterviewSession_setId_idx" ON "InterviewSession"("setId")`,
      `CREATE INDEX IF NOT EXISTS "InterviewResponse_sessionId_idx" ON "InterviewResponse"("sessionId")`,
      `CREATE INDEX IF NOT EXISTS "InterviewResponse_followUpFromId_idx" ON "InterviewResponse"("followUpFromId")`,
      `CREATE INDEX IF NOT EXISTS "ProctoringLog_sessionId_idx" ON "ProctoringLog"("sessionId")`,
      `CREATE INDEX IF NOT EXISTS "ProctoringLog_severity_idx" ON "ProctoringLog"("severity")`,
      `CREATE INDEX IF NOT EXISTS "InterviewInvitation_setId_idx" ON "InterviewInvitation"("setId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "InterviewInvitation_invitationToken_key" ON "InterviewInvitation"("invitationToken")`,
      `CREATE INDEX IF NOT EXISTS "InterviewInvitation_invitationToken_idx" ON "InterviewInvitation"("invitationToken")`,
      `CREATE INDEX IF NOT EXISTS "InterviewInvitation_status_idx" ON "InterviewInvitation"("status")`,
    ];

    const results = [];
    for (const sql of createTables) {
      try {
        await db.$executeRawUnsafe(sql);
        results.push({ sql: sql.substring(0, 60) + '...', status: 'ok' });
      } catch (err: any) {
        // Ignore "already exists" errors
        if (err?.message?.includes('already exists') || err?.code === '42P07' || err?.code === '42710') {
          results.push({ sql: sql.substring(0, 60) + '...', status: 'already_exists' });
        } else {
          results.push({ sql: sql.substring(0, 60) + '...', status: 'error', error: err?.message?.substring(0, 100) });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'AI Interview tables migration completed',
      results,
    });
  } catch (error) {
    console.error('[Migrate] Error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
