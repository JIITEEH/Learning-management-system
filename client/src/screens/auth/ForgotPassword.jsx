// Ask for a reset link. The server answers the same whether or not the email has an account, so
// this screen cannot be used to find out who is registered, and it does not claim otherwise.
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api-client/api.js';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { Notice } from '../../ui-pieces/basics/Feedback.jsx';
import AuthLayout from './AuthLayout.jsx';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');

  const submit = useSubmit(async () => {
    if (!email.includes('@')) throw new Error('Type the email address your account uses.');
    await api.forgotPassword(email.trim());
    setSentTo(email.trim());
  });

  return (
    <AuthLayout>
      <h1>Forgot your password?</h1>
      {sentTo ? (
        <Notice tone="ok">
          If {sentTo} has an account, a link to choose a new password is on its way. Check the inbox, and the spam
          folder, in the next few minutes.
        </Notice>
      ) : (
        <>
          <p className="card-intro">
            Type the email address your account uses. If it has an account, a link to choose a new password is sent
            there. The link works for 30 minutes.
          </p>
          <Notice>{submit.error}</Notice>
          <form className="form" noValidate onSubmit={(event) => { event.preventDefault(); submit.run(); }}>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input className="input" id="email" type="email" autoComplete="email" required autoFocus
                value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={submit.busy} data-loading={submit.busy}>
              Send the link
            </button>
          </form>
        </>
      )}
      <p className="centred-foot">
        Remembered it? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
