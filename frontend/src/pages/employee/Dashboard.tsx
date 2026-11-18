import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Clock, LogIn, Coffee, PlayCircle, LogOut, Timer, Zap,
  AlertCircle, CheckCircle, Sun, Moon, Sunset, TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { Attendance } from '../../types';
import { formatTime, formatMinutes, getStatusColor, getStatusLabel, formatDate } from '../../utils';

type LiveStatus = 'NOT_CHECKED_IN' | 'WORKING' | 'ON_BREAK' | 'CHECKED_OUT';

export default function EmployeeDashboard() {
  const { user } = useAuthStore();
  const employee = user?.employee;

  const [today, setToday] = useState<Attendance | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchTodayAttendance = useCallback(async () => {
    try {
      const res = await api.get('/attendance/today');
      setToday(res.data.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchRecentAttendance = useCallback(async () => {
    try {
      const res = await api.get(`/attendance?limit=10`);
      setRecentAttendance(res.data.data.slice(0, 10));
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchTodayAttendance(), fetchRecentAttendance()]);
      setLoading(false);
    };
    load();
  }, [fetchTodayAttendance, fetchRecentAttendance]);

  // Determine live status
  const getLiveStatus = (): LiveStatus => {
    if (!today?.entryTime) return 'NOT_CHECKED_IN';
    if (today.exitTime) return 'CHECKED_OUT';
    const openBreak = today.breaks?.find(b => !b.endTime);
    return openBreak ? 'ON_BREAK' : 'WORKING';
  };

  const liveStatus = getLiveStatus();

  // Calculate current working time (live)
  const getCurrentWorkMinutes = (): number => {
    if (!today?.entryTime || today.exitTime) {
      return today?.totalWorkMinutes || 0;
    }
    const entry = new Date(today.entryTime);
    const now = currentTime;
    const grossMins = Math.floor((now.getTime() - entry.getTime()) / 60000);
    return Math.max(0, grossMins - (today.totalBreakMinutes || 0));
  };

  const currentBreakMinutes = (): number => {
    if (!today?.breaks) return 0;
    const openBreak = today.breaks.find(b => !b.endTime);
    if (!openBreak) return 0;
    return Math.floor((currentTime.getTime() - new Date(openBreak.startTime).getTime()) / 60000);
  };

  const handleMarkEntry = async () => {
    setActionLoading('entry');
    try {
      await api.post('/attendance/entry');
      toast.success('Entry marked successfully!');
      await fetchTodayAttendance();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to mark entry');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartBreak = async () => {
    setActionLoading('break-start');
    try {
      await api.post('/attendance/break/start');
      toast.success('Break started');
      await fetchTodayAttendance();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to start break');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEndBreak = async () => {
    setActionLoading('break-end');
    try {
      await api.post('/attendance/break/end');
      toast.success('Break ended');
      await fetchTodayAttendance();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to end break');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkExit = async () => {
    if (!window.confirm('Are you sure you want to mark exit for today?')) return;
    setActionLoading('exit');
    try {
      await api.post('/attendance/exit');
      toast.success('Exit marked! Have a great evening!');
      await fetchTodayAttendance();
      await fetchRecentAttendance();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to mark exit');
    } finally {
      setActionLoading(null);
    }
  };

  const getGreeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return { text: 'Good Morning', icon: <Sun className="w-6 h-6 text-yellow-400" /> };
    if (h < 17) return { text: 'Good Afternoon', icon: <Sunset className="w-6 h-6 text-orange-400" /> };
    return { text: 'Good Evening', icon: <Moon className="w-6 h-6 text-blue-400" /> };
  };

  const greeting = getGreeting();

  const statusConfig: Record<LiveStatus, { bg: string; text: string; border: string; label: string; icon: React.ReactNode }> = {
    NOT_CHECKED_IN: {
      bg: 'from-gray-500 to-gray-600',
      text: 'text-gray-100',
      border: 'border-gray-400',
      label: 'Not Checked In',
      icon: <AlertCircle className="w-8 h-8" />,
    },
    WORKING: {
      bg: 'from-green-500 to-emerald-600',
      text: 'text-green-100',
      border: 'border-green-400',
      label: 'Currently Working',
      icon: <CheckCircle className="w-8 h-8" />,
    },
    ON_BREAK: {
      bg: 'from-yellow-500 to-orange-500',
      text: 'text-yellow-100',
      border: 'border-yellow-400',
      label: 'On Break',
      icon: <Coffee className="w-8 h-8" />,
    },
    CHECKED_OUT: {
      bg: 'from-blue-500 to-indigo-600',
      text: 'text-blue-100',
      border: 'border-blue-400',
      label: 'Checked Out',
      icon: <CheckCircle className="w-8 h-8" />,
    },
  };

  const statusConf = statusConfig[liveStatus];
  const settings = { requiredHours: 480, officeStartTime: '09:00' }; // defaults

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting + Status Card */}
      <div className={`relative overflow-hidden bg-gradient-to-r ${statusConf.bg} rounded-2xl p-6 text-white shadow-lg`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Greeting */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              {greeting.icon}
              <span className="text-lg font-medium opacity-90">{greeting.text}</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold">{employee?.name || user?.email}</h2>
            <div className="flex items-center gap-3 mt-2 opacity-80 text-sm">
              <span>{employee?.employeeId}</span>
              <span>•</span>
              <span>{employee?.designation || 'Employee'}</span>
              <span>•</span>
              <span>{employee?.department?.name}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 bg-white/20 rounded-full border ${statusConf.border}`}>
                {statusConf.icon}
                <span className="font-semibold">{statusConf.label}</span>
              </div>
            </div>
          </div>

          {/* Live Clock */}
          <div className="text-right">
            <div className="text-4xl font-bold font-mono tracking-tight">
              {format(currentTime, 'hh:mm:ss a')}
            </div>
            <div className="opacity-80 mt-1">{format(currentTime, 'EEEE, dd MMMM yyyy')}</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Mark Entry */}
        <button
          onClick={handleMarkEntry}
          disabled={liveStatus !== 'NOT_CHECKED_IN' || !!actionLoading}
          className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 font-semibold transition-all
            ${liveStatus === 'NOT_CHECKED_IN'
              ? 'bg-green-50 border-green-400 text-green-700 hover:bg-green-100 hover:shadow-md'
              : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
        >
          {actionLoading === 'entry'
            ? <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            : <LogIn className="w-8 h-8" />
          }
          <span>Mark Entry</span>
          {today?.entryTime && (
            <span className="text-xs font-normal opacity-75">In at {formatTime(today.entryTime)}</span>
          )}
        </button>

        {/* Start Break */}
        <button
          onClick={handleStartBreak}
          disabled={liveStatus !== 'WORKING' || !!actionLoading}
          className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 font-semibold transition-all
            ${liveStatus === 'WORKING'
              ? 'bg-yellow-50 border-yellow-400 text-yellow-700 hover:bg-yellow-100 hover:shadow-md'
              : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
        >
          {actionLoading === 'break-start'
            ? <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            : <Coffee className="w-8 h-8" />
          }
          <span>Start Break</span>
        </button>

        {/* End Break */}
        <button
          onClick={handleEndBreak}
          disabled={liveStatus !== 'ON_BREAK' || !!actionLoading}
          className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 font-semibold transition-all
            ${liveStatus === 'ON_BREAK'
              ? 'bg-orange-50 border-orange-400 text-orange-700 hover:bg-orange-100 hover:shadow-md'
              : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
        >
          {actionLoading === 'break-end'
            ? <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            : <PlayCircle className="w-8 h-8" />
          }
          <span>End Break</span>
          {liveStatus === 'ON_BREAK' && (
            <span className="text-xs font-normal">Break: {formatMinutes(currentBreakMinutes())}</span>
          )}
        </button>

        {/* Mark Exit */}
        <button
          onClick={handleMarkExit}
          disabled={!['WORKING', 'ON_BREAK'].includes(liveStatus) || !!actionLoading}
          className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 font-semibold transition-all
            ${['WORKING'].includes(liveStatus)
              ? 'bg-red-50 border-red-400 text-red-700 hover:bg-red-100 hover:shadow-md'
              : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
        >
          {actionLoading === 'exit'
            ? <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            : <LogOut className="w-8 h-8" />
          }
          <span>Mark Exit</span>
          {today?.exitTime && (
            <span className="text-xs font-normal opacity-75">Out at {formatTime(today.exitTime)}</span>
          )}
        </button>
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <LogIn className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Entry Time</p>
              <p className="text-lg font-bold text-gray-900">
                {today?.entryTime ? formatTime(today.entryTime) : '--:--'}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Coffee className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Total Break</p>
              <p className="text-lg font-bold text-gray-900">
                {formatMinutes((today?.totalBreakMinutes || 0) + (liveStatus === 'ON_BREAK' ? currentBreakMinutes() : 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Timer className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Working Time</p>
              <p className="text-lg font-bold text-gray-900">
                {liveStatus === 'CHECKED_OUT'
                  ? formatMinutes(today?.totalWorkMinutes || 0)
                  : formatMinutes(getCurrentWorkMinutes())
                }
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Overtime</p>
              <p className="text-lg font-bold text-gray-900">
                {formatMinutes(Math.max(0, getCurrentWorkMinutes() - 480))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Breaks */}
      {today?.breaks && today.breaks.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Coffee className="w-5 h-5 text-yellow-500" />
            Today's Breaks
          </h3>
          <div className="space-y-2">
            {today.breaks.map((b, i) => (
              <div key={b.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Break {i + 1}</span>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{formatTime(b.startTime)}</span>
                  {b.endTime ? (
                    <>
                      <span className="mx-2 text-gray-400">→</span>
                      <span className="font-medium">{formatTime(b.endTime)}</span>
                      <span className="ml-2 text-yellow-600">({b.durationMinutes} min)</span>
                    </>
                  ) : (
                    <span className="ml-2 text-yellow-600 animate-pulse">• Active</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Late / Missing Checkout alerts */}
      {today?.isLate && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-orange-800">Late Arrival</p>
            <p className="text-sm text-orange-600">You arrived {today.lateMinutes} minutes late today.</p>
          </div>
        </div>
      )}

      {/* Recent Attendance */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-500" />
            Recent Attendance
          </h3>
        </div>
        {recentAttendance.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>No attendance records yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Date</th>
                  <th className="table-header">Entry</th>
                  <th className="table-header">Exit</th>
                  <th className="table-header">Break</th>
                  <th className="table-header">Working Hours</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentAttendance.map(record => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-medium">{formatDate(record.date)}</td>
                    <td className="table-cell">{record.entryTime ? formatTime(record.entryTime) : '-'}</td>
                    <td className="table-cell">{record.exitTime ? formatTime(record.exitTime) : '-'}</td>
                    <td className="table-cell">{formatMinutes(record.totalBreakMinutes || 0)}</td>
                    <td className="table-cell font-medium">{formatMinutes(record.totalWorkMinutes || 0)}</td>
                    <td className="table-cell">
                      <span className={`badge ${getStatusColor(record.status)}`}>
                        {getStatusLabel(record.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
