import { useState, useEffect, useCallback } from 'react';
import {
  History,
  Search,
  Filter,
  ShieldCheck,
  User,
  Calendar,
  Layers,
} from 'lucide-react';
import api from '../../services/api';
import { AuditLog } from '../../types';
import { formatDate, formatDateTime, timeAgo } from '../../utils';
import toast from 'react-hot-toast';

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(actionFilter && { action: actionFilter }),
      });
      const res = await api.get(`/audit-logs?${params.toString()}`);
      setLogs(res.data.data);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const getActionBadgeColor = (action: string) => {
    if (action.includes('ADDED') || action.includes('APPROVED')) return 'bg-emerald-100 text-emerald-800';
    if (action.includes('DELETED') || action.includes('REJECTED')) return 'bg-rose-100 text-rose-800';
    if (action.includes('MODIFIED') || action.includes('UPDATED')) return 'bg-amber-100 text-amber-800';
    if (action.includes('LOGIN') || action.includes('LOGOUT')) return 'bg-blue-100 text-blue-800';
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          System Audit Logs
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Complete, tamper-evident chronological record of administrative actions and attendance events
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center justify-between">
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="input w-64 text-xs"
        >
          <option value="">All Action Types</option>
          <option value="EMPLOYEE_ADDED">Employee Added</option>
          <option value="EMPLOYEE_UPDATED">Employee Updated</option>
          <option value="EMPLOYEE_DELETED">Employee Deleted</option>
          <option value="EMPLOYEE_STATUS_CHANGED">Employee Status Changed</option>
          <option value="ATTENDANCE_MODIFIED">Attendance Modified</option>
          <option value="ATTENDANCE_ENTRY_MARKED">Attendance Entry</option>
          <option value="ATTENDANCE_EXIT_MARKED">Attendance Exit</option>
          <option value="LEAVE_APPROVED">Leave Approved</option>
          <option value="LEAVE_REJECTED">Leave Rejected</option>
          <option value="CORRECTION_APPROVED">Correction Approved</option>
          <option value="SETTINGS_UPDATED">Settings Updated</option>
          <option value="USER_LOGIN">User Login</option>
          <option value="USER_REGISTERED">User Registered</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75">
                <th className="table-header">Timestamp</th>
                <th className="table-header">Action</th>
                <th className="table-header">Target Entity</th>
                <th className="table-header">Description</th>
                <th className="table-header">Initiated By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <div className="w-7 h-7 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No audit records found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="table-cell whitespace-nowrap text-slate-500 font-mono">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="table-cell whitespace-nowrap">
                      <span className={`badge font-semibold ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="table-cell font-medium text-slate-700">
                      {log.entityType || '-'}
                    </td>
                    <td className="table-cell text-slate-800 max-w-md">
                      {log.description}
                    </td>
                    <td className="table-cell text-slate-600 font-medium">
                      {log.admin?.employee?.name || log.admin?.email || log.user?.employee?.name || log.user?.email || 'System'}
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
    </div>
  );
}
