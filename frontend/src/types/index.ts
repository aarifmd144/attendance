// ============================================================
// SHARED TYPES
// ============================================================

export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE' | 'FOOD_OWNER';
  employee?: Employee;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  _count?: { employees: number };
}

export interface Employee {
  id: string;
  employeeId: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  departmentId?: string;
  department?: Department;
  designation?: string;
  joiningDate: string;
  profilePhoto?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  user?: { email: string; role: string; isRegistered: boolean };
}

export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'HALF_DAY'
  | 'LATE'
  | 'ON_LEAVE'
  | 'HOLIDAY'
  | 'WEEK_OFF'
  | 'MISSING_CHECKOUT';

export interface Break {
  id: string;
  attendanceId: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
}

export interface Attendance {
  id: string;
  employeeId: string;
  employee?: Employee;
  date: string;
  entryTime?: string;
  exitTime?: string;
  totalWorkMinutes?: number;
  totalBreakMinutes?: number;
  overtimeMinutes?: number;
  lateMinutes?: number;
  status: AttendanceStatus;
  isLate: boolean;
  isOvertime: boolean;
  isMissingCheckout: boolean;
  notes?: string;
  breaks: Break[];
  currentStatus?: 'NOT_CHECKED_IN' | 'WORKING' | 'ON_BREAK' | 'CHECKED_OUT';
}

export type LeaveType = 'CASUAL' | 'SICK' | 'EMERGENCY' | 'PERMISSION' | 'OTHER';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employee?: Employee;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  adminComment?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface AttendanceCorrection {
  id: string;
  employeeId: string;
  employee?: Employee;
  attendanceId?: string;
  date: string;
  requestedEntry?: string;
  requestedExit?: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminComment?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  adminId?: string;
  userId?: string;
  action: string;
  entityType?: string;
  description: string;
  createdAt: string;
  admin?: { email: string; employee?: { name: string } };
  user?: { email: string; employee?: { name: string } };
}

export interface CompanySetting {
  id: string;
  companyName: string;
  officeStartTime: string;
  officeEndTime: string;
  requiredHours: number;
  lateThresholdMinutes: number;
  overtimeThresholdMinutes: number;
  halfDayMinutes: number;
  workingDays: string[];
  breakLimitMinutes: number;
  timezone: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  description?: string;
  isRecurring: boolean;
}

export interface DashboardSummary {
  totalEmployees: number;
  activeEmployees: number;
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
  lateToday: number;
  currentlyWorking: number;
  missingCheckout: number;
  avgWorkingMinutes: number;
  totalOvertimeMinutes: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: Pagination;
}

// ============================================================
// FOOD ORDERING SYSTEM TYPES
// ============================================================

export interface FoodItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FoodOrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface FoodOrderItem {
  id: string;
  orderId: string;
  foodItemId: string;
  itemName: string;
  price: number;
  quantity: number;
  subtotal: number;
  foodItem?: FoodItem;
}

export interface FoodOrder {
  id: string;
  orderNumber: string;
  employeeId: string;
  breakTime: string;
  status: FoodOrderStatus;
  totalAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  employee: Employee;
  items: FoodOrderItem[];
}

export interface FoodExpensesData {
  todayTotal: number;
  monthTotal: number;
  totalOrdersThisMonth: number;
  dailyBreakdown: Array<{
    date: string;
    day: string;
    total: number;
    ordersCount: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
  }>;
  recentOrders: FoodOrder[];
}

export interface FoodOrderStats {
  totalToday: number;
  pending: number;
  accepted: number;
  preparing: number;
  ready: number;
  delivered: number;
  cancelled: number;
  activeOrders: number;
  todaySales: number;
}

export interface FoodMonthlyReportData {
  year: number;
  month: number;
  totalSpend: number;
  totalOrders: number;
  uniqueEmployeesCount: number;
  avgOrderValue: number;
  departmentSummary: Array<{
    id: string;
    name: string;
    totalOrders: number;
    totalAmount: number;
  }>;
  employeeSummary: Array<{
    id: string;
    empId: string;
    name: string;
    department: string;
    totalOrders: number;
    totalAmount: number;
  }>;
  dailyTrend: Array<{
    date: string;
    totalAmount: number;
    totalOrders: number;
  }>;
  topItems: Array<{
    name: string;
    category: string;
    quantity: number;
    totalAmount: number;
  }>;
}

// ============================================================
// CHAT SYSTEM TYPES
// ============================================================

export type MessageType = 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'ORDER_ALERT' | 'LEAVE_NOTICE' | 'CALL_LOG' | 'AUDIO' | 'VIDEO';

export type CallType = 'AUDIO' | 'VIDEO';
export type CallStatus = 'INITIATED' | 'RINGING' | 'ONGOING' | 'COMPLETED' | 'MISSED' | 'REJECTED' | 'BUSY' | 'CANCELLED';

export interface ChatThemeConfig {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  primaryColor: string;
  bubbleColor: string;
  bgPattern: string; // 'none' | 'dots' | 'grid' | 'doodles' | 'subtle'
}

export interface ChatUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE' | 'FOOD_OWNER';
  name: string;
  designation?: string | null;
  department?: string | null;
  employeeId?: string | null;
  avatar?: string | null;
  isOnline?: boolean;
  lastSeenAt?: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: ChatUser;
  messageType: MessageType;
  messageContent: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  attachmentType?: string | null;
  duration?: number | null;
  createdAt: string;
  deliveredAt?: string | null;
  readAt?: string | null;
  isDeleted?: boolean;
  isPinned?: boolean;
  pinnedAt?: string | null;
  isForwarded?: boolean;
}

export interface ChatConversation {
  id: string;
  conversationType: 'DIRECT' | 'GROUP';
  title?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
  createdById?: string | null;
  groupTheme?: ChatThemeConfig | null;
  createdAt: string;
  updatedAt: string;
  otherUser: ChatUser | null;
  participants?: ChatUser[];
  lastMessage: ChatMessage | null;
  unreadCount: number;
}

export interface ChatNotification {
  id: string;
  messageId: string;
  conversationId: string;
  conversationType?: 'DIRECT' | 'GROUP';
  groupTitle?: string | null;
  sender: ChatUser;
  messageContent: string;
  messageType: MessageType;
  createdAt: string;
  isRead: boolean;
}

export interface CallRecord {
  id: string;
  conversationId: string;
  callerId: string;
  caller: ChatUser;
  callType: CallType;
  isGroup: boolean;
  status: CallStatus;
  startedAt: string;
  endedAt?: string | null;
  durationSeconds: number;
  conversation?: {
    id: string;
    title?: string | null;
    conversationType: 'DIRECT' | 'GROUP';
    avatarUrl?: string | null;
  };
  participants: Array<{
    id: string;
    status: string;
    joinedAt?: string | null;
    leftAt?: string | null;
    user: ChatUser;
  }>;
}

