import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarClock,
  Bell,
  LogOut,
  Menu,
  X,
  User,
  Clock,
  Building,
  UtensilsCrossed,
  MessageSquare,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function EmployeeLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const chatUnread = useChatStore((s) => s.unreadTotal);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const employee = user?.employee;

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await api.get('/notifications?limit=1');
        setUnreadCount(res.data.unreadCount || 0);
      } catch {
        // silent fail
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/employee/dashboard', icon: LayoutDashboard },
    { name: 'Attendance History', path: '/employee/attendance', icon: CalendarCheck },
    { name: 'Leave Management', path: '/employee/leave', icon: CalendarClock },
    { name: 'Food & Refreshments', path: '/employee/food', icon: UtensilsCrossed },
    { name: 'Live Chat', path: '/employee/chat', icon: MessageSquare, count: chatUnread },
    { name: 'Notifications', path: '/employee/notifications', icon: Bell, count: unreadCount },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 text-slate-100 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white font-bold shadow-lg shadow-primary-600/30">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight tracking-wide">WorkPulse</h1>
              <p className="text-[11px] font-medium text-slate-400">Employee Workspace</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Employee Mini Card */}
        <div className="px-4 py-4 border-b border-slate-800 bg-slate-900/40">
          <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/60 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary-600/20 text-primary-400 border border-primary-500/30 flex items-center justify-center font-bold text-base overflow-hidden">
              {employee?.profilePhoto ? (
                <img src={employee.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                employee?.name ? employee.name[0].toUpperCase() : 'E'
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-slate-100 truncate">
                {employee?.name || user?.email}
              </h2>
              <p className="text-[11px] font-medium text-primary-400 flex items-center gap-1 mt-0.5">
                <span>{employee?.employeeId || 'EMP'}</span>
                <span>•</span>
                <span className="truncate">{employee?.designation || 'Staff'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5 custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-600/25 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </div>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="bg-primary-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {item.count}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User profile & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-72 min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200/80 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-semibold text-slate-800 text-sm">
              Attendance Portal
            </span>
          </div>

          <div className="flex items-center gap-3">
            <NavLink
              to="/employee/notifications"
              className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white"></span>
              )}
            </NavLink>
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-700">{employee?.name || user?.email}</span>
              <span className="text-[10px] text-slate-400">{employee?.employeeId}</span>
            </div>
          </div>
        </header>

        {/* Page Outlet */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
