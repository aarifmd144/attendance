import { Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

// GET /api/notifications
export const getNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.notification.count({ where: { userId: req.user!.id } }),
      prisma.notification.count({ where: { userId: req.user!.id, isRead: false } }),
    ]);

    res.json({ success: true, data: notifications, unreadCount, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (error) { next(error); }
};

// PATCH /api/notifications/:id/read
export const markRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      await prisma.notification.updateMany({ where: { userId: req.user!.id }, data: { isRead: true } });
    } else {
      await prisma.notification.updateMany({ where: { id, userId: req.user!.id }, data: { isRead: true } });
    }
    res.json({ success: true });
  } catch (error) { next(error); }
};
