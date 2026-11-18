import { Response, NextFunction } from 'express';
import { format } from 'date-fns';
import ExcelJS from 'exceljs';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { formatMinutes } from '../utils/calculations';
import {
  parseLocalDate,
  formatDateKey,
  getMonthRange,
  getWeekRange,
} from '../utils/dateUtils';

const getAttendanceData = async (where: any) => {
  return prisma.attendance.findMany({
    where,
    include: {
      breaks: { orderBy: { startTime: 'asc' } },
      employee: { include: { department: true } },
    },
    orderBy: [{ date: 'desc' }, { employee: { employeeId: 'asc' } }],
  });
};

// GET /api/reports/daily
export const getDailyReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.companySetting.findFirst();
    const tz = settings?.timezone || 'Asia/Kolkata';
    const dateStr = req.query.date ? String(req.query.date) : formatDateKey(new Date(), tz);
    const targetDate = parseLocalDate(dateStr, tz);
    const where: any = { date: targetDate };
    if (req.query.departmentId) where.employee = { departmentId: String(req.query.departmentId) };

    const data = await getAttendanceData(where);
    res.json({ success: true, data, reportType: 'daily', date: dateStr });
  } catch (error) { next(error); }
};

// GET /api/reports/weekly
export const getWeeklyReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.companySetting.findFirst();
    const tz = settings?.timezone || 'Asia/Kolkata';
    const dateStr = req.query.date ? String(req.query.date) : formatDateKey(new Date(), tz);
    const { start, end } = getWeekRange(dateStr, tz);
    const where: any = { date: { gte: start, lte: end } };

    const data = await getAttendanceData(where);
    res.json({ success: true, data, reportType: 'weekly' });
  } catch (error) { next(error); }
};

// GET /api/reports/monthly
export const getMonthlyReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const { start, end } = getMonthRange(year, month);
    const where: any = { date: { gte: start, lte: end } };
    if (req.query.employeeId) where.employeeId = String(req.query.employeeId);
    if (req.query.departmentId) where.employee = { departmentId: String(req.query.departmentId) };

    const data = await getAttendanceData(where);

    // Aggregate stats
    const stats = {
      totalDays: data.length,
      present: data.filter(d => ['PRESENT', 'LATE', 'HALF_DAY'].includes(d.status)).length,
      absent: data.filter(d => d.status === 'ABSENT').length,
      onLeave: data.filter(d => d.status === 'ON_LEAVE').length,
      late: data.filter(d => d.isLate).length,
      totalWorkMinutes: data.reduce((s, d) => s + (d.totalWorkMinutes || 0), 0),
      totalOvertimeMinutes: data.reduce((s, d) => s + (d.overtimeMinutes || 0), 0),
    };

    res.json({ success: true, data, stats, reportType: 'monthly', year, month });
  } catch (error) { next(error); }
};

// GET /api/reports/employee/:employeeId
export const getEmployeeReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { employeeId } = req.params;
    if (req.user?.role !== 'ADMIN' && req.user?.employeeId !== employeeId) {
      return next(createError('Access denied', 403));
    }

    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const { start, end } = getMonthRange(year, month);

    const data = await getAttendanceData({
      employeeId,
      date: { gte: start, lte: end },
    });

    const stats = {
      totalDays: data.length,
      present: data.filter(d => ['PRESENT', 'LATE', 'HALF_DAY'].includes(d.status)).length,
      absent: data.filter(d => d.status === 'ABSENT').length,
      onLeave: data.filter(d => d.status === 'ON_LEAVE').length,
      late: data.filter(d => d.isLate).length,
      totalWorkMinutes: data.reduce((s, d) => s + (d.totalWorkMinutes || 0), 0),
      totalOvertimeMinutes: data.reduce((s, d) => s + (d.overtimeMinutes || 0), 0),
      avgWorkMinutes: data.length > 0 ? Math.round(data.reduce((s, d) => s + (d.totalWorkMinutes || 0), 0) / data.length) : 0,
    };

    res.json({ success: true, data, stats });
  } catch (error) { next(error); }
};

// GET /api/reports/export
export const exportReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { format: fmt = 'excel', startDate, endDate, date, employeeId, departmentId } = req.query;
    const settings = await prisma.companySetting.findFirst();
    const tz = settings?.timezone || 'Asia/Kolkata';

    const where: any = {};
    if (date) {
      where.date = parseLocalDate(String(date), tz);
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = parseLocalDate(String(startDate), tz);
      if (endDate) where.date.lte = parseLocalDate(String(endDate), tz);
    }
    if (employeeId) where.employeeId = String(employeeId);
    if (departmentId) where.employee = { departmentId: String(departmentId) };

    const data = await getAttendanceData(where);

    if (fmt === 'csv') {
      const headers = 'Employee ID,Employee Name,Department,Date,Entry Time,Exit Time,Total Break,Working Hours,Overtime,Status,Late\n';
      const rows = data.map(r => [
        r.employee.employeeId,
        r.employee.name,
        r.employee.department?.name || '-',
        formatDateKey(r.date, tz),
        r.entryTime ? format(r.entryTime, 'hh:mm a') : '-',
        r.exitTime ? format(r.exitTime, 'hh:mm a') : '-',
        formatMinutes(r.totalBreakMinutes || 0),
        formatMinutes(r.totalWorkMinutes || 0),
        formatMinutes(r.overtimeMinutes || 0),
        r.status,
        r.isLate ? 'Yes' : 'No',
      ].join(',')).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.csv');
      return res.send(headers + rows);
    }

    // Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Attendance Report');

    sheet.columns = [
      { header: 'Employee ID', key: 'empId', width: 12 },
      { header: 'Employee Name', key: 'name', width: 20 },
      { header: 'Department', key: 'dept', width: 18 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Entry Time', key: 'entry', width: 14 },
      { header: 'Break Start', key: 'breakStart', width: 14 },
      { header: 'Break End', key: 'breakEnd', width: 14 },
      { header: 'Total Break', key: 'totalBreak', width: 14 },
      { header: 'Exit Time', key: 'exit', width: 14 },
      { header: 'Working Hours', key: 'work', width: 16 },
      { header: 'Overtime', key: 'ot', width: 12 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Late', key: 'late', width: 8 },
    ];

    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    data.forEach(r => {
      const firstBreak = r.breaks[0];
      const lastBreak = r.breaks[r.breaks.length - 1];
      sheet.addRow({
        empId: r.employee.employeeId,
        name: r.employee.name,
        dept: r.employee.department?.name || '-',
        date: formatDateKey(r.date, tz),
        entry: r.entryTime ? format(r.entryTime, 'hh:mm a') : '-',
        breakStart: firstBreak?.startTime ? format(firstBreak.startTime, 'hh:mm a') : '-',
        breakEnd: lastBreak?.endTime ? format(lastBreak.endTime, 'hh:mm a') : '-',
        totalBreak: formatMinutes(r.totalBreakMinutes || 0),
        exit: r.exitTime ? format(r.exitTime, 'hh:mm a') : '-',
        work: formatMinutes(r.totalWorkMinutes || 0),
        ot: formatMinutes(r.overtimeMinutes || 0),
        status: r.status,
        late: r.isLate ? 'Yes' : 'No',
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { next(error); }
};
