import React from 'react';
import LiveChat from '../../components/chat/LiveChat';
import { MessageSquare, ShieldCheck } from 'lucide-react';

export default function AdminChat() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Live Communication Center</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-700">
              <ShieldCheck className="w-3.5 h-3.5" /> Admin Secure
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Real-time multi-role live chat with employees, cafeteria food services, and administrators.
          </p>
        </div>
      </div>

      {/* Chat Component */}
      <LiveChat />
    </div>
  );
}
