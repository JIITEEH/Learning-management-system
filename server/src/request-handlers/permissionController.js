// The catalogue of permission codes, for the role and account editors.
import * as Permission from '../database-queries/permissionModel.js';

// Grouped by category, so the editor can draw one section per category without knowing the codes
// in advance: a code added to seed/02_permissions.sql appears on its own
export async function listPermissions(req, res) {
  const rows = await Permission.listAll();

  const byCategory = new Map();
  for (const row of rows) {
    if (!byCategory.has(row.category)) byCategory.set(row.category, []);
    byCategory.get(row.category).push(row);
  }
  const categories = [...byCategory].map(([category, permissions]) => ({ category, permissions }));

  res.json({ permissions: rows, categories });
}
