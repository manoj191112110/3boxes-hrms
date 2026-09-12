/**
 * READ-ONLY reproduction of the EXACT query /api/employees runs on Vercel.
 * Uses the project's generated Prisma client + @prisma/adapter-neon, connected
 * via the TenantDatabase connectionString stored in the platform DB.
 * Only findMany / count — NO writes.
 *
 * Usage: npx tsx scripts/repro-employees-query.ts
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
cur.execute('SELECT td.\\"connectionString\\" FROM \\"TenantDatabase\\" td JOIN \\"Tenant\\" t ON t.id = td.\\"tenantId\\" WHERE t.slug = %s AND td.\\"isActive\\" = true', ('marqaitechgroup',))
r = cur.fetchone()
print(r[0] if r else '')
"`,
    { encoding: 'utf8' }
  ).trim()

  if (!cs) {
    console.error('NO STORED CONNECTION STRING FOUND')
    process.exit(1)
  }
  console.log('[repro] got stored connectionString (pooler):', cs.replace(/:[^:@]+@/, ':***@'))

  const adapter = new PrismaNeon({ connectionString: cs })
  const db = new PrismaClient({ adapter })

  console.log('\n[repro] === EXACT query from /api/employees GET (admin, no company filter) ===')
  try {
    const [employees, total] = await Promise.all([
      db.employee.findMany({
        where: {},
        include: {
          department: true,
          designation: true,
          branch: true,
          user: { select: { id: true, email: true, role: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 500,
      }),
      db.employee.count({ where: {} }),
    ])
    console.log(`SUCCESS — findMany returned ${employees.length} rows, count=${total}`)
  } catch (e: any) {
    console.error('REPRODUCED FAILURE:')
    console.error('  code:', e.code)
    console.error('  message:', String(e.message).slice(0, 600))
    if (e.meta) console.error('  meta:', JSON.stringify(e.meta).slice(0, 400))
  }

  console.log('\n[repro] === simple findMany (no include) — isolates Employee columns vs relations ===')
  try {
    const emps = await db.employee.findMany({ take: 1 })
    console.log('SUCCESS — simple findMany ok, rows:', emps.length)
  } catch (e: any) {
    console.error('FAILED simple:', e.code, String(e.message).slice(0, 300))
  }

  console.log('\n[repro] === relation tables individually (department / designation / branch / user) ===')
  const probes: Array<[string, () => Promise<unknown>]> = [
    ['department', () => db.department.findMany({ take: 1 })],
    ['designation', () => db.designation.findMany({ take: 1 })],
    ['branch', () => db.branch.findMany({ take: 1 })],
    ['user', () => db.user.findMany({ take: 1, select: { id: true, email: true, role: true, avatar: true } })],
  ]
  for (const [name, fn] of probes) {
    try {
      await fn()
      console.log(`  ${name}: OK`)
    } catch (e: any) {
      console.error(`  ${name}: FAILED —`, e.code, String(e.message).slice(0, 300))
    }
  }

  await db.$disconnect()
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
