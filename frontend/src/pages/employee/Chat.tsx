import React from 'react';
import LiveChat from '../../components/chat/LiveChat';
import { MessageSquare, Users } from 'lucide-react';

export default function EmployeeChat() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Colleague & Cafeteria Chat</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              <Users className="w-3.5 h-3.5" /> Employee Portal
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Real-time chat with fellow team members, HR administrators, and cafeteria food services.
          </p>
        </div>
      </div>

      {/* Chat Component */}
      <LiveChat />
    </div>
  );
}
