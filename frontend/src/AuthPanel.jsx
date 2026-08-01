import { useEffect, useState } from 'react';
import * as auth from './auth.js';

// The browser version of the curl checkpoints. The buttons are deliberately not
// hidden when signed out: pressing "GET /protected/profile" with no token and
// watching the 401 come back is the entire lesson, and a disabled button teaches
// nothing. The same button with a token returns 200 and your account.

const pretty = (value) => JSON.stringify(value, null, 2);

export default function AuthPanel() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [signedIn, setSignedIn] = useState(() => Boolean(auth.getToken()));
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  // A token in localStorage survives a reload; a *valid* token is a different
  // claim. This asks the server on mount rather than trusting what is on disk,
  // so an expired token shows as signed out instead of as a UI that lies until
  // the first click.
  useEffect(() => {
    if (!auth.getToken()) return;

    auth
      .getProfile()
      .then(({ user: verified }) => setUser(verified))
      .catch(() => {
        auth.clearToken();
        setSignedIn(false);
        setUser(null);
      });
  }, []);

  // One wrapper so every button reports the same way: what was called, whether
  // it worked, and exactly what came back.
  const call = async (label, action) => {
    setBusy(true);
    try {
      const data = await action();
      setResult({ label, ok: true, data });
      return data;
    } catch (err) {
      setResult({ label, ok: false, status: err.status, message: err.message });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = (event) => {
    event.preventDefault();
    call('POST /auth/signup', () => auth.signUp(email, password));
  };

  const handleLogIn = async () => {
    const session = await call('POST /auth/login', () => auth.logIn(email, password));
    if (!session) return;

    setSignedIn(true);
    setUser(session.user);
    setPassword('');
  };

  const handleLogOut = async () => {
    await call('POST /auth/logout', auth.logOut);
    setSignedIn(false);
    setUser(null);
  };

  // Proves the token is checked on every request rather than at login only.
  // Corrupting one character is what the Stage 3 checkpoint does with curl.
  const handleTamper = () =>
    call('GET /protected/profile (tampered token)', async () => {
      const real = auth.getToken();
      const forged = real.slice(0, -1) + (real.endsWith('a') ? 'b' : 'a');

      const res = await fetch('/protected/profile', {
        headers: { Authorization: `Bearer ${forged}` },
      });
      const body = await res.json();

      if (!res.ok) {
        const err = new Error(body.error);
        err.status = res.status;
        throw err;
      }
      return body;
    });

  return (
    <section className="auth" aria-labelledby="auth-heading">
      <div className="auth__head">
        <h2 id="auth-heading">Authentication</h2>
        <span className={signedIn ? 'badge badge--in' : 'badge'}>
          {signedIn ? 'Signed in' : 'Signed out'}
        </span>
      </div>

      {signedIn && user ? (
        <dl className="auth__user">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>User id</dt>
            <dd className="auth__id">{user.id}</dd>
          </div>
          <div>
            <dt>Account created</dt>
            <dd>{new Date(user.created_at).toLocaleString()}</dd>
          </div>
        </dl>
      ) : (
        <form className="auth__form" onSubmit={handleSignUp}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@gmail.com"
            aria-label="Email"
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            aria-label="Password"
            autoComplete="current-password"
          />
          <button type="submit" disabled={busy}>
            Sign up
          </button>
          <button type="button" className="primary" disabled={busy} onClick={handleLogIn}>
            Log in
          </button>
        </form>
      )}

      <div className="auth__calls" role="group" aria-label="Try the routes">
        <button type="button" disabled={busy} onClick={() => call('GET /public/info', auth.getPublicInfo)}>
          GET /public/info
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => call('GET /protected/profile', auth.getProfile)}
        >
          GET /protected/profile
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => call('GET /protected/dashboard', auth.getDashboard)}
        >
          GET /protected/dashboard
        </button>
        {signedIn && (
          <>
            <button type="button" disabled={busy} onClick={handleTamper}>
              …with a tampered token
            </button>
            <button type="button" className="danger" disabled={busy} onClick={handleLogOut}>
              Log out
            </button>
          </>
        )}
      </div>

      {result && (
        <output className={result.ok ? 'auth__out' : 'auth__out auth__out--bad'}>
          <span className="auth__label">
            {result.label} — {result.ok ? 'OK' : `${result.status ?? 'failed'}`}
          </span>
          <pre>
            {!result.ok
              ? pretty({ error: result.message })
              : // A 204 has no body to show, which is the point of a 204.
                result.data === null
                ? '204 No Content'
                : pretty(result.data)}
          </pre>
        </output>
      )}

      <p className="auth__note">
        The task list below is <strong>not</strong> protected — A4 guards <code>/protected/*</code>{' '}
        and <code>/auth/logout</code> only. Signing out does not hide it, and that is correct.
      </p>
    </section>
  );
}
