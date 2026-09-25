import { Router } from 'express';
import { getDashboard } from '../request-handlers/dashboardController.js';
import { requireAuth } from '../request-filters/auth.js';

const router = Router();

// Any signed-in account; what the reply contains follows its permissions
router.get('/', requireAuth, getDashboard);

export default router;
