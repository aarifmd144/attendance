import { Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

// GET /api/settings
export const getSettings = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let settings = await prisma.companySetting.findFirst();
    if (!settings) {
      settings = await prisma.companySetting.create({ data: {} });
    }
    res.json({ success: true, data: settings });
  } catch (error) { next(error); }
};

// PUT /api/settings
export const updateSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let settings = await prisma.companySetting.findFirst();
    const data = req.body;

    if (!settings) {
      settings = await prisma.companySetting.create({ data });
    } else {
      settings = await prisma.companySetting.update({ where: { id: settings.id }, data });
    }

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'SETTINGS_UPDATED',
        description: 'Admin updated company settings',
      },
    });

    res.json({ success: true, data: settings, message: 'Settings updated' });
  } catch (error) { next(error); }
};
