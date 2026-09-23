// Roles — database access.
//
// Schema: database/schema/01_identity.sql (roles, role_permissions).
// Used by routes/roles.js and routes/users.js.

import { query, queryOne, transaction } from "../pool.js";

const SELECT_ROLE = `
  SELECT id, name, label, description, is_system, created_at
    FROM roles
`;

export function findById(id) {
  return queryOne(`${SELECT_ROLE} WHERE id = :id`, { id });
}

export function findByName(name) {
  return queryOne(`${SELECT_ROLE} WHERE name = :name`, { name });
}

/**
 * Every role with how many permissions it carries and how many accounts hold
 * it — what the roles admin screen lists.
 *
 * COUNT(DISTINCT …) because joining both role_permissions and users multiplies
 * the rows together; without it a role with 20 permissions and 5 users would
 * report 100 of each.
 */
export function listWithCounts() {
  return query(
    `SELECT r.id, r.name, r.label, r.description, r.is_system,
            COUNT(DISTINCT rp.permission_id) AS permission_count,
            COUNT(DISTINCT u.id) AS user_count
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN users u ON u.role_id = r.id
      GROUP BY r.id
      ORDER BY r.name`,
  );
}

/** The permission codes a role carries. */
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

/** Whether a role name is in use, optionally ignoring one role. */
export async function nameTaken(name, exceptId = null) {
  const row = await queryOne(
    `SELECT id FROM roles
      WHERE name = :name AND (:exceptId IS NULL OR id <> :exceptId)`,
    { name, exceptId },
  );
  return row !== null;
}

/** How many accounts hold a role. */
export async function countUsers(roleId) {
  const { total } = await queryOne(
    "SELECT COUNT(*) AS total FROM users WHERE role_id = :id",
    { id: roleId },
  );
  return Number(total);
}

/**
 * Create a role and its permission set together. One transaction, so a role
 * can never exist with only part of the permissions it was created with.
 * Returns the new id.
 */
export function insertWithPermissions({ name, label, description, permissionIds }) {
  return transaction(async (connection) => {
    const [result] = await connection.execute(
      `INSERT INTO roles (name, label, description, is_system)
       VALUES (:name, :label, :description, 0)`,
      { name, label, description },
    );
    for (const permissionId of permissionIds) {
      await connection.execute(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES (:roleId, :permissionId)`,
        { roleId: result.insertId, permissionId },
      );
    }
    return result.insertId;
  });
}

export function update({ id, name, label, description }) {
  return query(
    `UPDATE roles SET name = :name, label = :label, description = :description
      WHERE id = :id`,
    { name, label, description, id },
  );
}

export function remove(id) {
  return query("DELETE FROM roles WHERE id = :id", { id });
}

/**
 * Replace a role's permission set with the one given. Because permissions are
 * read per request, this lands on everyone holding the role immediately — so
 * it is done in a transaction rather than leaving a window where the role
 * carries nothing.
 */
export function replacePermissions(roleId, permissionIds) {
  return transaction(async (connection) => {
    await connection.execute("DELETE FROM role_permissions WHERE role_id = :roleId", {
      roleId,
    });
    for (const permissionId of permissionIds) {
      await connection.execute(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES (:roleId, :permissionId)`,
        { roleId, permissionId },
      );
    }
  });
}
