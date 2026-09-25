import { Router } from 'express';
import { listPermissions } from '../request-handlers/permissionController.js';
import { requireAuth } from '../request-filters/auth.js';

const router = Router();

router.get('/', requireAuth, listPermissions);

export default router;
