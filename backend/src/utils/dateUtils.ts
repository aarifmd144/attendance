/**
 * Date utilities for Attendance Management System.
 *
 * PostgreSQL @db.Date fields store a pure calendar date (YYYY-MM-DD) without time.
 * Prisma serializes and deserializes @db.Date using UTC calendar dates.
 * Using local `startOfDay(new Date())` introduces timezone shifts (e.g. UTC+5:30 in India
 * produces 18:30 UTC of the previous day, causing Prisma to save the previous day).
 *
 * These utilities ensure that:
 * 1. "Today" in company timezone is always converted to UTC midnight representing that exact calendar date.
 * 2. User-selected dates (like "2026-11-12") are preserved exactly as "2026-11-12" with zero timezone shifting.
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns today's calendar date as a Date object at UTC midnight (YYYY-MM-DDT00:00:00.000Z)
 * corresponding to the current date in the specified timezone.
 */
export const getTodayDate = (timeZone: string = DEFAULT_TIMEZONE): Date => {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
  return new Date(`${dateStr}T00:00:00.000Z`);
};

/**
 * Parses any date input (YYYY-MM-DD string, ISO string, or Date) into a UTC midnight Date object
 * representing that exact calendar date, preventing any off-by-one or timezone drift.
 */
export const parseLocalDate = (
  input?: string | Date | null,
  timeZone: string = DEFAULT_TIMEZONE
): Date => {
  if (!input) return getTodayDate(timeZone);

  if (typeof input === 'string') {
    const trimmed = input.trim();
    // Match date-only prefix or date-only with optional T00:00:00
    const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?(?:Z)?)?$/);
    if (dateOnlyMatch) {
      return new Date(`${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}T00:00:00.000Z`);
    }

    // Full timestamp with time, convert to timezone's local date
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone }).format(d);
      return new Date(`${dateStr}T00:00:00.000Z`);
    }
  } else if (input instanceof Date && !isNaN(input.getTime())) {
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone }).format(input);
    return new Date(`${dateStr}T00:00:00.000Z`);
  }

  return getTodayDate(timeZone);
};

/**
 * Formats a Date or string to 'YYYY-MM-DD'.
 */
export const formatDateKey = (
  date: Date | string,
  timeZone: string = DEFAULT_TIMEZONE
): string => {
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(d);
};

/**
 * Returns month range (start and end date at UTC midnight) for querying @db.Date fields.
 * month is 1-based (1 = Jan, 12 = Dec).
 */
export const getMonthRange = (
  year: number | string,
  month: number | string
): { start: Date; end: Date } => {
  const y = Number(year);
  const m = Number(month);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = new Date(Date.UTC(y, m - 1, lastDay, 0, 0, 0, 0));
  return { start, end };
};

/**
 * Returns week range (Monday to Sunday at UTC midnight) for querying @db.Date fields.
 */
export const getWeekRange = (
  dateInput: Date | string,
  timeZone: string = DEFAULT_TIMEZONE
): { start: Date; end: Date } => {
  const base = parseLocalDate(dateInput, timeZone);
  // base is UTC midnight
  const day = base.getUTCDay(); // 0 is Sunday, 1 is Monday, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setUTCDate(base.getUTCDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return { start: monday, end: sunday };
};

/**
 * Returns the uppercase day name (e.g. 'MONDAY', 'TUESDAY') in the specified timezone.
 */
export const getDayName = (
  date: Date,
  timeZone: string = DEFAULT_TIMEZONE
): string => {
  return date.toLocaleDateString('en-US', { weekday: 'long', timeZone }).toUpperCase();
};

/**
 * Checks if two dates refer to the exact same calendar day.
 */
export const isSameCalendarDate = (
  dateA: Date | string,
  dateB: Date | string,
  timeZone: string = DEFAULT_TIMEZONE
): boolean => {
  return formatDateKey(dateA, timeZone) === formatDateKey(dateB, timeZone);
};
