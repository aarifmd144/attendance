import { useState, useEffect } from 'react';
import {
  Settings,
  Building2,
  Clock,
  Calendar,
  Save,
  ShieldAlert,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import api from '../../services/api';
import { CompanySetting } from '../../types';
import toast from 'react-hot-toast';

const ALL_DAYS = [
  { id: 'MONDAY', label: 'Monday' },
  { id: 'TUESDAY', label: 'Tuesday' },
  { id: 'WEDNESDAY', label: 'Wednesday' },
  { id: 'THURSDAY', label: 'Thursday' },
  { id: 'FRIDAY', label: 'Friday' },
  { id: 'SATURDAY', label: 'Saturday' },
  { id: 'SUNDAY', label: 'Sunday' },
];

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CompanySetting>({
    id: '',
    companyName: 'TechCorp Solutions Pvt. Ltd.',
    officeStartTime: '09:00',
    officeEndTime: '18:00',
    requiredHours: 480,
    lateThresholdMinutes: 15,
    overtimeThresholdMinutes: 0,
    halfDayMinutes: 240,
    workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    breakLimitMinutes: 60,
    timezone: 'Asia/Kolkata',
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        if (res.data.data) {
          setSettings(res.data.data);
        }
      } catch {
        toast.error('Failed to load company settings');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleToggleDay = (day: string) => {
    setSettings((prev) => {
      const exists = prev.workingDays.includes(day);
      return {
        ...prev,
        workingDays: exists
          ? prev.workingDays.filter((d) => d !== day)
          : [...prev.workingDays, day],
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', settings);
      toast.success('Company policies and working hours updated successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Company Settings & Rules
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Configure work schedules, punctuality thresholds, break limits, and working days
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Settings */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
            <Building2 className="w-5 h-5 text-primary-600" />
            <h3 className="font-bold text-slate-900 text-base">Company Identity</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Company Name</label>
              <input
                type="text"
                required
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                className="input text-xs"
              />
            </div>

            <div>
              <label className="label">Timezone</label>
              <input
                type="text"
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="input text-xs"
              />
            </div>
          </div>
        </div>

        {/* Working Hours & Shift Rules */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
            <Clock className="w-5 h-5 text-primary-600" />
            <h3 className="font-bold text-slate-900 text-base">Office Shift & Work Durations</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="label">Shift Start Time</label>
              <input
                type="time"
                required
                value={settings.officeStartTime}
                onChange={(e) => setSettings({ ...settings, officeStartTime: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="label">Shift End Time</label>
              <input
                type="time"
                required
                value={settings.officeEndTime}
                onChange={(e) => setSettings({ ...settings, officeEndTime: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="label">Required Hours (mins)</label>
              <input
                type="number"
                required
                value={settings.requiredHours}
                onChange={(e) => setSettings({ ...settings, requiredHours: Number(e.target.value) })}
                className="input"
              />
              <p className="text-[11px] text-slate-400 mt-1">480 mins = 8 hours shift</p>
            </div>

            <div>
              <label className="label">Half-Day Threshold (mins)</label>
              <input
                type="number"
                required
                value={settings.halfDayMinutes}
                onChange={(e) => setSettings({ ...settings, halfDayMinutes: Number(e.target.value) })}
                className="input"
              />
              <p className="text-[11px] text-slate-400 mt-1">240 mins = 4 hours minimum</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
            <div>
              <label className="label">Late Arrival Grace Period (mins)</label>
              <input
                type="number"
                required
                value={settings.lateThresholdMinutes}
                onChange={(e) =>
                  setSettings({ ...settings, lateThresholdMinutes: Number(e.target.value) })
                }
                className="input"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Employees arriving after {settings.officeStartTime} + {settings.lateThresholdMinutes} mins marked Late
              </p>
            </div>

            <div>
              <label className="label">Max Daily Break Allowance (mins)</label>
              <input
                type="number"
                required
                value={settings.breakLimitMinutes}
                onChange={(e) =>
                  setSettings({ ...settings, breakLimitMinutes: Number(e.target.value) })
                }
                className="input"
              />
              <p className="text-[11px] text-slate-400 mt-1">Standard allocated cumulative break time</p>
            </div>
          </div>
        </div>

        {/* Working Days */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
            <Calendar className="w-5 h-5 text-primary-600" />
            <h3 className="font-bold text-slate-900 text-base">Designated Working Days</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {ALL_DAYS.map((day) => {
              const isWorking = settings.workingDays.includes(day.id);
              return (
                <button
                  type="button"
                  key={day.id}
                  onClick={() => handleToggleDay(day.id)}
                  className={`p-3.5 rounded-xl border font-semibold flex items-center justify-between transition-all ${
                    isWorking
                      ? 'bg-primary-50 border-primary-300 text-primary-800'
                      : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <span>{day.label}</span>
                  {isWorking && <CheckCircle2 className="w-4 h-4 text-primary-600" />}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-400">
            Non-working days are automatically designated as 'WEEK_OFF' on employee attendance records.
          </p>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2 px-6 py-2.5 shadow-md"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Changes...' : 'Save Company Policies'}
          </button>
        </div>
      </form>
    </div>
  );
}
