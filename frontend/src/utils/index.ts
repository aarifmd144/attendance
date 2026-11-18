import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { AttendanceStatus, LeaveStatus, LeaveType } from '../types';

/**
 * Format a calendar date (string or Date) cleanly as 'dd MMM yyyy' (e.g. '12 Nov 2026').
 * Prevents timezone offset shifts when formatting pure date strings (e.g. '2026-11-12T00:00:00.000Z'
 * or '2026-11-12').
 */
export const formatDate = (date: string | Date): string => {
  if (!date) return '-';
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return format(new Date(year, month, day), 'dd MMM yyyy');
    }
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return format(d, 'dd MMM yyyy');
};

/**
 * Extract 'YYYY-MM-DD' from a Date or string without timezone conversion.
 */
export const toDateKey = (date: string | Date): string => {
  if (!date) return '';
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return format(d, 'yyyy-MM-dd');
};

export const formatTime = (date: string | Date): string => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return format(d, 'hh:mm a');
};

export const formatDateTime = (date: string | Date): string => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return format(d, 'dd MMM yyyy, hh:mm a');
};

export const formatMinutes = (minutes: number): string => {
  if (!minutes || minutes <= 0) return '0h 0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};

export const timeAgo = (date: string | Date): string => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return formatDistanceToNow(d, { addSuffix: true });
};

export const getStatusColor = (status: AttendanceStatus): string => {
  const colors: Record<AttendanceStatus, string> = {
    PRESENT: 'bg-green-100 text-green-800',
    ABSENT: 'bg-red-100 text-red-800',
    HALF_DAY: 'bg-yellow-100 text-yellow-800',
    LATE: 'bg-orange-100 text-orange-800',
    ON_LEAVE: 'bg-blue-100 text-blue-800',
    HOLIDAY: 'bg-purple-100 text-purple-800',
    WEEK_OFF: 'bg-gray-100 text-gray-800',
    MISSING_CHECKOUT: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

export const getLeaveStatusColor = (status: LeaveStatus): string => {
  const colors: Record<LeaveStatus, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

export const getLeaveTypeLabel = (type: LeaveType): string => {
  const labels: Record<LeaveType, string> = {
    CASUAL: 'Casual Leave',
    SICK: 'Sick Leave',
    EMERGENCY: 'Emergency Leave',
    PERMISSION: 'Permission',
    OTHER: 'Other',
  };
  return labels[type] || type;
};

export const getStatusLabel = (status: AttendanceStatus): string => {
  const labels: Record<AttendanceStatus, string> = {
    PRESENT: 'Present',
    ABSENT: 'Absent',
    HALF_DAY: 'Half Day',
    LATE: 'Late',
    ON_LEAVE: 'On Leave',
    HOLIDAY: 'Holiday',
    WEEK_OFF: 'Week Off',
    MISSING_CHECKOUT: 'Missing Checkout',
  };
  return labels[status] || status;
};

export const getLiveStatusConfig = (status: string) => {
  const configs: Record<string, { color: string; bg: string; label: string }> = {
    NOT_CHECKED_IN: { color: 'text-gray-500', bg: 'bg-gray-100', label: 'Not Checked In' },
    WORKING: { color: 'text-green-700', bg: 'bg-green-100', label: 'Working' },
    ON_BREAK: { color: 'text-yellow-700', bg: 'bg-yellow-100', label: 'On Break' },
    CHECKED_OUT: { color: 'text-blue-700', bg: 'bg-blue-100', label: 'Checked Out' },
  };
  return configs[status] || configs.NOT_CHECKED_IN;
};

export const cn = (...classes: (string | undefined | null | boolean)[]): string => {
  return classes.filter(Boolean).join(' ');
};
