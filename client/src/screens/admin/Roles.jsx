// The roles screen: every role with how many accounts hold it, and an editor for a role's name,
// description and permissions. The whole screen needs role.manage, which the server checks again.
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api-client/api.js';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import { useToast } from '../../shared-state/ToastContext.jsx';
import useApi from '../../reusable-logic/useApi.js';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { Notice } from '../../ui-pieces/basics/Feedback.jsx';

const BLANK_ROLE = { label: '', name: '', description: '', codes: [] };

// `roleId` is null for a new role. `holders` is how many accounts hold it (from the table).
function RoleEditor({ roleId, holders, catalogue, onSaved, onDeleted }) {
  const { user: me } = useAuth();
  const toast = useToast();
  const heading = useRef(null);
  const isNew = roleId === null;
  const { data } = useApi(() => (isNew ? null : api.getRole(roleId)), [roleId]);
  const [form, setForm] = useState(isNew ? BLANK_ROLE : null);
  const role = data?.role ?? null;

  useEffect(() => {
    if (data) {
      setForm({ label: data.role.label, name: data.role.name, description: data.role.description ?? '', codes: data.codes });
    }
  }, [data]);

  const loaded = form !== null;
  useEffect(() => {
    if (!loaded) return;
    heading.current?.focus();
    heading.current?.scrollIntoView({ block: 'start' });
  }, [loaded]);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  function toggleCode(code) {
    const codes = form.codes.includes(code) ? form.codes.filter((held) => held !== code) : [...form.codes, code];
    setForm({ ...form, codes });
  }

  const save = useSubmit(async () => {
    const label = form.label.trim();
    const name = form.name.trim().toLowerCase();
    if (!label || !name) throw new Error('Both the name shown on screen and the short name are needed.');

    // Taking role.manage away from your own role takes it from you, and then nobody on this
    // account can put it back. The server allows it (another administrator might hold it through
    // a different role), so the screen asks first.
    if (role && role.name === me.role && !form.codes.includes('role.manage')) {
      const sure = window.confirm(
        'This is your own role. Without role.manage you will lose access to this screen and cannot undo the change yourself. Save anyway?',
      );
      if (!sure) return;
    }

    const details = { name, label, description: form.description.trim() };
    let savedId = roleId;
    if (isNew) {
      savedId = (await api.createRole({ ...details, codes: form.codes })).role.id;
    } else {
      // Details and permissions are separate on the server, so an existing role saves in two requests
      await api.updateRole(roleId, details);
      await api.setRolePermissions(roleId, form.codes);
    }
    toast.success(`${label} saved.`);
    onSaved(savedId);
  });

  const remove = useSubmit(async () => {
    if (!window.confirm(`Delete the role "${role.label}"? This cannot be undone.`)) return;
    await api.deleteRole(role.id);
    toast.success(`${role.label} deleted.`);
    onDeleted();
  });

  if (!form) return null;
  // A role can only be deleted once nobody holds it, and never a built-in one
  const deleteBlockedBy = role?.isSystem
    ? 'Built-in roles cannot be deleted.'
    : holders > 0
      ? `${holders === 1 ? '1 account still holds' : `${holders} accounts still hold`} this role. Move them to another role first.`
      : '';

  return (
    <section className="card" aria-labelledby="editor-title">
      <h2 id="editor-title" tabIndex={-1} ref={heading}>{isNew ? 'New role' : role.label}</h2>
      <Notice>{save.error || remove.error}</Notice>

      <form className="form" noValidate onSubmit={(event) => { event.preventDefault(); save.run(); }}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="role-label">Name shown on screen</label>
            <input className="input" id="role-label" maxLength={80} required value={form.label} onChange={update('label')} />
          </div>
          <div className="field">
            <label htmlFor="role-name">Short name</label>
            {/* Built-in roles are looked up by this name inside the server, so it cannot change */}
            <input className="input" id="role-name" maxLength={40} required autoCapitalize="none" spellCheck="false"
              aria-describedby="name-hint" disabled={Boolean(role?.isSystem)} value={form.name} onChange={update('name')} />
            <p className="field-hint" id="name-hint">Lower-case letters, digits, _ or -. Used inside the system.</p>
          </div>
        </div>
        <div className="field">
          <label htmlFor="role-description">Description</label>
          <textarea className="textarea" id="role-description" maxLength={255} value={form.description}
            onChange={update('description')} />
        </div>

        <h3 className="subhead">What this role may do</h3>
        {catalogue.map(({ category, permissions }) => (
          <div key={category} className="perm-group">
            <h3>{category}</h3>
            <div className="perm-list">
              {permissions.map(({ code, description }) => (
                <label key={code} className="perm-row perm-row-check">
                  <input className="check" type="checkbox" checked={form.codes.includes(code)} onChange={() => toggleCode(code)} />
                  <span>
                    <span className="perm-code">{code}</span>
                    <span className="perm-desc">{description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={save.busy} data-loading={save.busy}>Save role</button>
          {!isNew && (
            <button className="btn btn-danger" type="button" onClick={remove.run}
              disabled={Boolean(deleteBlockedBy) || remove.busy} data-loading={remove.busy}>
              Delete role
            </button>
          )}
        </div>
        {!isNew && deleteBlockedBy && <p className="field-hint">{deleteBlockedBy}</p>}
      </form>
    </section>
  );
}

export default function Roles() {
  const { data, error, reload } = useApi(() => Promise.all([api.listRoles(), api.listPermissions()]), []);
  // undefined: editor closed. null: a new role. A number: that role.
  const [pickedId, setPickedId] = useState(undefined);
  const [roleReply, permissionReply] = data ?? [{ roles: [] }, { categories: [] }];
  const holders = roleReply.roles.find((role) => role.id === pickedId)?.userCount ?? 0;

  return (
    <main className="stack stack-wide" id="main">
      <section className="card" aria-labelledby="roles-title">
        <div className="card-head">
          <h1 id="roles-title">Roles</h1>
          <button className="btn btn-primary" type="button" onClick={() => setPickedId(null)}>New role</button>
        </div>
        <p className="card-intro">
          A role is a named bundle of permissions. Every account holds exactly one. Changing a role changes what
          everyone holding it may do, from their very next click.
        </p>
        <Notice>{error?.message}</Notice>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">Description</th>
                <th scope="col">Accounts</th>
                <th scope="col">Permissions</th>
                <th scope="col"><span className="visually-hidden">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {roleReply.roles.map((role) => (
                <tr key={role.id} aria-current={role.id === pickedId ? 'true' : undefined}>
                  <td>
                    <span className="cell-strong">{role.label}</span>
                    <br />
                    <span className="perm-code">{role.name}</span>
                    {role.isSystem && <span className="tag">Built in</span>}
                  </td>
                  <td data-label="Description">{role.description ?? ''}</td>
                  <td data-label="Accounts">{role.userCount}</td>
                  <td data-label="Permissions">{role.permissionCount}</td>
                  <td className="cell-action">
                    <button className="btn btn-sm" type="button" onClick={() => setPickedId(role.id)}>
                      Edit<span className="visually-hidden"> {role.label}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {pickedId !== undefined && data && (
        <RoleEditor
          key={pickedId ?? 'new'}
          roleId={pickedId}
          holders={holders}
          catalogue={permissionReply.categories}
          onSaved={(id) => { setPickedId(id); reload(); }}
          onDeleted={() => { setPickedId(undefined); reload(); }}
        />
      )}
    </main>
  );
}
