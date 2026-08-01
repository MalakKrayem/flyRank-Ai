import { supabase } from '../auth/supabase.js';
import { HttpError, badRequest, unauthorized } from '../errors.js';

// Everything this app knows how to do with an account. It is a thin layer on
// purpose: the passwords are hashed by Supabase, the tokens are signed by
// Supabase, and the only original work here is deciding what counts as bad input
// and which failure becomes which status code.
//
// The golden rule of the whole assignment lives in what is *absent* from this
// file. There is no hashing, no token signing, no password ever written down.
// Credentials arrive, get forwarded, and are forgotten.

// The server never trusts the client. An empty body, a missing password, a
// `password` that arrived as a number — all of it is caught here, before a
// pointless network call to Supabase.
const readCredentials = (body) => {
  const { email, password } = body ?? {};

  if (typeof email !== 'string' || email.trim() === '') {
    throw badRequest('Email is required');
  }
  if (typeof password !== 'string' || password === '') {
    throw badRequest('Password is required');
  }

  return { email: email.trim(), password };
};

// The SDK does not throw. It resolves with `{ data, error }` and leaves the
// judgement to us — which is exactly the trap Stage 7 asks you to look for in the
// AI's version: code that reads `data` without ever looking at `error` will
// happily treat a rejected login as a success.
export const signUp = async (body) => {
  const { data, error } = await supabase.auth.signUp(readCredentials(body));

  // Supabase already knows why it said no — a password under six characters, an
  // address that is not an address — and its own status code is more accurate
  // than a blanket 400, so it is passed through when there is one.
  if (error) throw new HttpError(error.status ?? 400, error.message);

  return data.user;
};

export const logIn = async (body) => {
  const { data, error } = await supabase.auth.signInWithPassword(readCredentials(body));

  // Deliberately one message for every way this can fail. "No such user" and
  // "wrong password" are different facts, and telling them apart out loud would
  // let anyone discover which email addresses have accounts.
  if (error) throw unauthorized('Invalid login credentials');

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    token_type: data.session.token_type,
    expires_in: data.session.expires_in,
    user: publicUser(data.user),
  };
};

// The guard's one question: is this token real, and whose is it?
//
// This is a network call to Supabase, not local arithmetic, and that is the
// whole reason the answer can be trusted. A JWT is signed but not secret —
// anyone can read its payload, and a forged one is only detectable by checking
// the signature against the key that made it. Supabase holds that key.
//
// `error || !data?.user` is one condition on purpose. The SDK reports a rejected
// token through `error`, but a client that had no session at all can also come
// back as a clean response with a null user. Trusting `data.user` without
// checking both is how a route ends up "authenticating" nobody.
export const verifyToken = async (token) => {
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) throw unauthorized('Invalid or expired token');

  return publicUser(data.user);
};

// Ending a session, which needs the token rather than the client's memory.
//
// The obvious call — `supabase.auth.signOut()` — does nothing here, and reading
// the SDK shows why: it looks up the *stored* session to find which token to
// revoke, and this client stores none (see auth/supabase.js on why a server must
// not). With no session found it returns success having called nothing, which is
// the worst kind of bug: a logout that reports 204 and revokes nothing.
//
// `admin.signOut(jwt)` is the same POST /logout with the token passed in
// explicitly. The `admin` namespace is a naming accident rather than a
// permission level — it is authorised by the user's own token, and no
// service_role key is involved.
export const logOut = async (token) => {
  const { error } = await supabase.auth.admin.signOut(token);

  // The guard already proved this token was good a moment ago, so a failure now
  // is a real one and not a stale pass.
  if (error) throw new HttpError(error.status ?? 500, error.message);
};

// What a client is allowed to learn about the account behind a token. Supabase's
// user object carries more than that — internal identity records, the raw app
// metadata — and none of it has a reason to cross the wire.
export const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  created_at: user.created_at,
});
