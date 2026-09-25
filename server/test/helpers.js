// Shared by every test file: start the API, make accounts, and send requests as someone.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after } from 'node:test';
import { tempDir } from './setup.js';
import app from '../src/app.js';
import { pool } from '../src/database/index.js';
import * as Role from '../src/database-queries/roleModel.js';
import * as User from '../src/database-queries/userModel.js';
import { hashPassword } from '../src/helpers/password.js';

export const PASSWORD = 'password123';
// Hashing takes about 0.2 s on purpose, so it is done once and shared by every test account
const passwordHash = await hashPassword(PASSWORD);

// Starts the API on a random port for one test file. When the file finishes, the server stops,
// and its throwaway database and uploads are deleted.
export async function startApi() {
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  after(async () => {
    server.closeAllConnections();
    server.close();
    await pool.query(`DROP DATABASE IF EXISTS \`${process.env.DB_NAME}\``);
    await pool.end();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${server.address().port}/api`;

  // `as` is an account from makeUser (its session cookie is sent), or nothing for a visitor.
  // `body` is sent as JSON, `form` as a file upload (FormData).
  async function request(method, path, { as, body, form, headers = {} } = {}) {
    const sent = { ...headers };
    if (as) sent.Cookie = as.cookie;
    let payload = form;
    if (body !== undefined) {
      sent['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(base + path, { method, headers: sent, body: payload });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers };
  }

  return {
    get: (path, options) => request('GET', path, options),
    post: (path, options) => request('POST', path, options),
    patch: (path, options) => request('PATCH', path, options),
    put: (path, options) => request('PUT', path, options),
    delete: (path, options) => request('DELETE', path, options),
    // Signs in and returns the session cookie, or null if refused
    async signIn(email, password = PASSWORD) {
      const res = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const cookie = res.headers.get('set-cookie')?.split(';')[0] ?? null;
      return { status: res.status, cookie };
    },
  };
}

// Creates an active account with a role straight in the database, signs it in, and returns it
// with its session cookie: { id, email, fullName, role, cookie }
let counter = 0;
export async function makeUser(api, role = 'student', name = null) {
  counter += 1;
  const fullName = name ?? `Test ${role} ${counter}`;
  const email = `${role}${counter}@example.test`;
  const roleRow = await Role.findByName(role);
  const id = await User.create({ email, passwordHash, fullName, roleId: roleRow.id, status: 'active' });
  const { status, cookie } = await api.signIn(email);
  assert.equal(status, 200, `${email} signs in`);
  return { id, email, fullName, role, cookie };
}

// A course with an instructor, open to students, with the given students enrolled.
// Returns { course, joinCode }.
export async function makeCourse(api, instructor, students = [], { publish = true } = {}) {
  counter += 1;
  const created = await api.post('/courses', { as: instructor, body: { code: `TEST${counter}`, title: `Course ${counter}` } });
  assert.equal(created.status, 201);
  const course = created.data.course;
  if (publish) await api.patch(`/courses/${course.id}/status`, { as: instructor, body: { status: 'published' } });
  for (const student of students) {
    const joined = await api.post('/enrollments', { as: instructor, body: { courseId: course.id, email: student.email } });
    assert.equal(joined.status, 201);
  }
  return { course, joinCode: course.joinCode };
}

// A small file for upload tests: { form } ready to send, with `name` and `type` as given
export function fileForm(files, fields = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  for (const { name, type = 'text/plain', contents = 'hello' } of files) {
    form.append('files', new Blob([contents], { type }), name);
  }
  return form;
}

// How many uploaded files are on disk right now
export const filesOnDisk = () => (fs.existsSync(process.env.UPLOAD_DIR) ? fs.readdirSync(process.env.UPLOAD_DIR).length : 0);

// UTC time a number of days from now, as the browser sends it
export const daysFromNow = (days) => new Date(Date.now() + days * 86400000).toISOString();
