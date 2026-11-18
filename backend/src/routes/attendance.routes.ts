import { Router } from 'express';
import {
  markEntry, markExit, startBreak, endBreak, getTodayAttendance,
  getAttendance, getLiveAttendance, getCalendar, updateAttendance,
  createAttendance,
} from '../controllers/attendance.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', getAttendance);
router.post('/', requireAdmin, createAttendance);
router.get('/today', getTodayAttendance);
router.get('/live', requireAdmin, getLiveAttendance);
router.get('/calendar/:employeeId', getCalendar);
router.post('/entry', markEntry);
router.post('/exit', markExit);
router.post('/break/start', startBreak);
router.post('/break/end', endBreak);
router.patch('/:id', requireAdmin, updateAttendance);

export default router;
