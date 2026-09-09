import { NextResponse } from 'next/server';

/**
 * POST /api/i18n/set-locale
 * Body: { "locale": "en" | "es" | "fr" | "de" | "hi" | "ar" }
 *
 * Sets the NEXT_LOCALE cookie on the response. The middleware reads this
 * cookie on subsequent requests to determine the active locale (instead of
 * using URL-based locale prefixes).
 *
 * This is the companion endpoint for src/components/LocaleSwitcher.tsx.
 */

const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'hi', 'ar'] as const;
const DEFAULT_LOCALE = 'en';

export async function POST(request: Request) {
  let body: { locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const requested = (body.locale || '').toLowerCase();
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(requested)) {
    return NextResponse.json(
      { error: `Unsupported locale. Supported: ${SUPPORTED_LOCALES.join(', ')}` },
      { status: 400 }
    );
  }

  const response = NextResponse.json({ ok: true, locale: requested });
  response.cookies.set('NEXT_LOCALE', requested, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return response;
}

/**
 * GET /api/i18n/set-locale — returns the currently configured default locale.
 * Mostly a noop but useful for health checks.
 */
export async function GET() {
  return NextResponse.json({ defaultLocale: DEFAULT_LOCALE, supported: SUPPORTED_LOCALES });
}
