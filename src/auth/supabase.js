import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

// The connection to the Identity Provider, and nothing else — the same job
// db/connection.js does for Postgres. Everything that *uses* it lives in
// services/auth.service.js, so this file stays readable on its own.

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'SUPABASE_URL and SUPABASE_ANON_KEY are not set. Copy .env.example to .env and fill in the two values from your Supabase dashboard (Project Settings → API).',
  );
}

// `persistSession: false` is the one option that matters here. The SDK was
// written for a browser, where staying logged in between page loads is the whole
// point. This is a server handling many users at once: if it remembered a session
// it would remember *someone's* session, and the next request would be answered
// as the wrong person. Every request must carry its own token and be judged only
// on that.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// The equivalent of `SELECT 1` against Postgres: proves at startup that the URL
// points at a real project that is answering, rather than finding out on the
// first signup that it was a typo. GoTrue — the auth half of Supabase — answers
// /auth/v1/health without any credentials.
export const checkSupabase = async () => {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
    headers: { apikey: SUPABASE_ANON_KEY },
  });

  if (!response.ok) {
    throw new Error(`Supabase health check failed with HTTP ${response.status} — check SUPABASE_URL and SUPABASE_ANON_KEY`);
  }
};
