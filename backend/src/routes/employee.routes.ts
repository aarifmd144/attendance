import { Router } from 'express';
import {
  getEmployees, getEmployee, createEmployee, updateEmployee,
  deleteEmployee, updateEmployeeStatus, getEmployeeSummary,
} from '../controllers/employee.controller';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/summary', requireAdmin, getEmployeeSummary);
router.get('/', requireAdmin, getEmployees);
router.get('/:id', getEmployee);
router.post('/', requireAdmin, createEmployee);
router.put('/:id', requireAdmin, updateEmployee);
router.delete('/:id', requireAdmin, deleteEmployee);
router.patch('/:id/status', requireAdmin, updateEmployeeStatus);

export default router;
