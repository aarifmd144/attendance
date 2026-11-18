import { Router } from 'express';
import { getDailyReport, getWeeklyReport, getMonthlyReport, getEmployeeReport, exportReport } from '../controllers/report.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/daily', requireAdmin, getDailyReport);
router.get('/weekly', requireAdmin, getWeeklyReport);
router.get('/monthly', getMonthlyReport);
router.get('/employee/:employeeId', getEmployeeReport);
router.get('/export', requireAdmin, exportReport);

export default router;
