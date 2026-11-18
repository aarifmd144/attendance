import { Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

// GET /api/departments
export const getDepartments = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const departments = await prisma.department.findMany({
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: departments });
  } catch (error) { next(error); }
};

// POST /api/departments
export const createDepartment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body;
    if (!name) return next(createError('Department name required', 400));

    const dept = await prisma.department.create({ data: { name, description } });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'DEPARTMENT_ADDED',
        entityType: 'Department',
        entityId: dept.id,
        description: `Department "${name}" created`,
      },
    });

    res.status(201).json({ success: true, data: dept });
  } catch (error) { next(error); }
};

// PUT /api/departments/:id
export const updateDepartment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const dept = await prisma.department.update({ where: { id }, data: { name, description } });
    res.json({ success: true, data: dept });
  } catch (error) { next(error); }
};

// DELETE /api/departments/:id
export const deleteDepartment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.department.delete({ where: { id } });
    res.json({ success: true, message: 'Department deleted' });
  } catch (error) { next(error); }
};
