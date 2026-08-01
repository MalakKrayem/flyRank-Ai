import { useEffect, useState } from 'react';
import * as auth from './auth.js';
import LoginScreen from './LoginScreen.jsx';
import AccountBar from './AccountBar.jsx';
import TaskList from './TaskList.jsx';

// The gate, and nothing else. One of three things renders: a brief checking
// state, the login screen, or the app. Never two of them at once.
//
// Worth being honest about what this is and is not. Hiding the task list is a
// *user interface* decision, not a security control — /tasks is still open, and
// anyone can curl it. Real protection is the middleware on the server; a
// frontend that hides a button in front of an unguarded endpoint has protected
// nothing. What this does buy is that the app never renders in a half-state
// where it cannot say who the user is.

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // A token in localStorage survives a reload; a *valid* token is a different
  // claim. Ask the server rather than trusting what is on disk, so an expired
  // token lands on the login screen instead of on an app that lies until the
  // first click.
  useEffect(() => {
    if (!auth.getToken()) {
      setChecking(false);
      return;
    }

    auth
      .getProfile()
      .then(({ user: verified }) => setUser(verified))
      .catch(() => auth.clearToken())
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <main className="gate">
        <p className="empty">Checking your session…</p>
      </main>
    );
  }

  if (!user) {
    return <LoginScreen onSignedIn={setUser} />;
  }

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>Tasks</h1>
          <p className="subtitle">
            A React client for the Task API. Also explorable at{' '}
            <a href="http://localhost:3000/docs" target="_blank" rel="noreferrer">
              /docs
            </a>
            .
          </p>
        </div>
      </header>

      <AccountBar user={user} onSignedOut={() => setUser(null)} />

      <TaskList />
    </main>
  );
}
