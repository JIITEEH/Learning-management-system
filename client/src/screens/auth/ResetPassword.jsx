// Choose a new password from the link in a reset email: /reset-password#token=...
//
// The secret sits after the #. Browsers never send that part of an address to any server, so it
// stays out of server logs and out of what other sites learn when a link is followed. It is read
// once, then wiped from the address bar and the browser history.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api-client/api.js';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { Notice } from '../../ui-pieces/basics/Feedback.jsx';
import AuthLayout from './AuthLayout.jsx';

function takeTokenFromAddress() {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
  if (token) window.history.replaceState(null, '', window.location.pathname);
  return token;
}

export default function ResetPassword() {
  // useState(function) runs the function once, on first render, so the token is read only once
  const [token] = useState(takeTokenFromAddress);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);

  // A link pasted into a tab already on this screen changes only the part after the #, which does
  // not reload the page, so the new token would never be read. Reload, so it is.
  useEffect(() => {
    const reload = () => window.location.reload();
    window.addEventListener('hashchange', reload);
    return () => window.removeEventListener('hashchange', reload);
  }, []);

  const submit = useSubmit(async () => {
    if (password.length < 8) throw new Error('The new password must be at least 8 characters.');
    if (password !== confirm) throw new Error('The two passwords do not match.');
    await api.resetPassword(token, password);
    setDone(true);
  });

  let body;
  if (!token) {
    body = <Notice>This page needs the link from a reset email. Ask for a new one from the sign-in page.</Notice>;
  } else if (done) {
    body = (
      <>
        <Notice tone="ok">Your password is changed, and every device has been signed out.</Notice>
        <Link className="btn btn-primary btn-lg btn-block" to="/login">Sign in</Link>
      </>
    );
  } else {
    body = (
      <>
        <p className="card-intro">Saving it signs you out on every device, including any you have lost track of.</p>
        <Notice>{submit.error}</Notice>
        <form className="form" noValidate onSubmit={(event) => { event.preventDefault(); submit.run(); }}>
          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input className="input" id="newPassword" type="password" autoComplete="new-password" required autoFocus
              aria-describedby="new-password-hint" value={password} onChange={(event) => setPassword(event.target.value)} />
            <p className="field-hint" id="new-password-hint">At least 8 characters.</p>
          </div>
          <div className="field">
            <label htmlFor="confirm">Repeat new password</label>
            <input className="input" id="confirm" type="password" autoComplete="new-password" required
              value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </div>
          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={submit.busy} data-loading={submit.busy}>
            Save new password
          </button>
        </form>
      </>
    );
  }

  return (
    <AuthLayout>
      <h1>Choose a new password</h1>
      {body}
      {!done && (
        <p className="centred-foot">
          <Link to="/login">Back to sign in</Link>
        </p>
      )}
    </AuthLayout>
  );
}
