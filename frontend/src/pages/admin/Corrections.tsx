import { useState, useEffect, useCallback } from 'react';
import {
  FileEdit,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  X,
  AlertCircle,
} from 'lucide-react';
import api from '../../services/api';
import { AttendanceCorrection } from '../../types';
import { formatDate, formatTime } from '../../utils';
import toast from 'react-hot-toast';

export default function AdminCorrections() {
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Review modal
  const [selectedItem, setSelectedItem] = useState<AttendanceCorrection | null>(null);
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [adminComment, setAdminComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCorrections = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        ...(statusFilter && { status: statusFilter }),
      });
      const res = await api.get(`/corrections?${params.toString()}`);
      setCorrections(res.data.data);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch {
      toast.error('Failed to load correction requests');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchCorrections();
  }, [fetchCorrections]);

  const handleOpenReview = (item: AttendanceCorrection, action: 'APPROVED' | 'REJECTED') => {
    setSelectedItem(item);
    setActionType(action);
    setAdminComment('');
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      await api.patch(`/corrections/${selectedItem.id}/status`, {
        status: actionType,
        adminComment,
      });
      toast.success(`Correction request ${actionType.toLowerCase()}`);
      setSelectedItem(null);
      fetchCorrections();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update correction');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="badge bg-emerald-100 text-emerald-800">Approved</span>;
      case 'REJECTED':
        return <span className="badge bg-rose-100 text-rose-800">Rejected</span>;
      default:
        return <span className="badge bg-amber-100 text-amber-800">Pending Review</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Attendance Corrections
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Review employee correction claims for missing check-ins or modified hours
        </p>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center justify-between">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="input w-48 text-xs"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75">
                <th className="table-header">Employee</th>
                <th className="table-header">Department</th>
                <th className="table-header">Target Date</th>
                <th className="table-header">Requested Entry</th>
                <th className="table-header">Requested Exit</th>
                <th className="table-header">Reason</th>
                <th className="table-header">Status</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <div className="w-7 h-7 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </td>
                </tr>
              ) : corrections.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <FileEdit className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No correction requests found
                  </td>
                </tr>
              ) : (
                corrections.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="table-cell font-semibold text-slate-900">
                      {item.employee?.name}
                      <span className="block text-[11px] text-slate-400 font-normal font-mono">
                        {item.employee?.employeeId}
                      </span>
                    </td>
                    <td className="table-cell font-medium text-slate-600">
                      {item.employee?.department?.name || '-'}
                    </td>
                    <td className="table-cell font-semibold text-slate-800">
                      {formatDate(item.date)}
                    </td>
                    <td className="table-cell text-emerald-700 font-medium">
                      {item.requestedEntry ? formatTime(item.requestedEntry) : '-'}
                    </td>
                    <td className="table-cell text-blue-700 font-medium">
                      {item.requestedExit ? formatTime(item.requestedExit) : '-'}
                    </td>
                    <td className="table-cell max-w-xs truncate text-slate-600 italic">
                      "{item.reason}"
                    </td>
                    <td className="table-cell">{getStatusBadge(item.status)}</td>
                    <td className="table-cell text-right">
                      {item.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenReview(item, 'APPROVED')}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-semibold transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleOpenReview(item, 'REJECTED')}
                            className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg font-semibold transition-colors flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Completed</span>
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

      {/* Review Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {actionType === 'APPROVED' ? 'Approve Correction' : 'Reject Correction'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Requested by {selectedItem.employee?.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1">
                <p className="font-semibold text-slate-800">
                  Target Date: {formatDate(selectedItem.date)}
                </p>
                <p className="text-slate-600">
                  Entry: {selectedItem.requestedEntry ? formatTime(selectedItem.requestedEntry) : 'No change'} | 
                  Exit: {selectedItem.requestedExit ? formatTime(selectedItem.requestedExit) : 'No change'}
                </p>
                <p className="text-slate-700 italic mt-1">"{selectedItem.reason}"</p>
              </div>

              <div>
                <label className="label">Admin Feedback Note</label>
                <textarea
                  rows={3}
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  placeholder="Optional review note..."
                  className="input text-xs"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={actionType === 'APPROVED' ? 'btn-success text-xs' : 'btn-danger text-xs'}
                >
                  {submitting
                    ? 'Processing...'
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
