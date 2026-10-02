import { Router } from 'express';
import { listAudit } from '../request-handlers/auditController.js';
import { requirePermission } from '../request-filters/auth.js';

const router = Router();

// Read-only on purpose: there is no route to change or remove an entry
router.get('/', requirePermission('audit.read'), listAudit);

export default router;
