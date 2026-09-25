// Screens wrapped in these only show for the right visitor. They are a courtesy for the person
// using the app, not protection: the server checks the same things on every request.
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import { PageLoader } from '../basics/Feedback.jsx';

// Signed-in accounts only. Anyone else goes to sign in, and comes back here afterwards.
export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

// Signed-out visitors only (sign in, register...). Someone signed in goes on to the screen that
// sent them to sign in, if any, otherwise the dashboard. This is also what moves a person on the
// moment they sign in. `from` is only ever a path inside this app, set by RequireAuth above, so it
// cannot send anyone to another website.
export function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to={location.state?.from ?? '/dashboard'} replace />;
  return children;
}

// Accounts holding a permission code only, e.g. <RequirePermission code="role.manage">
export function RequirePermission({ code, children }) {
  const { can } = useAuth();
  if (!can(code)) return <Navigate to="/dashboard" replace />;
  return children;
}
