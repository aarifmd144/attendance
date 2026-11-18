import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settings.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.get('/', getSettings);
router.put('/', requireAdmin, updateSettings);

export default router;
