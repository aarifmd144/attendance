import { useState, useEffect, useCallback } from 'react';
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  MessageSquare,
  X,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import api from '../../services/api';
import { LeaveRequest } from '../../types';
import { formatDate, getLeaveStatusColor, getLeaveTypeLabel } from '../../utils';
import toast from 'react-hot-toast';

export default function AdminLeave() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | ''>('PENDING');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Review modal state
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [adminComment, setAdminComment] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        ...(tab && { status: tab }),
      });
      const res = await api.get(`/leave?${params.toString()}`);
      setLeaves(res.data.data);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch {
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  }, [page, tab]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const handleOpenReview = (leave: LeaveRequest, action: 'APPROVED' | 'REJECTED') => {
    setSelectedLeave(leave);
    setActionType(action);
    setAdminComment('');
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeave) return;
    setReviewing(true);
    try {
      await api.patch(`/leave/${selectedLeave.id}/status`, {
        status: actionType,
        adminComment,
      });
      toast.success(`Leave request ${actionType.toLowerCase()}`);
      setSelectedLeave(null);
      fetchLeaves();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update leave status');
    } finally {
      setReviewing(false);
    }
  };

  const filtered = leaves.filter(
    (l) =>
      !search ||
      l.employee?.name.toLowerCase().includes(search.toLowerCase()) ||
      l.employee?.employeeId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Leave Requests
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Review, authorize, or reject employee leave applications
          </p>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full md:w-auto">
          {[
            { label: 'Pending', value: 'PENDING' },
            { label: 'Approved', value: 'APPROVED' },
            { label: 'Rejected', value: 'REJECTED' },
            { label: 'All', value: '' },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => {
                setTab(item.value as any);
                setPage(1);
              }}
              className={`flex-1 md:flex-initial px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === item.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75">
                <th className="table-header">Employee</th>
                <th className="table-header">Department</th>
                <th className="table-header">Leave Type</th>
                <th className="table-header">Duration</th>
                <th className="table-header">Reason</th>
                <th className="table-header">Applied On</th>
                <th className="table-header">Status</th>
                <th className="table-header text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <div className="w-7 h-7 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No leave requests found
                  </td>
                </tr>
              ) : (
                filtered.map((leave) => (
                  <tr key={leave.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="table-cell">
                      <div>
                        <p className="font-semibold text-slate-900">{leave.employee?.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {leave.employee?.employeeId}
                        </p>
                      </div>
                    </td>
                    <td className="table-cell font-medium text-slate-600">
                      {leave.employee?.department?.name || '-'}
                    </td>
                    <td className="table-cell font-medium text-slate-800">
                      {getLeaveTypeLabel(leave.leaveType)}
                    </td>
                    <td className="table-cell">
                      <div className="text-slate-800 font-medium">
                        {formatDate(leave.startDate)} → {formatDate(leave.endDate)}
                      </div>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        ({leave.totalDays} {leave.totalDays > 1 ? 'Days' : 'Day'})
                      </span>
                    </td>
                    <td className="table-cell max-w-xs truncate text-slate-600 italic">
                      "{leave.reason}"
                    </td>
                    <td className="table-cell text-slate-500">{formatDate(leave.createdAt)}</td>
                    <td className="table-cell">
                      <span className={`badge ${getLeaveStatusColor(leave.status)}`}>
                        {leave.status}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      {leave.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenReview(leave, 'APPROVED')}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-semibold transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleOpenReview(leave, 'REJECTED')}
                            className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg font-semibold transition-colors flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary py-1 px-3 text-xs"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary py-1 px-3 text-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Confirmation Modal */}
      {selectedLeave && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {actionType === 'APPROVED' ? 'Approve Leave Request' : 'Reject Leave Request'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  for {selectedLeave.employee?.name} ({selectedLeave.totalDays} days)
                </p>
              </div>
              <button
                onClick={() => setSelectedLeave(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1">
                <p className="font-semibold text-slate-800">
                  {getLeaveTypeLabel(selectedLeave.leaveType)}
                </p>
                <p className="text-slate-500">
                  {formatDate(selectedLeave.startDate)} to {formatDate(selectedLeave.endDate)}
                </p>
                <p className="text-slate-700 italic mt-1">"{selectedLeave.reason}"</p>
              </div>

              <div>
                <label className="label">Admin Notes / Comments (Optional)</label>
                <textarea
                  rows={3}
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  placeholder={
                    actionType === 'APPROVED'
                      ? 'e.g. Approved. Please ensure handover.'
                      : 'e.g. Rejecting due to insufficient project coverage.'
                  }
                  className="input text-xs"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedLeave(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewing}
                  className={actionType === 'APPROVED' ? 'btn-success text-xs' : 'btn-danger text-xs'}
                >
                  {reviewing
                    ? 'Submitting...'
                    : actionType === 'APPROVED'
                    ? 'Confirm Approval'
                    : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
