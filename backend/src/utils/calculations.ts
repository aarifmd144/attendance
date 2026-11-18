import { format, differenceInMinutes, parseISO, startOfDay, endOfDay } from 'date-fns';

// Parse HH:mm string to today's Date
export const parseTimeString = (timeStr: string, baseDate?: Date): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = baseDate ? new Date(baseDate) : new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

// Format minutes to "Xh Ym"
export const formatMinutes = (totalMinutes: number): string => {
  if (totalMinutes <= 0) return '0h 0m';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
};

// Calculate total break duration in minutes from breaks array
export const calcTotalBreakMinutes = (breaks: { startTime: Date; endTime: Date | null }[]): number => {
  return breaks.reduce((total, b) => {
    if (b.endTime) {
      return total + differenceInMinutes(new Date(b.endTime), new Date(b.startTime));
    }
    return total;
  }, 0);
};

// Calculate working minutes = exit - entry - total break
export const calcWorkingMinutes = (
  entryTime: Date,
  exitTime: Date,
  totalBreakMinutes: number
): number => {
  const gross = differenceInMinutes(exitTime, entryTime);
  return Math.max(0, gross - totalBreakMinutes);
};

// Determine if employee is late
export const isLate = (entryTime: Date, officeStart: string, lateThreshold: number): boolean => {
  const scheduled = parseTimeString(officeStart, entryTime);
  const lateTime = new Date(scheduled.getTime() + lateThreshold * 60 * 1000);
  return entryTime > lateTime;
};

// Calculate late minutes
export const calcLateMinutes = (entryTime: Date, officeStart: string): number => {
  const scheduled = parseTimeString(officeStart, entryTime);
  const diff = differenceInMinutes(entryTime, scheduled);
  return Math.max(0, diff);
};

// Calculate overtime minutes
export const calcOvertimeMinutes = (workingMinutes: number, requiredMinutes: number): number => {
  return Math.max(0, workingMinutes - requiredMinutes);
};

// Determine attendance status
export const determineStatus = (
  workingMinutes: number,
  requiredMinutes: number,
  lateArrival: boolean,
  isOnLeave: boolean,
  isHoliday: boolean,
  isWeekOff: boolean,
  isMissingCheckout: boolean
): string => {
  if (isOnLeave) return 'ON_LEAVE';
  if (isHoliday) return 'HOLIDAY';
  if (isWeekOff) return 'WEEK_OFF';
  if (isMissingCheckout) return 'MISSING_CHECKOUT';
  if (workingMinutes === 0) return 'ABSENT';
  if (workingMinutes >= requiredMinutes / 2 && workingMinutes < requiredMinutes) return 'HALF_DAY';
  if (lateArrival && workingMinutes >= requiredMinutes) return 'LATE';
  if (workingMinutes >= requiredMinutes) return 'PRESENT';
  return 'HALF_DAY';
};

// Get start and end of a date
export const getDateRange = (date: Date) => ({
  start: startOfDay(date),
  end: endOfDay(date),
});

// Format date to string for display (DD/MM/YYYY) without timezone shifts
export const formatDate = (date: Date | string): string => {
  if (!date) return '-';
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
  }
  return format(new Date(date), 'dd/MM/yyyy');
};

export const formatTime = (date: Date | string): string => {
  return format(new Date(date), 'hh:mm a');
};
