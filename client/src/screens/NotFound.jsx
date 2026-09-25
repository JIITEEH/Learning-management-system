import { Link } from 'react-router';
import AuthLayout from './auth/AuthLayout.jsx';

export default function NotFound() {
  return (
    <AuthLayout>
      <p className="metric-value" data-numeric>404</p>
      <h1>This page does not exist</h1>
      <p className="card-intro">
        The address may be mistyped, or the thing it pointed at may have been removed. If you reached it from a link
        inside LearnHub, that link is a mistake worth reporting.
      </p>
      <div className="form">
        <Link className="btn btn-primary btn-lg btn-block" to="/dashboard">Go to your dashboard</Link>
        <Link className="btn btn-lg btn-block" to="/">Back to the start</Link>
      </div>
    </AuthLayout>
  );
}
