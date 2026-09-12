/**
 * REQ-SEC-MKT-03 — Immutable wallet audit ledger.
 *
 * Every WalletTransaction is part of a hash chain (mini-blockchain). The
 * `chainHash` of transaction N is SHA-256(N.id || N.previousHash || N.walletId
 * || N.amount || N.type || N.createdAt). The `previousHash` field stores the
 * `chainHash` of N-1 (or "GENESIS" for the first transaction in the wallet).
 *
 * Tamper detection: any subsequent recomputation that yields a different
 * chainHash sets `tamperFlagged = true` on the offending row.
 */
import crypto from 'crypto';

const GENESIS_HASH = 'GENESIS';

/**
 * Compute the chainHash for a transaction, given its previousHash.
 */
export function computeChainHash(input: {
  id: string;
  previousHash: string | null;
  walletId: string;
  amount: number;
  type: string;
  createdAt: Date;
}): string {
  const parts = [
    input.id,
    input.previousHash || GENESIS_HASH,
    input.walletId,
    String(input.amount),
    input.type,
    input.createdAt.toISOString(),
  ];
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

/**
 * Append a new transaction to the wallet's hash chain.
 *
 * Usage:
 *   const { previousHash, chainHash } = await appendHashChain(walletId, txData);
 *   await prisma.walletTransaction.update({ where: { id: tx.id }, data: { previousHash, chainHash } });
 */
export async function appendHashChain(
  prisma: any,
  walletId: string,
  txData: { id: string; amount: number; type: string; createdAt: Date },
): Promise<{ previousHash: string; chainHash: string }> {
  // Find the latest transaction in this wallet to chain from
  const latest = await prisma.walletTransaction.findFirst({
    where: { walletId },
    orderBy: { createdAt: 'desc' },
    select: { chainHash: true, id: true },
  });
  const previousHash = latest?.chainHash || GENESIS_HASH;
  const chainHash = computeChainHash({
    id: txData.id,
    previousHash,
    walletId,
    amount: txData.amount,
    type: txData.type,
    createdAt: txData.createdAt,
  });
  return { previousHash, chainHash };
}

/**
 * Verify the integrity of a wallet's transaction chain. Returns the number of
 * tampered rows detected (also flags them in the DB).
 */
export async function verifyWalletChain(prisma: any, walletId: string): Promise<{
  totalTransactions: number;
  tampered: number;
  tamperedIds: string[];
}> {
  const txs = await prisma.walletTransaction.findMany({
    where: { walletId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, previousHash: true, walletId: true, amount: true, type: true, createdAt: true, chainHash: true },
  });
  let expectedPrev = GENESIS_HASH;
  const tamperedIds: string[] = [];
  for (const tx of txs) {
    const expected = computeChainHash({
      id: tx.id,
      previousHash: expectedPrev,
      walletId: tx.walletId,
      amount: tx.amount,
      type: tx.type,
      createdAt: tx.createdAt,
    });
    if (tx.chainHash !== expected || tx.previousHash !== expectedPrev) {
      tamperedIds.push(tx.id);
      await prisma.walletTransaction.update({
        where: { id: tx.id },
        data: { tamperFlagged: true },
      });
    }
    expectedPrev = tx.chainHash || expected;
  }
  return { totalTransactions: txs.length, tampered: tamperedIds.length, tamperedIds };
}
