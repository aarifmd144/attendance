import React from 'react';
import LiveChat from '../../components/chat/LiveChat';
import { ChefHat, UtensilsCrossed } from 'lucide-react';

export default function FoodOwnerChat() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cafeteria Customer Chat</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
              <ChefHat className="w-3.5 h-3.5" /> Food & Orders
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Real-time messaging with ordering employees and administrators. Send order ready alerts and pickup notifications.
          </p>
        </div>
      </div>

      {/* Chat Component */}
      <LiveChat />
    </div>
  );
}
