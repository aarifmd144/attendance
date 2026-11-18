import { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  CalendarOff,
  X,
  FileText,
  UtensilsCrossed,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { LeaveRequest } from '../../types';
import { formatDate, getLeaveStatusColor, getLeaveTypeLabel } from '../../utils';

const FOOD_LEAVE_TYPES = [
  { value: 'OTHER', label: 'Kitchen Maintenance & Deep Cleaning' },
  { value: 'CASUAL', label: 'Cafeteria Staff Casual Leave' },
  { value: 'EMERGENCY', label: 'Kitchen / Equipment Emergency' },
  { value: 'PERMISSION', label: 'Short Supply / Counter Maintenance' },
  { value: 'SICK', label: 'Staff Medical Leave' },
];

export default function FoodOwnerLeave() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  const [form, setForm] = useState({
    leaveType: 'OTHER',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await api.get('/leave');
      setLeaves(res.data.data || []);
    } catch (err: any) {
      toast.error('Failed to load leave history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const calcDays = () => {
    if (!form.startDate || !form.endDate) return 0;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (end < start) return 0;
    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      count++;
    }
    return count;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const days = calcDays();
    if (days === 0) {
      toast.error('Invalid date range. Start date must be before or equal to end date.');
      return;
    }
    if (form.reason.trim().length < 10) {
      toast.error('Please provide a detailed reason (minimum 10 characters)');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/leave', {
        ...form,
        totalDays: days,
      });
      toast.success('Cafeteria leave request submitted! Notifications and chat alerts sent.');
      setShowModal(false);
      setForm({ leaveType: 'OTHER', startDate: '', endDate: '', reason: '' });
      await fetchLeaves();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this leave request?')) return;
    try {
      await api.delete(`/leave/${id}`);
      toast.success('Leave request cancelled');
      await fetchLeaves();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to cancel');
    }
  };

  const filteredLeaves = leaves.filter((l) => activeTab === 'ALL' || l.status === activeTab);

  const tabCounts = {
    ALL: leaves.length,
    PENDING: leaves.filter((l) => l.status === 'PENDING').length,
    APPROVED: leaves.filter((l) => l.status === 'APPROVED').length,
    REJECTED: leaves.filter((l) => l.status === 'REJECTED').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Cafeteria Leave Notices
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              Food Operator
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Request kitchen leaves or service closures. Automatically notifies Management and Employees.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold text-sm shadow-sm transition-all hover:shadow"
        >
          <Plus className="w-4 h-4" />
          <span>Request Leave / Closure</span>
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <p className="font-semibold mb-0.5">Automated Broadcast Workflow</p>
          <p>
            When you submit a leave request, system notifications are automatically dispatched to both
            <strong> Administrators</strong> and <strong>All Employees</strong>, and an official notice
            is published in the corporate chat box so staff can prepare meal arrangements in advance.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === tab
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>{tab === 'ALL' ? 'All Requests' : tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === tab ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {tabCounts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Leave Requests Grid / Cards */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading leave records...
        </div>
      ) : filteredLeaves.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <CalendarOff className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">No Leave Requests Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
            You currently have no {activeTab !== 'ALL' ? activeTab.toLowerCase() : ''} leave requests on file.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Apply For Leave</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeaves.map((leave) => {
            const isPending = leave.status === 'PENDING';
            const isApproved = leave.status === 'APPROVED';
            const isRejected = leave.status === 'REJECTED';

            return (
              <div
                key={leave.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                      {getLeaveTypeLabel(leave.leaveType)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        isApproved
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : isRejected
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {isApproved && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {isRejected && <XCircle className="w-3.5 h-3.5" />}
                      {isPending && <Clock className="w-3.5 h-3.5" />}
                      <span>{leave.status}</span>
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-semibold">
                        {formatDate(leave.startDate)} &rarr; {formatDate(leave.endDate)}
                      </span>
                      <span className="text-slate-400 text-[11px]">({leave.totalDays} days)</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed">
                      <p className="font-semibold text-slate-800 text-[11px] mb-1">Reason / Description:</p>
                      <p>{leave.reason}</p>
                    </div>

                    {leave.adminComment && (
                      <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900">
                        <span className="font-bold">Admin Remark: </span>
                        {leave.adminComment}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Applied on {formatDate(leave.createdAt)}</span>
                  {isPending && (
                    <button
                      onClick={() => handleCancel(leave.id)}
                      className="text-red-600 hover:text-red-700 font-semibold hover:underline"
                    >
                      Cancel Request
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Application Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-amber-50/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-600 text-white shadow-sm">
                  <UtensilsCrossed className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Apply for Cafeteria Leave</h3>
                  <p className="text-xs text-slate-500">
                    Schedule kitchen downtime, holiday, or sanitation
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Leave / Closure Type
                </label>
                <select
                  value={form.leaveType}
                  onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                >
                  {FOOD_LEAVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                  />
                </div>
              </div>

              {form.startDate && form.endDate && (
                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 flex items-center justify-between text-xs text-amber-900">
                  <span className="font-semibold">Calculated Duration:</span>
                  <span className="font-extrabold text-sm">{calcDays()} Day(s)</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Detailed Reason & Closure Notice
                </label>
                <textarea
                  required
                  rows={3}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Explain why the cafeteria is taking leave (e.g. kitchen equipment maintenance, annual deep sanitation, staff holiday)..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none font-medium leading-relaxed"
                />
                <p className="text-[11px] text-slate-400 mt-1">Minimum 10 characters required.</p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl shadow-sm transition-all"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit & Notify All</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
