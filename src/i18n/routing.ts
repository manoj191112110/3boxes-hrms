/**
 * i18n routing configuration (REQ-REC-06, REQ-ONB-03, REQ-PER-03, REQ-EXIT-05).
 *
 * Defines the supported locales + default. We use `localePrefix: 'as-needed'`
 * so the default locale (en) does NOT get a URL prefix — existing URLs like
 * /login, /dashboard, /employees continue to work unchanged. Other locales
 * get a prefix: /es/login, /fr/login, etc.
 */

import { defineRouting } from 'next-intl/routing';

export const locales = ['en', 'es', 'fr', 'de', 'hi', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, { label: string; nativeName: string; flag: string; dir: 'ltr' | 'rtl' }> = {
  en: { label: 'English',    nativeName: 'English',    flag: '🇺🇸', dir: 'ltr' },
  es: { label: 'Spanish',    nativeName: 'Español',    flag: '🇪🇸', dir: 'ltr' },
  fr: { label: 'French',     nativeName: 'Français',   flag: '🇫🇷', dir: 'ltr' },
  de: { label: 'German',     nativeName: 'Deutsch',    flag: '🇩🇪', dir: 'ltr' },
  hi: { label: 'Hindi',      nativeName: 'हिन्दी',      flag: '🇮🇳', dir: 'ltr' },
  ar: { label: 'Arabic',     nativeName: 'العربية',    flag: '🇸🇦', dir: 'rtl' },
};

export const routing = defineRouting({
  locales,
  defaultLocale,
  // 'as-needed' = default locale (en) has no prefix; other locales get /es/, /fr/ etc.
  // This preserves all existing URLs.
  localePrefix: 'as-needed',
});
