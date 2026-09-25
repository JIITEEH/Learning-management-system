// Your own account: what it holds right now, and changing its password
import { useEffect, useState } from 'react';
import { api } from '../api-client/api.js';
import { useAuth } from '../shared-state/AuthContext.jsx';
import { useToast } from '../shared-state/ToastContext.jsx';
import useSubmit from '../reusable-logic/useSubmit.js';
import { accountStatus, plural, roleLabel } from '../helpers/format.js';
import { Notice } from '../ui-pieces/basics/Feedback.jsx';

const EMPTY_FORM = { currentPassword: '', newPassword: '', confirm: '' };

export default function Account() {
  const { user, permissions, refresh } = useAuth();
  const toast = useToast();
  // Ask the server again on opening, so a renamed account or a changed permission shows at once
  useEffect(() => {
    refresh();
  }, [refresh]);
  const [form, setForm] = useState(EMPTY_FORM);
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  const codes = [...permissions].sort();

  const changePassword = useSubmit(async () => {
    if (form.newPassword.length < 8) throw new Error('The new password must be at least 8 characters.');
    if (form.newPassword !== form.confirm) throw new Error('The two new passwords do not match.');
    if (form.newPassword === form.currentPassword) throw new Error('The new password is the same as the current one.');
    await api.changePassword(form.currentPassword, form.newPassword);
    setForm(EMPTY_FORM);
    toast.success('Password changed. Your other devices have been signed out.');
  });

  return (
    <main className="stack" id="main">
      <section className="card" aria-labelledby="details-title">
        <h1 id="details-title">Your account</h1>
        <p className="card-intro">These details come from the server each time this screen opens.</p>
        <dl className="details">
          <div><dt>Name</dt><dd>{user.fullName}</dd></div>
          <div><dt>Email address</dt><dd>{user.email}</dd></div>
          <div><dt>Role</dt><dd>{roleLabel(user.role)}</dd></div>
          <div><dt>Status</dt><dd>{accountStatus(user.status).label}</dd></div>
        </dl>
      </section>

      <section className="card" aria-labelledby="permissions-title">
        <div className="card-head">
          <h2 id="permissions-title">What you may do</h2>
          <span className="tag">{plural(codes.length, 'permission')}</span>
        </div>
        <p>
          Your role grants these permissions. A page or a button you cannot see is missing because one of these is not
          on the list, and the server checks the same list again on every request.
        </p>
        <div className="tag-list">
          {codes.map((code) => <span key={code} className="tag">{code}</span>)}
        </div>
      </section>

      <section className="card" aria-labelledby="password-title">
        <h2 id="password-title">Change password</h2>
        <p className="card-intro">
          Your current password is asked for so that an unattended, still signed-in browser cannot be used to lock you
          out of your own account.
        </p>
        <Notice>{changePassword.error}</Notice>
        <form className="form" noValidate onSubmit={(event) => { event.preventDefault(); changePassword.run(); }}>
          <div className="field">
            <label htmlFor="currentPassword">Current password</label>
            <input className="input" id="currentPassword" type="password" autoComplete="current-password" required
              value={form.currentPassword} onChange={update('currentPassword')} />
          </div>
          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input className="input" id="newPassword" type="password" autoComplete="new-password" required
              aria-describedby="new-password-hint" value={form.newPassword} onChange={update('newPassword')} />
            <p className="field-hint" id="new-password-hint">At least 8 characters.</p>
          </div>
          <div className="field">
            <label htmlFor="confirm">Repeat new password</label>
            <input className="input" id="confirm" type="password" autoComplete="new-password" required
              value={form.confirm} onChange={update('confirm')} />
          </div>
          <button className="btn btn-primary btn-lg" type="submit" disabled={changePassword.busy} data-loading={changePassword.busy}>
            Change password
          </button>
        </form>
      </section>
    </main>
  );
}
