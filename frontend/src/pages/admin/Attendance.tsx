import { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck,
  Search,
  Filter,
  Download,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  Clock,
  Plus,
  X,
} from 'lucide-react';
import api from '../../services/api';
import { Attendance, Department } from '../../types';
import { formatDate, formatTime, formatMinutes, getStatusColor, getStatusLabel } from '../../utils';
import toast from 'react-hot-toast';

export default function AdminAttendance() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');
  const [isLate, setIsLate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Manual Attendance Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    date: new Date().toISOString().slice(0, 10),
    entryTime: '09:00',
    exitTime: '18:00',
    status: 'PRESENT',
    notes: '',
  });

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        ...(search && { search }),
        ...(departmentId && { departmentId }),
        ...(date && { date }),
        ...(status && { status }),
        ...(isLate && { isLate }),
      });
      const res = await api.get(`/attendance?${params.toString()}`);
      setRecords(res.data.data);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch {
      toast.error('Failed to load attendance logs');
    } finally {
      setLoading(false);
    }
  }, [page, search, departmentId, date, status, isLate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptsRes, empsRes] = await Promise.all([
          api.get('/departments'),
          api.get('/employees?limit=100'),
        ]);
        setDepartments(deptsRes.data.data);
        setEmployees(empsRes.data.data || []);
      } catch {
        // silent fail
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handleExport = async (format: 'excel' | 'csv') => {
    try {
      const params = new URLSearchParams({
        format,
        ...(departmentId && { departmentId }),
        ...(date && { date }),
        ...(status && { status }),
      });
      const response = await api.get(`/reports/export?${params.toString()}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: format === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_report_${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Export failed');
    }
  };

  const handleCreateAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId || !formData.date) {
      toast.error('Please select an employee and date');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        employeeId: formData.employeeId,
        date: formData.date,
        status: formData.status,
        notes: formData.notes,
      };
      if (formData.entryTime) {
        payload.entryTime = `${formData.date}T${formData.entryTime}:00`;
      }
      if (formData.exitTime) {
        payload.exitTime = `${formData.date}T${formData.exitTime}:00`;
      }
      await api.post('/attendance', payload);
      toast.success('Attendance recorded successfully!');
      setShowAddModal(false);
      setFormData({
        employeeId: '',
        date: new Date().toISOString().slice(0, 10),
        entryTime: '09:00',
        exitTime: '18:00',
        status: 'PRESENT',
        notes: '',
      });
      fetchAttendance();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record attendance');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Attendance Records
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Complete company attendance logs with break calculations & overtime
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2 text-xs font-semibold py-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Enter Attendance
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="btn-secondary flex items-center gap-2 text-xs font-semibold py-2"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="btn-secondary flex items-center gap-2 text-xs font-semibold py-2 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel Export
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input pl-10 text-xs"
          />
        </div>

        <div>
          <select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setPage(1);
            }}
            className="input text-xs"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(1);
            }}
            className="input text-xs"
          />
        </div>

        <div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="input text-xs"
          >
            <option value="">All Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
            <option value="LATE">Late</option>
            <option value="HALF_DAY">Half Day</option>
            <option value="ON_LEAVE">On Leave</option>
          </select>
        </div>

        <div>
          <select
            value={isLate}
            onChange={(e) => {
              setIsLate(e.target.value);
              setPage(1);
            }}
            className="input text-xs"
          >
            <option value="">Punctuality Filter</option>
            <option value="true">Late Arrivals Only</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75">
                <th className="table-header">ID</th>
                <th className="table-header">Employee</th>
                <th className="table-header">Department</th>
                <th className="table-header">Date</th>
                <th className="table-header">Entry</th>
                <th className="table-header">Break Interval</th>
                <th className="table-header">Total Break</th>
                <th className="table-header">Exit</th>
                <th className="table-header">Working Hours</th>
                <th className="table-header">Overtime</th>
                <th className="table-header">Status</th>
                <th className="table-header">Punctuality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={12} className="text-center py-12">
                    <div className="w-7 h-7 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-slate-400">
                    <CalendarCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No attendance records found
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const firstBreak = r.breaks?.[0];
                  const lastBreak = r.breaks?.[r.breaks.length - 1];
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="table-cell font-mono font-semibold text-primary-600">
                        {r.employee?.employeeId}
                      </td>
                      <td className="table-cell font-semibold text-slate-900">
                        {r.employee?.name || '-'}
                      </td>
                      <td className="table-cell text-slate-600">
                        {r.employee?.department?.name || '-'}
                      </td>
                      <td className="table-cell text-slate-700 font-medium">{formatDate(r.date)}</td>
                      <td className="table-cell font-medium text-slate-800">
                        {r.entryTime ? formatTime(r.entryTime) : '-'}
                      </td>
                      <td className="table-cell text-slate-500">
                        {firstBreak?.startTime
                          ? `${formatTime(firstBreak.startTime)} - ${
                              lastBreak?.endTime ? formatTime(lastBreak.endTime) : 'In Progress'
                            }`
                          : '-'}
                      </td>
                      <td className="table-cell text-amber-600 font-medium">
                        {formatMinutes(r.totalBreakMinutes || 0)}
                      </td>
                      <td className="table-cell font-medium text-slate-800">
                        {r.exitTime ? (
                          formatTime(r.exitTime)
                        ) : r.entryTime ? (
                          <span className="text-rose-500 font-semibold text-[11px]">Active / Missing</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="table-cell font-bold text-slate-900">
                        {formatMinutes(r.totalWorkMinutes || 0)}
                      </td>
                      <td className="table-cell font-medium">
                        {r.overtimeMinutes && r.overtimeMinutes > 0 ? (
                          <span className="text-purple-600">+{formatMinutes(r.overtimeMinutes)}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${getStatusColor(r.status)}`}>
                          {getStatusLabel(r.status)}
                        </span>
                      </td>
                      <td className="table-cell">
                        {r.isLate ? (
                          <span className="badge bg-amber-100 text-amber-800 font-medium">
                            Late ({r.lateMinutes || 0}m)
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-medium">On Time</span>
                        )}
                      </td>
                    </tr>
                  );
                })
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

      {/* Enter Attendance Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <h3 className="font-bold text-slate-900 text-base">Enter Employee Attendance</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAttendance} className="p-6 space-y-4 text-xs">
              <div>
                <label className="label">Employee</label>
                <select
                  required
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="input"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employeeId} - {emp.name} ({emp.department?.name || 'No Dept'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Attendance Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Entry Time</label>
                  <input
                    type="time"
                    value={formData.entryTime}
                    onChange={(e) => setFormData({ ...formData, entryTime: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Exit Time</label>
                  <input
                    type="time"
                    value={formData.exitTime}
                    onChange={(e) => setFormData({ ...formData, exitTime: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="input"
                >
                  <option value="PRESENT">Present</option>
                  <option value="LATE">Late</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="ABSENT">Absent</option>
                  <option value="ON_LEAVE">On Leave</option>
                </select>
              </div>

              <div>
                <label className="label">Notes / Remarks</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input"
                  placeholder="Optional admin notes..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary flex-1 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex-1 py-2"
                >
                  {submitting ? 'Saving...' : 'Record Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
