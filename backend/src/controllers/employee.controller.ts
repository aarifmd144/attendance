import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const createEmployeeSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  designation: z.string().optional(),
  joiningDate: z.string().transform(s => new Date(s)),
});

const updateEmployeeSchema = createEmployeeSchema.partial().omit({ employeeId: true });

// GET /api/employees
export const getEmployees = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search, departmentId, status, page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
        { employeeId: { contains: String(search), mode: 'insensitive' } },
      ];
    }
    if (departmentId) where.departmentId = String(departmentId);
    if (status) where.status = String(status);

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: { department: true, user: { select: { email: true, role: true, isRegistered: true } } },
        orderBy: { employeeId: 'asc' },
        skip,
        take: Number(limit),
      }),
      prisma.employee.count({ where }),
    ]);

    res.json({
      success: true,
      data: employees,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/employees/:id
export const getEmployee = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Employees can only view their own record
    if (req.user?.role !== 'ADMIN' && req.user?.employeeId !== id) {
      return next(createError('Access denied', 403));
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        user: { select: { email: true, role: true, isRegistered: true, createdAt: true } },
      },
    });

    if (!employee) return next(createError('Employee not found', 404));
    res.json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
};

// POST /api/employees (Admin only)
export const createEmployee = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createEmployeeSchema.parse(req.body);

    // Check uniqueness
    const existing = await prisma.employee.findFirst({
      where: { OR: [{ employeeId: data.employeeId }, { email: data.email }] },
    });
    if (existing) {
      return next(createError('Employee ID or email already exists', 400));
    }

    // Create user account (placeholder password, not activated until self-registration)
    const placeholderPassword = await bcrypt.hash(Math.random().toString(36), 12);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: placeholderPassword,
        role: 'EMPLOYEE',
        isRegistered: false,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        employeeId: data.employeeId,
        userId: user.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        departmentId: data.departmentId,
        designation: data.designation,
        joiningDate: data.joiningDate,
      },
      include: { department: true },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'EMPLOYEE_ADDED',
        entityType: 'Employee',
        entityId: employee.id,
        description: `Admin added employee ${employee.name} (${employee.employeeId})`,
      },
    });

    res.status(201).json({ success: true, data: employee, message: 'Employee created. They can now register using their Employee ID and email.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError(error.errors[0].message, 400));
    }
    next(error);
  }
};

// PUT /api/employees/:id (Admin only)
export const updateEmployee = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = updateEmployeeSchema.parse(req.body);

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return next(createError('Employee not found', 404));

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        departmentId: data.departmentId,
        designation: data.designation,
        joiningDate: data.joiningDate,
      },
      include: { department: true },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'EMPLOYEE_UPDATED',
        entityType: 'Employee',
        entityId: id,
        description: `Admin updated employee ${updated.name} (${updated.employeeId})`,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError(error.errors[0].message, 400));
    }
    next(error);
  }
};

// DELETE /api/employees/:id (Admin only)
export const deleteEmployee = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) return next(createError('Employee not found', 404));

    await prisma.employee.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'EMPLOYEE_DELETED',
        entityType: 'Employee',
        entityId: id,
        description: `Admin deleted employee ${employee.name} (${employee.employeeId})`,
      },
    });

    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/employees/:id/status (Admin only)
export const updateEmployeeStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
      return next(createError('Invalid status', 400));
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: { status },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'EMPLOYEE_STATUS_CHANGED',
        entityType: 'Employee',
        entityId: id,
        description: `Admin changed ${employee.name}'s status to ${status}`,
      },
    });

    res.json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
};

// GET /api/employees/summary (Admin dashboard stats)
export const getEmployeeSummary = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [total, active, todayAttendance, onLeaveToday] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({ where: { status: 'ACTIVE' } }),
      prisma.attendance.findMany({
        where: { date: { gte: today, lt: tomorrow } },
        include: { employee: { include: { department: true } } },
      }),
      prisma.leaveRequest.count({
        where: {
          status: 'APPROVED',
          startDate: { lte: today },
          endDate: { gte: today },
        },
      }),
    ]);

    const present = todayAttendance.filter(a =>
      ['PRESENT', 'LATE', 'HALF_DAY'].includes(a.status)
    ).length;
    const late = todayAttendance.filter(a => a.isLate).length;
    const currentlyWorking = todayAttendance.filter(a => a.entryTime && !a.exitTime).length;
    const missingCheckout = todayAttendance.filter(a => a.isMissingCheckout).length;

    const avgWorkingMinutes = todayAttendance.length > 0
      ? todayAttendance.reduce((sum, a) => sum + (a.totalWorkMinutes || 0), 0) / todayAttendance.length
      : 0;

    const totalOvertimeMinutes = todayAttendance.reduce((sum, a) => sum + (a.overtimeMinutes || 0), 0);

    res.json({
      success: true,
      data: {
        totalEmployees: total,
        activeEmployees: active,
        presentToday: present,
        absentToday: active - present - onLeaveToday,
        onLeaveToday,
        lateToday: late,
        currentlyWorking,
        missingCheckout,
        avgWorkingMinutes: Math.round(avgWorkingMinutes),
        totalOvertimeMinutes,
      },
    });
  } catch (error) {
    next(error);
  }
};
