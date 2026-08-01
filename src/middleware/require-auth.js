import * as authService from '../services/auth.service.js';
import { unauthorized } from '../errors.js';

// One guard, standing at every locked door.
//
// The Stage 3 version of this check lived inside the profile handler, which
// worked and did not scale: the second protected route means copying it, and the
// day someone forgets to copy it there is an unguarded door that looks exactly
// like a guarded one. A route either has this middleware in front of it or it
// does not, and that is visible at a glance in the routes file.
//
// What it leaves behind matters as much as what it blocks. By the time a handler
// runs, req.user is a verified user — not a claim from the client, but an answer
// from Supabase — so no handler downstream ever has to think about tokens again.

// Two different questions, answered in order. Reading the header asks "was a
// token presented, in the right place and the right shape?" — syntax, which this
// server can settle alone. Verifying asks "is it real, and whose is it?" —
// cryptography, which only Supabase can settle. Both answers are 401, for
// opposite reasons.
//
// The regex matches the whole header rather than splitting on a space, because
// `Authorization: <token>` with no scheme is the most common way a hand-written
// extractor goes wrong: take index 1 of the split and that header silently
// yields undefined. Here it is a 401, the same as sending nothing.
const BEARER = /^Bearer\s+(\S+)$/i;

export const readBearerToken = (req) => {
  const header = req.get('authorization');
  if (!header) throw unauthorized('Access token required');

  const match = BEARER.exec(header.trim());
  if (!match) throw unauthorized('Access token required');

  return match[1];
};

// No try/catch, for the same reason the controllers have none: Express 5
// forwards a rejected promise to the error handler exactly as it forwards a
// thrown error, so a 401 raised in here lands in the one place that turns an
// HttpError into JSON.
export const requireAuth = async (req, res, next) => {
  const token = readBearerToken(req);

  req.user = await authService.verifyToken(token);

  // Kept because logout needs to tell Supabase *which* session to end, and by
  // then the raw token is gone from the header's point of view. Nothing else
  // should reach for this — handlers want req.user.
  req.accessToken = token;

  next();
};
