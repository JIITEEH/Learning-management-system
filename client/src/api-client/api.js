// Every request to the server goes through here. Screens call the named functions at the bottom
// (api.login, api.listCourses...) and never call fetch themselves, so how a request is sent and
// how a failure is reported is decided in one place.
//
// All requests go to /api; in development Vite forwards them to Express (see vite.config.js).
// The browser attaches the session cookie by itself, so nothing here handles sign-in tokens.
const BASE_URL = '/api';

let handleUnauthorized = null;
// AuthContext registers a function here, run when the server says the session has ended
export function setUnauthorizedHandler(fn) {
  handleUnauthorized = fn;
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return null;

  // A failure that never reached our routes (a proxy timing out, say) answers with HTML, which is
  // not JSON, so a body that cannot be parsed is treated as empty instead of throwing
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // A 401 on anything but the sign-in check itself means the session ended (signed out on
    // another device, or the password changed): let the app return to the sign-in screen
    if (response.status === 401 && path !== '/auth/me') handleUnauthorized?.();
    const error = new Error(data?.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

// Builds "?status=pending&role=student" from an object, leaving out empty values
function toQuery(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value));
  const text = query.toString();
  return text ? `?${text}` : '';
}

export const api = {
  // Signing in and out, and passwords
  me: () => request('/auth/me'),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  forgotPassword: (email) => request('/auth/forgot', { method: 'POST', body: { email } }),
  resetPassword: (token, newPassword) => request('/auth/reset', { method: 'POST', body: { token, newPassword } }),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/password', { method: 'PATCH', body: { currentPassword, newPassword } }),

  // Accounts
  listUsers: (filters) => request(`/users${toQuery(filters)}`),
  getUser: (id) => request(`/users/${id}`),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PATCH', body: data }),
  setUserStatus: (id, status) => request(`/users/${id}/status`, { method: 'PATCH', body: { status } }),
  getUserPermissions: (id) => request(`/users/${id}/permissions`),
  setUserPermissions: (id, overrides) => request(`/users/${id}/permissions`, { method: 'PUT', body: { overrides } }),

  // Roles and permission codes
  listRoles: () => request('/roles'),
  getRole: (id) => request(`/roles/${id}`),
  createRole: (data) => request('/roles', { method: 'POST', body: data }),
  updateRole: (id, data) => request(`/roles/${id}`, { method: 'PATCH', body: data }),
  deleteRole: (id) => request(`/roles/${id}`, { method: 'DELETE' }),
  setRolePermissions: (id, codes) => request(`/roles/${id}/permissions`, { method: 'PUT', body: { codes } }),
  listPermissions: () => request('/permissions'),

  // Courses and enrollments
  listCourses: () => request('/courses'),
  getCourse: (id) => request(`/courses/${id}`),
  createCourse: (data) => request('/courses', { method: 'POST', body: data }),
  updateCourse: (id, data) => request(`/courses/${id}`, { method: 'PATCH', body: data }),
  setCourseStatus: (id, status) => request(`/courses/${id}/status`, { method: 'PATCH', body: { status } }),
  newJoinCode: (id) => request(`/courses/${id}/join-code`, { method: 'POST' }),
  deleteCourse: (id) => request(`/courses/${id}`, { method: 'DELETE' }),
  getRoster: (id) => request(`/courses/${id}/roster`),
  joinCourse: (joinCode) => request('/enrollments/me', { method: 'POST', body: { joinCode } }),
  addToCourse: (courseId, email) => request('/enrollments', { method: 'POST', body: { courseId, email } }),
  setEnrollmentStatus: (id, status) => request(`/enrollments/${id}`, { method: 'PATCH', body: { status } }),
  removeEnrollment: (id) => request(`/enrollments/${id}`, { method: 'DELETE' }),
};
