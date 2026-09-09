import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const cs =
  process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: cs! }) });

async function main() {
  const masked = cs?.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@').slice(0, 90);
  console.log('Platform URL:', masked);

  const row = await prisma.tenantDatabase.findFirst({
    where: { tenant: { slug: 'marqaitechgroup' }, isActive: true },
    select: { id: true, databaseName: true, tenantId: true },
  });

  console.log('TenantDatabase for marqaitechgroup:', row ?? 'NOT FOUND');
  console.log('Platform company count:', await prisma.company.count());
}

main().finally(() => prisma.$disconnect());
