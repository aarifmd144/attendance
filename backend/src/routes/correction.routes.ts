import { Router } from 'express';
import { getCorrections, createCorrection, updateCorrectionStatus } from '../controllers/correction.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', getCorrections);
router.post('/', createCorrection);
router.patch('/:id/status', requireAdmin, updateCorrectionStatus);

export default router;
