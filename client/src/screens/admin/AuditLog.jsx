// /admin/audit: every administrative change, newest first, 50 at a time with "Show older changes"
// for the rest. Entries cannot be edited or removed, here or anywhere. The same screen as the
// thesis management system's audit log.
import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { api } from '../../api-client/api.js';
import useApi from '../../reusable-logic/useApi.js';
import { formatDateTime } from '../../helpers/format.js';
import { EmptyState, Notice } from '../../ui-pieces/basics/Feedback.jsx';

const FILTERS = [
  { value: '', label: 'Everything' },
  { value: 'user', label: 'Accounts' },
  { value: 'role', label: 'Roles' },
  { value: 'course', label: 'Courses and enrollment' },
];

// Written as what the person did, so each row reads as a sentence: "Ada Admin suspended an account"
const ACTIONS = {
  'user.created': 'created an account',
  'user.approved': 'approved an account',
  'user.suspended': 'suspended an account',
  'user.reactivated': 'reactivated an account',
  'user.status_changed': 'changed an account’s status',
  'user.role_changed': 'changed a role',
  'user.details_changed': 'edited account details',
  'user.permissions_changed': 'changed one account’s permissions',
  'user.deleted': 'deleted an account',
  'role.created': 'created a role',
  'role.updated': 'edited a role',
  'role.permissions_changed': 'changed what a role may do',
  'role.deleted': 'deleted a role',
  'course.status_changed': 'changed a course’s status',
  'course.deleted': 'deleted a course',
  'enrollment.added': 'added a student to a course',
  'enrollment.status_changed': 'changed a student’s enrollment',
  'enrollment.removed': 'removed a student from a course',
};

export default function AuditLog() {
  const [target, setTarget] = useState('');
  // Pages fetched with "Show older changes", added below the first page
  const [older, setOlder] = useState({ entries: [], nextBefore: undefined });
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState('');
  const { data, error } = useApi(() => api.listAudit({ target }), [target]);

  function chooseTarget(value) {
    setOlder({ entries: [], nextBefore: undefined });
    setOlderError('');
    setTarget(value);
  }

  const entries = data ? [...data.entries, ...older.entries] : [];
  const nextBefore = older.nextBefore !== undefined ? older.nextBefore : data?.nextBefore;

  async function showOlder() {
    setLoadingOlder(true);
    setOlderError('');
    try {
      const page = await api.listAudit({ target, before: nextBefore });
      setOlder((previous) => ({ entries: [...previous.entries, ...page.entries], nextBefore: page.nextBefore }));
    } catch (failure) {
      setOlderError(failure.message);
    } finally {
      setLoadingOlder(false);
    }
  }

  return (
    <main className="stack stack-wide" id="main">
      <section className="card" aria-labelledby="audit-title">
        <h1 id="audit-title">Audit log</h1>
        <p className="card-intro">
          Every change made to accounts, roles, courses and enrollment, newest first. Entries cannot be edited or removed.
        </p>
        <Notice>{error?.message}</Notice>

        <div className="filters">
          <div className="field">
            <label htmlFor="audit-filter">Show changes to</label>
            <select className="select" id="audit-filter" value={target} onChange={(event) => chooseTarget(event.target.value)}>
              {FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
            </select>
          </div>
        </div>

        {data && entries.length === 0 && (
          <EmptyState icon={ScrollText}>Nothing recorded yet. Approvals, role changes and removals will appear here.</EmptyState>
        )}
        {entries.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">Change</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="When">{formatDateTime(entry.createdAt)}</td>
                    <td data-label="Who">
                      {entry.actorName}
                      {entry.actorId === null && <span className="field-hint audit-sub">Account since deleted</span>}
                    </td>
                    <td data-label="Change">
                      <span className="cell-strong">{ACTIONS[entry.action] ?? entry.action}</span>
                      <span className="field-hint audit-sub">{entry.targetLabel}</span>
                    </td>
                    <td data-label="Details">{entry.details || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Notice>{olderError}</Notice>
        {nextBefore && (
          <div className="actions">
            <button className="btn" type="button" onClick={showOlder} disabled={loadingOlder} data-loading={loadingOlder}>
              Show older changes
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
