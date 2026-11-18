import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { Attendance } from '../../types';
import { formatDate, formatTime, formatMinutes, getStatusColor, getStatusLabel, toDateKey } from '../../utils';

export default function EmployeeAttendance() {
  const { user } = useAuthStore();
  const employee = user?.employee;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarData, setCalendarData] = useState<Attendance[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!employee?.id) return;
    const load = async () => {
      setLoading(true);
      try {
        const [calRes, listRes] = await Promise.all([
          api.get(`/attendance/calendar/${employee.id}?year=${currentMonth.getFullYear()}&month=${currentMonth.getMonth() + 1}`),
          api.get(`/attendance?page=${page}&limit=15`),
        ]);
        setCalendarData(calRes.data.data);
        setAttendance(listRes.data.data);
        setTotalPages(listRes.data.pagination?.pages || 1);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [employee?.id, currentMonth, page]);

  const getDayStatus = (date: Date): Attendance | undefined => {
    const targetKey = format(date, 'yyyy-MM-dd');
    return calendarData.find(a => toDateKey(a.date) === targetKey);
  };

  const dayStatusColor: Record<string, string> = {
    PRESENT: 'bg-green-100 text-green-700',
    ABSENT: 'bg-red-100 text-red-700',
    HALF_DAY: 'bg-yellow-100 text-yellow-700',
    LATE: 'bg-orange-100 text-orange-700',
    ON_LEAVE: 'bg-blue-100 text-blue-700',
    HOLIDAY: 'bg-purple-100 text-purple-700',
    WEEK_OFF: 'bg-gray-100 text-gray-400',
    MISSING_CHECKOUT: 'bg-red-100 text-red-700',
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = getDay(monthStart); // 0=Sun

  // Monthly summary stats
  const present = calendarData.filter(a => ['PRESENT', 'LATE', 'HALF_DAY'].includes(a.status)).length;
  const absent = calendarData.filter(a => a.status === 'ABSENT').length;
  const onLeave = calendarData.filter(a => a.status === 'ON_LEAVE').length;
  const totalWork = calendarData.reduce((s, a) => s + (a.totalWorkMinutes || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Attendance History</h1>
      </div>

      {/* Monthly Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Present Days', value: present, color: 'text-green-600 bg-green-50', border: 'border-green-200' },
          { label: 'Absent Days', value: absent, color: 'text-red-600 bg-red-50', border: 'border-red-200' },
          { label: 'On Leave', value: onLeave, color: 'text-blue-600 bg-blue-50', border: 'border-blue-200' },
          { label: 'Total Work', value: formatMinutes(totalWork), color: 'text-primary-600 bg-primary-50', border: 'border-primary-200' },
        ].map(stat => (
          <div key={stat.label} className={`card border ${stat.border}`}>
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color.split(' ')[0]}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-500" />
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-3 py-1 text-sm bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells before month start */}
          {Array.from({ length: startDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {days.map(day => {
            const record = getDayStatus(day);
            const isWeekend = [0, 6].includes(getDay(day));
            const isDayToday = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={`
                  relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm
                  ${isDayToday ? 'ring-2 ring-primary-500 ring-offset-1' : ''}
                  ${record ? dayStatusColor[record.status] || 'bg-gray-50' : isWeekend ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'}
                `}
              >
                <span className={`font-medium ${isDayToday ? 'text-primary-700' : ''}`}>
                  {format(day, 'd')}
                </span>
                {record && (
                  <span className="text-[10px] mt-0.5 hidden sm:block">
                    {record.status === 'PRESENT' ? '✓' :
                     record.status === 'ABSENT' ? '✗' :
                     record.status === 'LATE' ? 'Late' :
                     record.status === 'ON_LEAVE' ? 'Leave' :
                     record.status === 'HOLIDAY' ? 'Hol' :
                     record.status === 'HALF_DAY' ? 'Half' : ''}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100">
          {[
            { label: 'Present', color: 'bg-green-100 text-green-700' },
            { label: 'Absent', color: 'bg-red-100 text-red-700' },
            { label: 'Late', color: 'bg-orange-100 text-orange-700' },
            { label: 'Half Day', color: 'bg-yellow-100 text-yellow-700' },
            { label: 'On Leave', color: 'bg-blue-100 text-blue-700' },
            { label: 'Holiday', color: 'bg-purple-100 text-purple-700' },
          ].map(l => (
            <div key={l.label} className={`badge ${l.color}`}>{l.label}</div>
          ))}
        </div>
      </div>

      {/* Detailed Table */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary-500" />
          Detailed Records
        </h3>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : attendance.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No records found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header">Date</th>
                    <th className="table-header">Entry</th>
                    <th className="table-header">Break</th>
                    <th className="table-header">Exit</th>
                    <th className="table-header">Working Hours</th>
                    <th className="table-header">Overtime</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {attendance.map(record => (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell font-medium">{formatDate(record.date)}</td>
                      <td className="table-cell">{record.entryTime ? formatTime(record.entryTime) : '-'}</td>
                      <td className="table-cell text-yellow-600">{formatMinutes(record.totalBreakMinutes || 0)}</td>
                      <td className="table-cell">{record.exitTime ? formatTime(record.exitTime) : record.entryTime ? <span className="text-red-500 text-xs">Missing</span> : '-'}</td>
                      <td className="table-cell font-semibold">{formatMinutes(record.totalWorkMinutes || 0)}</td>
                      <td className="table-cell">
                        {record.overtimeMinutes ? (
                          <span className="text-purple-600 font-medium">{formatMinutes(record.overtimeMinutes)}</span>
                        ) : '-'}
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${getStatusColor(record.status)}`}>
                          {getStatusLabel(record.status)}
                        </span>
                        {record.isLate && <span className="badge bg-orange-100 text-orange-700 ml-1">Late</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4 pt-4 border-t border-gray-100">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50">Prev</button>
                <span className="px-4 py-1.5 text-sm text-gray-600">Page {page} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-50">Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
