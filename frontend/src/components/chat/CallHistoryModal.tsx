import React from 'react';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Video,
  Users,
  X,
  Clock,
  Calendar,
} from 'lucide-react';
import { useCallStore } from '../../store/callStore';
import { useAuthStore } from '../../store/authStore';
import { format, formatDistanceToNow } from 'date-fns';
import { CallRecord } from '../../types';

export default function CallHistoryModal() {
  const { user } = useAuthStore();
  const { showHistoryModal, setShowHistoryModal, callHistory, isLoadingHistory, initiateCall } =
    useCallStore();

  if (!showHistoryModal) return null;

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const getCallTypeIcon = (call: CallRecord) => {
    const isCaller = call.callerId === user?.id;

    if (call.status === 'MISSED' || call.status === 'REJECTED') {
      return <PhoneMissed className="w-4 h-4 text-red-500" />;
    }
    if (call.callType === 'VIDEO') {
      return <Video className="w-4 h-4 text-indigo-500" />;
    }
    if (isCaller) {
      return <PhoneOutgoing className="w-4 h-4 text-primary-500" />;
    }
    return <PhoneIncoming className="w-4 h-4 text-emerald-500" />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-100 text-primary-700">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Call History</h3>
              <p className="text-xs text-slate-500">Audio and video communications</p>
            </div>
          </div>

          <button
            onClick={() => setShowHistoryModal(false)}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Call List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
          {isLoadingHistory ? (
            <div className="p-8 text-center text-xs text-slate-400">
              <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading call logs...
            </div>
          ) : callHistory.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <Phone className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No call history recorded</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Calls initiated from the chat will appear here.
              </p>
            </div>
          ) : (
            callHistory.map((call) => {
              const isCaller = call.callerId === user?.id;
              const otherUser = isCaller
                ? call.participants.find((p) => p.user.id !== user?.id)?.user
                : call.caller;

              const displayName = call.isGroup
                ? call.conversation?.title || 'Group Meeting'
                : otherUser?.name || 'User';

              return (
                <div
                  key={call.id}
                  className="p-3 rounded-2xl hover:bg-slate-50 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-slate-100 shrink-0">
                      {getCallTypeIcon(call)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-900 truncate">
                          {displayName}
                        </span>
                        {call.isGroup && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-primary-100 text-primary-700">
                            <Users className="w-2.5 h-2.5" /> Group
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          {format(new Date(call.startedAt), 'MMM dd, hh:mm a')}
                        </span>
                        {call.durationSeconds > 0 && (
                          <span>• {formatDuration(call.durationSeconds)}</span>
                        )}
                        <span
                          className={`font-semibold ${
                            call.status === 'MISSED' || call.status === 'REJECTED'
                              ? 'text-red-500'
                              : 'text-emerald-600'
                          }`}
                        >
                          • {call.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Callback Button (if not group and otherUser exists) */}
                  {!call.isGroup && otherUser && (
                    <button
                      onClick={() => {
                        setShowHistoryModal(false);
                        initiateCall(call.conversationId, otherUser, call.callType);
                      }}
                      className="p-2 rounded-xl text-primary-600 hover:bg-primary-50 transition-colors shrink-0"
                      title={`Call ${otherUser.name}`}
                    >
                      {call.callType === 'VIDEO' ? (
                        <Video className="w-4 h-4" />
                      ) : (
                        <Phone className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/50 flex justify-end">
          <button
            onClick={() => setShowHistoryModal(false)}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
