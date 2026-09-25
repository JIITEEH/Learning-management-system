// Shared by the test server and the tests. Importing start-server.mjs would start a server.
export const PORT = 3200;
export const DATABASE = 'lms_e2e';
export const PASSWORD = 'e2e-password-123';
// The accounts start-server.mjs creates, one per role
export const ACCOUNTS = {
  admin: { email: 'e2e-admin@example.test', fullName: 'Ada Admin' },
  instructor: { email: 'e2e-instructor@example.test', fullName: 'Ian Instructor' },
  student: { email: 'e2e-student@example.test', fullName: 'Sam Student' },
  classmate: { email: 'e2e-classmate@example.test', fullName: 'Cleo Classmate' },
};
