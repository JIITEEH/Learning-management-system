import { Router } from "express";

import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncRoute } from "../middleware/errors.js";

const router = Router();

/**
 * The catalogue of permission codes, for building role editors. Grouped by
 * category so the editor can render sections without knowing the codes in
 * advance — new codes added to seed.sql appear on their own.
 */
router.get(
  "/",
  requireAuth,
  asyncRoute(async (_req, res) => {
    const rows = await query(
      `SELECT id, code, category, description
         FROM permissions
        ORDER BY category, code`,
    );

    const categories = [];
    for (const row of rows) {
      let group = categories.find((entry) => entry.category === row.category);
      if (!group) {
        group = { category: row.category, permissions: [] };
        categories.push(group);
      }
      group.permissions.push(row);
    }

    res.json({ permissions: rows, categories });
  }),
);

export default router;
