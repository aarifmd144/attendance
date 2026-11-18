import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  employeeId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const generateTokens = (userId: string, email: string, role: string) => {
  const accessToken = jwt.sign(
    { id: userId, email, role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as jwt.SignOptions
  );
  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' } as jwt.SignOptions
  );
  return { accessToken, refreshToken };
};

// POST /api/auth/login
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        employee: {
          include: { department: true },
        },
      },
    });

    if (!user) {
      return next(createError('Invalid email or password', 401));
    }

    if (!user.isRegistered) {
      return next(createError('Account not activated. Please complete registration first.', 401));
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return next(createError('Invalid email or password', 401));
    }

    if (user.employee && user.employee.status === 'INACTIVE') {
      return next(createError('Your account has been deactivated. Please contact admin.', 403));
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        description: `User ${user.email} logged in`,
        ipAddress: req.ip,
      },
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          employee: user.employee,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError(error.errors[0].message, 400));
    }
    next(error);
  }
};

// POST /api/auth/register (Employee sign-up)
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { employeeId, email, password } = registerSchema.parse(req.body);

    // Check if employee record exists with matching employeeId AND email
    const employee = await prisma.employee.findFirst({
      where: { employeeId, email },
      include: { user: true },
    });

    if (!employee) {
      return next(createError('No employee found with this Employee ID and email combination. Please contact your admin.', 404));
    }

    if (employee.user.isRegistered) {
      return next(createError('This account has already been registered. Please login.', 400));
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user with hashed password and mark as registered
    await prisma.user.update({
      where: { id: employee.userId },
      data: { password: hashedPassword, isRegistered: true },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: employee.userId,
        action: 'USER_REGISTERED',
        description: `Employee ${employee.name} (${employee.employeeId}) completed registration`,
        ipAddress: req.ip,
      },
    });

    // Create welcome notification
    await prisma.notification.create({
      data: {
        userId: employee.userId,
        title: 'Welcome!',
        message: `Welcome to the Attendance System, ${employee.name}! Your account is now active.`,
        type: 'SUCCESS',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful! You can now login.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError(error.errors[0].message, 400));
    }
    next(error);
  }
};

// POST /api/auth/refresh
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return next(createError('Refresh token required', 400));

    const stored = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      return next(createError('Invalid or expired refresh token', 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { id: string };
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      stored.user.id,
      stored.user.email,
      stored.user.role
    );

    // Rotate refresh token
    await prisma.refreshToken.delete({ where: { token } });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: { token: newRefreshToken, userId: stored.user.id, expiresAt },
    });

    res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/logout
export const logout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { refreshToken: token } = req.body;
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } });
    }

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'USER_LOGOUT',
          description: `User ${req.user.email} logged out`,
        },
      });
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        employee: {
          include: { department: true },
        },
      },
    });

    if (!user) return next(createError('User not found', 404));

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        employee: user.employee,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/change-password
export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return next(createError('Current and new password required', 400));
    }
    if (newPassword.length < 8) {
      return next(createError('New password must be at least 8 characters', 400));
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return next(createError('User not found', 404));

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return next(createError('Current password is incorrect', 400));

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};
