import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    employeeId?: string;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query?.token) {
      token = String(req.query.token);
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(token, secret) as { id: string; email: string; role: string };

    // Fetch user from DB to ensure they still exist
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { employee: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employee?.id,
    };

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

export const requireFoodOwner = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'FOOD_OWNER' && req.user?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Food Owner access required' });
  }
  next();
};

export const requireFoodOwnerOrAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'FOOD_OWNER' && req.user?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Authorized access required' });
  }
  next();
};

export const requireEmployee = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user?.employeeId && req.user?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Employee access required' });
  }
  next();
};

