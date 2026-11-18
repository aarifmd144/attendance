import { Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { parseLocalDate } from '../utils/dateUtils';
import { sendDirectChatMessage } from './chat.controller';
import { emitToUser, emitToConversation } from '../services/socket.service';

const leaveSchema = z.object({
  leaveType: z.enum(['CASUAL', 'SICK', 'EMERGENCY', 'PERMISSION', 'OTHER']),
  startDate: z.string().transform(s => parseLocalDate(s)),
  endDate: z.string().transform(s => parseLocalDate(s)),
  reason: z.string().min(10, 'Please provide a detailed reason (min 10 characters)'),
  totalDays: z.number().min(1),
});

// POST /api/leave
export const applyLeave = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.employeeId) {
      if (req.user?.role === 'FOOD_OWNER') {
        let emp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
        if (!emp) {
          let dept = await prisma.department.findFirst({ where: { name: 'Cafeteria & Food Services' } });
          if (!dept) {
            dept = await prisma.department.create({
              data: { name: 'Cafeteria & Food Services', description: 'Cafeteria and Workplace Dining Amenities' },
            });
          }
          emp = await prisma.employee.create({
            data: {
              employeeId: 'FO001',
              userId: req.user.id,
              name: 'Cafeteria & Food Services',
              email: req.user.email,
              departmentId: dept.id,
              designation: 'Cafeteria Manager',
              joiningDate: new Date('2023-01-01'),
              status: 'ACTIVE',
            },
          });
        }
        req.user.employeeId = emp.id;
      } else {
        return next(createError('Employee profile not found', 404));
      }
    }
    const data = leaveSchema.parse(req.body);

    if (data.startDate > data.endDate) {
      return next(createError('Start date cannot be after end date', 400));
    }

    // Check for overlapping leaves
    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: req.user.employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          { startDate: { lte: data.endDate }, endDate: { gte: data.startDate } },
        ],
      },
    });

    if (overlap) {
      return next(createError('You already have a leave request for this period', 400));
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        employeeId: req.user.employeeId,
        leaveType: data.leaveType,
        startDate: data.startDate,
        endDate: data.endDate,
        totalDays: data.totalDays,
        reason: data.reason,
      },
      include: { employee: { include: { department: true } } },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'LEAVE_APPLIED',
        entityType: 'LeaveRequest',
        entityId: leave.id,
        description: `${leave.employee.name} applied for ${data.leaveType} leave`,
      },
    });

    const isFoodOwner = req.user.role === 'FOOD_OWNER';
    const startStr = data.startDate.toDateString();
    const endStr = data.endDate.toDateString();
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, email: true } });

    if (isFoodOwner) {
      // 1. Food Owner Leave Request triggers notifications for BOTH admin and employees
      // A. Admin notifications
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            title: 'Cafeteria Leave Notice',
            message: `Cafeteria & Food Services has requested ${data.leaveType} leave from ${startStr} to ${endStr} (${data.totalDays} day(s)). Reason: ${data.reason}`,
            type: 'WARNING',
            link: '/admin/leave',
          })),
        });

        admins.forEach((admin) => {
          emitToUser(admin.id, 'new_notification', {
            id: `food-leave-${leave.id}-${admin.id}`,
            conversationId: null,
            sender: { name: 'Cafeteria & Food Services', role: 'FOOD_OWNER' },
            messageType: 'LEAVE_NOTICE',
            messageContent: `Cafeteria & Food Services applied for leave from ${startStr} to ${endStr}.`,
            createdAt: new Date().toISOString(),
          });
        });
      }

      // B. Employee notifications
      const employees = await prisma.user.findMany({
        where: { role: 'EMPLOYEE' },
        select: { id: true, email: true },
      });

      if (employees.length > 0) {
        await prisma.notification.createMany({
          data: employees.map((emp) => ({
            userId: emp.id,
            title: 'Cafeteria Closure Notice',
            message: `Cafeteria & Food Services will be on leave from ${startStr} to ${endStr} (${data.totalDays} day(s)). Meal ordering will be paused during this period. Reason: ${data.reason}`,
            type: 'WARNING',
            link: '/employee/food',
          })),
        });

        employees.forEach((emp) => {
          emitToUser(emp.id, 'new_notification', {
            id: `food-leave-emp-${leave.id}-${emp.id}`,
            conversationId: null,
            sender: { name: 'Cafeteria & Food Services', role: 'FOOD_OWNER' },
            messageType: 'LEAVE_NOTICE',
            messageContent: `Cafeteria will be on leave from ${startStr} to ${endStr}. Food ordering suspended.`,
            createdAt: new Date().toISOString(),
          });
        });
      }

      // C. Appears as a readable message in the chat box
      const foodLeaveChatNotice =
        `📢 CAFETERIA LEAVE & CLOSURE NOTICE\n\n` +
        `📋 Details:\n` +
        `• Requested By: Cafeteria & Food Services\n` +
        `• Leave Type: ${data.leaveType}\n` +
        `• Duration: ${startStr} to ${endStr} (${data.totalDays} Day(s))\n` +
        `• Reason: ${data.reason}\n` +
        `• Status: 🟡 PENDING APPROVAL\n\n` +
        `⚠️ Notice: Cafeteria food ordering may be suspended during this leave period. Please plan your meal breaks accordingly.`;

      // Post in chat with Admins
      for (const admin of admins) {
        await sendDirectChatMessage({
          senderUserId: req.user.id,
          recipientUserId: admin.id,
          messageContent: foodLeaveChatNotice,
          messageType: 'LEAVE_NOTICE',
        });
      }

      // Post in chat with Employees
      for (const emp of employees) {
        await sendDirectChatMessage({
          senderUserId: req.user.id,
          recipientUserId: emp.id,
          messageContent: foodLeaveChatNotice,
          messageType: 'LEAVE_NOTICE',
        });
      }

      // Also post into any team group chats
      const groupConvs = await prisma.chatConversation.findMany({
        where: { conversationType: 'GROUP' },
        include: { participants: true },
      });

      for (const g of groupConvs) {
        const groupMsg = await prisma.chatMessage.create({
          data: {
            conversationId: g.id,
            senderId: req.user.id,
            messageType: 'LEAVE_NOTICE',
            messageContent: foodLeaveChatNotice,
          },
          include: {
            sender: {
              include: { employee: { include: { department: true } } },
            },
          },
        });

        emitToConversation(g.id, 'receive_message', {
          id: groupMsg.id,
          conversationId: g.id,
          senderId: req.user.id,
          sender: { name: 'Cafeteria & Food Services', role: 'FOOD_OWNER' },
          messageType: 'LEAVE_NOTICE',
          messageContent: foodLeaveChatNotice,
          createdAt: groupMsg.createdAt.toISOString(),
          isDeleted: false,
          isPinned: false,
        });
      }
    } else {
      // 2. Employee leave requests notify admin and post details in chat
      // A. Notify Admins
      await Promise.all(
        admins.map((admin) =>
          prisma.notification.create({
            data: {
              userId: admin.id,
              title: 'New Leave Request',
              message: `${leave.employee.name} has applied for ${data.leaveType} leave from ${startStr} to ${endStr} (${data.totalDays} day(s))`,
              type: 'INFO',
              link: `/admin/leave`,
            },
          })
        )
      );

      admins.forEach((admin) => {
        emitToUser(admin.id, 'new_notification', {
          id: `emp-leave-${leave.id}-${admin.id}`,
          conversationId: null,
          sender: { name: leave.employee.name, role: 'EMPLOYEE' },
          messageType: 'LEAVE_NOTICE',
          messageContent: `${leave.employee.name} applied for ${data.leaveType} leave from ${startStr} to ${endStr}.`,
          createdAt: new Date().toISOString(),
        });
      });

      // B. Post details in chat between Employee and Admin
      const empLeaveChatNotice =
        `📝 NEW LEAVE REQUEST SUBMITTED\n\n` +
        `👤 Employee: ${leave.employee.name} (${leave.employee.employeeId})\n` +
        `🏢 Department: ${leave.employee.department?.name || 'General'}\n` +
        `📌 Leave Type: ${data.leaveType}\n` +
        `📅 Duration: ${startStr} to ${endStr} (${data.totalDays} Day(s))\n` +
        `📝 Reason: ${data.reason}\n` +
        `🟡 Status: 🟡 PENDING (Awaiting Admin Review)`;

      for (const admin of admins) {
        await sendDirectChatMessage({
          senderUserId: req.user.id,
          recipientUserId: admin.id,
          messageContent: empLeaveChatNotice,
          messageType: 'LEAVE_NOTICE',
        });
      }
    }

    res.status(201).json({ success: true, data: leave, message: 'Leave request submitted successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(createError(error.errors[0].message, 400));
    }
    next(error);
  }
};

// GET /api/leave
export const getLeaveRequests = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, employeeId, page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};

    if (req.user?.role !== 'ADMIN') {
      where.employeeId = req.user?.employeeId;
    } else {
      if (employeeId) where.employeeId = String(employeeId);
    }

    if (status) where.status = String(status);

    const [leaves, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: { employee: { include: { department: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    res.json({
      success: true,
      data: leaves,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/leave/:id/status (Admin only)
export const updateLeaveStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, adminComment } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return next(createError('Invalid status', 400));
    }

    const leave = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        adminComment,
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
      },
      include: { employee: { include: { user: true } } },
    });

    // Mark attendance as ON_LEAVE if approved
    if (status === 'APPROVED') {
      const start = parseLocalDate(leave.startDate);
      const end = parseLocalDate(leave.endDate);
      const current = new Date(start);
      while (current <= end) {
        const dateOnly = new Date(current);
        await prisma.attendance.upsert({
          where: {
            employeeId_date: { employeeId: leave.employeeId, date: dateOnly },
          },
          update: { status: 'ON_LEAVE' },
          create: {
            employeeId: leave.employeeId,
            date: dateOnly,
            status: 'ON_LEAVE',
          },
        });
        current.setUTCDate(current.getUTCDate() + 1);
      }
    }

    // Notify employee / applicant
    await prisma.notification.create({
      data: {
        userId: leave.employee.userId,
        title: `Leave ${status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
        message: `Your ${leave.leaveType} leave request has been ${status.toLowerCase()}.${adminComment ? ` Note: ${adminComment}` : ''}`,
        type: status === 'APPROVED' ? 'SUCCESS' : 'ERROR',
        link: leave.employee.user.role === 'FOOD_OWNER' ? '/food-owner/leave' : '/employee/leave',
      },
    });

    emitToUser(leave.employee.userId, 'new_notification', {
      id: `leave-decision-${leave.id}`,
      conversationId: null,
      sender: { name: 'System Administrator', role: 'ADMIN' },
      messageType: 'LEAVE_NOTICE',
      messageContent: `Your ${leave.leaveType} leave request has been ${status.toLowerCase()}.`,
      createdAt: new Date().toISOString(),
    });

    // Send automatic message update to the applicant in chat box
    const isApproved = status === 'APPROVED';
    const statusEmoji = isApproved ? '✅' : '❌';
    const statusColor = isApproved ? '🟢' : '🔴';
    const startStr = parseLocalDate(leave.startDate).toDateString();
    const endStr = parseLocalDate(leave.endDate).toDateString();
    const commentStr = adminComment ? `\n💬 Admin Remarks: ${adminComment}` : '';

    const decisionChatMessage =
      `${statusEmoji} LEAVE REQUEST ${status}\n\n` +
      `👤 Applicant: ${leave.employee.name} (${leave.employee.employeeId})\n` +
      `📌 Leave Type: ${leave.leaveType}\n` +
      `📅 Period: ${startStr} to ${endStr} (${leave.totalDays} Day(s))\n` +
      `${statusColor} Status: ${status}${commentStr}`;

    await sendDirectChatMessage({
      senderUserId: req.user!.id,
      recipientUserId: leave.employee.userId,
      messageContent: decisionChatMessage,
      messageType: 'LEAVE_NOTICE',
    });

    // If Food Owner leave was approved, broadcast an announcement to all employees
    if (leave.employee.user.role === 'FOOD_OWNER' && isApproved) {
      const allEmployees = await prisma.user.findMany({
        where: { role: 'EMPLOYEE' },
        select: { id: true },
      });

      if (allEmployees.length > 0) {
        await prisma.notification.createMany({
          data: allEmployees.map((e) => ({
            userId: e.id,
            title: 'Cafeteria Closure Confirmed',
            message: `Cafeteria Leave from ${startStr} to ${endStr} has been APPROVED by Management. Food ordering will be suspended during this period.`,
            type: 'WARNING',
            link: '/employee/food',
          })),
        });

        allEmployees.forEach((e) => {
          emitToUser(e.id, 'new_notification', {
            id: `food-approved-${leave.id}-${e.id}`,
            conversationId: null,
            sender: { name: 'System Administrator', role: 'ADMIN' },
            messageType: 'LEAVE_NOTICE',
            messageContent: `Cafeteria Leave from ${startStr} to ${endStr} has been APPROVED. Food ordering suspended.`,
            createdAt: new Date().toISOString(),
          });
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: status === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
        entityType: 'LeaveRequest',
        entityId: id,
        description: `Admin ${status.toLowerCase()} leave request for ${leave.employee.name}`,
      },
    });

    res.json({ success: true, data: leave });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/leave/:id (Employee cancel)
export const cancelLeave = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!leave) return next(createError('Leave request not found', 404));
    if (req.user?.role !== 'ADMIN' && leave.employee.userId !== req.user?.id) {
      return next(createError('Access denied', 403));
    }
    if (leave.status !== 'PENDING') {
      return next(createError('Only pending leave requests can be cancelled', 400));
    }

    await prisma.leaveRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
    res.json({ success: true, message: 'Leave request cancelled' });
  } catch (error) {
    next(error);
  }
};
