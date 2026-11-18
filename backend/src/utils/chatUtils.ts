import prisma from './prisma';
import { isUserOnline } from '../services/socket.service';

export interface ThemeConfig {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  primaryColor: string;
  bubbleColor: string;
  bgPattern: string;
  headerBg?: string;
  accentColor?: string;
}

export const THEME_PRESETS: Record<string, ThemeConfig> = {
  'classic-blue': {
    id: 'classic-blue',
    name: 'WorkPulse Blue',
    mode: 'light',
    primaryColor: '#2563eb',
    bubbleColor: '#2563eb',
    bgPattern: 'dots',
  },
  'emerald-forest': {
    id: 'emerald-forest',
    name: 'Emerald Forest',
    mode: 'light',
    primaryColor: '#059669',
    bubbleColor: '#059669',
    bgPattern: 'grid',
  },
  'royal-purple': {
    id: 'royal-purple',
    name: 'Royal Purple',
    mode: 'light',
    primaryColor: '#7c3aed',
    bubbleColor: '#7c3aed',
    bgPattern: 'doodles',
  },
  'sunset-rose': {
    id: 'sunset-rose',
    name: 'Sunset Rose',
    mode: 'light',
    primaryColor: '#e11d48',
    bubbleColor: '#e11d48',
    bgPattern: 'dots',
  },
  'warm-amber': {
    id: 'warm-amber',
    name: 'Warm Amber',
    mode: 'light',
    primaryColor: '#d97706',
    bubbleColor: '#d97706',
    bgPattern: 'subtle',
  },
  'slate-minimal': {
    id: 'slate-minimal',
    name: 'Slate Minimal',
    mode: 'light',
    primaryColor: '#475569',
    bubbleColor: '#334155',
    bgPattern: 'none',
  },
  'midnight-dark': {
    id: 'midnight-dark',
    name: 'Midnight Dark',
    mode: 'dark',
    primaryColor: '#3b82f6',
    bubbleColor: '#2563eb',
    bgPattern: 'grid',
  },
  'cyber-neon': {
    id: 'cyber-neon',
    name: 'Cyberpunk Neon',
    mode: 'dark',
    primaryColor: '#06b6d4',
    bubbleColor: '#0891b2',
    bgPattern: 'dots',
  },
};

export const DEFAULT_THEME: ThemeConfig = THEME_PRESETS['classic-blue'];

// Role-based permission check
export const isChatAllowed = (senderRole: string, receiverRole: string): boolean => {
  if (senderRole === 'ADMIN') {
    return receiverRole === 'ADMIN' || receiverRole === 'EMPLOYEE' || receiverRole === 'FOOD_OWNER';
  }
  if (senderRole === 'EMPLOYEE') {
    return receiverRole === 'ADMIN' || receiverRole === 'EMPLOYEE' || receiverRole === 'FOOD_OWNER';
  }
  if (senderRole === 'FOOD_OWNER') {
    return receiverRole === 'ADMIN' || receiverRole === 'EMPLOYEE';
  }
  return false;
};

// Helper to format user display data securely
export const formatUserDisplay = (user: any) => {
  if (!user) return null;

  let displayName = user.email;
  let designation = user.role;
  let department = null;
  let employeeId = null;
  let avatar = null;

  if (user.employee) {
    displayName = user.employee.name;
    designation = user.employee.designation || 'Staff';
    department = user.employee.department?.name || null;
    employeeId = user.employee.employeeId;
    avatar = user.employee.profilePhoto;
  } else if (user.role === 'FOOD_OWNER') {
    displayName = 'Cafeteria & Food Services';
    designation = 'Food & Canteen Manager';
  } else if (user.role === 'ADMIN') {
    displayName = 'System Administrator';
    designation = 'System Admin';
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: displayName,
    designation,
    department,
    employeeId,
    avatar,
    isOnline: isUserOnline(user.id),
    lastSeenAt: user.lastSeenAt,
  };
};
