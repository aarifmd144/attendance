import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useChatStore } from './store/chatStore';
import ChatNotificationPopup from './components/chat/ChatNotificationPopup';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';

// Admin Pages
import AdminLayout from './components/layout/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AdminEmployees from './pages/admin/Employees';
import AdminAttendance from './pages/admin/Attendance';
import AdminLiveAttendance from './pages/admin/LiveAttendance';
import AdminLeave from './pages/admin/Leave';
import AdminCorrections from './pages/admin/Corrections';
import AdminReports from './pages/admin/Reports';
import AdminHolidays from './pages/admin/Holidays';
import AdminDepartments from './pages/admin/Departments';
import AdminNotifications from './pages/admin/Notifications';
import AdminAuditLogs from './pages/admin/AuditLogs';
import AdminSettings from './pages/admin/Settings';
import AdminFoodManagement from './pages/admin/FoodManagement';
import AdminChat from './pages/admin/Chat';

// Employee Pages
import EmployeeLayout from './components/layout/EmployeeLayout';
import EmployeeDashboard from './pages/employee/Dashboard';
import EmployeeAttendance from './pages/employee/Attendance';
import EmployeeLeave from './pages/employee/Leave';
import EmployeeNotifications from './pages/employee/Notifications';
import EmployeeFoodOrdering from './pages/employee/FoodOrdering';
import EmployeeChat from './pages/employee/Chat';

// Food Owner Pages
import FoodOwnerLayout from './components/layout/FoodOwnerLayout';
import FoodOwnerDashboard from './pages/food-owner/Dashboard';
import FoodOwnerMenu from './pages/food-owner/Menu';
import FoodOwnerHistory from './pages/food-owner/History';
import FoodOwnerChat from './pages/food-owner/Chat';
import FoodOwnerLeave from './pages/food-owner/Leave';

const getHomePath = (role?: string) => {
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'FOOD_OWNER') return '/food-owner/dashboard';
  return '/employee/dashboard';
};

// Protected Route Component
const ProtectedRoute = ({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: 'ADMIN' | 'EMPLOYEE' | 'FOOD_OWNER';
}) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role && user?.role !== role) {
    return <Navigate to={getHomePath(user?.role)} replace />;
  }
  return <>{children}</>;
};

export default function App() {
  const { isAuthenticated, user } = useAuthStore();
  const initChat = useChatStore((s) => s.initChat);

  // Initialize live chat & real-time notification socket when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      initChat();
    }
  }, [isAuthenticated, initChat]);

  return (
    <>
      <ChatNotificationPopup />
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to={getHomePath(user?.role)} replace /> : <Login />
          }
        />
        <Route
          path="/register"
          element={
            isAuthenticated ? <Navigate to={getHomePath(user?.role)} replace /> : <Register />
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="ADMIN">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="employees" element={<AdminEmployees />} />
          <Route path="attendance" element={<AdminAttendance />} />
          <Route path="live" element={<AdminLiveAttendance />} />
          <Route path="leave" element={<AdminLeave />} />
          <Route path="corrections" element={<AdminCorrections />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="food" element={<AdminFoodManagement />} />
          <Route path="chat" element={<AdminChat />} />
          <Route path="holidays" element={<AdminHolidays />} />
          <Route path="departments" element={<AdminDepartments />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="audit-logs" element={<AdminAuditLogs />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* Employee Routes */}
        <Route
          path="/employee"
          element={
            <ProtectedRoute role="EMPLOYEE">
              <EmployeeLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/employee/dashboard" replace />} />
          <Route path="dashboard" element={<EmployeeDashboard />} />
          <Route path="attendance" element={<EmployeeAttendance />} />
          <Route path="leave" element={<EmployeeLeave />} />
          <Route path="food" element={<EmployeeFoodOrdering />} />
          <Route path="chat" element={<EmployeeChat />} />
          <Route path="notifications" element={<EmployeeNotifications />} />
        </Route>

        {/* Food Owner Routes */}
        <Route
          path="/food-owner"
          element={
            <ProtectedRoute role="FOOD_OWNER">
              <FoodOwnerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/food-owner/dashboard" replace />} />
          <Route path="dashboard" element={<FoodOwnerDashboard />} />
          <Route path="menu" element={<FoodOwnerMenu />} />
          <Route path="leave" element={<FoodOwnerLeave />} />
          <Route path="history" element={<FoodOwnerHistory />} />
          <Route path="chat" element={<FoodOwnerChat />} />
        </Route>

        {/* Root redirect */}
        <Route
          path="/"
          element={
            isAuthenticated ? <Navigate to={getHomePath(user?.role)} replace /> : <Navigate to="/login" replace />
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
