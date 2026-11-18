import { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Filter,
  Users,
  Building2,
  Clock,
  TrendingUp,
} from 'lucide-react';
import api from '../../services/api';
import { Attendance, Department, Employee } from '../../types';
import { formatDate, formatTime, formatMinutes, getStatusColor, getStatusLabel } from '../../utils';
import toast from 'react-hot-toast';

export default function AdminReports() {
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | 'employee'>('monthly');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedEmp, setSelectedEmp] = useState('');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const [dRes, eRes] = await Promise.all([
          api.get('/departments'),
          api.get('/employees?limit=100'),
        ]);
        setDepartments(dRes.data.data);
        setEmployees(eRes.data.data);
      } catch {
        // silent
      }
    };
    fetchDropdowns();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      if (reportType === 'daily') {
        endpoint = `/reports/daily?date=${selectedDate}${selectedDept ? `&departmentId=${selectedDept}` : ''}`;
      } else if (reportType === 'weekly') {
        endpoint = `/reports/weekly?date=${selectedDate}`;
      } else if (reportType === 'monthly') {
        endpoint = `/reports/monthly?year=${selectedYear}&month=${selectedMonth}${
          selectedDept ? `&departmentId=${selectedDept}` : ''
        }${selectedEmp ? `&employeeId=${selectedEmp}` : ''}`;
      } else if (reportType === 'employee') {
        if (!selectedEmp && employees.length > 0) {
          setSelectedEmp(employees[0].id);
        }
        const empId = selectedEmp || employees[0]?.id;
        if (empId) {
          endpoint = `/reports/employee/${empId}?year=${selectedYear}&month=${selectedMonth}`;
        }
      }

      if (endpoint) {
        const res = await api.get(endpoint);
        setRecords(res.data.data || []);
        setStats(res.data.stats || null);
      }
    } catch {
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedDate, selectedYear, selectedMonth, selectedDept, selectedEmp]);

  const handleExport = async (format: 'excel' | 'csv') => {
    try {
      const params = new URLSearchParams({
        format,
        ...(selectedDept && { departmentId: selectedDept }),
        ...(selectedEmp && { employeeId: selectedEmp }),
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
      a.download = `attendance_report_${reportType}_${new Date().toISOString().slice(0, 10)}.${
        format === 'excel' ? 'xlsx' : 'csv'
      }`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Attendance Reports
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Aggregate analytical reports, employee work hour audits, and spreadsheet exports
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleExport('csv')}
            className="btn-secondary flex items-center gap-2 text-xs font-semibold py-2"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="btn-primary flex items-center gap-2 text-xs font-semibold py-2 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full md:w-auto">
          {[
            { id: 'monthly', label: 'Monthly Report' },
            { id: 'daily', label: 'Daily Report' },
            { id: 'weekly', label: 'Weekly Summary' },
            { id: 'employee', label: 'Employee-wise' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setReportType(t.id as any)}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                reportType === t.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Dynamic Controls based on report type */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {reportType === 'daily' || reportType === 'weekly' ? (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input text-xs w-40"
            />
          ) : (
            <>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="input text-xs w-32"
              >
                {[
                  'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'
                ].map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="input text-xs w-24"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </>
          )}

          {reportType === 'employee' ? (
            <select
              value={selectedEmp}
              onChange={(e) => setSelectedEmp(e.target.value)}
              className="input text-xs w-48"
            >
              <option value="">Select Employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.employeeId})
                </option>
              ))}
            </select>
          ) : (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="input text-xs w-40"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Summary Cards for Monthly/Employee stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Present Records</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">{stats.present}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Late Arrivals</span>
            <p className="text-2xl font-black text-amber-600 mt-1">{stats.late}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Working Hours</span>
            <p className="text-2xl font-black text-primary-600 mt-1">
              {formatMinutes(stats.totalWorkMinutes || 0)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Overtime</span>
            <p className="text-2xl font-black text-purple-600 mt-1">
              {formatMinutes(stats.totalOvertimeMinutes || 0)}
            </p>
          </div>
        </div>
      )}

      {/* Report Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75">
                <th className="table-header">Emp ID</th>
                <th className="table-header">Employee</th>
                <th className="table-header">Department</th>
                <th className="table-header">Date</th>
                <th className="table-header">Entry Time</th>
                <th className="table-header">Exit Time</th>
                <th className="table-header">Total Break</th>
                <th className="table-header">Working Hours</th>
                <th className="table-header">Overtime</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12">
                    <div className="w-7 h-7 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No attendance records for the selected period
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="table-cell font-mono font-semibold text-primary-600">
                      {r.employee?.employeeId}
                    </td>
                    <td className="table-cell font-semibold text-slate-900">{r.employee?.name}</td>
                    <td className="table-cell text-slate-600">{r.employee?.department?.name || '-'}</td>
                    <td className="table-cell text-slate-700">{formatDate(r.date)}</td>
                    <td className="table-cell font-medium text-slate-800">
                      {r.entryTime ? formatTime(r.entryTime) : '-'}
                    </td>
                    <td className="table-cell font-medium text-slate-800">
                      {r.exitTime ? formatTime(r.exitTime) : '-'}
                    </td>
                    <td className="table-cell text-amber-600 font-medium">
                      {formatMinutes(r.totalBreakMinutes || 0)}
                    </td>
                    <td className="table-cell font-bold text-slate-900">
                      {formatMinutes(r.totalWorkMinutes || 0)}
                    </td>
                    <td className="table-cell font-medium text-purple-600">
                      {r.overtimeMinutes && r.overtimeMinutes > 0
                        ? `+${formatMinutes(r.overtimeMinutes)}`
                        : '-'}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${getStatusColor(r.status)}`}>
                        {getStatusLabel(r.status)}
                      </span>
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
