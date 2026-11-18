import { Router } from 'express';
import {
  getFoodItems,
  createFoodItem,
  updateFoodItem,
  deleteFoodItem,
  toggleFoodItemAvailability,
  createOrder,
  getMyOrders,
  getMyExpenses,
  getIncomingOrders,
  updateOrderStatus,
  getOrderStats,
  streamOrders,
  getAllOrders,
  getMonthlyFoodReport,
  exportMonthlyFoodExcel,
  exportMonthlyFoodPdf,
} from '../controllers/food.controller';
import {
  authenticate,
  requireAdmin,
  requireEmployee,
  requireFoodOwnerOrAdmin,
} from '../middleware/auth';

const router = Router();

// ============================================================
// REAL-TIME STREAM
// ============================================================
router.get('/orders/stream', authenticate, streamOrders);

// ============================================================
// FOOD ITEMS
// ============================================================
router.get('/items', authenticate, getFoodItems);
router.post('/items', authenticate, requireAdmin, createFoodItem);
router.put('/items/:id', authenticate, requireAdmin, updateFoodItem);
router.delete('/items/:id', authenticate, requireAdmin, deleteFoodItem);
router.patch('/items/:id/toggle', authenticate, requireFoodOwnerOrAdmin, toggleFoodItemAvailability);

// ============================================================
// EMPLOYEE ORDER ACTIONS & EXPENSES
// ============================================================
router.post('/orders', authenticate, requireEmployee, createOrder);
router.get('/orders/my-orders', authenticate, requireEmployee, getMyOrders);
router.get('/orders/my-expenses', authenticate, requireEmployee, getMyExpenses);

// ============================================================
// FOOD OWNER & ADMIN LIVE ORDER MANAGEMENT
// ============================================================
router.get('/orders/incoming', authenticate, requireFoodOwnerOrAdmin, getIncomingOrders);
router.patch('/orders/:id/status', authenticate, requireFoodOwnerOrAdmin, updateOrderStatus);
router.get('/orders/stats', authenticate, requireFoodOwnerOrAdmin, getOrderStats);

// ============================================================
// ADMIN ALL ORDERS & MONTHLY REPORT EXPORTS
// ============================================================
router.get('/orders/all', authenticate, requireAdmin, getAllOrders);
router.get('/reports/monthly', authenticate, requireAdmin, getMonthlyFoodReport);
router.get('/reports/export/excel', authenticate, requireAdmin, exportMonthlyFoodExcel);
router.get('/reports/export/pdf', authenticate, requireAdmin, exportMonthlyFoodPdf);

export default router;
