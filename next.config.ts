import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Local dev only (Cloud Agent): keep the Neon serverless driver external so the
  // scripts/local-dev/neon-local-shim preload can point it at the local ws proxy.
  // Guarded by NEON_LOCAL_PROXY so production bundling is unchanged.
  ...(process.env.NEON_LOCAL_PROXY === '1'
    ? { serverExternalPackages: ['@neondatabase/serverless', '@prisma/adapter-neon'] }
    : {}),
  // Include schema SQL assets for /api/trial/approve tenant DB provisioning on Vercel
  outputFileTracingIncludes: {
    '/api/trial/approve': [
      './scripts/schema-sync-runner.js',
      './scripts/_generated-tables.js',
      './scripts/_init-table-fixes.js',
      './scripts/_timestamp-fix.js',
      './prisma/migrations/0_init/migration.sql',
    ],
  },
  // Allow all subdomains of 3boxeshrms.com for image optimization and links
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.3boxeshrms.com',
      },
      {
        protocol: 'https',
        hostname: '3boxeshrms.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800",
          },
        ],
      },
      {
        source: "/icons/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Security headers for all pages
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
