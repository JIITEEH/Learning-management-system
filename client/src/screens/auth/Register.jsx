// Create an account. The role is never asked for or sent: the server decides it. The very first
// account on an empty system becomes an active administrator; every later one is a student
// waiting for an administrator's approval.
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api-client/api.js';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { Notice } from '../../ui-pieces/basics/Feedback.jsx';
import AuthLayout from './AuthLayout.jsx';

export default function Register() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [created, setCreated] = useState(null); // the new account, once made
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const submit = useSubmit(async () => {
    if (!form.fullName.trim() || !form.email.trim()) throw new Error('Your name and email address are both needed.');
    if (form.password.length < 8) throw new Error('The password must be at least 8 characters.');
    // Checked here as a courtesy: only one copy is sent, so the server has nothing to compare
    if (form.password !== form.confirm) throw new Error('The two passwords do not match.');
    const { user } = await api.register({ fullName: form.fullName.trim(), email: form.email.trim(), password: form.password });
    setCreated(user);
  });

  if (created) {
    return (
      <AuthLayout>
        <h1>Account created</h1>
        <Notice tone="ok">
          {created.status === 'active'
            ? 'You can sign in now.'
            : 'An administrator has to approve it before you can sign in.'}
        </Notice>
        <p className="centred-foot">
          <Link to="/login">Go to sign in</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1>Create an account</h1>
      <p className="card-intro">
        A new account joins as a student and waits for an administrator to approve it before it can sign in.
      </p>
      <Notice>{submit.error}</Notice>

      <form className="form" noValidate onSubmit={(event) => { event.preventDefault(); submit.run(); }}>
        <div className="field">
          <label htmlFor="fullName">Full name</label>
          <input className="input" id="fullName" autoComplete="name" required autoFocus maxLength={160}
            value={form.fullName} onChange={update('fullName')} />
        </div>
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input className="input" id="email" type="email" autoComplete="email" required
            value={form.email} onChange={update('email')} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input className="input" id="password" type="password" autoComplete="new-password" required
            aria-describedby="password-hint" value={form.password} onChange={update('password')} />
          <p className="field-hint" id="password-hint">At least 8 characters.</p>
        </div>
        <div className="field">
          <label htmlFor="confirm">Repeat password</label>
          <input className="input" id="confirm" type="password" autoComplete="new-password" required
            value={form.confirm} onChange={update('confirm')} />
        </div>
        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={submit.busy} data-loading={submit.busy}>
          Create account
        </button>
      </form>

      <p className="centred-foot">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
