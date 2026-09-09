'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// ─── Currency Data ──────────────────────────────────────────
export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  locale: string;
}

export const CURRENCY_LIST: CurrencyInfo[] = [
  { code: 'INR', name: 'Indian Rupee',       symbol: '₹',  flag: '🇮🇳', locale: 'en-IN' },
  { code: 'USD', name: 'US Dollar',          symbol: '$',  flag: '🇺🇸', locale: 'en-US' },
  { code: 'EUR', name: 'Euro',               symbol: '€',  flag: '🇪🇺', locale: 'de-DE' },
  { code: 'GBP', name: 'British Pound',      symbol: '£',  flag: '🇬🇧', locale: 'en-GB' },
  { code: 'SGD', name: 'Singapore Dollar',   symbol: 'S$', flag: '🇸🇬', locale: 'en-SG' },
  { code: 'AED', name: 'UAE Dirham',         symbol: 'د.إ', flag: '🇦🇪', locale: 'ar-AE' },
  { code: 'AUD', name: 'Australian Dollar',  symbol: 'A$', flag: '🇦🇺', locale: 'en-AU' },
  { code: 'CAD', name: 'Canadian Dollar',    symbol: 'C$', flag: '🇨🇦', locale: 'en-CA' },
  { code: 'JPY', name: 'Japanese Yen',       symbol: '¥',  flag: '🇯🇵', locale: 'ja-JP' },
  { code: 'CNY', name: 'Chinese Yuan',       symbol: '¥',  flag: '🇨🇳', locale: 'zh-CN' },
];

export const DEFAULT_CURRENCY = 'INR';

const CURRENCY_MAP = new Map(CURRENCY_LIST.map((c) => [c.code, c]));

// ─── Utility Functions ──────────────────────────────────────

/** Get the symbol for a currency code, falling back to the code itself */
export function getCurrencySymbol(code: string): string {
  return CURRENCY_MAP.get(code)?.symbol ?? code;
}

/** Get the locale for a currency code */
function getCurrencyLocale(code: string): string {
  return CURRENCY_MAP.get(code)?.locale ?? 'en-IN';
}

/** Format an amount with the proper currency symbol and locale-aware formatting */
export function formatCurrency(amount: number, currencyCode: string): string {
  try {
    const locale = getCurrencyLocale(currencyCode);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for unsupported currency codes
    const symbol = getCurrencySymbol(currencyCode);
    return `${symbol}${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

/** Get a currency info object by code */
export function getCurrencyInfo(code: string): CurrencyInfo | undefined {
  return CURRENCY_MAP.get(code);
}

// ─── React Context ──────────────────────────────────────────

interface CurrencyContextValue {
  currency: string;
  setCurrency: (code: string) => void;
  formatAmount: (amount: number, overrideCurrency?: string) => string;
  symbol: string;
  currencyInfo: CurrencyInfo;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const STORAGE_KEY = 'nexus_currency';

function getStoredCurrency(): string {
  if (typeof window === 'undefined') return DEFAULT_CURRENCY;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && CURRENCY_MAP.has(stored)) return stored;
  } catch { /* ignore */ }
  return DEFAULT_CURRENCY;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<string>(DEFAULT_CURRENCY);

  // Read from localStorage after mount
  useEffect(() => {
    setCurrencyState(getStoredCurrency());
  }, []);

  const setCurrency = (code: string) => {
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch { /* ignore */ }
  };

  const formatAmount = (amount: number, overrideCurrency?: string) => {
    return formatCurrency(amount, overrideCurrency ?? currency);
  };

  const info = CURRENCY_MAP.get(currency) ?? CURRENCY_LIST[0];

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        formatAmount,
        symbol: info.symbol,
        currencyInfo: info,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

/** Hook to access the global currency context */
export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    // Return a safe default when used outside provider
    const info = CURRENCY_LIST[0]; // INR
    return {
      currency: DEFAULT_CURRENCY,
      setCurrency: () => {},
      formatAmount: (amount: number, overrideCurrency?: string) =>
        formatCurrency(amount, overrideCurrency ?? DEFAULT_CURRENCY),
      symbol: info.symbol,
      currencyInfo: info,
    };
  }
  return ctx;
}
