// SQL for roles (roles and role_permissions tables, schema/01_identity.sql).
import { query, queryOne, transaction } from '../database/index.js';

const SELECT_ROLE = 'SELECT id, name, label, description, is_system, created_at FROM roles';

export function findById(id) {
  return queryOne(`${SELECT_ROLE} WHERE id = :id`, { id });
}

export function findByName(name) {
  return queryOne(`${SELECT_ROLE} WHERE name = :name`, { name });
}

// Every role, with how many permissions it carries and how many accounts hold it.
// COUNT(DISTINCT ...) because joining two tables multiplies rows: without it, a role with
// 20 permissions and 5 accounts would report 100 of each.
export function listWithCounts() {
  return query(
    `SELECT r.id, r.name, r.label, r.description, r.is_system, r.created_at,
            COUNT(DISTINCT rp.permission_id) AS permission_count,
            COUNT(DISTINCT u.id) AS user_count
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN users u ON u.role_id = r.id
      GROUP BY r.id
      ORDER BY r.name`,
  );
}

// The permission codes a role carries, as a sorted array of strings
export async function codesFor(roleId) {
  const rows = await query(
    `SELECT p.code
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = :roleId
      ORDER BY p.code`,
    { roleId },
  );
  return rows.map((row) => row.code);
}

export async function nameTaken(name, exceptId = null) {
  const row = await queryOne(
    'SELECT 1 FROM roles WHERE name = :name AND (:exceptId IS NULL OR id <> :exceptId)',
    { name, exceptId },
  );
  return row !== null;
}

export async function countAccounts(roleId) {
  const row = await queryOne('SELECT COUNT(*) AS total FROM users WHERE role_id = :roleId', { roleId });
  return Number(row.total);
}

// Inserts every permission for a role. Called inside a transaction by the two functions below.
async function insertPermissions(connection, roleId, permissionIds) {
  for (const permissionId of permissionIds) {
    await connection.execute(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES (:roleId, :permissionId)',
      { roleId, permissionId },
    );
  }
}

// Creates a role and its permissions together, so a role never exists with only some of them.
// Returns the new id.
export function create({ name, label, description, permissionIds }) {
  return transaction(async (connection) => {
    const [result] = await connection.execute(
      'INSERT INTO roles (name, label, description, is_system) VALUES (:name, :label, :description, 0)',
      { name, label, description },
    );
    await insertPermissions(connection, result.insertId, permissionIds);
    return result.insertId;
  });
}

export function update({ id, name, label, description }) {
  return query(
    'UPDATE roles SET name = :name, label = :label, description = :description WHERE id = :id',
    { id, name, label, description },
  );
}

// Replaces a role's whole permission set. It applies to everyone holding the role at once, so it
// runs as a transaction: there is never a moment where the role carries nothing.
export function replacePermissions(roleId, permissionIds) {
  return transaction(async (connection) => {
    await connection.execute('DELETE FROM role_permissions WHERE role_id = :roleId', { roleId });
    await insertPermissions(connection, roleId, permissionIds);
  });
}

export function remove(id) {
  return query('DELETE FROM roles WHERE id = :id', { id });
}
