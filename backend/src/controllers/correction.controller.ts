import { Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { parseLocalDate } from '../utils/dateUtils';

// GET /api/corrections
export const getCorrections = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};

    if (req.user?.role !== 'ADMIN') {
      where.employeeId = req.user?.employeeId;
    }
    if (status) where.status = String(status);

    const [corrections, total] = await Promise.all([
      prisma.attendanceCorrection.findMany({
        where,
        include: { employee: { include: { department: true } }, attendance: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.attendanceCorrection.count({ where }),
    ]);

    res.json({ success: true, data: corrections, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } });
  } catch (error) { next(error); }
};

// POST /api/corrections
export const createCorrection = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.employeeId) return next(createError('Employee profile not found', 404));
    const { date, requestedEntry, requestedExit, reason, attendanceId } = req.body;

    if (!date || !reason) return next(createError('Date and reason are required', 400));

    const correction = await prisma.attendanceCorrection.create({
      data: {
        employeeId: req.user.employeeId,
        attendanceId,
        date: parseLocalDate(date),
        requestedEntry: requestedEntry ? new Date(requestedEntry) : undefined,
        requestedExit: requestedExit ? new Date(requestedExit) : undefined,
        reason,
      },
      include: { employee: true },
    });

    // Notify admins
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
    await Promise.all(
      admins.map(admin =>
        prisma.notification.create({
          data: {
            userId: admin.id,
            title: 'Correction Request',
            message: `${correction.employee.name} requested an attendance correction`,
            type: 'INFO',
            link: '/admin/corrections',
          },
        })
      )
    );

    res.status(201).json({ success: true, data: correction });
  } catch (error) { next(error); }
};

// PATCH /api/corrections/:id/status
export const updateCorrectionStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, adminComment } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return next(createError('Invalid status', 400));
    }

    const correction = await prisma.attendanceCorrection.update({
      where: { id },
      data: { status, adminComment, reviewedBy: req.user!.id, reviewedAt: new Date() },
      include: { employee: { include: { user: true } } },
    });

    // If approved, update attendance
    if (status === 'APPROVED' && correction.attendanceId) {
      const updates: any = {};
      if (correction.requestedEntry) updates.entryTime = correction.requestedEntry;
      if (correction.requestedExit) updates.exitTime = correction.requestedExit;
      if (Object.keys(updates).length > 0) {
        await prisma.attendance.update({ where: { id: correction.attendanceId }, data: updates });
      }

      await prisma.auditLog.create({
        data: {
          adminId: req.user!.id,
          action: 'CORRECTION_APPROVED',
          entityType: 'AttendanceCorrection',
          entityId: id,
          description: `Admin approved correction request for ${correction.employee.name}`,
        },
      });
    }

    // Notify employee
    await prisma.notification.create({
      data: {
        userId: correction.employee.userId,
        title: `Correction ${status}`,
        message: `Your attendance correction request has been ${status.toLowerCase()}.${adminComment ? ` Note: ${adminComment}` : ''}`,
        type: status === 'APPROVED' ? 'SUCCESS' : 'ERROR',
      },
    });

    res.json({ success: true, data: correction });
  } catch (error) { next(error); }
};
