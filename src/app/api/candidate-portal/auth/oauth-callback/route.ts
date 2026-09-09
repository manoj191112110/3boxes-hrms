/**
 * Candidate Portal — OAuth Callback (Google)
 *
 * GET /api/candidate-portal/auth/oauth-callback?code=...&state=...
 *
 * Exchanges the Google authorization code for an id_token, decodes the
 * user info (email, name, sub), upserts a CandidatePortalUser with
 * oauthProvider='google' + oauthSubject=sub, and redirects to:
 *   /candidate-portal/oauth-bridge?token=<jwt>&name=<name>&email=<email>
 *
 * The bridge page stores the token in localStorage and then redirects
 * to /candidate-portal/dashboard. (We can't set localStorage from a
 * server route, so we hand off via a tiny client page.)
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_OAUTH_REDIRECT  (must match the Google Cloud console — typically
 *                            https://<host>/api/candidate-portal/auth/oauth-callback)
 */
import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { createToken } from '@/lib/auth';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

function redirectWithError(error: string) {
  const url = new URL('/candidate-portal/login', process.env.NEXT_PUBLIC_BASE_URL || '');
  url.searchParams.set('oauth_error', error);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const db = await getDb(request);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    return redirectWithError(errorParam);
  }
  if (!code) {
    return redirectWithError('missing_code');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  // Build redirect_uri from the request host so we don't need a separate env var
  const redirectUri = `${url.origin}/api/candidate-portal/auth/oauth-callback`;

  if (!clientId || !clientSecret) {
    console.error('[oauth-callback] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set');
    return redirectWithError('server_misconfigured');
  }

  // Exchange code for tokens
  let idToken: string | undefined;
  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[oauth-callback] token exchange failed:', tokenRes.status, errText);
      return redirectWithError('token_exchange_failed');
    }
    const tokenJson = await tokenRes.json();
    idToken = tokenJson.id_token;
    if (!idToken) {
      return redirectWithError('no_id_token');
    }
  } catch (e) {
    console.error('[oauth-callback] token exchange error:', e);
    return redirectWithError('token_exchange_error');
  }

  // Decode the id_token (JWT) to get user info — no signature verification
  // needed here because we just got it directly from Google over HTTPS.
  let payload: { email?: string; name?: string; sub?: string };
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new Error('malformed id_token');
    const decoded = Buffer.from(parts[1], 'base64url').toString('utf8');
    payload = JSON.parse(decoded);
  } catch (e) {
    console.error('[oauth-callback] id_token decode error:', e);
    return redirectWithError('id_token_decode_failed');
  }

  const email = payload.email?.trim().toLowerCase();
  const name = payload.name || (email ? email.split('@')[0] : 'Candidate');
  const sub = payload.sub;
  if (!email || !sub) {
    return redirectWithError('missing_userinfo');
  }

  // Upsert CandidatePortalUser with oauth fields
  const user = await db.candidatePortalUser.upsert({
    where: { candidateEmail: email },
    create: {
      candidateEmail: email,
      candidateName: name,
      oauthProvider: 'google',
      oauthSubject: sub,
      lastLoginAt: new Date(),
    },
    update: {
      candidateName: name,
      oauthProvider: 'google',
      oauthSubject: sub,
      lastLoginAt: new Date(),
    },
  });

  const token = await createToken({
    kind: 'candidate',
    email: user.candidateEmail,
    name: user.candidateName,
  });

  // Hand off to a tiny client page that stores the token in localStorage
  // and then redirects to the dashboard.
  const bridge = new URL('/candidate-portal/oauth-bridge', url.origin);
  bridge.searchParams.set('token', token);
  bridge.searchParams.set('email', user.candidateEmail);
  bridge.searchParams.set('name', user.candidateName);
  return NextResponse.redirect(bridge);
}
