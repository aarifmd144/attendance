import { useState, useEffect } from 'react';
import { Calendar, Search, CheckCircle, Clock, ShoppingBag, ArrowUpDown } from 'lucide-react';
import api from '../../services/api';
import { FoodOrder } from '../../types';
import toast from 'react-hot-toast';

export default function FoodOwnerHistory() {
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/food/orders/incoming', {
        params: {
          date: selectedDate || 'all',
          search: search || undefined,
          status: 'ALL',
        },
      });
      setOrders(res.data.data || []);
    } catch {
      toast.error('Failed to load order history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [selectedDate, search]);

  const totalRevenue = orders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const deliveredCount = orders.filter((o) => o.status === 'DELIVERED').length;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Order History & Sales
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Review completed orders, employee billing records, and canteen revenue.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-1.5 border border-slate-200/80">
              <Calendar className="w-4 h-4 text-slate-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
              />
            </div>
            <button
              onClick={() => setSelectedDate('')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                !selectedDate
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Orders
            </span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{orders.length}</p>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-xl p-4">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Delivered Successfully
            </span>
            <p className="text-2xl font-extrabold text-emerald-800 mt-1">{deliveredCount}</p>
          </div>

          <div className="bg-amber-50/70 border border-amber-200/70 rounded-xl p-4">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Revenue Total
            </span>
            <p className="text-2xl font-extrabold text-amber-800 mt-1">
              ₹{totalRevenue.toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-900">Recorded Orders</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by order #, emp name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Break Slot</th>
                <th className="py-3 px-4">Items Summary</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No orders recorded for this selection.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {o.orderNumber}
                      <span className="block text-[10px] font-normal text-slate-400">
                        {new Date(o.createdAt).toLocaleDateString()} {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 block">{o.employee?.name}</span>
                      <span className="text-[11px] text-primary-600 font-mono">{o.employee?.employeeId}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {o.employee?.department?.name || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                        {o.breakTime}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                      {o.items.map((i) => `${i.itemName} (x${i.quantity})`).join(', ')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          o.status === 'DELIVERED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : o.status === 'CANCELLED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      ₹{o.totalAmount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
