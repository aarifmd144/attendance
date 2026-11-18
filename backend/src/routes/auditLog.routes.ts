import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditLog.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireAdmin);
router.get('/', getAuditLogs);

export default router;
