// The administration overview: a card for each admin screen this account may open, with a count
// on each, so waiting work (accounts to approve) is visible at once
import { Link } from 'react-router';
import { api } from '../../api-client/api.js';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import useApi from '../../reusable-logic/useApi.js';

export default function Admin() {
  const { can } = useAuth();
  const users = useApi(() => (can('user.read') ? api.listUsers() : null), []);
  const roles = useApi(() => api.listRoles(), []);
  const pending = users.data?.users.filter((user) => user.status === 'pending').length ?? 0;

  return (
    <main className="stack" id="main">
      <section className="card" aria-labelledby="admin-title">
        <h1 id="admin-title">Administration</h1>
        <p className="card-intro">Who has an account, what each role may do, and which accounts are still waiting to be let in.</p>
      </section>

      <div className="link-grid">
        {can('user.read') && (
          <Link className="card link-card" to="/admin/users">
            <h2>Accounts</h2>
            <p>Approve new sign-ups, suspend an account, change its role, or give one person a permission their role does not carry.</p>
            <p className="metric">
              <span className="metric-value">{users.data?.users.length ?? '—'}</span>
              <span className="metric-label">accounts</span>
            </p>
            {pending > 0 && <span className="tag tag-warn">{pending} waiting for approval</span>}
          </Link>
        )}
        <Link className="card link-card" to="/admin/roles">
          <h2>Roles</h2>
          <p>Decide what each role may do. A change reaches everyone holding that role on their very next click.</p>
          <p className="metric">
            <span className="metric-value">{roles.data?.roles.length ?? '—'}</span>
            <span className="metric-label">roles</span>
          </p>
        </Link>
      </div>
    </main>
  );
}
