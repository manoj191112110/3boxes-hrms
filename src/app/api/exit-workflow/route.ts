import { NextRequest, NextResponse } from 'next/server'
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { ensureSchemaSynced } from '@/lib/schema-sync'

// GET /api/exit-workflow
export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    // Ensure the ExitRequest table exists (P0 fix for missing model)
    await ensureSchemaSynced()

    const url = new URL(req.url)
    const companyId = url.searchParams.get('companyId')
    const employeeId = url.searchParams.get('employeeId')
    const status = url.searchParams.get('status')

    const where: any = {}
    if (companyId) where.companyId = companyId
    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status

    const requests = await db.exitRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, email: true, department: { select: { name: true } }, designation: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const pending = requests.filter(r => r.status === 'pending').length
    const inProgress = requests.filter(r => r.status === 'in_progress').length
    const completed = requests.filter(r => r.status === 'completed').length

    return NextResponse.json({ requests, stats: { pending, inProgress, completed, total: requests.length } })
  } catch (error: any) {
    console.error('Exit GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/exit-workflow
export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    await ensureSchemaSynced()

    const body = await req.json()
    const { companyId, employeeId, type, reason, noticePeriodEndDate, lastWorkingDate } = body

    if (!companyId || !employeeId) {
      return NextResponse.json({ error: 'companyId and employeeId are required' }, { status: 400 })
    }

    const request = await db.exitRequest.create({
      data: {
        companyId,
        employeeId,
        type: type || 'resignation',
        reason: reason || null,
        noticePeriodEndDate: noticePeriodEndDate ? new Date(noticePeriodEndDate) : null,
        lastWorkingDate: lastWorkingDate ? new Date(lastWorkingDate) : null,
        status: 'pending',
      },
      include: { employee: true },
    })

    await db.notification.create({
      data: { companyId, type: 'exit', title: 'Exit Request Submitted', message: `${request.employee.firstName} ${request.employee.lastName} submitted ${type || 'resignation'}` },
    })

    await db.auditLog.create({
      data: { companyId, action: 'EXIT_REQUESTED', entity: 'ExitRequest', entityId: request.id, details: `${type} request by employee ${employeeId}` },
    })

    return NextResponse.json(request, { status: 201 })
  } catch (error: any) {
    console.error('Exit POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/exit-workflow
export async function PUT(req: NextRequest) {
  const db = await getDb(req);
  try {
    await ensureSchemaSynced()

    const body = await req.json()
    const { id, ...data } = body

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const request = await db.exitRequest.update({
      where: { id },
      data,
      include: { employee: true },
    })

    // If completed, update employee status
    if (data.status === 'completed') {
      await db.employee.update({
        where: { id: request.employeeId },
        data: { status: 'exited' },
      })
    }

    await db.notification.create({
      data: { companyId: request.companyId, type: 'exit', title: `Exit ${data.status}`, message: `Exit request for ${request.employee.firstName} ${request.employee.lastName} - ${data.status}` },
    })

    return NextResponse.json(request)
  } catch (error: any) {
    console.error('Exit PUT error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
