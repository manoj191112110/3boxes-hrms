/**
 * Onboarding Cascade — candidate → employee one-click conversion.
 *
 * Given an accepted offer (or a hired job application), this service:
 *   1. Creates the Employee record (status: probation, from candidate/offer data)
 *   2. Creates the linked PreboardingCandidate record (document collection /
 *      BGV / provisioning pipeline)
 *   3. Auto-generates OnboardingTasks from active OnboardingTaskTemplates
 *      (dueDate = joining date + dueOffsetDays; role/department aware)
 *   4. Notifies the right departments:
 *        - IT users          → it_setup tasks       (system access / email / device)
 *        - Admin users       → workstation readiness
 *        - Finance users     → payroll_setup / benefits enrollment
 *        - HR admins         → hr_docs / orientation tasks
 *   5. Marks the job application 'hired' and decrements the posting's vacancies
 *      (auto-closes the posting when it reaches zero)
 */

export interface ConvertInput {
  tenantId?: string | null;
  offerId?: string | null;
  applicationId?: string | null;
  candidateId?: string | null;
  joiningDate?: string | null;
  probationPeriod?: number | null;
  actingUserId?: string | null;
}

export interface ConvertResult {
  employeeId: string;
  preboardingCandidateId: string | null;
  tasksCreated: number;
  notificationsSent: number;
}

function pickStr(...vals: unknown[]): string {
  for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim();
  return '';
}

/**
 * Core conversion. Runs inside the tenant DB client passed as `db`.
 */
export async function convertCandidateToEmployee(db: Record<string, any>, input: ConvertInput): Promise<ConvertResult> {
  const result: ConvertResult = { employeeId: '', preboardingCandidateId: null, tasksCreated: 0, notificationsSent: 0 };

  // ── 1. Gather source data ──
  let offer: Record<string, any> | null = null;
  let application: Record<string, any> | null = null;
  let candidate: Record<string, any> | null = null;

  if (input.offerId) {
    offer = await (db as any).offer.findUnique({ where: { id: input.offerId } });
    if (offer?.candidateId) {
      candidate = await (db as any).candidate.findUnique({ where: { id: offer.candidateId } }).catch(() => null);
    }
    if (offer?.jobPostingId && !input.applicationId) {
      application = await (db as any).jobApplication.findFirst({
        where: { jobPostingId: offer.jobPostingId, candidateEmail: offer.candidateEmail },
      }).catch(() => null);
    }
  }
  if (!application && input.applicationId) {
    application = await (db as any).jobApplication.findUnique({
      where: { id: input.applicationId },
      include: { jobPosting: { select: { id: true, title: true, departmentId: true, vacancies: true } } },
    });
    if (application?.candidateId && !candidate) {
      candidate = await (db as any).candidate.findUnique({ where: { id: application.candidateId } }).catch(() => null);
    }
  }
  if (!candidate && input.candidateId) {
    candidate = await (db as any).candidate.findUnique({ where: { id: input.candidateId } }).catch(() => null);
  }

  const firstName = pickStr(offer?.candidateName, application?.candidateName, candidate?.fullName, candidate?.firstName).split(' ')[0] || pickStr(candidate?.firstName) || 'New';
  const rest = pickStr(offer?.candidateName, application?.candidateName, candidate?.fullName).split(' ').slice(1).join(' ');
  const lastName = rest || pickStr(candidate?.lastName) || 'Employee';
  const email = pickStr(candidate?.email, application?.candidateEmail, offer?.candidateEmail) || `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}.${Date.now().toString(36)}@newhire.tenant`;
  const phone = pickStr(candidate?.phone, application?.candidatePhone);
  const position = pickStr(offer?.position, application?.jobPosting?.title, candidate?.currentRole, 'New Hire');
  const joiningDate = input.joiningDate ? new Date(input.joiningDate) : (offer?.joiningDate ? new Date(offer.joiningDate) : new Date());
  const probationDays = input.probationPeriod || offer?.probationPeriod || 90;

  // Resolve department: from posting, else first department
  let departmentId = pickStr(application?.jobPosting?.departmentId) || pickStr(candidate?.departmentId) || null;
  if (!departmentId) {
    const dept = await (db as any).department.findFirst({ select: { id: true } }).catch(() => null);
    departmentId = dept?.id || null;
  }
  // Company (tenant DBs typically hold one company)
  let companyId = pickStr(candidate?.companyId);
  if (!companyId) {
    const comp = await (db as any).company.findFirst({ select: { id: true } }).catch(() => null);
    companyId = comp?.id || null;
  }

  // Avoid duplicate conversion (same email already an active employee)
  const existingEmp = await (db as any).employee.findFirst({ where: { email }, select: { id: true } });
  if (existingEmp) throw new Error('An employee with this email already exists — the candidate may already be converted.');

  // ── 2. Create the Employee ──
  const employeeCode = `EMP-${Date.now().toString(36).toUpperCase()}`;
  const employee = await (db as any).employee.create({
    data: {
      employeeId: employeeCode,
      firstName,
      lastName,
      email,
      ...(phone ? { phone } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(companyId ? { companyId } : {}),
      position,
      employeeStatus: 'probation',
      status: 'active',
      dateOfJoining: joiningDate,
      workAnniversary: joiningDate,
    },
  });
  result.employeeId = employee.id;

  // ── 3. Preboarding record ──
  try {
    const preboarding = await (db as any).preboardingCandidate.create({
      data: {
        candidateName: `${firstName} ${lastName}`.trim(),
        candidateEmail: email,
        jobTitle: position,
        offerDate: offer?.sentAt || new Date(),
        joiningDate,
        offerId: offer?.id || null,
        status: 'document_collection',
        employeeId: employee.id,
      },
    });
    result.preboardingCandidateId = preboarding?.id || null;
  } catch { /* non-critical */ }

  // ── 4. Auto-generate onboarding tasks from templates ──
  const taskRows: Record<string, unknown>[] = [];
  try {
    const templates = await (db as any).onboardingTaskTemplate.findMany({ where: { isActive: true } });
    for (const t of templates) {
      if (t.appliesToDepartment && departmentId && t.appliesToDepartment !== departmentId) continue;
      const due = new Date(joiningDate);
      due.setDate(due.getDate() + Number(t.dueOffsetDays || 0));
      taskRows.push({
        employeeId: employee.id,
        task: t.task || t.name || 'Onboarding task',
        category: t.category || 'general',
        status: 'pending',
        dueDate: due,
        assignedBy: 'System (auto-generated)',
        templateId: t.id || null,
        preboardingCandidateId: result.preboardingCandidateId,
      });
    }
  } catch { /* templates optional */ }

  // Baseline checklist when no templates exist
  if (taskRows.length === 0) {
    const base: Array<[string, string, number]> = [
      ['Send digital paperwork pack (tax forms, direct deposit, employment agreement, emergency contact)', 'hr_docs', -3],
      ['Collect signed NDA and policy acknowledgments', 'hr_docs', 0],
      ['Create system access and corporate email account', 'it_setup', -1],
      ['Allocate laptop / device and workstation', 'it_setup', -1],
      ['Payroll setup and benefits enrollment', 'payroll_setup', 1],
      ['Team introductions and office orientation', 'introduction', 0],
      ['Assign initial training modules and KRAs', 'training', 7],
      ['First check-in with buddy / mentor', 'buddy_setup', 1],
    ];
    for (const [task, category, offset] of base) {
      const due = new Date(joiningDate);
      due.setDate(due.getDate() + offset);
      taskRows.push({ employeeId: employee.id, task, category, status: 'pending', dueDate: due, assignedBy: 'System (auto-generated)', preboardingCandidateId: result.preboardingCandidateId });
    }
  }

  try {
    await (db as any).onboardingTask.createMany({ data: taskRows });
    result.tasksCreated = taskRows.length;
  } catch {
    for (const row of taskRows) {
      try { await (db as any).onboardingTask.create({ data: row }); result.tasksCreated++; } catch { /* skip */ }
    }
  }

  // ── 5. Cross-departmental notifications ──
  const notifyRoles: Array<{ roles: string[]; title: string; message: string }> = [
    {
      roles: ['it_admin', 'it', 'admin'],
      title: `IT Provisioning Needed — ${firstName} ${lastName}`,
      message: `New hire ${firstName} ${lastName} (${position}) joins on ${joiningDate.toLocaleDateString()}. Please set up system access, corporate email, and device allocation.`,
    },
    {
      roles: ['tenant_admin', 'admin'],
      title: `Workstation Readiness — ${firstName} ${lastName}`,
      message: `Admin: prepare the workstation and seating for ${firstName} ${lastName} (${position}), joining ${joiningDate.toLocaleDateString()}.`,
    },
    {
      roles: ['finance', 'finance_admin', 'tenant_admin'],
      title: `Payroll Setup Required — ${firstName} ${lastName}`,
      message: `Finance: complete payroll setup and benefits enrollment for ${firstName} ${lastName} (${position}), joining ${joiningDate.toLocaleDateString()}.`,
    },
    {
      roles: ['admin', 'hr_admin', 'company_hr_admin', 'tenant_admin'],
      title: `Preboarding Started — ${firstName} ${lastName}`,
      message: `HR: send the digital paperwork pack (tax forms, direct deposit, employment agreement, emergency contact, NDA) and track background checks for ${firstName} ${lastName}.`,
    },
  ];

  const notified = new Set<string>();
  for (const n of notifyRoles) {
    try {
      const users = await (db as any).user.findMany({
        where: { role: { in: n.roles }, status: 'active' },
        select: { id: true },
        take: 30,
      });
      for (const u of users) {
        if (notified.has(`${u.id}:${n.title}`)) continue;
        notified.add(`${u.id}:${n.title}`);
        try {
          await (db as any).notification.create({
            data: {
              userId: u.id,
              title: n.title,
              message: n.message,
              type: 'info',
              category: 'recruitment',
              link: '/onboarding',
              isRead: false,
              isEmailSent: false,
            },
          }).catch(() => null);
          result.notificationsSent++;
        } catch { /* non-critical */ }
      }
    } catch { /* non-critical */ }
  }

  // ── 6. Mark application hired + decrement posting vacancies ──
  try {
    if (application?.id) {
      await (db as any).jobApplication.update({ where: { id: application.id }, data: { status: 'hired' } }).catch(() => null);
    }
    const postingId = application?.jobPosting?.id || application?.jobPostingId || offer?.jobPostingId || null;
    if (postingId) {
      const posting = await (db as any).jobPosting.findUnique({ where: { id: postingId }, select: { vacancies: true, status: true } });
      if (posting && Number(posting.vacancies) > 0) {
        const remaining = Number(posting.vacancies) - 1;
        await (db as any).jobPosting.update({
          where: { id: postingId },
          data: { vacancies: remaining, ...(remaining <= 0 ? { status: 'filled' } : {}) },
        }).catch(() => null);
      }
    }
  } catch { /* non-critical */ }

  // ── 7. Audit trail ──
  try {
    await (db as any).auditLog.create({
      data: {
        userId: input.actingUserId || null,
        action: 'CANDIDATE_CONVERTED_TO_EMPLOYEE',
        module: 'recruitment',
        details: `Converted ${firstName} ${lastName} (${position}) to employee ${employeeCode}. Offer: ${offer?.id || 'n/a'}. Tasks generated: ${result.tasksCreated}.`,
      },
    }).catch(() => null);
  } catch { /* non-critical */ }

  return result;
}
