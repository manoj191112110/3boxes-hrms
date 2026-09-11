/**
 * Next.js instrumentation hook.
 *
 * Local development only: when NEON_LOCAL_PROXY=1 is set (Cloud Agent / local
 * dev with a local PostgreSQL server), route the Neon serverless driver through
 * the local WebSocket proxy (scripts/local-dev/neon-ws-proxy.cjs) instead of
 * Neon's cloud endpoint. This runs once at server startup, before any request,
 * so the Prisma Neon adapter picks up the config on its first query.
 *
 * This is a no-op in production, where NEON_LOCAL_PROXY is never set.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEON_LOCAL_PROXY !== '1') return;

  const { neonConfig } = await import('@neondatabase/serverless');
  const proxyPort = process.env.NEON_WS_PROXY_PORT || '5433';

  // Use Node's built-in global WebSocket (Node 18.16+/undici) rather than the
  // `ws` package, which webpack mangles (bufferUtil.mask) when bundled.
  if (typeof globalThis.WebSocket !== 'undefined') {
    // @ts-expect-error - global WebSocket is compatible with the driver at runtime
    neonConfig.webSocketConstructor = globalThis.WebSocket;
  }
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineConnect = false;
  // @ts-expect-error - pipelineTLS is a valid runtime option
  neonConfig.pipelineTLS = false;
  neonConfig.wsProxy = (host: string, port: number | string) =>
    `127.0.0.1:${proxyPort}/v1?address=${host}:${port}`;

  console.log(`[instrumentation] Neon driver routed to local ws proxy on port ${proxyPort}`);
}
