/**
 * 3Boxes HRMS — Per-tab session token storage (CRITICAL SECURITY FIX)
 *
 * PROBLEM:
 *   Previously `tb_token` was stored in `localStorage`, which is SHARED across
 *   all tabs of the same browser. If tab 1 logged in as super_admin and tab 2
 *   logged in as employee, refreshing either tab would cause it to adopt the
 *   other tab's session — leaking super_admin privileges to the employee tab.
 *
 * FIX:
 *   Store `tb_token` in `sessionStorage` instead. sessionStorage is per-tab
 *   AND persists across refreshes of the same tab, so:
 *     • Two tabs are fully isolated (different sessions)
 *     • Refreshing a tab keeps that tab's session
 *     • Closing a tab clears its session
 *
 * MIGRATION:
 *   On first load of a NEW tab (where sessionStorage is empty), we MIGRATE
 *   any existing token from localStorage to sessionStorage, then CLEAR
 *   localStorage. This means:
 *     • Existing logged-in users don't get logged out unexpectedly
 *     • After migration, the token is only in sessionStorage (per-tab)
 *
 * USAGE:
 *   Import { getToken, setToken, removeToken } from '@/lib/token-storage'
 *   instead of accessing localStorage directly.
 *
 *   For backwards compatibility, this module also patches
 *   `window.localStorage.getItem('tb_token')` to redirect to sessionStorage.
 *   This means existing code that still reads `localStorage.getItem('tb_token')`
 *   will continue to work, but the actual storage backend is sessionStorage.
 */

const TOKEN_KEY = 'tb_token';

/**
 * Whether we've already installed the localStorage shim.
 * Prevents re-patching on hot-reload in dev.
 */
let shimInstalled = false;

/**
 * Migrate any existing token from localStorage → sessionStorage (once per tab).
 * Called automatically on first import.
 */
function migrateTokenFromLocalStorage(): void {
  if (typeof window === 'undefined') return;

  // Already have a token in sessionStorage — nothing to migrate.
  const ssToken = sessionStorage.getItem(TOKEN_KEY);
  if (ssToken) return;

  // No sessionStorage token — try to migrate from localStorage.
  const lsToken = localStorage.getItem(TOKEN_KEY);
  if (lsToken) {
    sessionStorage.setItem(TOKEN_KEY, lsToken);
    // IMPORTANT: remove from localStorage so other tabs don't pick it up.
    localStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Install a shim that intercepts localStorage.getItem('tb_token') and
 * localStorage.setItem('tb_token', ...) and redirects them to sessionStorage.
 * This means all 200+ existing call sites continue to work without changes,
 * but the actual storage backend is per-tab sessionStorage.
 *
 * The shim also intercepts localStorage.removeItem('tb_token').
 */
export function installTokenStorageShim(): void {
  if (typeof window === 'undefined') return;
  if (shimInstalled) return;
  shimInstalled = true;

  migrateTokenFromLocalStorage();

  const originalGetItem = localStorage.getItem.bind(localStorage);
  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);

  // Patch localStorage.getItem
  localStorage.getItem = function (key: string): string | null {
    if (key === TOKEN_KEY) {
      return sessionStorage.getItem(TOKEN_KEY);
    }
    return originalGetItem(key);
  };

  // Patch localStorage.setItem
  localStorage.setItem = function (key: string, value: string): void {
    if (key === TOKEN_KEY) {
      sessionStorage.setItem(TOKEN_KEY, value);
      // Do NOT also write to localStorage — that would leak across tabs.
      return;
    }
    originalSetItem(key, value);
  };

  // Patch localStorage.removeItem
  localStorage.removeItem = function (key: string): void {
    if (key === TOKEN_KEY) {
      sessionStorage.removeItem(TOKEN_KEY);
      return;
    }
    originalRemoveItem(key);
  };

  // Listen for storage events from OTHER tabs.
  // If another tab logs out (clears localStorage['tb_token']), we DON'T want
  // to follow suit — each tab has its own session now. So we ignore these
  // events for tb_token. (Other localStorage keys still sync normally.)
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === TOKEN_KEY) {
      // Ignore — we use sessionStorage, not localStorage, for the token.
      // Other tabs' logout/login events should NOT affect this tab.
      return;
    }
  });

  //console.log('[TokenStorage] Shim installed — tb_token now stored in sessionStorage (per-tab)');
}

/**
 * Read the current session token.
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  installTokenStorageShim();
  return sessionStorage.getItem(TOKEN_KEY);
}

/**
 * Store a new session token.
 */
export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  installTokenStorageShim();
  sessionStorage.setItem(TOKEN_KEY, token);
}

/**
 * Remove the current session token.
 */
export function removeToken(): void {
  if (typeof window === 'undefined') return;
  installTokenStorageShim();
  sessionStorage.removeItem(TOKEN_KEY);
}

// Auto-install on import in the browser
if (typeof window !== 'undefined') {
  installTokenStorageShim();
}
