import { Router } from 'express';
import { getHolidays, createHoliday, deleteHoliday } from '../controllers/holiday.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.get('/', getHolidays);
router.post('/', requireAdmin, createHoliday);
router.delete('/:id', requireAdmin, deleteHoliday);

export default router;
