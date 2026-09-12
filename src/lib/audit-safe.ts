/**
 * FK-safe audit log write.
 *
 * WHY THIS EXISTS (2026-09-09):
 * The JWT identity is resolved from the PLATFORM DB on login, while most
 * writes target the TENANT DB. When the same email has different User ids
 * in the two databases (stale synthetic demo users like 'demo-tenantadmin',
 * or separately-provisioned rows), auditLog.create({ userId }) violates
 * AuditLog_userId_fkey (P2003) and — being unguarded — failed the WHOLE
 * business request with "Internal server error" even though the actual
 * operation (create/approve leave) had already succeeded.
 *
 * RULE: an audit write must never break the operation it is auditing.
 * On FK violation we retry with userId: null and preserve the actor id in
 * the details text, so the trail is kept without the FK link.
 */

type AuditData = {
  userId?: string | null;
  action: string;
  module: string;
  details?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export async function safeAuditLog(db: {
  auditLog: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> };
}, data: AuditData): Promise<void> {
  try {
    await db.auditLog.create({ data });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2003' && data.userId) {
      // FK violation — actor not present in THIS database.
      // Retry without the FK link, keeping the raw actor id in details.
      try {
        await db.auditLog.create({
          data: {
            ...data,
            userId: null,
            details: `${data.details || ''} (actor: ${data.userId})`.trim(),
          },
        });
        return;
      } catch (retryErr) {
        console.warn('[audit] retry without FK link also failed:', (retryErr as { code?: string })?.code || retryErr);
        return;
      }
    }
    // Any other audit failure is logged but never propagated.
    console.warn('[audit] auditLog.create failed (non-fatal):', code || err);
  }
}
