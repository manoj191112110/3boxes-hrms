/**
 * Server-side request config — called on every request to load the right
 * message bundle. Uses next-intl's getRequestConfig.
 */

import { getRequestConfig } from 'next-intl/server';
import { routing, defaultLocale, type Locale } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // `requestLocale` is the locale detected by the middleware (or undefined)
  let locale = (await requestLocale) as Locale | undefined;

  // Validate the locale; fall back to default
  if (!locale || !routing.locales.includes(locale)) {
    locale = defaultLocale;
  }

  // Load the message bundle for this locale
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    // Direction for RTL support (Arabic)
    timeZone: 'UTC',
    // Note: `now` field removed — passing Date objects across Server→Client
    // boundary causes React error #31 (non-serializable props).
    // next-intl defaults to Date.now() on the client side, which is sufficient.
  };
});
