/**
 * Navigation helpers.
 *
 * We do NOT use next-intl's `createNavigation(routing)` here because that
 * produces locale-aware `Link` / `useRouter` / `usePathname` that expect
 * URL prefixes (e.g. /es/login). Our app uses cookie-based locale detection
 * (see src/middleware.ts), so URLs never contain a locale prefix.
 *
 * Components that need a locale-aware Link should just use the standard
 * `next/link` Link, and the locale will be picked up from the cookie/header
 * at request time.
 *
 * For locale switching, see src/components/LocaleSwitcher.tsx — it sets
 * the NEXT_LOCALE cookie via an API call and refreshes the page.
 */

export { default as Link } from 'next/link';
export { useRouter, usePathname, redirect } from 'next/navigation';

// Helper for server components (rarely needed in this codebase).
export function getPathname(path: string): string {
  return path;
}
