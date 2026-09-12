/**
 * Multi-currency FX conversion utility (REQ-PM-09, also unblocks §7.1.2 / §7.2.3).
 *
 * Strategy:
 *   1. Same currency → rate = 1, no DB hit.
 *   2. Direct rate in ExchangeRate table (from → to), pick most recent on or before rateDate.
 *   3. Inverse rate (to → from) → invert.
 *   4. Triangulation via USD (e.g. EUR → USD → INR) if neither direct nor inverse exists.
 *   5. Fall back to rate = 1 with a warning, so the caller never crashes.
 *
 * All monetary amounts stored on Invoice/InvoiceLineItem are kept in the
 * INVOICE currency. The FX rate at invoice creation time is persisted on
 * the Invoice row so historical invoices never drift when the rate table
 * is updated.
 */

import prisma from '@/lib/prisma';

export interface FxResult {
  /** Converted amount in the target currency. */
  amount: number;
  /** Exchange rate applied (fromCurrency → toCurrency). 1 base = rate * target. */
  rate: number;
  /** Date the rate was taken from the table (null for same-currency). */
  rateDate: Date | null;
  /** Source of the rate (e.g. "Manual Entry", "Inverse", "USD-triangulated"). */
  source: string;
  /** Populated only when no usable rate was found. */
  warning?: string;
}

/**
 * Convert `amount` from `fromCurrency` to `toCurrency` using the latest
 * ExchangeRate row at or before `options.rateDate` (default: now).
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  options: { rateDate?: Date; rateType?: string; preferSource?: string } = {}
): Promise<FxResult> {
  // 1. Same currency → no conversion needed
  if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) {
    return { amount, rate: 1, rateDate: null, source: 'SAME_CURRENCY' };
  }

  const rateDate = options.rateDate ?? new Date();

  // 2. Try direct rate (from → to)
  const direct = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrency,
      toCurrency,
      isActive: true,
      rateDate: { lte: rateDate },
      ...(options.rateType ? { rateType: options.rateType } : {}),
      ...(options.preferSource ? { source: options.preferSource } : {}),
    },
    orderBy: { rateDate: 'desc' },
  });

  if (direct && direct.exchangeRate > 0) {
    return {
      amount: round(amount * direct.exchangeRate),
      rate: direct.exchangeRate,
      rateDate: direct.rateDate,
      source: direct.source || 'ExchangeRate',
    };
  }

  // 3. Try inverse rate (to → from)
  const inverse = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrency: toCurrency,
      toCurrency: fromCurrency,
      isActive: true,
      rateDate: { lte: rateDate },
    },
    orderBy: { rateDate: 'desc' },
  });

  if (inverse && inverse.exchangeRate > 0) {
    const invRate = 1 / inverse.exchangeRate;
    return {
      amount: round(amount * invRate),
      rate: invRate,
      rateDate: inverse.rateDate,
      source: `${inverse.source || 'ExchangeRate'} (inverse)`,
    };
  }

  // 4. Triangulate via USD (most currencies have a USD pair)
  if (fromCurrency !== 'USD' && toCurrency !== 'USD') {
    const [fromUsd, toUsd] = await Promise.all([
      convertCurrency(1, fromCurrency, 'USD', { rateDate }),
      convertCurrency(1, 'USD', toCurrency, { rateDate }),
    ]);

    if (fromUsd.source !== 'NO_RATE_FOUND' && toUsd.source !== 'NO_RATE_FOUND') {
      const triRate = fromUsd.rate * toUsd.rate;
      return {
        amount: round(amount * triRate),
        rate: triRate,
        rateDate: fromUsd.rateDate ?? toUsd.rateDate,
        source: `USD-triangulated (${fromUsd.source} × ${toUsd.source})`,
      };
    }
  }

  // 5. Fall back — no rate found anywhere
  return {
    amount,
    rate: 1,
    rateDate: null,
    source: 'NO_RATE_FOUND',
    warning: `No exchange rate found for ${fromCurrency} → ${toCurrency}. Used rate=1.`,
  };
}

/**
 * Convenience helper for converting a list of (amount, currency) tuples
 * into a single target currency. Returns the total + the FX rate used for
 * the most recent conversion (useful for invoice-level FX rate).
 */
export async function convertAndSum(
  entries: { amount: number; currency: string }[],
  targetCurrency: string,
  rateDate?: Date
): Promise<{ total: number; lastRate: number; warnings: string[] }> {
  let total = 0;
  let lastRate = 1;
  const warnings: string[] = [];

  for (const entry of entries) {
    const r = await convertCurrency(entry.amount, entry.currency, targetCurrency, { rateDate });
    total += r.amount;
    if (r.rate) lastRate = r.rate;
    if (r.warning) warnings.push(`${entry.currency}→${targetCurrency}: ${r.warning}`);
  }

  return { total: round(total), lastRate, warnings };
}

/** Round to 2 decimal places (standard for currency). */
function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
