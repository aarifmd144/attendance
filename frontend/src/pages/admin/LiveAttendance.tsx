import { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  RefreshCw,
  Search,
  CheckCircle2,
  Coffee,
  LogOut,
  Clock,
  Building2,
  Users,
  AlertCircle,
} from 'lucide-react';
import api from '../../services/api';
import { Attendance, Department } from '../../types';
import { formatTime, formatMinutes } from '../../utils';
import toast from 'react-hot-toast';

export default function AdminLiveAttendance() {
  const [liveList, setLiveList] = useState<Attendance[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchLive = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get('/attendance/live');
      setLiveList(res.data.data);
    } catch {
      toast.error('Failed to update live monitor');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const loadDepts = async () => {
      try {
        const res = await api.get('/departments');
        setDepartments(res.data.data);
      } catch {
        // silent
      }
    };
    loadDepts();
    fetchLive();

    const timer = setInterval(() => {
      fetchLive(true);
    }, 20000); // 20s auto-refresh

    return () => clearInterval(timer);
  }, [fetchLive]);

  const filtered = liveList.filter((item) => {
    const matchesSearch =
      !search ||
      item.employee?.name.toLowerCase().includes(search.toLowerCase()) ||
      item.employee?.employeeId.toLowerCase().includes(search.toLowerCase());

    const matchesDept = !selectedDept || item.employee?.departmentId === selectedDept;
    const matchesStatus = !statusFilter || item.currentStatus === statusFilter;

    return matchesSearch && matchesDept && matchesStatus;
  });

  const counts = {
    TOTAL: liveList.length,
    WORKING: liveList.filter((l) => l.currentStatus === 'WORKING').length,
    ON_BREAK: liveList.filter((l) => l.currentStatus === 'ON_BREAK').length,
    CHECKED_OUT: liveList.filter((l) => l.currentStatus === 'CHECKED_OUT').length,
    NOT_CHECKED_IN: liveList.filter((l) => l.currentStatus === 'NOT_CHECKED_IN').length,
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'WORKING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Working
          </span>
        );
      case 'ON_BREAK':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Coffee className="w-3.5 h-3.5" />
            On Break
          </span>
        );
      case 'CHECKED_OUT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Checked Out
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <Clock className="w-3.5 h-3.5" />
            Not Checked In
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Live Workforce Monitor
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              REAL-TIME
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Tracking real-time employee work statuses and active breaks today
          </p>
        </div>
        <button
          onClick={() => fetchLive(false)}
          disabled={loading || refreshing}
          className="btn-secondary flex items-center justify-center gap-2 text-xs font-semibold py-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-primary-600' : ''}`} />
          Refresh Status
        </button>
      </div>

      {/* Summary Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Currently Working', count: counts.WORKING, status: 'WORKING', color: 'emerald' },
          { label: 'On Break', count: counts.ON_BREAK, status: 'ON_BREAK', color: 'amber' },
          { label: 'Completed Shift', count: counts.CHECKED_OUT, status: 'CHECKED_OUT', color: 'blue' },
          { label: 'Not Checked In', count: counts.NOT_CHECKED_IN, status: 'NOT_CHECKED_IN', color: 'slate' },
        ].map((item) => (
          <button
            key={item.status}
            onClick={() => setStatusFilter(statusFilter === item.status ? '' : item.status)}
            className={`p-4 rounded-2xl border text-left transition-all ${
              statusFilter === item.status
                ? 'ring-2 ring-primary-500 bg-white shadow-md border-primary-300'
                : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-sm'
            }`}
          >
            <p className="text-xs font-semibold text-slate-500 uppercase">{item.label}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{item.count}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by name or employee ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 text-xs"
          />
        </div>
        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="input sm:w-52 text-xs"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200/80 text-center text-slate-400">
          <Radio className="w-10 h-10 mx-auto mb-2 opacity-30" />
          No employees found for this filter
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => {
            const emp = item.employee;
            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm border border-slate-200">
                      {emp?.name ? emp.name[0].toUpperCase() : 'E'}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm leading-tight">{emp?.name}</h4>
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                        {emp?.employeeId} • {emp?.designation || 'Staff'}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(item.currentStatus)}
                </div>

                <div className="border-t border-slate-100 pt-3.5 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Department</span>
                    <span className="font-medium text-slate-800">{emp?.department?.name || '-'}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Entry Time</span>
                    <span className="font-semibold text-slate-800">
                      {item.entryTime ? formatTime(item.entryTime) : 'Not Checked In'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Breaks Taken</span>
                    <span className="font-medium text-amber-600">
                      {item.breaks?.length || 0} breaks ({formatMinutes(item.totalBreakMinutes || 0)})
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Exit Time</span>
                    <span className="font-semibold text-slate-800">
                      {item.exitTime ? formatTime(item.exitTime) : item.entryTime ? 'Active Shift' : '-'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
