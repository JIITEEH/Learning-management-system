import { Router } from 'express';
import {
  createRole,
  deleteRole,
  getRole,
  listRoles,
  setRolePermissions,
  updateRole,
} from '../request-handlers/roleController.js';
import { requireAuth, requirePermission } from '../request-filters/auth.js';

const router = Router();

// Any signed-in account may read roles: the account page shows which role you hold
router.get('/', requireAuth, listRoles);
router.get('/:id', requireAuth, getRole);
router.post('/', requirePermission('role.manage'), createRole);
router.patch('/:id', requirePermission('role.manage'), updateRole);
router.delete('/:id', requirePermission('role.manage'), deleteRole);
router.put('/:id/permissions', requirePermission('role.manage'), setRolePermissions);

export default router;
