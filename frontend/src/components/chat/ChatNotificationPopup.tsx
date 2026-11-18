import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, X, ExternalLink, Utensils, Shield, User } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { formatDistanceToNow } from 'date-fns';

export default function ChatNotificationPopup() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { popupNotifications, dismissPopupNotification, selectConversation } = useChatStore();

  if (popupNotifications.length === 0) return null;

  const handleOpenChat = async (conversationId: string, notifId: string) => {
    dismissPopupNotification(notifId);
    await selectConversation(conversationId);

    // Route based on role
    if (user?.role === 'ADMIN') {
      navigate(`/admin/chat?cid=${conversationId}`);
    } else if (user?.role === 'FOOD_OWNER') {
      navigate(`/food-owner/chat?cid=${conversationId}`);
    } else {
      navigate(`/employee/chat?cid=${conversationId}`);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary-100 text-primary-700">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      case 'FOOD_OWNER':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
            <Utensils className="w-3 h-3" /> Cafeteria
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">
            <User className="w-3 h-3" /> Employee
          </span>
        );
    }
  };

  return (
    <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {popupNotifications.map((notif) => (
        <div
          key={notif.id}
          className="pointer-events-auto bg-white rounded-xl shadow-2xl border border-slate-200/80 p-3.5 transition-all duration-300 animate-in slide-in-from-top-4 hover:shadow-primary-500/10"
        >
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="relative shrink-0">
              {notif.sender.avatar ? (
                <img
                  src={notif.sender.avatar}
                  alt={notif.sender.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                  {notif.sender.name ? notif.sender.name[0].toUpperCase() : 'U'}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="font-semibold text-xs text-slate-900 truncate">
                  {notif.groupTitle ? `${notif.groupTitle} • ${notif.sender.name}` : notif.sender.name}
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                </span>
              </div>

              <div className="flex items-center gap-1.5 mb-1.5">
                {getRoleBadge(notif.sender.role)}
                {notif.sender.department && (
                  <span className="text-[10px] text-slate-500 truncate">
                    • {notif.sender.department}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 rounded-lg p-2 border border-slate-100">
                {notif.messageType === 'ORDER_ALERT' ? (
                  <span className="text-amber-800 font-semibold line-clamp-2">
                    {notif.messageContent.split('\n').filter(Boolean).slice(0, 2).join(' • ')}
                  </span>
                ) : notif.messageType === 'IMAGE' ? (
                  <span className="text-slate-700 italic">📷 Sent an image attachment</span>
                ) : notif.messageType === 'DOCUMENT' ? (
                  <span className="text-slate-700 italic">📄 Sent a document</span>
                ) : (
                  notif.messageContent
                )}
              </p>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  onClick={() => dismissPopupNotification(notif.id)}
                  className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => handleOpenChat(notif.conversationId, notif.id)}
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Reply
                </button>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => dismissPopupNotification(notif.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
