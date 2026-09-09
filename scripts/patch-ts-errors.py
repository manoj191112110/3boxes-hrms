#!/usr/bin/env python3
"""Patch TypeScript errors in generated API routes."""
import re
from pathlib import Path

ROOT = Path('/home/z/my-project/src/app/api')

# Fix 1: const where = {} → already patched. But for files with literal where like { status: 'active' }, cast `where as any`.

# Fix 2: PII scrubbing patterns - these have inline ternaries that TS can't infer
# Pattern: `name: \`[PURGED_\${Date.now()}]\`` — fine.
# Pattern: `contactEmail: null, contactPhone: null` — fine
# Fix vendors/[id]/purge: decoded.role check — `decoded.role` may be unknown. Use `as string`.

# Fix 3: SOW approve route line 49 — `approvedById: decoded.userId` — TS sees decoded.userId as unknown
# Pattern across files: `decoded.userId as string`

# Fix 4: contractor-requests line 52 — `notes: notes` where notes is unknown
# Fix 5: vendor documents line 54 — `uploadedById: decoded.userId` 
# Fix 6: marketplace orders line 79 — `walletBucketId: bucket.id` where bucket.id is string|null

patches = [
    # clients/sow/route.ts — where was already typed but the conditional indexing still fails
    (ROOT / 'clients/sow/route.ts', [
        ('if (clientId) where.clientId = clientId;',
         'if (clientId) (where as Record<string, unknown>).clientId = clientId;'),
        ('if (status) where.status = status;',
         'if (status) (where as Record<string, unknown>).status = status;'),
        ('const sows = await prisma.sOW.findMany({\n      where,',
         'const sows = await prisma.sOW.findMany({\n      where: where as any,'),
    ]),
    # contractor-requests: notes field, requestedById
    (ROOT / 'contractor-requests/route.ts', [
        ('const where: Record<string, unknown> = {};\n    if (projectId) where.projectId = projectId;',
         'const where: Record<string, unknown> = {};\n    if (projectId) where.projectId = projectId;'),
        ('notes, requestedById: decoded.userId',
         'notes: notes ?? null, requestedById: decoded.userId as string'),
        ('where,\n      include:',
         'where: where as any,\n      include:'),
    ]),
    # purchase-orders: lineItems s and li implicit any
    (ROOT / 'purchase-orders/route.ts', [
        ('const totalAmount = lineItems.reduce((s, li) => s + (li.quantity * li.unitPrice), 0);',
         'const totalAmount = lineItems.reduce((s: number, li: any) => s + (li.quantity * li.unitPrice), 0);'),
        ('lineItems: { create: lineItems.map(li => ({ description: li.description, quantity: li.quantity, unitPrice: li.unitPrice, currency: li.currency || currency || \'INR\', total: li.quantity * li.unitPrice })) },',
         'lineItems: { create: lineItems.map((li: any) => ({ description: li.description, quantity: li.quantity, unitPrice: li.unitPrice, currency: li.currency || currency || \'INR\', total: li.quantity * li.unitPrice })) },'),
        ('where,\n      include:',
         'where: where as any,\n      include:'),
    ]),
    # vendors/[id]/documents: uploadedById
    (ROOT / 'vendors/[id]/documents/route.ts', [
        ('uploadedById: decoded.userId',
         'uploadedById: decoded.userId as string'),
    ]),
    # vendors/[id]/purge: decoded.role check
    (ROOT / 'vendors/[id]/purge/route.ts', [
        ("if (decoded.role && !['super_admin', 'tenant_admin'].includes(decoded.role))",
         "if (!((decoded.role as string) && ['super_admin', 'tenant_admin'].includes(decoded.role as string)))"),
    ]),
    # clients/sow/[id]/approve: approvedById
    (ROOT / 'clients/sow/[id]/approve/route.ts', [
        ('approvedById: decoded.userId',
         'approvedById: decoded.userId as string'),
    ]),
    # contractor-requests: requestedById + where
    (ROOT / 'contractor-requests/route.ts', [
        ('requestedById: decoded.userId',
         'requestedById: decoded.userId as string'),
    ]),
    # wallet/route.ts — bucket.walletId null check
    (ROOT / 'wallet/route.ts', [
        ('if (!bucket || bucket.walletId !== wallet.id)',
         'if (!bucket || !bucket.walletId || bucket.walletId !== wallet.id)'),
        ('initiatedById: decoded.userId',
         'initiatedById: decoded.userId as string'),
    ]),
    # marketplace/orders: walletBucketId null
    (ROOT / 'marketplace/orders/route.ts', [
        ('walletBucketId: bucket.id,',
         'walletBucketId: bucket.id!,'),
        ('where,\n      include:',
         'where: where as any,\n      include:'),
    ]),
    # wallet-budgets
    (ROOT / 'wallet-budgets/route.ts', [
        ('where,\n      include:',
         'where: where as any,\n      include:'),
    ]),
    # vendor-invoices
    (ROOT / 'vendor-invoices/route.ts', [
        ('where,\n      include:',
         'where: where as any,\n      include:'),
    ]),
    # ewa, gifts, insurance/claims, insurance/policies, loan-marketplace, recognition — where cast
    (ROOT / 'ewa/route.ts', [
        ('where,\n      orderBy',
         'where: where as any,\n      orderBy'),
    ]),
    (ROOT / 'gifts/route.ts', [
        ('where,\n      include',
         'where: where as any,\n      include'),
    ]),
    (ROOT / 'insurance/claims/route.ts', [
        ('where,\n      include',
         'where: where as any,\n      include'),
    ]),
    (ROOT / 'insurance/policies/route.ts', [
        ('where,\n      include',
         'where: where as any,\n      include'),
    ]),
    (ROOT / 'loan-marketplace/route.ts', [
        ('where,\n      orderBy',
         'where: where as any,\n      orderBy'),
    ]),
    (ROOT / 'recognition/route.ts', [
        ('where,\n      orderBy',
         'where: where as any,\n      orderBy'),
    ]),
]

count = 0
for fp, edits in patches:
    if not fp.exists():
        print(f'[skip] {fp} (not found)')
        continue
    text = fp.read_text()
    new_text = text
    for old, new in edits:
        if old in new_text:
            new_text = new_text.replace(old, new, 1)
            count += 1
        else:
            print(f'[warn] {fp.name}: pattern not found: {old[:60]!r}')
    if new_text != text:
        fp.write_text(new_text)
        print(f'[ok] {fp}')

print(f'\nApplied {count} edits.')
