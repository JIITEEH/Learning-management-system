import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { Notice } from '../../ui-pieces/basics/Feedback.jsx';
import AuthLayout from './AuthLayout.jsx';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = useSubmit(async () => {
    if (!email.trim() || !password) throw new Error('Enter your email address and password.');
    // Once signed in, GuestOnly (around this screen) moves the person on to where they were going
    await signIn(email.trim(), password);
  });

  return (
    <AuthLayout>
      <h1>Sign in</h1>
      <p className="card-intro">Use the email address your account was created with.</p>
      <Notice>{submit.error}</Notice>

      <form className="form" noValidate onSubmit={(event) => { event.preventDefault(); submit.run(); }}>
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input className="input" id="email" type="email" autoComplete="email" required autoFocus
            value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input className="input" id="password" type="password" autoComplete="current-password" required
            value={password} onChange={(event) => setPassword(event.target.value)} />
          <p className="field-hint">
            <Link to="/forgot-password">Forgot your password?</Link>
          </p>
        </div>
        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={submit.busy} data-loading={submit.busy}>
          Sign in
        </button>
      </form>

      <p className="centred-foot">
        No account yet? <Link to="/register">Create one</Link>
      </p>
    </AuthLayout>
  );
}
