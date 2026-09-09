import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.join(process.cwd(), 'package.json'));

/**
 * Apply full schema to a new tenant Neon database.
 * Uses scripts/schema-sync-runner.js (no child_process — works on Vercel).
 *
 * Loaded via absolute path so Turbopack/Next bundling does not break the
 * runner's own requires for _generated-tables.js and related SQL assets.
 */
const { runSchemaSyncForConnection } = require(
  path.join(process.cwd(), 'scripts', 'schema-sync-runner.js')
) as {
  runSchemaSyncForConnection: (connectionString: string) => Promise<void>;
};

export async function runTenantSchemaSync(connectionString: string): Promise<void> {
  await runSchemaSyncForConnection(connectionString);
}
