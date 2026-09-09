'use client';

/**
 * Locale switcher — dropdown to switch between supported locales.
 *
 * Uses COOKIE-BASED locale switching (not URL-based) because our app
 * is not structured under app/[locale]/. When the user picks a new locale:
 *   1. POST to /api/i18n/set-locale with the new locale
 *   2. The API sets the NEXT_LOCALE cookie
 *   3. We reload the current page — middleware reads the cookie and sets
 *      x-next-intl-locale header → layout.tsx's getLocale() picks it up
 *      → correct translation bundle is loaded
 *
 * URL stays unchanged (/login, /dashboard, etc.) in all locales.
 */

import { useState, useRef, useEffect } from 'react';
import { FiGlobe, FiChevronDown } from 'react-icons/fi';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { locales, localeNames, type Locale } from '@/i18n/routing';

export default function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const t = useTranslations('locale');
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleChange = async (newLocale: Locale) => {
    setOpen(false);
    if (newLocale === locale) return;

    setSwitching(true);
    try {
      // Set the NEXT_LOCALE cookie via API so the middleware picks it up
      // on the next request.
      await fetch('/api/i18n/set-locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: newLocale }),
      });
      // Reload the current page so server components re-render with the
      // new locale's message bundle.
      router.refresh();
    } catch (err) {
      console.error('Failed to switch locale:', err);
      setSwitching(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={switching}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
        title={t('switchLanguage')}
        aria-label={t('switchLanguage')}
        aria-expanded={open}
      >
        <FiGlobe className="w-4 h-4" />
        <span className="hidden sm:inline">{localeNames[locale]?.flag}</span>
        <span className="hidden md:inline">{localeNames[locale]?.nativeName}</span>
        <FiChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
          <p className="px-3 py-1 text-xs text-slate-500 uppercase tracking-wider">{t('selectLocale')}</p>
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => handleChange(l)}
              disabled={switching}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50 ${
                l === locale ? 'bg-teal-50 text-teal-700 font-medium' : 'text-slate-700'
              }`}
            >
              <span className="text-base">{localeNames[l].flag}</span>
              <span className="flex-1">{localeNames[l].nativeName}</span>
              <span className="text-xs text-slate-400">{l.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
