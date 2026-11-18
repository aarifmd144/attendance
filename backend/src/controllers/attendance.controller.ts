import { Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import {
  calcTotalBreakMinutes,
  calcWorkingMinutes,
  isLate,
  calcLateMinutes,
  calcOvertimeMinutes,
  determineStatus,
} from '../utils/calculations';
import {
  getTodayDate,
  parseLocalDate,
  getMonthRange,
  getDayName,
} from '../utils/dateUtils';

// Helper: get company settings
const getSettings = async () => {
  let settings = await prisma.companySetting.findFirst();
  if (!settings) {
    settings = await prisma.companySetting.create({ data: {} });
  }
  return settings;
};

// Helper: check for holiday / weekend
const isHolidayOrWeekend = async (date: Date, settings: any): Promise<{ isHoliday: boolean; isWeekOff: boolean }> => {
  const tz = settings?.timezone || 'Asia/Kolkata';
  const dayName = getDayName(date, tz);
  const isWeekOff = !(settings?.workingDays || []).includes(dayName);

  const targetDate = parseLocalDate(date, tz);
  const holiday = await prisma.holiday.findFirst({
    where: { date: targetDate },
  });

  return { isHoliday: !!holiday, isWeekOff };
};

// POST /api/attendance/entry
export const markEntry = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const employeeId = (req.user?.role === 'ADMIN' && req.body.employeeId)
      ? req.body.employeeId
      : req.user?.employeeId;

    if (!employeeId) return next(createError('Employee profile not found', 404));

    const settings = await getSettings();
    const tz = settings?.timezone || 'Asia/Kolkata';
    const now = new Date();

    // Use user-selected date if passed in request body, otherwise use today's date in company timezone
    const targetDate = req.body.date
      ? parseLocalDate(req.body.date, tz)
      : getTodayDate(tz);

    const entryTime = req.body.entryTime ? new Date(req.body.entryTime) : now;

    // Check for existing attendance on this date
    const existing = await prisma.attendance.findFirst({
      where: { employeeId, date: targetDate },
    });

    if (existing?.entryTime && !req.body.allowUpdate) {
      return next(createError('Entry already marked for this date', 400));
    }

    const { isHoliday, isWeekOff } = await isHolidayOrWeekend(entryTime, settings);

    const late = isLate(entryTime, settings.officeStartTime, settings.lateThresholdMinutes);
    const lateMinutes = late ? calcLateMinutes(entryTime, settings.officeStartTime) : 0;

    let attendance;
    if (existing) {
      attendance = await prisma.attendance.update({
        where: { id: existing.id },
        data: { entryTime, isLate: late, lateMinutes, status: late ? 'LATE' : 'PRESENT' },
        include: { breaks: true },
      });
    } else {
      attendance = await prisma.attendance.create({
        data: {
          employeeId,
          date: targetDate,
          entryTime,
          isLate: late,
          lateMinutes,
          status: isHoliday ? 'HOLIDAY' : isWeekOff ? 'WEEK_OFF' : late ? 'LATE' : 'PRESENT',
        },
        include: { breaks: true },
      });
    }

    if (req.user?.id) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'ATTENDANCE_ENTRY_MARKED',
          entityType: 'Attendance',
          entityId: attendance.id,
          description: `Entry marked at ${now.toLocaleTimeString()}`,
        },
      });

      if (late) {
        await prisma.notification.create({
          data: {
            userId: req.user.id,
            title: 'Late Arrival',
            message: `You arrived ${lateMinutes} minutes late today.`,
            type: 'WARNING',
          },
        });
      }
    }

    res.json({ success: true, data: attendance, message: 'Entry marked successfully' });
  } catch (error) {
    next(error);
  }
};

// POST /api/attendance (Admin: manual attendance creation)
export const createAttendance = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { employeeId, date, entryTime, exitTime, status, notes } = req.body;
    if (!employeeId || !date) {
      return next(createError('Employee ID and date are required', 400));
    }

    const settings = await getSettings();
    const tz = settings?.timezone || 'Asia/Kolkata';
    const targetDate = parseLocalDate(date, tz);

    const existing = await prisma.attendance.findFirst({
      where: { employeeId, date: targetDate },
    });

    if (existing) {
      return next(createError('Attendance record already exists for this date', 400));
    }

    const parsedEntry = entryTime ? new Date(entryTime) : undefined;
    const parsedExit = exitTime ? new Date(exitTime) : undefined;

    let totalWorkMinutes = 0;
    let overtimeMinutes = 0;
    let late = false;
    let lateMinutes = 0;

    if (parsedEntry) {
      late = isLate(parsedEntry, settings.officeStartTime, settings.lateThresholdMinutes);
      lateMinutes = late ? calcLateMinutes(parsedEntry, settings.officeStartTime) : 0;
    }

    if (parsedEntry && parsedExit) {
      totalWorkMinutes = calcWorkingMinutes(parsedEntry, parsedExit, 0);
      overtimeMinutes = calcOvertimeMinutes(totalWorkMinutes, settings.requiredHours);
    }

    const finalStatus = status || (parsedEntry ? (late ? 'LATE' : 'PRESENT') : 'ABSENT');

    const attendance = await prisma.attendance.create({
      data: {
        employeeId,
        date: targetDate,
        entryTime: parsedEntry,
        exitTime: parsedExit,
        totalWorkMinutes: totalWorkMinutes || undefined,
        overtimeMinutes: overtimeMinutes || undefined,
        isOvertime: overtimeMinutes > 0,
        isLate: late,
        lateMinutes: lateMinutes || undefined,
        status: finalStatus as any,
        notes,
      },
      include: { employee: { include: { department: true } }, breaks: true },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'ATTENDANCE_ENTRY_MARKED',
        entityType: 'Attendance',
        entityId: attendance.id,
        description: `Admin entered attendance for employee on ${date}`,
      },
    });

    res.status(201).json({ success: true, data: attendance, message: 'Attendance recorded successfully' });
  } catch (error) {
    next(error);
  }
};

// POST /api/attendance/break/start
export const startBreak = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.employeeId) return next(createError('Employee profile not found', 404));

    const settings = await getSettings();
    const tz = settings?.timezone || 'Asia/Kolkata';
    const now = new Date();
    const targetDate = req.body.date ? parseLocalDate(req.body.date, tz) : getTodayDate(tz);

    const attendance = await prisma.attendance.findFirst({
      where: { employeeId: req.user.employeeId, date: targetDate },
      include: { breaks: { orderBy: { startTime: 'desc' } } },
    });

    if (!attendance?.entryTime) return next(createError('Please mark entry first', 400));
    if (attendance.exitTime) return next(createError('You have already checked out', 400));

    // Check for open break
    const openBreak = attendance.breaks.find(b => !b.endTime);
    if (openBreak) return next(createError('You are already on a break. End the current break first.', 400));

    const breakRecord = await prisma.break.create({
      data: { attendanceId: attendance.id, startTime: now },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'BREAK_STARTED',
        entityType: 'Break',
        entityId: breakRecord.id,
        description: `Break started at ${now.toLocaleTimeString()}`,
      },
    });

    res.json({ success: true, data: breakRecord, message: 'Break started' });
  } catch (error) {
    next(error);
  }
};

// POST /api/attendance/break/end
export const endBreak = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.employeeId) return next(createError('Employee profile not found', 404));

    const settings = await getSettings();
    const tz = settings?.timezone || 'Asia/Kolkata';
    const now = new Date();
    const targetDate = req.body.date ? parseLocalDate(req.body.date, tz) : getTodayDate(tz);

    const attendance = await prisma.attendance.findFirst({
      where: { employeeId: req.user.employeeId, date: targetDate },
      include: { breaks: true },
    });

    if (!attendance) return next(createError('No attendance record found', 404));

    const openBreak = attendance.breaks.find(b => !b.endTime);
    if (!openBreak) return next(createError('No active break found', 400));

    const durationMinutes = Math.round((now.getTime() - openBreak.startTime.getTime()) / 60000);

    const updatedBreak = await prisma.break.update({
      where: { id: openBreak.id },
      data: { endTime: now, durationMinutes },
    });

    // Update total break minutes on attendance
    const allBreaks = await prisma.break.findMany({ where: { attendanceId: attendance.id } });
    const totalBreakMinutes = calcTotalBreakMinutes(allBreaks);

    await prisma.attendance.update({
      where: { id: attendance.id },
      data: { totalBreakMinutes },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'BREAK_ENDED',
        entityType: 'Break',
        entityId: openBreak.id,
        description: `Break ended at ${now.toLocaleTimeString()} (${durationMinutes} min)`,
      },
    });

    res.json({ success: true, data: updatedBreak, message: 'Break ended' });
  } catch (error) {
    next(error);
  }
};

// POST /api/attendance/exit
export const markExit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.employeeId) return next(createError('Employee profile not found', 404));

    const settings = await getSettings();
    const tz = settings?.timezone || 'Asia/Kolkata';
    const now = new Date();
    const targetDate = req.body.date ? parseLocalDate(req.body.date, tz) : getTodayDate(tz);

    const attendance = await prisma.attendance.findFirst({
      where: { employeeId: req.user.employeeId, date: targetDate },
      include: { breaks: true },
    });

    if (!attendance?.entryTime) return next(createError('Please mark entry first', 400));
    if (attendance.exitTime) return next(createError('Exit already marked for today', 400));

    // Check for open break
    const openBreak = attendance.breaks.find(b => !b.endTime);
    if (openBreak) return next(createError('Please end your current break before marking exit', 400));

    const totalBreakMinutes = calcTotalBreakMinutes(attendance.breaks);
    const totalWorkMinutes = calcWorkingMinutes(attendance.entryTime, now, totalBreakMinutes);
    const overtimeMinutes = calcOvertimeMinutes(totalWorkMinutes, settings.requiredHours);
    const isOvertime = overtimeMinutes > 0;

    const status = determineStatus(
      totalWorkMinutes,
      settings.requiredHours,
      attendance.isLate,
      false, false, false, false
    );

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        exitTime: now,
        totalWorkMinutes,
        totalBreakMinutes,
        overtimeMinutes,
        isOvertime,
        isMissingCheckout: false,
        status: status as any,
      },
      include: { breaks: true, employee: { include: { department: true } } },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'ATTENDANCE_EXIT_MARKED',
        entityType: 'Attendance',
        entityId: attendance.id,
        description: `Exit marked at ${now.toLocaleTimeString()}, worked ${totalWorkMinutes} min`,
      },
    });

    res.json({ success: true, data: updated, message: 'Exit marked successfully' });
  } catch (error) {
    next(error);
  }
};

// GET /api/attendance/today
export const getTodayAttendance = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await getSettings();
    const tz = settings?.timezone || 'Asia/Kolkata';
    const today = getTodayDate(tz);

    let where: any = { date: today };

    if (req.user?.role !== 'ADMIN') {
      if (!req.user?.employeeId) return next(createError('Employee profile not found', 404));
      where.employeeId = req.user.employeeId;
    }

    const attendance = await prisma.attendance.findFirst({
      where,
      include: {
        breaks: { orderBy: { startTime: 'asc' } },
        employee: { include: { department: true } },
      },
    });

    res.json({ success: true, data: attendance });
  } catch (error) {
    next(error);
  }
};

// GET /api/attendance (list with filters)
export const getAttendance = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      employeeId,
      departmentId,
      date,
      startDate,
      endDate,
      status,
      isLate: lateFilter,
      page = '1',
      limit = '20',
    } = req.query;

    const settings = await getSettings();
    const tz = settings?.timezone || 'Asia/Kolkata';

    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {};

    if (req.user?.role !== 'ADMIN') {
      where.employeeId = req.user?.employeeId;
    } else {
      if (employeeId) where.employeeId = String(employeeId);
      if (departmentId) {
        where.employee = { departmentId: String(departmentId) };
      }
    }

    if (date) {
      where.date = parseLocalDate(String(date), tz);
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = parseLocalDate(String(startDate), tz);
      if (endDate) where.date.lte = parseLocalDate(String(endDate), tz);
    }

    if (status) where.status = String(status);
    if (lateFilter === 'true') where.isLate = true;

    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          breaks: { orderBy: { startTime: 'asc' } },
          employee: { include: { department: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.attendance.count({ where }),
    ]);

    res.json({
      success: true,
      data: records,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/attendance/live
export const getLiveAttendance = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await getSettings();
    const tz = settings?.timezone || 'Asia/Kolkata';
    const today = getTodayDate(tz);

    const records = await prisma.attendance.findMany({
      where: { date: today },
      include: {
        breaks: { orderBy: { startTime: 'desc' }, take: 1 },
        employee: { include: { department: true } },
      },
    });

    const live = records.map(r => {
      const openBreak = r.breaks.find(b => !b.endTime);
      let currentStatus = 'CHECKED_OUT';
      if (!r.entryTime) currentStatus = 'NOT_CHECKED_IN';
      else if (!r.exitTime) {
        currentStatus = openBreak ? 'ON_BREAK' : 'WORKING';
      }
      return { ...r, currentStatus };
    });

    res.json({ success: true, data: live });
  } catch (error) {
    next(error);
  }
};

// GET /api/attendance/calendar/:employeeId
export const getCalendar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { employeeId } = req.params;
    const { year, month } = req.query;

    if (req.user?.role !== 'ADMIN' && req.user?.employeeId !== employeeId) {
      return next(createError('Access denied', 403));
    }

    const y = Number(year) || new Date().getFullYear();
    const m = Number(month) || new Date().getMonth() + 1;
    const { start, end } = getMonthRange(y, m);

    const records = await prisma.attendance.findMany({
      where: { employeeId, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });

    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/attendance/:id (Admin: manual correction)
export const updateAttendance = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { entryTime, exitTime, notes, date, status } = req.body;
    const settings = await getSettings();
    const tz = settings?.timezone || 'Asia/Kolkata';

    const attendance = await prisma.attendance.findUnique({
      where: { id },
      include: { breaks: true },
    });

    if (!attendance) return next(createError('Attendance record not found', 404));

    const newEntry = entryTime ? new Date(entryTime) : attendance.entryTime;
    const newExit = exitTime ? new Date(exitTime) : attendance.exitTime;

    let updates: any = {};
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined) updates.status = status;
    if (date !== undefined) updates.date = parseLocalDate(date, tz);
    if (newEntry) updates.entryTime = newEntry;
    if (newExit && newEntry) {
      const totalBreakMinutes = calcTotalBreakMinutes(attendance.breaks);
      const totalWorkMinutes = calcWorkingMinutes(newEntry, newExit, totalBreakMinutes);
      const overtimeMinutes = calcOvertimeMinutes(totalWorkMinutes, settings.requiredHours);
      updates = { ...updates, exitTime: newExit, totalWorkMinutes, totalBreakMinutes, overtimeMinutes, isOvertime: overtimeMinutes > 0 };
    }

    const updated = await prisma.attendance.update({ where: { id }, data: updates });

    await prisma.auditLog.create({
      data: {
        adminId: req.user!.id,
        action: 'ATTENDANCE_MODIFIED',
        entityType: 'Attendance',
        entityId: id,
        description: `Admin manually updated attendance record`,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};
