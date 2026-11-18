import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { FileText, Plus, X, Clock, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { LeaveRequest } from '../../types';
import { formatDate, getLeaveStatusColor, getLeaveTypeLabel } from '../../utils';

const LEAVE_TYPES = [
  { value: 'CASUAL', label: 'Casual Leave' },
  { value: 'SICK', label: 'Sick Leave' },
  { value: 'EMERGENCY', label: 'Emergency Leave' },
  { value: 'PERMISSION', label: 'Permission' },
  { value: 'OTHER', label: 'Other' },
];

export default function EmployeeLeave() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  const [form, setForm] = useState({
    leaveType: 'CASUAL',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const fetchLeaves = async () => {
    try {
      const res = await api.get('/leave');
      setLeaves(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeaves(); }, []);

  const calcDays = () => {
    if (!form.startDate || !form.endDate) return 0;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (end < start) return 0;
    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const days = calcDays();
    if (days === 0) { toast.error('Invalid date range'); return; }
    if (form.reason.length < 10) { toast.error('Please provide a more detailed reason'); return; }

    setSubmitting(true);
    try {
      await api.post('/leave', { ...form, totalDays: days });
      toast.success('Leave request submitted successfully!');
      setShowModal(false);
      setForm({ leaveType: 'CASUAL', startDate: '', endDate: '', reason: '' });
      await fetchLeaves();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancel this leave request?')) return;
    try {
      await api.delete(`/leave/${id}`);
      toast.success('Leave request cancelled');
      await fetchLeaves();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
    }
  };

  const filteredLeaves = leaves.filter(l => activeTab === 'ALL' || l.status === activeTab);

  const tabs = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const;
  const tabCounts = {
    ALL: leaves.length,
    PENDING: leaves.filter(l => l.status === 'PENDING').length,
    APPROVED: leaves.filter(l => l.status === 'APPROVED').length,
    REJECTED: leaves.filter(l => l.status === 'REJECTED').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Apply Leave
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Applied', value: leaves.length, icon: FileText, color: 'bg-gray-100 text-gray-600' },
          { label: 'Pending', value: tabCounts.PENDING, icon: Clock, color: 'bg-yellow-100 text-yellow-600' },
          { label: 'Approved', value: tabCounts.APPROVED, icon: CheckCircle, color: 'bg-green-100 text-green-600' },
          { label: 'Rejected', value: tabCounts.REJECTED, icon: XCircle, color: 'bg-red-100 text-red-600' },
        ].map(stat => (
          <div key={stat.label} className="card">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative -mb-px
                ${activeTab === tab
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              {tabCounts[tab] > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${activeTab === tab ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'}`}>
                  {tabCounts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No leave requests</p>
            <p className="text-sm mt-1">Click "Apply Leave" to submit a new request</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLeaves.map(leave => (
              <div key={leave.id} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-gray-900">{getLeaveTypeLabel(leave.leaveType)}</span>
                      <span className={`badge ${getLeaveStatusColor(leave.status)}`}>
                        {leave.status}
                      </span>
                      <span className="text-sm text-gray-500">{leave.totalDays} day{leave.totalDays > 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatDate(leave.startDate)} {leave.totalDays > 1 ? `→ ${formatDate(leave.endDate)}` : ''}
                    </p>
                    <p className="text-sm text-gray-500 mt-2 italic">"{leave.reason}"</p>
                    {leave.adminComment && (
                      <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-600 font-medium">Admin Comment:</p>
                        <p className="text-sm text-blue-800">{leave.adminComment}</p>
                      </div>
                    )}
                  </div>
                  {leave.status === 'PENDING' && (
                    <button
                      onClick={() => handleCancel(leave.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="Cancel Request"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-3">Applied on {formatDate(leave.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Apply Leave Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Apply for Leave</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Leave Type</label>
                <select
                  value={form.leaveType}
                  onChange={e => setForm({ ...form, leaveType: e.target.value })}
                  className="input"
                >
                  {LEAVE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    onChange={e => setForm({ ...form, startDate: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    min={form.startDate || format(new Date(), 'yyyy-MM-dd')}
                    onChange={e => setForm({ ...form, endDate: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              {form.startDate && form.endDate && calcDays() > 0 && (
                <div className="bg-primary-50 text-primary-700 text-sm px-3 py-2 rounded-lg">
                  📅 {calcDays()} working day{calcDays() > 1 ? 's' : ''} of leave
                </div>
              )}

              <div>
                <label className="label">Reason</label>
                <textarea
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  className="input resize-none"
                  rows={3}
                  placeholder="Please provide a detailed reason (min. 10 characters)"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">{form.reason.length}/10 minimum characters</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
