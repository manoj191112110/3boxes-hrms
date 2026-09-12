import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaNeon } from '@prisma/adapter-neon';

const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
const adapter = new PrismaNeon({ connectionString });
const p = new PrismaClient({ adapter });

async function run() {
  try {
    // Get all foreign key constraints - cast name types to text
    const fks = await p.$queryRaw`
      SELECT
        tc.table_name::text,
        kcu.column_name::text,
        ccu.table_name::text AS foreign_table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
    `;

    console.log(`Found ${(fks as any[]).length} foreign key constraints\n`);

    for (const fk of fks as any[]) {
      const sql = `DELETE FROM "${fk.table_name}" WHERE "${fk.column_name}" NOT IN (SELECT id FROM "${fk.foreign_table_name}")`;
      try {
        const result = await p.$executeRawUnsafe(sql);
        if (result > 0) {
          console.log(`CLEANED ${result} orphans from ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}`);
        }
      } catch (e: any) {
        if (!e.message?.includes('does not exist')) {
          console.log(`ERR ${fk.table_name}.${fk.column_name}: ${e.message?.substring(0, 80)}`);
        }
      }
    }

    console.log('\n=== All orphans cleaned ===');
  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await p.$disconnect();
  }
}

run();
