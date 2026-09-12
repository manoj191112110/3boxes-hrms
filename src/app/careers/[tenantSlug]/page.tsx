'use client';

import CareersPage from '../page';

/**
 * /careers/[tenantSlug]
 *
 * Per-tenant career portal. Each tenant can link to or embed this URL on
 * their own company website. The tenant's slug is read from the path and
 * used to pre-filter the job listing via the `tenantSlug` query param on
 * the /api/public/jobs endpoint.
 *
 * The parent <CareersPage /> component itself reads `useParams().tenantSlug`
 * and adds it to the API request, so this wrapper just renders it directly.
 * The router is set up so /careers renders <CareersPage /> (no tenantSlug)
 * and /careers/[tenantSlug] renders <CareersPage /> with tenantSlug.
 */
export default function TenantCareersPage() {
  return <CareersPage />;
}
