import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  UtensilsCrossed,
  ChefHat,
  MenuSquare,
  History,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Radio,
  Bell,
  MessageSquare,
  CalendarOff,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function FoodOwnerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const chatUnread = useChatStore((s) => s.unreadTotal);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/food/orders/stats');
        setActiveCount(res.data.data?.activeOrders || 0);
      } catch {
        // silent fail
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
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
    {
      name: 'Live Incoming Orders',
      path: '/food-owner/dashboard',
      icon: Radio,
      badge: activeCount > 0 ? `${activeCount} Active` : 'Live',
      badgeColor: activeCount > 0 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    },
    {
      name: 'Menu & Availability',
      path: '/food-owner/menu',
      icon: MenuSquare,
    },
    {
      name: 'Leave Requests',
      path: '/food-owner/leave',
      icon: CalendarOff,
    },
    {
      name: 'Order History & Sales',
      path: '/food-owner/history',
      icon: History,
    },
    {
      name: 'Live Chat',
      path: '/food-owner/chat',
      icon: MessageSquare,
      count: chatUnread,
    },
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
            <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white font-bold shadow-lg shadow-amber-600/30">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight tracking-wide">WorkPulse</h1>
              <p className="text-[11px] font-medium text-amber-400">Food & Canteen Portal</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Canteen Mini Card */}
        <div className="px-4 py-4 border-b border-slate-800 bg-slate-900/40">
          <div className="bg-slate-800/80 rounded-xl p-3.5 border border-slate-700/60 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-base">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-slate-100 truncate">
                TechCorp Canteen
              </h2>
              <p className="text-[11px] font-medium text-amber-400 flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Food Owner Station</span>
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
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className={`border text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor || 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
                    {item.badge}
                  </span>
                )}
                {typeof (item as any).count === 'number' && (item as any).count > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {(item as any).count}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User profile & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-semibold text-sm">
              F
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-200 truncate">{user?.email}</p>
              <span className="text-[11px] font-medium text-amber-400">Food Owner</span>
            </div>
          </div>
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
            <div className="flex items-center text-sm text-slate-500">
              <span className="font-semibold text-slate-800">Canteen Desk</span>
              <ChevronRight className="w-4 h-4 mx-2 text-slate-400" />
              <span className="capitalize">
                {location.pathname.replace('/food-owner/', '').replace('-', ' ') || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>Live Order Monitor</span>
            </div>
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-700">{user?.email}</span>
              <span className="text-[10px] text-slate-400">Food Owner</span>
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
