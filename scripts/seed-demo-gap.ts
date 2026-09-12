/**
 * 3Boxes HRMS — Demo Gap Seed Script
 * Fills the empty/missing tables in tenant_demo:
 *   - ProjectTask (0 → seeded)
 *   - ProjectMilestone (0 → seeded)
 *   - ProjectAllocation (0 → seeded)
 *   - FeatureFlag (0 → seeded)
 *
 * Also fixes orphaned tenant references for company groups and users
 * that reference non-existent Tenant rows.
 *
 * Usage: npx tsx scripts/seed-demo-gap.ts
 */

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const connectionString = 'postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech/tenant_demo?sslmode=require';
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding DEMO GAP data (ProjectTask, ProjectMilestone, ProjectAllocation, FeatureFlag)...');

  // ── Get tenant ──
  const tenant = await prisma.tenant.findUnique({ where: { slug: '3boxes-hrms-demo' } });
  if (!tenant) {
    console.error('❌ Demo tenant not found!');
    process.exit(1);
  }
  console.log(`✅ Found tenant: ${tenant.name} (${tenant.id})`);

  // ── Fix orphaned company groups ──
  const orphanGroups = await prisma.companyGroup.findMany({
    where: { tenantId: { not: tenant.id } },
  });
  if (orphanGroups.length > 0) {
    console.log(`🔧 Fixing ${orphanGroups.length} orphaned company groups...`);
    for (const group of orphanGroups) {
      await prisma.companyGroup.update({
        where: { id: group.id },
        data: { tenantId: tenant.id },
      });
    }
    console.log('✅ All company groups now belong to demo tenant');
  }

  // ── Fix orphaned users ──
  const orphanUsers = await prisma.user.findMany({
    where: { tenantId: { not: tenant.id } },
  });
  if (orphanUsers.length > 0) {
    console.log(`🔧 Fixing ${orphanUsers.length} orphaned users...`);
    for (const user of orphanUsers) {
      await prisma.user.update({
        where: { id: user.id },
        data: { tenantId: tenant.id },
      });
    }
    console.log('✅ All orphaned users now belong to demo tenant');
  }

  // ── Get projects ──
  const projects = await prisma.project.findMany();
  console.log(`📊 Found ${projects.length} projects: ${projects.map(p => p.name).join(', ')}`);

  // ── Get employees ──
  const employees = await prisma.employee.findMany({
    select: { id: true, employeeId: true, firstName: true, lastName: true, companyId: true, designationId: true },
  });
  console.log(`📊 Found ${employees.length} employees`);

  // ── Get designations ──
  const designations = await prisma.designation.findMany({
    select: { id: true, title: true },
  });

  // ═══════════════════════════════════════════
  // 1. SEED ProjectMilestone
  // ═══════════════════════════════════════════
  console.log('\n📦 Seeding ProjectMilestone...');

  const milestoneData: { name: string; plannedDate: Date; completionPct: number; approvalStatus: string; invoiceStatus: string; billingAmount: number | null }[][] = [
    // Project Alpha (TechCorp Global) - active, fixed, internal
    [
      { name: 'Discovery & Planning', plannedDate: new Date('2025-10-01'), completionPct: 100, approvalStatus: 'approved', invoiceStatus: 'not_invoiced', billingAmount: null },
      { name: 'Core Development', plannedDate: new Date('2025-12-15'), completionPct: 75, approvalStatus: 'approved', invoiceStatus: 'not_invoiced', billingAmount: null },
      { name: 'Testing & QA', plannedDate: new Date('2026-03-01'), completionPct: 30, approvalStatus: 'pending', invoiceStatus: 'not_invoiced', billingAmount: null },
      { name: 'Launch & Handover', plannedDate: new Date('2026-05-01'), completionPct: 0, approvalStatus: 'pending', invoiceStatus: 'not_invoiced', billingAmount: null },
    ],
    // Client Portal Redesign (HealthFirst Solutions) - on_track, client, T&M
    [
      { name: 'UX Research & Wireframes', plannedDate: new Date('2025-11-01'), completionPct: 100, approvalStatus: 'approved', invoiceStatus: 'invoiced', billingAmount: 25000 },
      { name: 'Frontend Development', plannedDate: new Date('2026-01-15'), completionPct: 85, approvalStatus: 'approved', invoiceStatus: 'invoiced', billingAmount: 45000 },
      { name: 'Backend API Integration', plannedDate: new Date('2026-03-01'), completionPct: 60, approvalStatus: 'pending', invoiceStatus: 'not_invoiced', billingAmount: 35000 },
      { name: 'UAT & Deployment', plannedDate: new Date('2026-04-30'), completionPct: 0, approvalStatus: 'pending', invoiceStatus: 'not_invoiced', billingAmount: 15000 },
    ],
    // Mobile App Development (InnovateTech Labs) - planning, internal, fixed
    [
      { name: 'Requirements & Prototyping', plannedDate: new Date('2026-01-01'), completionPct: 100, approvalStatus: 'approved', invoiceStatus: 'not_invoiced', billingAmount: null },
      { name: 'iOS & Android Development', plannedDate: new Date('2026-04-01'), completionPct: 20, approvalStatus: 'pending', invoiceStatus: 'not_invoiced', billingAmount: null },
      { name: 'Beta Testing', plannedDate: new Date('2026-07-01'), completionPct: 0, approvalStatus: 'pending', invoiceStatus: 'not_invoiced', billingAmount: null },
    ],
    // Data Migration (InnovateTech Labs) - planning, support, non_billable
    [
      { name: 'Data Assessment & Mapping', plannedDate: new Date('2026-02-01'), completionPct: 100, approvalStatus: 'approved', invoiceStatus: 'not_invoiced', billingAmount: null },
      { name: 'Migration Execution', plannedDate: new Date('2026-04-01'), completionPct: 40, approvalStatus: 'pending', invoiceStatus: 'not_invoiced', billingAmount: null },
      { name: 'Validation & Cutover', plannedDate: new Date('2026-06-01'), completionPct: 0, approvalStatus: 'pending', invoiceStatus: 'not_invoiced', billingAmount: null },
    ],
    // API Integration (GlobalFin Services) - on_track, client, hourly
    [
      { name: 'API Design & Documentation', plannedDate: new Date('2025-12-01'), completionPct: 100, approvalStatus: 'approved', invoiceStatus: 'invoiced', billingAmount: 18000 },
      { name: 'Integration Development', plannedDate: new Date('2026-02-15'), completionPct: 70, approvalStatus: 'approved', invoiceStatus: 'invoiced', billingAmount: 32000 },
      { name: 'Testing & Certification', plannedDate: new Date('2026-04-01'), completionPct: 30, approvalStatus: 'pending', invoiceStatus: 'not_invoiced', billingAmount: 12000 },
      { name: 'Production Rollout', plannedDate: new Date('2026-05-15'), completionPct: 0, approvalStatus: 'pending', invoiceStatus: 'not_invoiced', billingAmount: 8000 },
    ],
    // Cloud Infrastructure (GreenLeaf Energy) - on_track, r_and_d, retainer
    [
      { name: 'Architecture Design', plannedDate: new Date('2025-11-01'), completionPct: 100, approvalStatus: 'approved', invoiceStatus: 'not_invoiced', billingAmount: null },
      { name: 'Infrastructure Provisioning', plannedDate: new Date('2026-01-01'), completionPct: 90, approvalStatus: 'approved', invoiceStatus: 'not_invoiced', billingAmount: null },
      { name: 'Security Hardening', plannedDate: new Date('2026-03-01'), completionPct: 60, approvalStatus: 'pending', invoiceStatus: 'not_invoiced', billingAmount: null },
      { name: 'Monitoring & Optimization', plannedDate: new Date('2026-05-01'), completionPct: 20, approvalStatus: 'pending', invoiceStatus: 'not_invoiced', billingAmount: null },
    ],
  ];

  const createdMilestones: { id: string; projectId: string; name: string }[] = [];

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    const milestones = milestoneData[i] || [];

    for (const m of milestones) {
      const milestone = await prisma.projectMilestone.create({
        data: {
          projectId: project.id,
          name: m.name,
          plannedDate: m.plannedDate,
          completionPct: m.completionPct,
          approvalStatus: m.approvalStatus,
          invoiceStatus: m.invoiceStatus,
          billingAmount: m.billingAmount,
        },
      });
      createdMilestones.push({ id: milestone.id, projectId: project.id, name: m.name });
      console.log(`  ✅ Milestone: ${m.name} (${project.name})`);
    }
  }

  console.log(`📊 Created ${createdMilestones.length} project milestones`);

  // ═══════════════════════════════════════════
  // 2. SEED ProjectTask
  // ═══════════════════════════════════════════
  console.log('\n📦 Seeding ProjectTask...');

  const taskDefinitions: { name: string; category: string; priority: string; status: string; estimatedHours: number; isBillable: boolean; description: string }[][] = [
    // Project Alpha tasks
    [
      { name: 'Define project scope', category: 'planning', priority: 'high', status: 'done', estimatedHours: 40, isBillable: false, description: 'Create detailed project scope document with requirements breakdown' },
      { name: 'Architecture design', category: 'design', priority: 'high', status: 'done', estimatedHours: 80, isBillable: false, description: 'Design system architecture and create technical specifications' },
      { name: 'Database schema design', category: 'design', priority: 'high', status: 'done', estimatedHours: 32, isBillable: false, description: 'Design database schema with entity relationships' },
      { name: 'Backend API development', category: 'development', priority: 'high', status: 'in_progress', estimatedHours: 240, isBillable: false, description: 'Develop REST API endpoints for core business logic' },
      { name: 'Frontend dashboard', category: 'development', priority: 'medium', status: 'in_progress', estimatedHours: 160, isBillable: false, description: 'Build dashboard UI with data visualization widgets' },
      { name: 'Unit testing', category: 'testing', priority: 'medium', status: 'in_progress', estimatedHours: 80, isBillable: false, description: 'Write unit tests for all backend and frontend components' },
      { name: 'Integration testing', category: 'testing', priority: 'medium', status: 'todo', estimatedHours: 60, isBillable: false, description: 'End-to-end integration testing across all modules' },
      { name: 'Performance optimization', category: 'optimization', priority: 'low', status: 'todo', estimatedHours: 40, isBillable: false, description: 'Optimize query performance and frontend rendering' },
      { name: 'Security audit', category: 'security', priority: 'high', status: 'todo', estimatedHours: 32, isBillable: false, description: 'Conduct security audit and fix vulnerabilities' },
      { name: 'Documentation', category: 'documentation', priority: 'low', status: 'todo', estimatedHours: 24, isBillable: false, description: 'Create user documentation and API reference guides' },
    ],
    // Client Portal Redesign tasks
    [
      { name: 'User research interviews', category: 'research', priority: 'high', status: 'done', estimatedHours: 48, isBillable: true, description: 'Conduct stakeholder interviews and user research sessions' },
      { name: 'Wireframe design', category: 'design', priority: 'high', status: 'done', estimatedHours: 64, isBillable: true, description: 'Create wireframes for all portal pages and user flows' },
      { name: 'UI/UX design', category: 'design', priority: 'high', status: 'done', estimatedHours: 96, isBillable: true, description: 'Design final UI mockups with responsive layouts' },
      { name: 'Frontend portal development', category: 'development', priority: 'high', status: 'in_progress', estimatedHours: 200, isBillable: true, description: 'Develop portal frontend with React components' },
      { name: 'Backend API for portal', category: 'development', priority: 'high', status: 'in_progress', estimatedHours: 160, isBillable: true, description: 'Build backend APIs for portal data access' },
      { name: 'Client authentication system', category: 'security', priority: 'high', status: 'in_progress', estimatedHours: 40, isBillable: true, description: 'Implement secure client login and session management' },
      { name: 'Document upload module', category: 'development', priority: 'medium', status: 'review', estimatedHours: 48, isBillable: true, description: 'Build document upload and management feature' },
      { name: 'Notification system', category: 'development', priority: 'medium', status: 'todo', estimatedHours: 32, isBillable: true, description: 'Implement real-time notification system for clients' },
      { name: 'Mobile responsive testing', category: 'testing', priority: 'medium', status: 'todo', estimatedHours: 24, isBillable: true, description: 'Test portal on various mobile devices and browsers' },
      { name: 'UAT with client stakeholders', category: 'testing', priority: 'high', status: 'todo', estimatedHours: 40, isBillable: true, description: 'User acceptance testing with HealthFirst stakeholders' },
    ],
    // Mobile App Development tasks
    [
      { name: 'Mobile app prototyping', category: 'design', priority: 'high', status: 'done', estimatedHours: 60, isBillable: false, description: 'Create interactive prototypes for iOS and Android' },
      { name: 'iOS app development', category: 'development', priority: 'high', status: 'in_progress', estimatedHours: 320, isBillable: false, description: 'Develop native iOS application with Swift' },
      { name: 'Android app development', category: 'development', priority: 'high', status: 'in_progress', estimatedHours: 320, isBillable: false, description: 'Develop native Android application with Kotlin' },
      { name: 'Push notification service', category: 'development', priority: 'medium', status: 'todo', estimatedHours: 40, isBillable: false, description: 'Implement push notification service for both platforms' },
      { name: 'Offline data sync', category: 'development', priority: 'medium', status: 'todo', estimatedHours: 60, isBillable: false, description: 'Build offline data synchronization mechanism' },
      { name: 'Beta testing program', category: 'testing', priority: 'high', status: 'todo', estimatedHours: 80, isBillable: false, description: 'Organize beta testing with select employee group' },
    ],
    // Data Migration tasks
    [
      { name: 'Source data inventory', category: 'analysis', priority: 'high', status: 'done', estimatedHours: 40, isBillable: false, description: 'Catalog all source databases and data formats' },
      { name: 'Mapping specifications', category: 'analysis', priority: 'high', status: 'done', estimatedHours: 60, isBillable: false, description: 'Create field mapping specifications for each source system' },
      { name: 'ETL pipeline development', category: 'development', priority: 'high', status: 'in_progress', estimatedHours: 120, isBillable: false, description: 'Build ETL pipelines for data extraction and transformation' },
      { name: 'Data validation scripts', category: 'testing', priority: 'medium', status: 'todo', estimatedHours: 40, isBillable: false, description: 'Write data validation scripts to verify migration accuracy' },
      { name: 'Cutover execution plan', category: 'planning', priority: 'high', status: 'todo', estimatedHours: 24, isBillable: false, description: 'Plan and document cutover execution steps' },
    ],
    // API Integration tasks
    [
      { name: 'API specification design', category: 'design', priority: 'high', status: 'done', estimatedHours: 48, isBillable: true, description: 'Design OpenAPI specification for banking integrations' },
      { name: 'Core API development', category: 'development', priority: 'high', status: 'in_progress', estimatedHours: 200, isBillable: true, description: 'Develop core banking API integration endpoints' },
      { name: 'OAuth2 & PKCE implementation', category: 'security', priority: 'high', status: 'done', estimatedHours: 32, isBillable: true, description: 'Implement secure OAuth2 authentication with PKCE flow' },
      { name: 'Rate limiting & caching', category: 'development', priority: 'medium', status: 'in_progress', estimatedHours: 24, isBillable: true, description: 'Add rate limiting and response caching layers' },
      { name: 'Integration testing with bank APIs', category: 'testing', priority: 'high', status: 'in_progress', estimatedHours: 60, isBillable: true, description: 'Test integration with GlobalFin banking API sandbox' },
      { name: 'PCI-DSS compliance review', category: 'security', priority: 'high', status: 'todo', estimatedHours: 40, isBillable: true, description: 'Review all API endpoints for PCI-DSS compliance' },
      { name: 'Load testing', category: 'testing', priority: 'medium', status: 'todo', estimatedHours: 32, isBillable: true, description: 'Conduct load testing for high-volume transaction scenarios' },
      { name: 'API documentation portal', category: 'documentation', priority: 'medium', status: 'todo', estimatedHours: 24, isBillable: true, description: 'Create developer documentation portal' },
    ],
    // Cloud Infrastructure tasks
    [
      { name: 'Cloud architecture blueprint', category: 'design', priority: 'high', status: 'done', estimatedHours: 80, isBillable: false, description: 'Design multi-region cloud architecture blueprint' },
      { name: 'Kubernetes cluster setup', category: 'infrastructure', priority: 'high', status: 'done', estimatedHours: 60, isBillable: false, description: 'Set up Kubernetes clusters across regions' },
      { name: 'CI/CD pipeline configuration', category: 'infrastructure', priority: 'high', status: 'done', estimatedHours: 40, isBillable: false, description: 'Configure CI/CD pipelines for automated deployments' },
      { name: 'Network security groups', category: 'security', priority: 'high', status: 'in_progress', estimatedHours: 32, isBillable: false, description: 'Configure network security groups and firewall rules' },
      { name: 'Monitoring setup (Prometheus/Grafana)', category: 'operations', priority: 'medium', status: 'in_progress', estimatedHours: 48, isBillable: false, description: 'Set up Prometheus and Grafana monitoring stack' },
      { name: 'Auto-scaling policies', category: 'infrastructure', priority: 'medium', status: 'in_progress', estimatedHours: 24, isBillable: false, description: 'Configure auto-scaling policies for workloads' },
      { name: 'Disaster recovery testing', category: 'testing', priority: 'high', status: 'todo', estimatedHours: 40, isBillable: false, description: 'Test disaster recovery procedures across regions' },
      { name: 'Cost optimization review', category: 'operations', priority: 'low', status: 'todo', estimatedHours: 24, isBillable: false, description: 'Review and optimize cloud resource costs' },
    ],
  ];

  let totalTasksCreated = 0;

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    const tasks = taskDefinitions[i] || [];
    // Get milestones for this project to assign some tasks
    const projectMilestones = createdMilestones.filter(m => m.projectId === project.id);
    // Get employees for this project's company
    const projectEmployees = employees.filter(e => e.companyId === project.companyId);

    for (let j = 0; j < tasks.length; j++) {
      const t = tasks[j];
      // Assign milestone to some tasks (every other task gets a milestone if available)
      const milestoneId = projectMilestones.length > 0 && j < projectMilestones.length * 2
        ? projectMilestones[Math.min(Math.floor(j / 2), projectMilestones.length - 1)].id
        : null;
      // Assign employee to some tasks
      const assignedEmployee = projectEmployees.length > 0 && (t.status === 'in_progress' || t.status === 'done')
        ? projectEmployees[j % projectEmployees.length].id
        : null;

      const task = await prisma.projectTask.create({
        data: {
          projectId: project.id,
          milestoneId: milestoneId,
          name: t.name,
          category: t.category,
          assignedToId: assignedEmployee,
          estimatedHours: t.estimatedHours,
          actualHours: t.status === 'done' ? t.estimatedHours : (t.status === 'in_progress' ? Math.round(t.estimatedHours * 0.6) : 0),
          priority: t.priority,
          status: t.status,
          isBillable: t.isBillable,
          description: t.description,
          completedAt: t.status === 'done' ? new Date('2025-12-01') : null,
        },
      });
      totalTasksCreated++;
      console.log(`  ✅ Task: ${t.name} → ${project.name} [${t.status}]`);
    }
  }

  console.log(`📊 Created ${totalTasksCreated} project tasks`);

  // ═══════════════════════════════════════════
  // 3. SEED ProjectAllocation
  // ═══════════════════════════════════════════
  console.log('\n📦 Seeding ProjectAllocation...');

  let totalAllocationsCreated = 0;

  for (const project of projects) {
    const projectEmployees = employees.filter(e => e.companyId === project.companyId);
    // Select a subset of employees for this project (3-8 employees)
    const numAllocations = Math.min(Math.max(3, Math.floor(projectEmployees.length * 0.4)), 8);
    const selectedEmployees = projectEmployees.slice(0, numAllocations);

    // Determine billing status based on project billing type
    const isBillableProject = project.billingType !== 'non_billable';

    for (let k = 0; k < selectedEmployees.length; k++) {
      const emp = selectedEmployees[k];
      const isManager = k === 0;
      const allocationPct = isManager ? 50 : (k === 1 ? 100 : pick([75, 100, 50]));

      // Find the designation for this employee
      const empDesignation = designations.find(d => d.id === emp.designationId);
      const isSenior = empDesignation?.title?.toLowerCase().includes('senior') ||
                       empDesignation?.title?.toLowerCase().includes('lead') ||
                       empDesignation?.title?.toLowerCase().includes('manager') ||
                       empDesignation?.title?.toLowerCase().includes('director') ||
                       empDesignation?.title?.toLowerCase().includes('vp') ||
                       empDesignation?.title?.toLowerCase().includes('head');

      const billingRate = isBillableProject
        ? (isSenior ? pick([80, 90, 100, 120]) : pick([50, 60, 70, 75]))
        : 0;
      const internalCostRate = isSenior ? pick([40, 50, 60]) : pick([25, 30, 35]);

      const allocation = await prisma.projectAllocation.create({
        data: {
          projectId: project.id,
          employeeId: emp.id,
          role: isManager ? 'Project Manager' : (isSenior ? 'Senior Developer' : 'Developer'),
          allocationPct,
          startDate: new Date('2025-09-01'),
          endDate: project.endDate || null,
          billingStatus: isBillableProject ? 'billable' : 'non_billable',
          billingRate,
          internalCostRate,
          status: 'active',
        },
      });
      totalAllocationsCreated++;
      console.log(`  ✅ Allocation: ${emp.firstName} ${emp.lastName} → ${project.name} (${allocationPct}%${isManager ? ', PM' : ''})`);
    }
  }

  console.log(`📊 Created ${totalAllocationsCreated} project allocations`);

  // ═══════════════════════════════════════════
  // 4. SEED FeatureFlag
  // ═══════════════════════════════════════════
  console.log('\n📦 Seeding FeatureFlag...');

  const featureFlags = [
    { key: 'ai_anomaly_detection', label: 'AI Anomaly Detection', enabled: true, config: '{"sensitivity":0.8}', source: 'platform_default', notes: 'Detects anomalies in payroll, attendance, and employee data' },
    { key: 'ai_smart_search', label: 'AI Smart Search', enabled: true, config: null, source: 'platform_default', notes: 'Intelligent search across all HR modules' },
    { key: 'predictive_analytics', label: 'Predictive Analytics', enabled: false, config: '{"forecastHorizon":30}', source: 'platform_default', notes: 'Predict attrition, hiring needs, and performance trends' },
    { key: 'auto_translation', label: 'Auto Translation', enabled: true, config: '{"languages":["en","es","fr","de"]}', source: 'platform_default', notes: 'Auto-translate announcements and policies' },
    { key: 'sso_saml', label: 'SSO/SAML Integration', enabled: false, config: null, source: 'override', notes: 'Enterprise SSO via SAML 2.0' },
    { key: 'video_interviews', label: 'Video Interview Platform', enabled: true, config: '{"maxDuration":45}', source: 'platform_default', notes: 'One-way and live video interviews with AI scoring' },
    { key: 'collaborative_leave_check', label: 'AI Collaborative Leave Check', enabled: true, config: null, source: 'platform_default', notes: 'Warns about team coverage gaps during leave approval' },
    { key: 'resume_ai_scoring', label: 'AI Resume Scoring', enabled: true, config: '{"minScore":60}', source: 'platform_default', notes: 'Auto-score candidate resumes using AI' },
    { key: 'burnout_detection', label: 'Burnout Detection', enabled: false, config: '{"threshold":0.7}', source: 'platform_default', notes: 'Detect employee burnout signals from attendance and workload patterns' },
    { key: 'ghost_employee_detection', label: 'Ghost Employee Detection', enabled: true, config: '{"sensitivity":"high"}', source: 'platform_default', notes: 'Flag employees with zero attendance or activity' },
    { key: 'payroll_anomaly_ai', label: 'Payroll Anomaly AI', enabled: true, config: null, source: 'platform_default', notes: 'AI-driven payroll anomaly detection and flagging' },
    { key: 'client_portal', label: 'Client Portal', enabled: true, config: null, source: 'platform_default', notes: 'Enable client-facing portal for project visibility' },
    { key: 'vendor_portal', label: 'Vendor Portal', enabled: true, config: null, source: 'platform_default', notes: 'Enable vendor-facing portal for staffing vendors' },
    { key: 'marketplace_benefits', label: 'Employee Marketplace & Benefits', enabled: false, config: '{"maxWalletAmount":5000}', source: 'override', notes: 'Employee perks marketplace with wallet-based benefits' },
    { key: 'ewa_earned_wage_access', label: 'Earned Wage Access (EWA)', enabled: false, config: '{"maxAccessPct":50}', source: 'override', notes: 'Allow employees to access earned wages before payday' },
  ];

  let flagsCreated = 0;
  for (const flag of featureFlags) {
    try {
      await prisma.featureFlag.create({
        data: {
          tenantId: tenant.id,
          key: flag.key,
          label: flag.label,
          enabled: flag.enabled,
          config: flag.config,
          source: flag.source,
          notes: flag.notes,
        },
      });
      flagsCreated++;
      console.log(`  ✅ FeatureFlag: ${flag.key} (enabled: ${flag.enabled})`);
    } catch (e: any) {
      if (e.code === 'P2002') {
        console.log(`  ⚠️ FeatureFlag already exists: ${flag.key} — skipping`);
      } else {
        console.error(`  ❌ Error creating FeatureFlag ${flag.key}:`, e.message);
      }
    }
  }

  console.log(`📊 Created ${flagsCreated} feature flags`);

  // ═══════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════
  console.log('\n════════════════════════════════════════════');
  console.log('🎉 DEMO GAP SEED COMPLETE!');
  console.log(`   ProjectMilestone: ${createdMilestones.length} created`);
  console.log(`   ProjectTask:      ${totalTasksCreated} created`);
  console.log(`   ProjectAllocation: ${totalAllocationsCreated} created`);
  console.log(`   FeatureFlag:       ${flagsCreated} created`);
  console.log(`   Orphaned Groups Fixed: ${orphanGroups.length}`);
  console.log(`   Orphaned Users Fixed: ${orphanUsers.length}`);
  console.log('════════════════════════════════════════════');
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Fatal error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
