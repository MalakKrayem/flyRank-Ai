import { useState } from 'react';
import * as auth from './auth.js';

// Everything a visitor with no token is allowed to see. There is no task list
// behind it and no task list underneath it — the app is not rendered at all
// until there is a verified user, which is the frontend saying the same thing
// the middleware says on the server.
//
// The two buttons at the bottom are the exception, and they earn their place:
// one proves the server is reachable without any token, the other proves the
// door is genuinely locked. Neither shows any content.

export default function LoginScreen({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [probe, setProbe] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === 'signup') {
        await auth.signUp(email, password);
        // Signing up does not sign you in — Supabase returns the new user, not a
        // session. Saying so is better than silently switching tabs and leaving
        // someone wondering whether it worked.
        setNotice('Account created. Log in with the same details.');
        setMode('login');
      } else {
        const session = await auth.logIn(email, password);
        onSignedIn(session.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // No token is sent by either of these on purpose.
  const probeRoute = async (label, action) => {
    try {
      setProbe({ label, ok: true, body: await action() });
    } catch (err) {
      setProbe({ label, ok: false, status: err.status, body: { error: err.message } });
    }
  };

  return (
    <main className="gate">
      <div className="gate__card">
        <h1>Task API</h1>
        <p className="subtitle">
          {mode === 'login'
            ? 'Sign in to see your tasks.'
            : 'Create an account — Supabase stores it, this app never sees a password.'}
        </p>

        <div className="gate__tabs" role="group" aria-label="Sign in or sign up">
          <button
            type="button"
            className={mode === 'login' ? 'chip chip--active' : 'chip'}
            aria-pressed={mode === 'login'}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
          >
            Log in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'chip chip--active' : 'chip'}
            aria-pressed={mode === 'signup'}
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
          >
            Sign up
          </button>
        </div>

        <form className="gate__form" onSubmit={submit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@gmail.com"
            aria-label="Email"
            autoComplete="username"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            aria-label="Password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
          <button type="submit" className="gate__submit" disabled={busy}>
            {busy ? 'Working…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        {notice && <p className="notice">{notice}</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="gate__probe">
          <span>Without a token:</span>
          <button type="button" onClick={() => probeRoute('GET /public/info', auth.getPublicInfo)}>
            /public/info
          </button>
          <button
            type="button"
            onClick={() => probeRoute('GET /protected/profile', auth.getProfile)}
          >
            /protected/profile
          </button>
        </div>

        {probe && (
          <output className={probe.ok ? 'auth__out' : 'auth__out auth__out--bad'}>
            <span className="auth__label">
              {probe.label} — {probe.ok ? 'OK' : probe.status}
            </span>
            <pre>{JSON.stringify(probe.body, null, 2)}</pre>
          </output>
        )}
      </div>
    </main>
  );
}
