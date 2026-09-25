// The accounts screen: every account in a table, and a panel for managing the one picked.
// What each viewer can change follows their own permissions:
//   user.read    see the table and each account's permissions (needed to open this screen)
//   user.update  change an account's status
//   role.manage  change an account's role and its exceptions
// Switching a control off is a courtesy; the server checks every one of these again.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../../api-client/api.js';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import { useToast } from '../../shared-state/ToastContext.jsx';
import useApi from '../../reusable-logic/useApi.js';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { accountStatus, formatDateTime, plural } from '../../helpers/format.js';
import { Notice } from '../../ui-pieces/basics/Feedback.jsx';

const STATUSES = ['pending', 'active', 'suspended'];

function AccountEditor({ userId, roles, catalogue, onSaved }) {
  const { user: me, can } = useAuth();
  const toast = useToast();
  const heading = useRef(null);
  const { data, reload } = useApi(
    () => Promise.all([api.getUser(userId), api.getUserPermissions(userId)]),
    [userId],
  );
  const [form, setForm] = useState(null); // { status, role, overrides: { code: 'allow' | 'deny' } }

  // Fill the form each time an account's details arrive
  useEffect(() => {
    if (!data) return;
    const [{ user }, permissions] = data;
    setForm({
      status: user.status,
      role: user.role,
      overrides: Object.fromEntries(permissions.overrides.map((entry) => [entry.code, entry.effect])),
    });
  }, [data]);

  // Move focus to the panel once the account has loaded, so keyboard and screen-reader users land
  // on what just appeared instead of staying on a button far above it. (The panel is re-created
  // for each account, see key={pickedId} below, so this runs once per account.)
  const loaded = form !== null;
  useEffect(() => {
    if (!loaded) return;
    heading.current?.focus();
    heading.current?.scrollIntoView({ block: 'start' });
  }, [loaded]);

  const saveAccount = useSubmit(async () => {
    const [{ user }] = data;
    // Status and role are separate addresses on the server because they need different
    // permissions, so only the one that changed is sent
    if (form.status !== user.status) await api.setUserStatus(user.id, form.status);
    if (form.role !== user.role) await api.updateUser(user.id, { role: form.role });
    toast.success(`${user.fullName} saved.`);
    reload();
    onSaved();
  });

  const saveOverrides = useSubmit(async () => {
    const [{ user }] = data;
    // The server replaces the whole set, so a code left on "Follow the role" loses its exception
    const overrides = Object.entries(form.overrides)
      .filter(([, effect]) => effect)
      .map(([code, effect]) => ({ code, effect }));
    await api.setUserPermissions(user.id, overrides);
    toast.success(`Exceptions for ${user.fullName} saved.`);
  });

  if (!data || !form) return null;
  const [{ user }, permissions] = data;
  const fromRole = new Set(permissions.fromRole);
  // The server refuses both for your own account: either is a quick way to lock yourself out
  const isSelf = user.id === me.id;
  const statusLocked = isSelf || !can('user.update');
  const roleLocked = isSelf || !can('role.manage');

  return (
    <section className="card" aria-labelledby="editor-title">
      <h2 id="editor-title" tabIndex={-1} ref={heading}>{user.fullName}</h2>
      <p className="card-intro">{user.email} · {user.roleLabel}</p>
      <Notice>{saveAccount.error}</Notice>

      <form className="form" noValidate onSubmit={(event) => { event.preventDefault(); saveAccount.run(); }}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="account-status">Status</label>
            <select className="select" id="account-status" aria-describedby="status-hint" disabled={statusLocked}
              value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              {STATUSES.map((status) => <option key={status} value={status}>{accountStatus(status).label}</option>)}
            </select>
            <p className="field-hint" id="status-hint">
              {isSelf
                ? 'This is your own account. Another administrator must change its status or role.'
                : 'Only an active account can sign in.'}
            </p>
          </div>
          <div className="field">
            <label htmlFor="account-role">Role</label>
            <select className="select" id="account-role" aria-describedby="role-hint" disabled={roleLocked}
              value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              {roles.map((role) => <option key={role.id} value={role.name}>{role.label}</option>)}
            </select>
            <p className="field-hint" id="role-hint">The role decides most of what the account may do.</p>
          </div>
        </div>
        {!(statusLocked && roleLocked) && (
          <div className="actions">
            <button className="btn btn-primary" type="submit" disabled={saveAccount.busy} data-loading={saveAccount.busy}>
              Save status and role
            </button>
          </div>
        )}
      </form>

      <h3 className="subhead">Exceptions for this account</h3>
      <p className="card-intro">
        Each permission normally follows the role. You can instead always allow it for this one person, or always deny
        it, even when the role grants it. A deny beats everything else.
      </p>
      <Notice>{saveOverrides.error}</Notice>
      {catalogue.map(({ category, permissions: codes }) => (
        <div key={category} className="perm-group">
          <h3>{category}</h3>
          <div className="perm-list">
            {codes.map(({ code, description }) => (
              <div key={code} className="perm-row">
                <div>
                  <label className="perm-code" htmlFor={`override-${code}`}>{code}</label>
                  <div className="perm-desc">
                    {description} The role says: {fromRole.has(code) ? 'allowed' : 'not allowed'}.
                  </div>
                </div>
                <select className="select" id={`override-${code}`} disabled={!can('role.manage')}
                  value={form.overrides[code] ?? ''}
                  onChange={(event) => setForm({ ...form, overrides: { ...form.overrides, [code]: event.target.value } })}>
                  <option value="">Follow the role</option>
                  <option value="allow">Always allow</option>
                  <option value="deny">Always deny</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      ))}
      {can('role.manage') && (
        <div className="actions">
          <button className="btn btn-primary" type="button" onClick={saveOverrides.run}
            disabled={saveOverrides.busy} data-loading={saveOverrides.busy}>
            Save exceptions
          </button>
        </div>
      )}
    </section>
  );
}

export default function Users() {
  // Filters live in the address (?status=pending), so a filtered list can be linked to
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = { status: searchParams.get('status') ?? '', role: searchParams.get('role') ?? '' };
  const [pickedId, setPickedId] = useState(null);

  const lists = useApi(() => Promise.all([api.listRoles(), api.listPermissions()]), []);
  const accounts = useApi(() => api.listUsers(filters), [filters.status, filters.role]);
  const [roleReply, permissionReply] = lists.data ?? [{ roles: [] }, { categories: [] }];
  const users = accounts.data?.users ?? [];

  function setFilter(name, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next);
  }

  return (
    <main className="stack stack-wide" id="main">
      <section className="card" aria-labelledby="users-title">
        <div className="card-head">
          <h1 id="users-title">Accounts</h1>
          <span className="tag">{accounts.data ? plural(users.length, 'account') : '—'}</span>
        </div>
        <p className="card-intro">
          New sign-ups arrive as students awaiting approval. Pick an account to approve it, suspend it, or change what
          it may do.
        </p>
        <Notice>{accounts.error?.message || lists.error?.message}</Notice>

        <div className="filters">
          <div className="field">
            <label htmlFor="filter-status">Status</label>
            <select className="select" id="filter-status" value={filters.status}
              onChange={(event) => setFilter('status', event.target.value)}>
              <option value="">Any status</option>
              {STATUSES.map((status) => <option key={status} value={status}>{accountStatus(status).label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-role">Role</label>
            <select className="select" id="filter-role" value={filters.role}
              onChange={(event) => setFilter('role', event.target.value)}>
              <option value="">Any role</option>
              {roleReply.roles.map((role) => <option key={role.id} value={role.name}>{role.label}</option>)}
            </select>
          </div>
        </div>

        {accounts.data && users.length === 0 ? (
          <p className="empty">No account matches these filters.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email address</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last signed in</th>
                  <th scope="col"><span className="visually-hidden">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const status = accountStatus(user.status);
                  return (
                    <tr key={user.id} aria-current={user.id === pickedId ? 'true' : undefined}>
                      <td className="cell-strong">{user.fullName}</td>
                      <td data-label="Email address">{user.email}</td>
                      <td data-label="Role">{user.roleLabel}</td>
                      <td data-label="Status"><span className={`tag ${status.tone}`}>{status.label}</span></td>
                      <td data-label="Last signed in">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}</td>
                      <td className="cell-action">
                        <button className="btn btn-sm" type="button" onClick={() => setPickedId(user.id)}>
                          Manage<span className="visually-hidden"> {user.fullName}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pickedId && lists.data && (
        <AccountEditor key={pickedId} userId={pickedId} roles={roleReply.roles}
          catalogue={permissionReply.categories} onSaved={accounts.reload} />
      )}
    </main>
  );
}
