import { useState, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import api from '../../services/api';
import { Notification } from '../../types';
import { timeAgo } from '../../utils';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const typeConfig: Record<string, { icon: any; bg: string; iconColor: string }> = {
  INFO: { icon: Info, bg: 'bg-blue-50', iconColor: 'text-blue-500' },
  SUCCESS: { icon: CheckCircle, bg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
  WARNING: { icon: AlertTriangle, bg: 'bg-amber-50', iconColor: 'text-amber-500' },
  ERROR: { icon: XCircle, bg: 'bg-rose-50', iconColor: 'text-rose-500' },
};

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications?limit=50');
      setNotifications(res.data.data);
      setUnreadCount(res.data.unreadCount || 0);
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/all/read');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to update notifications');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Notifications & Alerts
            </h1>
            {unreadCount > 0 && (
              <span className="badge bg-rose-500 text-white font-bold text-xs">
                {unreadCount} Unread
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-1">
            System notices, leave alerts, late check-in reports, and requests
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="btn-secondary flex items-center gap-2 text-xs font-semibold py-2 self-start sm:self-auto"
          >
            <CheckCheck className="w-4 h-4 text-primary-600" />
            Mark All Read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden divide-y divide-slate-100">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
            You're all caught up! No notifications.
          </div>
        ) : (
          notifications.map((notif) => {
            const conf = typeConfig[notif.type] || typeConfig.INFO;
            const Icon = conf.icon;
            return (
              <div
                key={notif.id}
                onClick={() => !notif.isRead && markRead(notif.id)}
                className={`p-4 sm:p-5 flex items-start gap-4 transition-colors cursor-pointer hover:bg-slate-50/80 ${
                  !notif.isRead ? 'bg-primary-50/25' : ''
                }`}
              >
                <div className={`p-2.5 rounded-xl ${conf.bg} ${conf.iconColor} shrink-0 mt-0.5`}>
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className={`text-sm ${
                        !notif.isRead ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
                      }`}
                    >
                      {notif.title}
                    </h4>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">
                      {timeAgo(notif.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>

                  {notif.link && (
                    <Link
                      to={notif.link}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 mt-2"
                    >
                      View Details
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>

                {!notif.isRead && (
                  <span className="w-2.5 h-2.5 rounded-full bg-primary-600 shrink-0 mt-2"></span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
