import { Router } from 'express';
import { applyLeave, getLeaveRequests, updateLeaveStatus, cancelLeave } from '../controllers/leave.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', getLeaveRequests);
router.post('/', applyLeave);
router.patch('/:id/status', requireAdmin, updateLeaveStatus);
router.delete('/:id', cancelLeave);

export default router;
