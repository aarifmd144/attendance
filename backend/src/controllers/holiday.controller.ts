import { Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { parseLocalDate } from '../utils/dateUtils';

// GET /api/holidays
export const getHolidays = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { year } = req.query;
    const where: any = {};
    if (year) {
      const y = Number(year);
      where.date = { gte: parseLocalDate(`${y}-01-01`), lte: parseLocalDate(`${y}-12-31`) };
    }
    const holidays = await prisma.holiday.findMany({ where, orderBy: { date: 'asc' } });
    res.json({ success: true, data: holidays });
  } catch (error) { next(error); }
};

// POST /api/holidays
export const createHoliday = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, date, description, isRecurring } = req.body;
    if (!name || !date) return next(createError('Name and date are required', 400));

    const holiday = await prisma.holiday.create({
      data: { name, date: parseLocalDate(date), description, isRecurring: !!isRecurring },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'HOLIDAY_ADDED',
        entityType: 'Holiday',
        entityId: holiday.id,
        description: `Holiday "${name}" added on ${date}`,
      },
    });

    res.status(201).json({ success: true, data: holiday });
  } catch (error) { next(error); }
};

// DELETE /api/holidays/:id
export const deleteHoliday = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.holiday.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'HOLIDAY_DELETED',
        entityType: 'Holiday',
        entityId: id,
        description: 'Admin deleted a holiday',
      },
    });

    res.json({ success: true, message: 'Holiday deleted' });
  } catch (error) { next(error); }
};
