// The front page: a way in for a visitor, and a way onward for someone already signed in
import { Link } from 'react-router';
import { useAuth } from '../shared-state/AuthContext.jsx';
import AuthLayout from './auth/AuthLayout.jsx';

export default function Home() {
  const { user } = useAuth();
  return (
    <AuthLayout>
      <h1>Courses, lessons, and grades in one place</h1>
      <p className="card-intro">
        Instructors publish course material and set assignments. Students read, submit, and see their marks.
        Administrators decide who may do what.
      </p>
      <div className="form">
        {user ? (
          <Link className="btn btn-primary btn-lg btn-block" to="/dashboard">Go to your dashboard</Link>
        ) : (
          <>
            <Link className="btn btn-primary btn-lg btn-block" to="/login">Sign in</Link>
            <Link className="btn btn-lg btn-block" to="/register">Create an account</Link>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
