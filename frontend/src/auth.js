// Where the token lives, and everything that talks to /auth.
//
// localStorage is the honest choice for a practice project and the wrong one for
// a real product, so it is worth naming the trade rather than hiding it. Any
// script that runs on this page can read localStorage, which means a single XSS
// hole hands over the token — and a token is a session. Production apps put it in
// an httpOnly cookie instead, which JavaScript cannot read at all. What is kept
// here is deliberately only the access token: the refresh token is the
// longer-lived key to minting new ones, and it has no business in a browser
// store this readable.
const STORAGE_KEY = 'flyrank.access_token';

export const getToken = () => localStorage.getItem(STORAGE_KEY);

const setToken = (token) => localStorage.setItem(STORAGE_KEY, token);

export const clearToken = () => localStorage.removeItem(STORAGE_KEY);

// The API reports every failure the same way — a JSON { error } body — so it is
// unwrapped once here and callers just catch an Error, exactly as in api.js.
async function request(path, options = {}) {
  const res = await fetch(path, options);

  if (res.status === 204) return null;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(body?.error ?? `Request failed with status ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

const json = (payload) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

// Every call below sends the token the same way the curl examples do:
// `Authorization: Bearer <token>`. There is nothing browser-specific about it —
// Swagger's Authorize button builds the identical header.
export const authHeader = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const signUp = (email, password) => request('/auth/signup', json({ email, password }));

export const logIn = async (email, password) => {
  const session = await request('/auth/login', json({ email, password }));

  setToken(session.access_token);

  return session;
};

export const logOut = async () => {
  try {
    await request('/auth/logout', { method: 'POST', headers: authHeader() });
  } finally {
    // Forget the token locally whatever the server said. If it answered 401 the
    // token was already dead, and keeping it would leave the UI insisting it is
    // signed in with a pass that opens nothing.
    clearToken();
  }
};

export const getProfile = () => request('/protected/profile', { headers: authHeader() });

export const getDashboard = () => request('/protected/dashboard', { headers: authHeader() });

// No header on purpose. This is the control in the experiment: when a protected
// call comes back 401 it proves the token is the problem, not the server.
export const getPublicInfo = () => request('/public/info');
