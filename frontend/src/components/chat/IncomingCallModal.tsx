import React from 'react';
import { Phone, PhoneOff, Video, Users, User } from 'lucide-react';
import { useCallStore } from '../../store/callStore';

export default function IncomingCallModal() {
  const { incomingCallData, acceptIncomingCall, rejectIncomingCall } = useCallStore();

  if (!incomingCallData) return null;

  const { caller, callType, isGroup, groupTitle } = incomingCallData;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200/80 text-center relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Glow ambient background */}
        <div
          className={`absolute -top-16 -left-16 w-48 h-48 rounded-full blur-3xl opacity-30 ${
            callType === 'VIDEO' ? 'bg-indigo-500' : 'bg-emerald-500'
          }`}
        />
        <div
          className={`absolute -bottom-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-30 ${
            callType === 'VIDEO' ? 'bg-blue-500' : 'bg-emerald-400'
          }`}
        />

        {/* Header Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 mb-6">
          {isGroup ? (
            <>
              <Users className="w-3.5 h-3.5 text-primary-600" />
              <span>Incoming Group {callType === 'VIDEO' ? 'Video' : 'Audio'} Meeting</span>
            </>
          ) : callType === 'VIDEO' ? (
            <>
              <Video className="w-3.5 h-3.5 text-indigo-600" />
              <span>Incoming Video Call</span>
            </>
          ) : (
            <>
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Incoming Audio Call</span>
            </>
          )}
        </div>

        {/* Caller Avatar with animated pulsing rings */}
        <div className="relative mx-auto w-24 h-24 mb-4 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
          <div className="absolute -inset-2 rounded-full border-2 border-emerald-500/40 animate-pulse" />

          {caller.avatar ? (
            <img
              src={caller.avatar}
              alt={caller.name}
              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg relative z-10"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-2xl border-4 border-white shadow-lg relative z-10">
              {caller.name ? caller.name[0].toUpperCase() : 'U'}
            </div>
          )}
        </div>

        {/* Caller Name & Subtitle */}
        <h3 className="font-bold text-lg text-slate-900 mb-1 leading-tight">
          {caller.name}
        </h3>
        <p className="text-xs text-slate-500 mb-2">
          {isGroup ? (
            <span className="font-semibold text-primary-600">{groupTitle}</span>
          ) : (
            <span>{caller.department || caller.designation || caller.email}</span>
          )}
        </p>
        <p className="text-xs text-slate-400 italic mb-8">Ringing...</p>

        {/* Action Buttons: Decline & Accept */}
        <div className="flex items-center justify-center gap-6">
          {/* Reject */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={rejectIncomingCall}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/30 active:scale-95 transition-all"
              title="Decline Call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <span className="text-[11px] font-medium text-slate-600">Decline</span>
          </div>

          {/* Accept */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={acceptIncomingCall}
              className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 active:scale-95 transition-all animate-bounce"
              title="Accept Call"
            >
              {callType === 'VIDEO' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </button>
            <span className="text-[11px] font-medium text-slate-600">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}
