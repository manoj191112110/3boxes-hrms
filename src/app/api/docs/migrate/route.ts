import { NextResponse } from 'next/server';
import { getTokenFromHeaders, verifyToken } from '@/lib/auth';
import { getDb, getPlatformDb } from '@/lib/tenant-db';

export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: payload.userId as string } });
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can migrate' }, { status: 403 });
    }

    // Use raw SQL to create the documentation tables if they don't exist
    // This is necessary because prisma db push may fail during Vercel build

    // DocCategory table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DocCategory" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "description" TEXT,
        "icon" TEXT NOT NULL DEFAULT 'FiBookOpen',
        "color" TEXT NOT NULL DEFAULT 'blue',
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DocCategory_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "DocCategory_slug_key" UNIQUE ("slug")
      );
    `);

    // DocArticle table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DocArticle" (
        "id" TEXT NOT NULL,
        "categoryId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "summary" TEXT,
        "content" TEXT NOT NULL DEFAULT '',
        "docType" TEXT NOT NULL DEFAULT 'functional',
        "moduleKey" TEXT,
        "tags" TEXT,
        "version" TEXT NOT NULL DEFAULT '1.0',
        "status" TEXT NOT NULL DEFAULT 'draft',
        "authorId" TEXT,
        "viewCount" INTEGER NOT NULL DEFAULT 0,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DocArticle_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "DocArticle_slug_key" UNIQUE ("slug"),
        CONSTRAINT "DocArticle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DocCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    // Create indexes for DocArticle
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DocArticle_categoryId_idx" ON "DocArticle"("categoryId");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DocArticle_docType_idx" ON "DocArticle"("docType");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DocArticle_moduleKey_idx" ON "DocArticle"("moduleKey");
    `);

    // DocAccessRule table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DocAccessRule" (
        "id" TEXT NOT NULL,
        "articleId" TEXT NOT NULL,
        "role" TEXT,
        "userId" TEXT,
        "accessType" TEXT NOT NULL DEFAULT 'read',
        "grantedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DocAccessRule_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "DocAccessRule_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "DocArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    // Create indexes for DocAccessRule
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DocAccessRule_articleId_idx" ON "DocAccessRule"("articleId");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DocAccessRule_role_idx" ON "DocAccessRule"("role");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DocAccessRule_userId_idx" ON "DocAccessRule"("userId");
    `);

    return NextResponse.json({
      success: true,
      message: 'Documentation tables created successfully',
      tables: ['DocCategory', 'DocArticle', 'DocAccessRule']
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
