import { useState, useEffect } from 'react';
import { Bell, CheckCheck, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import api from '../../services/api';
import { Notification } from '../../types';
import { timeAgo } from '../../utils';
import toast from 'react-hot-toast';

const typeConfig: Record<string, { icon: React.ReactNode; bg: string; iconColor: string }> = {
  INFO: { icon: <Info className="w-5 h-5" />, bg: 'bg-blue-50', iconColor: 'text-blue-500' },
  SUCCESS: { icon: <CheckCircle className="w-5 h-5" />, bg: 'bg-green-50', iconColor: 'text-green-500' },
  WARNING: { icon: <AlertTriangle className="w-5 h-5" />, bg: 'bg-yellow-50', iconColor: 'text-yellow-500' },
  ERROR: { icon: <XCircle className="w-5 h-5" />, bg: 'bg-red-50', iconColor: 'text-red-500' },
};

export default function EmployeeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications?limit=50');
      setNotifications(res.data.data);
      setUnreadCount(res.data.unreadCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) { console.error(err); }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/all/read');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (err) { console.error(err); }
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bell className="w-6 h-6" />
          Notifications
          {unreadCount > 0 && (
            <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-secondary flex items-center gap-2 text-sm">
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      <div className="card">
        {notifications.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map(notif => {
              const config = typeConfig[notif.type] || typeConfig.INFO;
              return (
                <div
                  key={notif.id}
                  onClick={() => !notif.isRead && markRead(notif.id)}
                  className={`flex gap-4 p-4 transition-colors cursor-pointer hover:bg-gray-50 ${!notif.isRead ? 'bg-primary-50/30' : ''}`}
                >
                  <div className={`p-2 rounded-lg ${config.bg} ${config.iconColor} flex-shrink-0 h-fit`}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-medium text-gray-900 ${!notif.isRead ? 'font-semibold' : ''}`}>
                        {notif.title}
                      </p>
                      {!notif.isRead && (
                        <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{notif.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(notif.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
