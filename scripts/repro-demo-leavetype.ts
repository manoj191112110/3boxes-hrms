/**
 * Reproduce the silently-swallowed createMany failures from seed-demo-full
 * phases 2/3 against the DEMO tenant DB (3boxes-hrms-demo), surfacing the
 * REAL Prisma errors.
 *
 * Usage: npx tsx scripts/repro-demo-leavetype.ts
 */
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { execSync } from 'child_process'

async function main() {
  const cs = execSync(
    `python3 -c "
import psycopg2
c = psycopg2.connect('postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30')
cur = c.cursor()
cur.execute('SELECT td.\\"connectionString\\" FROM \\"TenantDatabase\\" td JOIN \\"Tenant\\" t ON t.id = td.\\"tenantId\\" WHERE t.slug = %s AND td.\\"isActive\\" = true', ('3boxes-hrms-demo',))
r = cur.fetchone()
print(r[0] if r else '')
"`,
    { encoding: 'utf8' }
  ).trim()

  if (!cs) {
    console.error('NO STORED CONNECTION STRING FOR DEMO TENANT')
    process.exit(1)
  }
  console.log('[repro] got demo connectionString:', cs.replace(/:[^:@]+@/, ':***@'))

  const adapter = new PrismaNeon({ connectionString: cs })
  const db = new PrismaClient({ adapter })

  const company = await db.company.findFirst({ select: { id: true, code: true, name: true } })
  console.log('[repro] first company:', company)

  // 1. LeaveType createMany — the phase-3 operation that reported +30 but inserted 0
  console.log('\n[repro] === leaveType.createMany ===')
  try {
    const res = await db.leaveType.createMany({
      data: [
        { name: 'Casual Leave', code: 'CL', defaultDays: 12, isPaid: true, carryForward: true, maxCarryForward: 3, companyId: company!.id },
      ],
    })
    console.log('SUCCESS:', res)
    await db.leaveType.deleteMany({ where: { companyId: company!.id, code: 'CL' } })
    console.log('(cleaned up test row)')
  } catch (e: any) {
    console.error('REPRODUCED FAILURE —', e.code)
    console.error(String(e.message).slice(0, 800))
    if (e.meta) console.error('meta:', JSON.stringify(e.meta).slice(0, 400))
  }

  // 2. LeaveBalance createMany probe
  const emp = await db.employee.findFirst({ select: { id: true, employeeId: true } })
  console.log('\n[repro] first employee:', emp)
  const lt = await db.leaveType.findFirst({ select: { id: true, code: true } })
  console.log('[repro] first leaveType:', lt)
  if (emp && lt) {
    console.log('[repro] === leaveBalance.createMany ===')
    try {
      const res = await db.leaveBalance.createMany({
        data: [{ employeeId: emp.id, leaveTypeId: lt.id, year: new Date().getFullYear(), total: 12, used: 2, carryForward: 0, remaining: 10 }],
      })
      console.log('SUCCESS:', res)
      await db.leaveBalance.deleteMany({ where: { employeeId: emp.id, leaveTypeId: lt.id } })
      console.log('(cleaned up test row)')
    } catch (e: any) {
      console.error('REPRODUCED FAILURE —', e.code)
      console.error(String(e.message).slice(0, 800))
      if (e.meta) console.error('meta:', JSON.stringify(e.meta).slice(0, 400))
    }
  }

  // 3. LeaveRequest createMany probe
  if (emp && lt) {
    console.log('\n[repro] === leaveRequest.createMany ===')
    try {
      const res = await db.leaveRequest.createMany({
        data: [{
          employeeId: emp.id, leaveTypeId: lt.id,
          startDate: new Date('2026-09-01'), endDate: new Date('2026-09-02'),
          reason: 'repro test', status: 'approved',
        }],
      })
      console.log('SUCCESS:', res)
      await db.leaveRequest.deleteMany({ where: { employeeId: emp.id, reason: 'repro test' } })
      console.log('(cleaned up test row)')
    } catch (e: any) {
      console.error('REPRODUCED FAILURE —', e.code)
      console.error(String(e.message).slice(0, 800))
      if (e.meta) console.error('meta:', JSON.stringify(e.meta).slice(0, 400))
    }
  }

  // 4. employee.update reportingManagerId probe (phase-2 $transaction failure)
  if (emp) {
    console.log('\n[repro] === employee.update reportingManagerId (in $transaction array) ===')
    try {
      // raw promise (what $transaction requires)
      await db.$transaction([db.employee.update({ where: { id: emp.id }, data: { reportingManagerId: null } })])
      console.log('SUCCESS: $transaction with raw prisma promise')
    } catch (e: any) {
      console.error('REPRODUCED FAILURE —', e.code)
      console.error(String(e.message).slice(0, 500))
    }
  }

  await db.$disconnect()
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
