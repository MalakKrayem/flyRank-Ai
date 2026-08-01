import * as authService from '../services/auth.service.js';
import { unauthorized } from '../errors.js';

// Two different questions, answered in order, and worth keeping apart. Reading
// the header asks "was a token presented, in the right place and the right
// shape?" — a matter of syntax this server can settle alone. Verifying it asks
// "is it real, and whose is it?" — a matter of cryptography only Supabase can
// settle. Both answers are 401, for opposite reasons.
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

export const profile = async (req, res) => {
  const user = await authService.verifyToken(readBearerToken(req));

  res.json({ user });
};
