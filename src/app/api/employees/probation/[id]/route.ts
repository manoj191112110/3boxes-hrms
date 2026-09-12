import { NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { loadWorkflowConfig, resolveTierApprovers } from '@/lib/approverResolve';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET /api/employees/probation/[id]
 * Returns a single probation review by ID.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const review = await db.performanceReview.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            avatar: true,
            department: { select: { name: true } },
            designation: { select: { title: true } },
          },
        },
      },
    });

    if (!review) {
      return NextResponse.json({ error: 'Probation review not found' }, { status: 404, headers: corsHeaders() });
    }

    // Parse the comments JSON
    let probationData: any = {};
    try {
      if (review.comments && review.comments.startsWith('{')) {
        probationData = JSON.parse(review.comments);
      }
    } catch { /* not JSON */ }

    const emp = (review as any).employee || {};
    let endDate: string | null = null;
    const startDateStr = probationData.probationStartDate || null;
    if (startDateStr && probationData.probationPeriod) {
      try {
        const start = new Date(startDateStr);
        const end = new Date(start);
        end.setMonth(end.getMonth() + Number(probationData.probationPeriod) + Number(probationData.extensionPeriod || 0));
        endDate = end.toISOString();
      } catch { /* invalid date */ }
    }

    return NextResponse.json({
      probation: {
        id: review.id,
        employeeId: review.employeeId,
        employee: review.employee,
        employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Unknown',
        employeeCode: emp.employeeId || '—',
        startDate: startDateStr,
        endDate,
        probationPeriod: Number(probationData.probationPeriod) || 0,
        probationStartDate: probationData.probationStartDate || null,
        extensionPeriod: probationData.extensionPeriod || 0,
        performanceRating: probationData.performanceRating || (review as any).overallRating || 0,
        reviewComments: probationData.reviewComments || review.comments || '',
        kpiStatus: probationData.kpiStatus || 'pending',
        decision: probationData.decision || 'pending',
        effectiveDate: probationData.effectiveDate || null,
        confirmationLetter: probationData.confirmationLetter || null,
        // Workflow fields
        status: review.status,
        reviewerId: review.reviewerId,
        reviewDate: review.reviewDate,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
      },
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Get probation review error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * PUT /api/employees/probation/[id]
 * Edit an existing probation review (before HR approval).
 * Only reviews with status='pending' can be edited.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const body = await request.json();
    const {
      probationStartDate,
      probationPeriod,
      extensionPeriod,
      performanceRating,
      reviewComments,
      kpiStatus,
      decision,
      effectiveDate,
      confirmationLetter,
    } = body;

    // Check if the review exists
    const existing = await db.performanceReview.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Probation review not found' }, { status: 404, headers: corsHeaders() });
    }

    // Only allow editing if the review is still pending
    if (existing.status !== 'pending') {
      return NextResponse.json({
        error: `Cannot edit a probation review that has already been ${existing.status}. Only pending reviews can be edited.`,
      }, { status: 400, headers: corsHeaders() });
    }

    // Build the updated probation data JSON
    // Merge with existing data to preserve fields not being updated
    let existingData: any = {};
    try {
      if (existing.comments && existing.comments.startsWith('{')) {
        existingData = JSON.parse(existing.comments);
      }
    } catch { /* not JSON */ }

    const updatedProbationData = JSON.stringify({
      probationStartDate: probationStartDate !== undefined ? probationStartDate : existingData.probationStartDate,
      probationPeriod: probationPeriod !== undefined ? probationPeriod : existingData.probationPeriod,
      extensionPeriod: extensionPeriod !== undefined ? extensionPeriod : (existingData.extensionPeriod || 0),
      performanceRating: performanceRating !== undefined ? performanceRating : (existingData.performanceRating || 0),
      reviewComments: reviewComments !== undefined ? reviewComments : (existingData.reviewComments || ''),
      kpiStatus: kpiStatus !== undefined ? kpiStatus : (existingData.kpiStatus || 'pending'),
      decision: decision !== undefined ? decision : (existingData.decision || 'pending'),
      effectiveDate: effectiveDate !== undefined ? effectiveDate : existingData.effectiveDate,
      confirmationLetter: confirmationLetter !== undefined ? confirmationLetter : existingData.confirmationLetter,
    });

    const review = await db.performanceReview.update({
      where: { id },
      data: {
        comments: updatedProbationData,
        rating: performanceRating !== undefined ? performanceRating : existing.rating,
        overallRating: performanceRating !== undefined ? performanceRating : existing.overallRating,
        reviewPeriod: probationPeriod ? `Probation (${probationPeriod} months)` : existing.reviewPeriod,
        reviewDate: effectiveDate ? new Date(effectiveDate) : existing.reviewDate,
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeId: true } },
      },
    });

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'UPDATE_PROBATION_REVIEW',
          module: 'employees',
          details: `Updated probation review for ${(review as any).employee?.firstName} ${(review as any).employee?.lastName}`,
        },
      });
    } catch { /* non-critical */ }

    return NextResponse.json({
      success: true,
      message: 'Probation review updated successfully',
      probation: { id: review.id, status: review.status },
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Update probation review error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * PATCH /api/employees/probation/[id]
 * 2-Level Workflow: HR review → MD/Admin final confirmation
 *
 * Body:
 *   { action: 'approve' | 'extend' | 'reject', comments?: string, extensionPeriod?: number }
 *
 * WORKFLOW:
 *   Stage 1 — HR Review (hr_review):
 *     - HR/Admin submits their decision (approve/extend/reject)
 *     - Status stays 'pending', workflowStage → 'md_review'
 *     - Notification sent to MD/Admin (super_admin, tenant_admin) for final confirmation
 *
 *   Stage 2 — MD/Admin Final Confirmation (md_review):
 *     - MD/Admin (super_admin, tenant_admin) reviews HR's decision
 *     - Can confirm or override HR's decision
 *     - Status → 'completed' (confirm), 'in_progress' (extend), or 'rejected' (terminate)
 *     - workflowStage → 'completed'
 *     - Employee's employeeStatus updated to 'confirmed' if approved
 *
 * Only HR/Admin can do Stage 1. Only MD/Admin (super_admin, tenant_admin) can do Stage 2.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const userRole = ((decoded.role as string) || 'employee').toLowerCase();
    const body = await request.json();
    const { action, comments, extensionPeriod } = body;

    if (!action || !['approve', 'extend', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve, extend, or reject' }, { status: 400, headers: corsHeaders() });
    }

    const existing = await db.performanceReview.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Probation review not found' }, { status: 404, headers: corsHeaders() });
    }

    // Parse existing probation data
    let probationData: any = {};
    try {
      if (existing.comments && existing.comments.startsWith('{')) {
        probationData = JSON.parse(existing.comments);
      }
    } catch { /* not JSON */ }

    // Determine current workflow stage
    const currentStage = probationData.workflowStage || 'hr_review';
    const isMDAdmin = ['super_admin', 'tenant_admin'].includes(userRole);
    const isHRAdmin = ['admin', 'company_hr_admin', 'hr_admin', 'manager'].includes(userRole) || isMDAdmin;

    // ─── Configurable approval chain (EmployeeWorkflowConfig, workflowType='probation_confirmation') ───
    // When HR has configured approvers in /employees/approval-config, this
    // multi-tier chain replaces the fixed HR → MD/Admin flow. Tiers are acted
    // on in order; only the LAST tier's decision finalizes the review. Legacy
    // 'hr_review'/'md_review' stages map onto tiers 1/2 for in-flight reviews.
    const wfConfig = await loadWorkflowConfig(db as Record<string, any>, request, 'probation_confirmation');
    if (wfConfig && currentStage !== 'completed') {
      let tierIdx = Number(probationData.tierIndex) || 0;
      if (!tierIdx) {
        if (currentStage === 'hr_review') tierIdx = 1;
        else if (currentStage === 'md_review') tierIdx = Math.min(2, wfConfig.tiers.length);
        else tierIdx = 1;
      }
      tierIdx = Math.min(tierIdx, wfConfig.tiers.length);
      const currentTierDef = wfConfig.tiers[tierIdx - 1];
      const resolved = await resolveTierApprovers(db as Record<string, any>, currentTierDef, existing.employeeId);

      // Permission gate for the current tier
      let allowed = isMDAdmin || resolved.userIds.includes(String(decoded.userId));
      if (!allowed && currentTierDef.approverType === 'hr_admin' && ['admin', 'company_hr_admin', 'hr_admin', 'manager'].includes(userRole)) allowed = true;
      if (!allowed) {
        return NextResponse.json({
          error: `This probation review is waiting for approval from: ${resolved.label}. You are not an approver at this stage.`,
        }, { status: 403, headers: corsHeaders() });
      }

      // Record this tier's decision
      probationData.tierDecisions = Array.isArray(probationData.tierDecisions) ? probationData.tierDecisions : [];
      probationData.tierDecisions.push({
        tier: tierIdx,
        approverType: currentTierDef.approverType,
        approverName: resolved.label,
        action,
        comments: comments || '',
        by: decoded.userId,
        at: new Date().toISOString(),
      });
      if (action === 'extend' && extensionPeriod) {
        probationData.extensionPeriod = extensionPeriod;
      }

      const reviewForName = await db.performanceReview.update({
        where: { id },
        data: { comments: JSON.stringify(probationData) },
        include: { employee: { select: { firstName: true, lastName: true, employeeId: true } } },
      });
      const empName = `${(reviewForName as any).employee?.firstName || ''} ${(reviewForName as any).employee?.lastName || ''}`.trim();

      const isLastTier = tierIdx >= wfConfig.tiers.length;
      if (!isLastTier) {
        // Advance to the next tier
        probationData.tierIndex = tierIdx + 1;
        probationData.workflowStage = `tier_${tierIdx + 1}`;
        await db.performanceReview.update({ where: { id }, data: { status: 'pending', comments: JSON.stringify(probationData) } });

        const nextTierDef = wfConfig.tiers[tierIdx];
        const nextResolved = await resolveTierApprovers(db as Record<string, any>, nextTierDef, existing.employeeId);
        for (const uid of nextResolved.userIds) {
          try {
            await db.notification.create({
              data: {
                userId: uid,
                title: `Probation Review Needs Your Approval — ${empName}`,
                message: `Tier ${tierIdx} decision (${action}) has been recorded. Your approval is required as ${nextResolved.label} (tier ${tierIdx + 1} of ${wfConfig.tiers.length}).`,
                type: 'probation',
                category: 'probation_tier_review',
                isRead: false,
                isEmailSent: false,
                actionUrl: '/employees/probation',
              },
            }).catch(() => null);
          } catch { /* non-critical */ }
        }
        try {
          await db.auditLog.create({
            data: { userId: decoded.userId as string, action: 'PROBATION_TIER_REVIEW', module: 'employees', details: `Tier ${tierIdx} (${resolved.label}) decision "${action}" recorded for ${empName}. Advanced to tier ${tierIdx + 1}.` },
          });
        } catch { /* non-critical */ }

        return NextResponse.json({
          success: true,
          message: `Decision recorded. Sent to ${nextResolved.label} (tier ${tierIdx + 1} of ${wfConfig.tiers.length}) for approval.`,
          probation: { id, status: 'pending', workflowStage: probationData.workflowStage, tierIndex: tierIdx + 1 },
        }, { headers: corsHeaders() });
      }

      // ─── Final tier: finalize the review (same semantics as legacy md_review) ───
      let newStatus = 'pending';
      let newDecision = 'pending';
      if (action === 'approve') { newStatus = 'completed'; newDecision = 'confirm'; }
      else if (action === 'extend') { newStatus = 'in_progress'; newDecision = 'extend'; }
      else if (action === 'reject') { newStatus = 'rejected'; newDecision = 'terminate'; }

      probationData.decision = newDecision;
      probationData.finalAction = action;
      probationData.finalComments = comments || '';
      probationData.workflowStage = 'completed';
      probationData.tierIndex = tierIdx;

      const finalReview = await db.performanceReview.update({
        where: { id },
        data: { status: newStatus, comments: JSON.stringify(probationData), reviewDate: new Date() },
        include: { employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } } },
      });

      if (action === 'approve') {
        try {
          await db.employee.update({ where: { id: existing.employeeId }, data: { employeeStatus: 'confirmed' } });
        } catch { /* non-critical */ }
      }

      // Notify HR admins that the decision is final
      try {
        const { getPlatformDb } = await import('@/lib/tenant-db');
        const platformDb = getPlatformDb();
        const hrAdmins = await platformDb.user.findMany({
          where: { role: { in: ['admin', 'company_hr_admin', 'hr_admin'] }, status: 'active' },
          select: { id: true },
        }).catch(() => []);
        const decisionLabel = newDecision === 'confirm' ? 'Confirmed' : newDecision === 'extend' ? 'Extended' : 'Terminated';
        for (const hr of hrAdmins) {
          try {
            await db.notification.create({
              data: {
                userId: hr.id,
                title: `Probation Decision Finalized — ${empName}`,
                message: `The probation approval chain has completed for ${empName}.\n\nFinal Decision: ${decisionLabel}\nComments: ${comments || 'No comments'}`,
                type: 'probation',
                category: 'probation_completed',
                isRead: false,
                isEmailSent: false,
                actionUrl: '/employees/probation',
              },
            }).catch(() => null);
          } catch { /* non-critical */ }
        }
      } catch { /* non-critical */ }

      try {
        await db.auditLog.create({
          data: { userId: decoded.userId as string, action: `PROBATION_FINAL_${action.toUpperCase()}`, module: 'employees', details: `Final tier decision "${action}" (${newDecision}) for ${empName}. Chain: ${wfConfig.tiers.length} tier(s).` },
        });
      } catch { /* non-critical */ }

      return NextResponse.json({
        success: true,
        message: `Probation review ${action}d at the final approval tier. Employee status updated.`,
        probation: { id, status: newStatus, decision: newDecision, workflowStage: 'completed' },
      }, { headers: corsHeaders() });
    }

    // ─── Stage 1: HR Review ───
    if (currentStage === 'hr_review') {
      if (!isHRAdmin) {
        return NextResponse.json({
          error: 'Only HR/Admin can submit the initial probation review decision. MD/Admin will review after HR submits.',
        }, { status: 403, headers: corsHeaders() });
      }

      // HR submits their decision — moves to MD/Admin for final confirmation
      // Map action → HR decision
      let hrDecision = 'pending';
      if (action === 'approve') hrDecision = 'confirm';
      else if (action === 'extend') hrDecision = 'extend';
      else if (action === 'reject') hrDecision = 'terminate';

      probationData.hrDecision = hrDecision;
      probationData.hrAction = action;
      probationData.hrComments = comments || '';
      probationData.hrActionedBy = decoded.userId;
      probationData.hrActionDate = new Date().toISOString();
      probationData.workflowStage = 'md_review'; // Move to MD/Admin for final confirmation
      if (action === 'extend' && extensionPeriod) {
        probationData.extensionPeriod = extensionPeriod;
      }

      // Status stays 'pending' — MD/Admin needs to confirm
      const review = await db.performanceReview.update({
        where: { id },
        data: {
          status: 'pending', // Still pending MD confirmation
          comments: JSON.stringify(probationData),
          improvements: comments || null,
        },
        include: {
          employee: { select: { firstName: true, lastName: true, employeeId: true, userId: true } },
        },
      });

      // ─── Notify MD/Admin (super_admin, tenant_admin) for final confirmation ───
      try {
        const { getPlatformDb } = await import('@/lib/tenant-db');
        const platformDb = getPlatformDb();
        const mdAdmins = await platformDb.user.findMany({
          where: {
            role: { in: ['super_admin', 'tenant_admin'] },
            status: 'active',
          },
          select: { id: true, email: true, name: true },
        }).catch(() => []);

        const emp = (review as any).employee || {};
        const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
        const decisionLabel = hrDecision === 'confirm' ? 'Confirm (End Probation)' : hrDecision === 'extend' ? 'Extend Probation' : 'Terminate';

        for (const md of mdAdmins) {
          try {
            await db.notification.create({
              data: {
                userId: md.id,
                title: `Probation Review Needs Your Final Approval — ${empName}`,
                message: `HR has submitted their decision for ${empName}'s probation review.\n\nHR Decision: ${decisionLabel}\nHR Comments: ${comments || 'No comments'}\n\nPlease review and provide your final confirmation.`,
                type: 'probation',
                category: 'probation_md_review',
                isRead: false,
                isEmailSent: false,
                actionUrl: '/employees/probation',
              },
            }).catch(() => null);
          } catch { /* non-critical */ }
        }
      } catch { /* non-critical */ }

      // Audit log
      try {
        await db.auditLog.create({
          data: {
            userId: decoded.userId as string,
            action: 'PROBATION_HR_REVIEW',
            module: 'employees',
            details: `HR submitted probation decision (${hrDecision}) for ${(review as any).employee?.firstName} ${(review as any).employee?.lastName}. Sent to MD/Admin for final confirmation.`,
          },
        });
      } catch { /* non-critical */ }

      return NextResponse.json({
        success: true,
        message: 'HR decision submitted. Sent to MD/Admin for final confirmation.',
        probation: { id: review.id, status: 'pending', workflowStage: 'md_review', hrDecision },
      }, { headers: corsHeaders() });
    }

    // ─── Stage 2: MD/Admin Final Confirmation ───
    if (currentStage === 'md_review') {
      if (!isMDAdmin) {
        return NextResponse.json({
          error: 'Only MD/Admin (super_admin, tenant_admin) can provide final confirmation. HR has already submitted their review.',
        }, { status: 403, headers: corsHeaders() });
      }

      // MD/Admin confirms or overrides HR's decision
      let newStatus = 'pending';
      let newDecision = 'pending';
      if (action === 'approve') {
        newStatus = 'completed';
        newDecision = 'confirm';
      } else if (action === 'extend') {
        newStatus = 'in_progress';
        newDecision = 'extend';
      } else if (action === 'reject') {
        newStatus = 'rejected';
        newDecision = 'terminate';
      }

      probationData.decision = newDecision;
      probationData.mdAction = action;
      probationData.mdComments = comments || '';
      probationData.mdActionedBy = decoded.userId;
      probationData.mdActionDate = new Date().toISOString();
      probationData.workflowStage = 'completed';

      if (action === 'extend' && extensionPeriod) {
        probationData.extensionPeriod = extensionPeriod;
      }

      const review = await db.performanceReview.update({
        where: { id },
        data: {
          status: newStatus,
          comments: JSON.stringify(probationData),
          reviewDate: new Date(),
        },
        include: {
          employee: { select: { firstName: true, lastName: true, employeeId: true, id: true } },
        },
      });

      // ─── If approved (confirmed), update employee's employeeStatus to 'confirmed' ───
      if (action === 'approve') {
        try {
          await db.employee.update({
            where: { id: (review as any).employeeId },
            data: { employeeStatus: 'confirmed' },
          }).catch(() => null);
        } catch { /* non-critical */ }
      }

      // ─── Notify HR that MD has made the final decision ───
      try {
        const { getPlatformDb } = await import('@/lib/tenant-db');
        const platformDb = getPlatformDb();
        const hrAdmins = await platformDb.user.findMany({
          where: {
            role: { in: ['admin', 'company_hr_admin', 'hr_admin'] },
            status: 'active',
          },
          select: { id: true, email: true, name: true },
        }).catch(() => []);

        const emp = (review as any).employee || {};
        const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
        const decisionLabel = newDecision === 'confirm' ? 'Confirmed' : newDecision === 'extend' ? 'Extended' : 'Terminated';

        for (const hr of hrAdmins) {
          try {
            await db.notification.create({
              data: {
                userId: hr.id,
                title: `Probation Decision Finalized — ${empName}`,
                message: `MD/Admin has finalized the probation decision for ${empName}.\n\nFinal Decision: ${decisionLabel}\nMD Comments: ${comments || 'No comments'}\n\nThe employee's status has been updated accordingly.`,
                type: 'probation',
                category: 'probation_completed',
                isRead: false,
                isEmailSent: false,
                actionUrl: '/employees/probation',
              },
            }).catch(() => null);
          } catch { /* non-critical */ }
        }
      } catch { /* non-critical */ }

      // Audit log
      try {
        await db.auditLog.create({
          data: {
            userId: decoded.userId as string,
            action: `PROBATION_MD_${action.toUpperCase()}`,
            module: 'employees',
            details: `MD/Admin finalized probation decision (${newDecision}) for ${(review as any).employee?.firstName} ${(review as any).employee?.lastName}`,
          },
        });
      } catch { /* non-critical */ }

      return NextResponse.json({
        success: true,
        message: `Probation review ${action}d by MD/Admin. Employee status updated.`,
        probation: { id: review.id, status: newStatus, decision: newDecision, workflowStage: 'completed' },
      }, { headers: corsHeaders() });
    }

    // If workflowStage is 'completed', no further actions allowed
    return NextResponse.json({
      error: `This probation review has already been completed. Workflow stage: ${currentStage}`,
    }, { status: 400, headers: corsHeaders() });
  } catch (error) {
    console.error('Approve/Reject probation review error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}

/**
 * DELETE /api/employees/probation/[id]
 * Delete a probation review (HR/Admin only, pending reviews only).
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = await getDb(request);
  try {
    const { id } = await params;
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    // Only HR/Admin can delete
    const userRole = (decoded.role as string) || 'employee';
    if (!['super_admin', 'tenant_admin', 'admin', 'company_hr_admin', 'hr_admin'].includes(userRole.toLowerCase())) {
      return NextResponse.json({ error: 'Only HR/Admin can delete probation reviews' }, { status: 403, headers: corsHeaders() });
    }

    const existing = await db.performanceReview.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Probation review not found' }, { status: 404, headers: corsHeaders() });
    }

    // Only allow deleting pending reviews
    if (existing.status !== 'pending') {
      return NextResponse.json({
        error: `Cannot delete a probation review that has been ${existing.status}. Only pending reviews can be deleted.`,
      }, { status: 400, headers: corsHeaders() });
    }

    await db.performanceReview.delete({ where: { id } });

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          userId: decoded.userId as string,
          action: 'DELETE_PROBATION_REVIEW',
          module: 'employees',
          details: `Deleted probation review ${id}`,
        },
      });
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, message: 'Probation review deleted successfully' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Delete probation review error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders() });
  }
}
