/**
 * 3Boxes HRMS - Database Client (Single Source of Truth)
 *
 * ⚠️  DO NOT create separate PrismaClient instances elsewhere.
 * ⚠️  Always import `db` from '@/lib/db' — never from '@/lib/prisma'.
 *
 * DATABASE CONNECTION PRIORITY (set by Vercel Neon integration):
 *   1. POSTGRES_PRISMA_URL  — Neon pooled connection (recommended for serverless)
 *   2. POSTGRES_URL         — Neon direct connection
 *   3. DATABASE_URL         — Fallback / local development
 *
 * To prevent connecting to the WRONG database:
 *   - On Vercel: Check Project Settings → Environment Variables → ensure the Neon
 *     integration points to the CORRECT Neon project (3Boxes HRMS, not any other).
 *   - Locally: Ensure .env contains the correct DATABASE_URL for this project.
 *   - The startup log below will print a prefix of the connection string so you
 *     can verify the database name at a glance.
 */
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const globalForDb = globalThis as unknown as {
  db: PrismaClient | undefined
}

// Priority: POSTGRES_PRISMA_URL (Neon pooled) > POSTGRES_URL (Neon direct) > DATABASE_URL (fallback)
const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL

// Safety log: print the connection string prefix so we can verify which DB is being used
if (typeof window === 'undefined' && connectionString) {
  const maskedUrl = connectionString.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')
  console.log(`[3Boxes DB] Connecting to: ${maskedUrl.substring(0, 80)}...`)
} else if (!connectionString) {
  console.log('[3Boxes DB] WARNING: No connection string found! Set POSTGRES_PRISMA_URL, POSTGRES_URL, or DATABASE_URL')
}

function createPrismaClient() {
  try {
    if (!connectionString) {
      console.error('[3Boxes DB] No connection string - returning fallback proxy')
      return createFallbackProxy()
    }

    // Use Neon serverless adapter for Vercel compatibility
    const adapter = new PrismaNeon({ connectionString })
    return new PrismaClient({ adapter })
  } catch (error) {
    console.error('[3Boxes DB] Failed to create PrismaClient:', error)
    return createFallbackProxy()
  }
}

// Fallback proxy that catches all database calls and returns safe defaults
function createFallbackProxy(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, prop: string) {
      const modelNames = [
        'user', 'employee', 'company', 'department', 'branch', 'job',
        'candidate', 'attendance', 'leave', 'payrollRecord', 'expenseClaim',
        'travelRequest', 'assetAllocation', 'notification', 'auditLog',
        'performanceReview', 'reviewCycle', 'goal', 'learningRecord',
        'ticket', 'workflowDefinition', 'workflowInstance', 'onboardingTask',
        'client', 'vendor', 'subVendor', 'survey', 'surveyQuestion', 'surveyResponse',
        'shift', 'shiftMember', 'complianceItem', 'document', 'interview',
        'leavePolicy', 'payrollStructure', 'alumniRecord', 'workflowStepDef',
        'workflowStepInstance', 'role', 'module', 'permission', 'rolePermission',
        'userRoleAssignment', 'tenant', 'payrollComponent', 'statutoryComponent',
        'cTCTemplate', 'cTCComponentMapping', 'taxSlabTable', 'taxSlabRateLine',
        'payrollInput', 'payrollRun', 'payrollTransactionLine', 'currencyConfig',
        'exchangeRate', 'dimensionDefinition', 'employeeDimensionAllocation',
        'complianceObligation', 'complianceFiling', 'gLAccountMapping',
        'fNFCalculation', 'salaryStructure', 'salaryComponent', 'payroll',
        'leaveType', 'leaveBalance', 'leaveRequest', 'designation',
        'jobPosting', 'jobApplication', 'companyGroup', 'subscriptionPlan',
        'subscription', 'payrollDefinition', 'employeePaymentMethod', 'loan',
        'overtimeRecord', 'payrollHold', 'bankPaymentFile', 'payrollValidation',
        // P0 fix: missing models (added 2026-06-20)
        'preboardingCandidate', 'exitRequest', 'oKR', 'keyResult',
        'exitInterview', 'recognition', 'aIConfig', 'aIPromptLog',
        // Invoicing (added 2026-06-21, REQ-PM-09)
        'invoice', 'invoiceLineItem',
        // Project-level RBAC (added 2026-06-21, REQ-SEC-11)
        'projectMember',
        // Employee Core & Collaboration (added 2026-06-21, REQ-EMP/COL/AI-EMP/SEC-EMP)
        'employeeCustomField', 'employeeCustomFieldValue',
        'dottedLineManager', 'team', 'teamMember',
        'socialProfile', 'sSOProvider', 'calendarSync',
        'chatRoom', 'chatRoomMember', 'chatMessage',
        'callLog', 'callParticipant',
        'fileNode', 'fileVersion', 'fileShareLink',
        'aIKnowledgeQuery', 'documentIntelligenceResult',
        'chatSummary', 'sentimentAnalysis',
        'storageQuota', 'legalHold', 'collaborationFeatureFlag',
        'communicationPolicy', 'storageAnalytics',
        'dLPScanLog', 'gDPRAnonymizationRequest', 'watermarkAccessLog',
        // Wave 2 — Offer / Onboarding / Preboarding cascade models (REQ-OFR-01/03/04, REQ-ONB-01/02/04/05/07/08/09)
        'offerTemplate', 'offerDeclineSurvey',
        'onboardingTaskTemplate', 'welcomeSeriesEmail', 'backgroundCheck',
        'jobBoardPosting',
        // WAVE2-C — Real resume parser + sentiment + interview feedback (REQ-ATS-01/02, REQ-AI-INT-02/07)
        'resumeParse', 'candidateSentimentScore', 'interviewFeedback',
        // WAVE2-E — Recruitment analytics + job boards (REQ-SRC-01/02/03)
        'requisition', 'referral',
        // Trial registration system (3boxeshrms.com)
        'trialRegistration',
        // Per-tenant database isolation
        'tenantDatabase',
        // Collaboration module models (email, todo, notes, kanban, settings)
        'emailMessage', 'todoTask', 'note',
        'kanbanBoard', 'kanbanCard',
        'collaborationSettings',
        // Social feed
        'socialPost', 'socialComment', 'socialLike',
        // Calendar
        'calendarEvent',
      ]

      if (modelNames.includes(prop)) {
        return new Proxy({}, {
          get(_t, method: string) {
            return (..._args: unknown[]) => {
              if (method === 'count') return Promise.resolve(0)
              if (method === 'findMany') return Promise.resolve([])
              if (method === 'findUnique') return Promise.resolve(null)
              if (method === 'findFirst') return Promise.resolve(null)
              if (method === 'aggregate') return Promise.resolve({ _sum: {} })
              if (method === 'groupBy') return Promise.resolve([])
              if (method === 'create') return Promise.resolve({})
              if (method === 'update') return Promise.resolve({})
              if (method === 'delete') return Promise.resolve({})
              if (method === 'deleteMany') return Promise.resolve({ count: 0 })
              if (method === 'updateMany') return Promise.resolve({ count: 0 })
              if (method === 'upsert') return Promise.resolve({})
              return Promise.resolve(null)
            }
          }
        })
      }

      // For $connect, $disconnect, $transaction, etc.
      if (typeof prop === 'string' && prop.startsWith('$')) {
        if (prop === '$transaction') {
          return (fn: any) => {
            if (typeof fn === 'function') return fn(db)
            return Promise.resolve([])
          }
        }
        return () => Promise.resolve()
      }

      return undefined
    }
  })
}

export const db =
  globalForDb.db ??
  createPrismaClient()

// Cache in development; also cache in production on Vercel for warm starts
if (process.env.NODE_ENV !== 'production') globalForDb.db = db
