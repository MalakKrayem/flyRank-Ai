import { unauthorized } from '../errors.js';

// Stage 2: the door is locked, but the guard cannot read yet. All this checks is
// that *a* token was presented in the right place and the right shape — not that
// it is real. Stage 3 hands the token to Supabase and gets a trustworthy answer.
//
// The regex is doing more than it looks. `Authorization: <token>` with no scheme
// is the single most common way a hand-written extractor goes wrong: split on a
// space and take index 1 and that header quietly yields undefined, which some
// verifiers then treat as "no token" and others pass to the identity provider as
// a literal. Requiring the whole header to match "Bearer <something>" makes both
// a 401 instead.
const BEARER = /^Bearer\s+(\S+)$/i;

export const readBearerToken = (req) => {
  const header = req.get('authorization');
  if (!header) throw unauthorized('Access token required');

  const match = BEARER.exec(header.trim());
  if (!match) throw unauthorized('Access token required');

  return match[1];
};

export const profile = (req, res) => {
  readBearerToken(req);

  // Deliberately not the real profile yet. Nothing here has checked *whose*
  // token this is, so there is nothing honest to say about the user.
  res.json({ message: 'A token was presented. Nothing has verified it yet.' });
};
