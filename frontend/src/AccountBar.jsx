import { useState } from 'react';
import * as auth from './auth.js';

// The signed-in header: who you are, a way out, and the buttons that prove the
// guard is doing its job on every request rather than only at login.
//
// The route buttons are kept because they are the assignment's checkpoints
// without curl. "…with a tampered token" is the interesting one — it flips a
// single character of a token that worked a second ago and watches the same
// route answer 401. Nothing else on this page demonstrates that a JWT is
// verified rather than merely remembered.

const pretty = (value) => JSON.stringify(value, null, 2);

export default function AccountBar({ user, onSignedOut }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const call = async (label, action) => {
    setBusy(true);
    try {
      setResult({ label, ok: true, data: await action() });
    } catch (err) {
      setResult({ label, ok: false, status: err.status, message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleLogOut = async () => {
    setBusy(true);
    try {
      await auth.logOut();
    } finally {
      // auth.logOut clears the token whatever the server said, so the app must
      // return to the gate either way.
      setBusy(false);
      onSignedOut();
    }
  };

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
    <section className="account" aria-label="Account">
      <div className="account__row">
        <div className="account__who">
          <span className="badge badge--in">Signed in</span>
          <strong>{user.email}</strong>
          <span className="account__id" title={`Account created ${new Date(user.created_at).toLocaleString()}`}>
            {user.id}
          </span>
        </div>
        <button type="button" className="danger" disabled={busy} onClick={handleLogOut}>
          Log out
        </button>
      </div>

      <div className="account__calls" role="group" aria-label="Try the routes">
        <button type="button" disabled={busy} onClick={() => call('GET /protected/profile', auth.getProfile)}>
          /protected/profile
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => call('GET /protected/dashboard', auth.getDashboard)}
        >
          /protected/dashboard
        </button>
        <button type="button" disabled={busy} onClick={handleTamper}>
          …with a tampered token
        </button>
        {result && (
          <button type="button" className="link" onClick={() => setResult(null)}>
            clear
          </button>
        )}
      </div>

      {result && (
        <output className={result.ok ? 'auth__out' : 'auth__out auth__out--bad'}>
          <span className="auth__label">
            {result.label} — {result.ok ? 'OK' : (result.status ?? 'failed')}
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
    </section>
  );
}
