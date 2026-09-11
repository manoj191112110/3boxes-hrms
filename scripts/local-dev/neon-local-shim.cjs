/**
 * Configure the Neon serverless driver to talk to a LOCAL PostgreSQL server via
 * the local WebSocket proxy (scripts/local-dev/neon-ws-proxy.cjs).
 *
 * This is a no-op unless NEON_LOCAL_PROXY=1 is set, so it is safe to preload
 * everywhere (tsx scripts, Prisma seed, the Next.js server) and has no effect on
 * production, where NEON_LOCAL_PROXY is never set.
 *
 * Preload it for node/tsx via NODE_OPTIONS="--require .../neon-local-shim.cjs".
 */
if (process.env.NEON_LOCAL_PROXY === '1') {
  try {
    const { neonConfig } = require('@neondatabase/serverless');
    const ws = require('ws');
    const proxyPort = process.env.NEON_WS_PROXY_PORT || '5433';

    neonConfig.webSocketConstructor = ws;
    neonConfig.useSecureWebSocket = false;
    neonConfig.pipelineConnect = false;
    neonConfig.pipelineTLS = false;
    neonConfig.wsProxy = (host, port) =>
      `127.0.0.1:${proxyPort}/v1?address=${host}:${port}`;

    if (!globalThis.__neonLocalShimLogged) {
      globalThis.__neonLocalShimLogged = true;
      console.log('[neon-local-shim] Neon driver routed to local ws proxy on port ' + proxyPort);
    }
  } catch (err) {
    console.error('[neon-local-shim] failed to configure local Neon proxy:', err);
  }
}
