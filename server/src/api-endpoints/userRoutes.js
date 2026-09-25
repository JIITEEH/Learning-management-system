import { Router } from 'express';
import {
  createUser,
  deleteUser,
  getUser,
  getUserPermissions,
  listUsers,
  setUserPermissions,
  setUserStatus,
  updateUser,
} from '../request-handlers/userController.js';
import { requireAuth, requirePermission } from '../request-filters/auth.js';

const router = Router();

router.get('/', requirePermission('user.read'), listUsers);
router.post('/', requirePermission('user.create'), createUser);
// Your own account needs no permission; the handler checks user.read / user.update for others
router.get('/:id', requireAuth, getUser);
router.patch('/:id', requireAuth, updateUser);
router.delete('/:id', requirePermission('user.delete'), deleteUser);
router.patch('/:id/status', requirePermission('user.update'), setUserStatus);
router.get('/:id/permissions', requirePermission('user.read'), getUserPermissions);
router.put('/:id/permissions', requirePermission('role.manage'), setUserPermissions);

export default router;
