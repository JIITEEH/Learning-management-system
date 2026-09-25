// Which screen shows at which address. The guards decide who may open each one; they are a
// courtesy only, since the server checks the same permissions on every request.
import { lazy } from 'react';
import { Route, Routes } from 'react-router';
import { GuestOnly, RequireAuth, RequirePermission } from './ui-pieces/auth/Guards.jsx';
import AppLayout from './ui-pieces/layout/AppLayout.jsx';
import Home from './screens/Home.jsx';
import NotFound from './screens/NotFound.jsx';
import Dashboard from './screens/Dashboard.jsx';
import Account from './screens/Account.jsx';
import Courses from './screens/Courses.jsx';
import Login from './screens/auth/Login.jsx';
import Register from './screens/auth/Register.jsx';
import ForgotPassword from './screens/auth/ForgotPassword.jsx';
import ResetPassword from './screens/auth/ResetPassword.jsx';

// Loaded on demand, so a browser only downloads the screens its account actually opens
const Course = lazy(() => import('./screens/Course.jsx'));
const Lesson = lazy(() => import('./screens/Lesson.jsx'));
const Admin = lazy(() => import('./screens/admin/Admin.jsx'));
const Users = lazy(() => import('./screens/admin/Users.jsx'));
const Roles = lazy(() => import('./screens/admin/Roles.jsx'));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
      {/* Not guest-only: someone may open the email link in a browser that is still signed in */}
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="account" element={<Account />} />
        <Route path="courses" element={<RequirePermission code="course.read"><Courses /></RequirePermission>} />
        <Route path="courses/:id" element={<RequirePermission code="course.read"><Course /></RequirePermission>} />
        <Route path="courses/:courseId/lessons/:lessonId" element={<RequirePermission code="lesson.read"><Lesson /></RequirePermission>} />
        <Route path="admin" element={<RequirePermission code="role.manage"><Admin /></RequirePermission>} />
        <Route path="admin/users" element={<RequirePermission code="user.read"><Users /></RequirePermission>} />
        <Route path="admin/roles" element={<RequirePermission code="role.manage"><Roles /></RequirePermission>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
