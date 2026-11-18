import React, { useState } from 'react';
import { X, Check, Sun, Moon, Palette, ShieldAlert, Sparkles } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { THEME_PRESETS, PATTERN_OPTIONS, DEFAULT_THEME, getThemeBackgroundStyle } from '../../utils/theme';
import { ChatConversation, ChatThemeConfig } from '../../types';

interface ThemeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeConversation?: ChatConversation | null;
}

export default function ThemeSettingsModal({ isOpen, onClose, activeConversation }: ThemeSettingsModalProps) {
  const { user } = useAuthStore();
  const { personalTheme, updatePersonalTheme, updateGroupTheme } = useChatStore();

  const isGroup = activeConversation?.conversationType === 'GROUP';
  const isAdmin = user?.role === 'ADMIN';
  const isReadOnly = isGroup && !isAdmin;

  // Initialize selected configuration
  const initialTheme: ChatThemeConfig = isGroup
    ? activeConversation?.groupTheme || DEFAULT_THEME
    : personalTheme || DEFAULT_THEME;

  const [selectedPresetId, setSelectedPresetId] = useState<string>(initialTheme.id || 'classic-blue');
  const [selectedMode, setSelectedMode] = useState<'light' | 'dark'>(initialTheme.mode || 'light');
  const [selectedPattern, setSelectedPattern] = useState<string>(initialTheme.bgPattern || 'dots');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSelectPreset = (presetId: string) => {
    if (isReadOnly) return;
    const preset = THEME_PRESETS[presetId];
    if (preset) {
      setSelectedPresetId(presetId);
      setSelectedMode(preset.mode);
      setSelectedPattern(preset.bgPattern);
    }
  };

  const handleSave = async () => {
    if (isReadOnly) return;
    setIsSaving(true);
    try {
      const preset = THEME_PRESETS[selectedPresetId] || DEFAULT_THEME;
      const themePayload: ChatThemeConfig = {
        id: selectedPresetId,
        name: preset.name,
        mode: selectedMode,
        primaryColor: preset.primaryColor,
        bubbleColor: preset.bubbleColor,
        bgPattern: selectedPattern,
      };

      if (isGroup && activeConversation) {
        await updateGroupTheme(activeConversation.id, themePayload);
      } else {
        await updatePersonalTheme(themePayload);
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const currentPreviewTheme: ChatThemeConfig = {
    id: selectedPresetId,
    name: THEME_PRESETS[selectedPresetId]?.name || 'Theme',
    mode: selectedMode,
    primaryColor: THEME_PRESETS[selectedPresetId]?.primaryColor || '#2563eb',
    bubbleColor: THEME_PRESETS[selectedPresetId]?.bubbleColor || '#2563eb',
    bgPattern: selectedPattern,
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-100 text-primary-700">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                {isGroup ? 'Group Chat Theme Settings' : 'Personal Chat Theme'}
              </h3>
              <p className="text-xs text-slate-500">
                {isGroup
                  ? isAdmin
                    ? 'Admin-controlled theme applied to all group members'
                    : 'Configured by System Administrator'
                  : 'Customize your personal chat appearance'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Informative Banner */}
          {isGroup && !isAdmin ? (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-800">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Administrator Managed Theme</p>
                <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                  Only System Administrators can customize group themes. Employees view the theme
                  selected by the Admin.
                </p>
              </div>
            </div>
          ) : isGroup && isAdmin ? (
            <div className="p-3.5 rounded-2xl bg-primary-50 border border-primary-200 flex items-start gap-3 text-xs text-primary-900">
              <Sparkles className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Admin Group Customization</p>
                <p className="text-[11px] text-primary-700 mt-0.5 leading-relaxed">
                  As an Administrator, any changes you make will be saved in the database and applied
                  consistently to all employees in this group.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">Personal Appearance</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Your theme preferences are saved to your account and only affect your own view.
              </p>
            </div>
          )}

          {/* Live Preview Box */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Live Theme Preview</label>
            <div
              style={getThemeBackgroundStyle(currentPreviewTheme)}
              className="p-4 rounded-2xl border border-slate-300 shadow-inner flex flex-col gap-2.5 transition-all duration-300"
            >
              {/* Receiver Bubble */}
              <div className="flex justify-start">
                <div
                  className={`px-3.5 py-2 rounded-2xl rounded-bl-xs text-xs max-w-[80%] shadow-sm ${
                    selectedMode === 'dark'
                      ? 'bg-slate-800 text-slate-100 border border-slate-700'
                      : 'bg-white text-slate-900 border border-slate-200'
                  }`}
                >
                  Hello! How does this new theme look?
                </div>
              </div>

              {/* Sender Bubble */}
              <div className="flex justify-end">
                <div
                  style={{
                    backgroundColor: THEME_PRESETS[selectedPresetId]?.bubbleColor || '#2563eb',
                  }}
                  className="px-3.5 py-2 rounded-2xl rounded-br-xs text-xs max-w-[80%] text-white shadow-sm"
                >
                  It looks gorgeous and vibrant! ✨
                </div>
              </div>
            </div>
          </div>

          {/* Theme Color Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Color Themes</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {Object.entries(THEME_PRESETS).map(([key, preset]) => {
                const isSelected = selectedPresetId === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => handleSelectPreset(key)}
                    className={`p-2.5 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                      isSelected
                        ? 'border-primary-600 ring-2 ring-primary-500/20 bg-primary-50/40 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`w-6 h-6 rounded-full shadow-sm ${preset.previewColor}`} />
                      {isSelected && <Check className="w-4 h-4 text-primary-600" />}
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-slate-900 leading-tight">
                        {preset.name}
                      </p>
                      <p className="text-[10px] text-slate-400 capitalize">{preset.mode} mode</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode Toggle: Light vs Dark */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Display Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => setSelectedMode('light')}
                className={`p-3 rounded-2xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                  selectedMode === 'light'
                    ? 'border-primary-600 bg-primary-50 text-primary-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Light Mode</span>
              </button>

              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => setSelectedMode('dark')}
                className={`p-3 rounded-2xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                  selectedMode === 'dark'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Moon className="w-4 h-4 text-indigo-400" />
                <span>Dark Mode</span>
              </button>
            </div>
          </div>

          {/* Background Pattern */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Background Pattern
            </label>
            <div className="flex flex-wrap gap-2">
              {PATTERN_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => setSelectedPattern(opt.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    selectedPattern === opt.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            {isReadOnly ? 'Close' : 'Cancel'}
          </button>

          {!isReadOnly && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-5 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md shadow-primary-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{isGroup ? 'Apply Group Theme' : 'Save Theme'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
