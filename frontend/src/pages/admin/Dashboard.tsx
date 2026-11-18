import { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  AlertTriangle,
  Zap,
  TrendingUp,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import api from '../../services/api';
import { DashboardSummary, Attendance } from '../../types';
import { formatMinutes, formatDate, formatTime, getStatusColor, getStatusLabel } from '../../utils';
import { Link } from 'react-router-dom';

const PIE_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];

export default function AdminDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sumRes, attRes] = await Promise.all([
          api.get('/employees/summary'),
          api.get('/attendance?limit=10'),
        ]);
        setSummary(sumRes.data.data);
        setRecentAttendance(attRes.data.data);
      } catch (err) {
        console.error('Failed to load admin dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Employees',
      value: summary?.totalEmployees ?? 0,
      sub: `${summary?.activeEmployees ?? 0} active accounts`,
      icon: Users,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    },
    {
      title: 'Present Today',
      value: summary?.presentToday ?? 0,
      sub: 'Marked on-site entry',
      icon: UserCheck,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    {
      title: 'Absent Today',
      value: summary?.absentToday ?? 0,
      sub: 'Not checked in',
      icon: UserX,
      color: 'bg-rose-50 text-rose-600 border-rose-100',
    },
    {
      title: 'On Leave',
      value: summary?.onLeaveToday ?? 0,
      sub: 'Approved leaves today',
      icon: Clock,
      color: 'bg-blue-50 text-blue-600 border-blue-100',
    },
    {
      title: 'Late Arrivals',
      value: summary?.lateToday ?? 0,
      sub: 'Passed entry threshold',
      icon: AlertTriangle,
      color: 'bg-amber-50 text-amber-600 border-amber-100',
    },
    {
      title: 'Currently Working',
      value: summary?.currentlyWorking ?? 0,
      sub: 'Logged in right now',
      icon: Activity,
      color: 'bg-teal-50 text-teal-600 border-teal-100',
    },
    {
      title: 'Avg Working Hours',
      value: formatMinutes(summary?.avgWorkingMinutes ?? 0),
      sub: 'Daily staff average',
      icon: TrendingUp,
      color: 'bg-violet-50 text-violet-600 border-violet-100',
    },
    {
      title: 'Total Overtime',
      value: formatMinutes(summary?.totalOvertimeMinutes ?? 0),
      sub: 'Accumulated extra hours',
      icon: Zap,
      color: 'bg-purple-50 text-purple-600 border-purple-100',
    },
  ];

  // Pie chart distribution
  const pieData = [
    { name: 'Present', value: summary?.presentToday || 0 },
    { name: 'Absent', value: Math.max(0, summary?.absentToday || 0) },
    { name: 'Late', value: summary?.lateToday || 0 },
    { name: 'On Leave', value: summary?.onLeaveToday || 0 },
  ].filter(d => d.value > 0);

  // Weekly attendance simulation for chart
  const weeklyTrends = [
    { day: 'Mon', present: 9, absent: 1, late: 1 },
    { day: 'Tue', present: 10, absent: 0, late: 2 },
    { day: 'Wed', present: 8, absent: 2, late: 0 },
    { day: 'Thu', present: 10, absent: 0, late: 1 },
    { day: 'Fri', present: 9, absent: 1, late: 1 },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time attendance metrics and workforce analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/admin/live" className="btn-primary flex items-center gap-2 text-sm shadow-md">
            <Activity className="w-4 h-4 animate-pulse" />
            Live Monitor
          </Link>
        </div>
      </div>

      {/* 8 Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {card.title}
                </span>
                <div className={`p-2.5 rounded-xl border ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {card.value}
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-1">{card.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Trend Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Weekly Attendance Trends</h3>
              <p className="text-xs text-slate-500">Distribution over current work week</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="present" fill="#10b981" radius={[4, 4, 0, 0]} name="Present" />
                <Bar dataKey="late" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Late" />
                <Bar dataKey="absent" fill="#ef4444" radius={[4, 4, 0, 0]} name="Absent" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Today's Distribution Pie Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Today's Workforce Ratio</h3>
            <p className="text-xs text-slate-500">Proportion of staff attendance</p>
          </div>
          <div className="h-64 w-full flex items-center justify-center my-2">
            {pieData.length === 0 ? (
              <p className="text-sm text-slate-400">No attendance data today</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Overall Staff Present:</span>
            <span className="font-semibold text-slate-800">
              {summary?.activeEmployees ? Math.round(((summary.presentToday || 0) / summary.activeEmployees) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Recent Attendance Activity */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Recent Attendance Logs</h3>
            <p className="text-xs text-slate-500">Latest check-in and checkout events</p>
          </div>
          <Link
            to="/admin/attendance"
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            View Full Records
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="table-header">Employee</th>
                <th className="table-header">Department</th>
                <th className="table-header">Date</th>
                <th className="table-header">Entry</th>
                <th className="table-header">Exit</th>
                <th className="table-header">Working Time</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentAttendance.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-sm text-slate-400">
                    No recent records found
                  </td>
                </tr>
              ) : (
                recentAttendance.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-semibold flex items-center justify-center text-xs">
                          {record.employee?.name ? record.employee.name[0] : 'E'}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">
                            {record.employee?.name || 'Unknown'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {record.employee?.employeeId}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell font-medium text-slate-600">
                      {record.employee?.department?.name || '-'}
                    </td>
                    <td className="table-cell text-slate-600">{formatDate(record.date)}</td>
                    <td className="table-cell text-slate-700 font-medium">
                      {record.entryTime ? formatTime(record.entryTime) : '-'}
                    </td>
                    <td className="table-cell text-slate-700 font-medium">
                      {record.exitTime ? formatTime(record.exitTime) : '-'}
                    </td>
                    <td className="table-cell font-semibold text-slate-800">
                      {formatMinutes(record.totalWorkMinutes || 0)}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${getStatusColor(record.status)}`}>
                        {getStatusLabel(record.status)}
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
