import { ChatThemeConfig } from '../types';

export const THEME_PRESETS: Record<string, ChatThemeConfig & { description: string; previewColor: string }> = {
  'classic-blue': {
    id: 'classic-blue',
    name: 'WorkPulse Blue',
    mode: 'light',
    primaryColor: '#2563eb',
    bubbleColor: '#2563eb',
    bgPattern: 'dots',
    description: 'Crisp corporate blue with subtle dot pattern',
    previewColor: 'bg-blue-600',
  },
  'emerald-forest': {
    id: 'emerald-forest',
    name: 'Emerald Forest',
    mode: 'light',
    primaryColor: '#059669',
    bubbleColor: '#059669',
    bgPattern: 'grid',
    description: 'Refreshing organic emerald with soft grid',
    previewColor: 'bg-emerald-600',
  },
  'royal-purple': {
    id: 'royal-purple',
    name: 'Royal Purple',
    mode: 'light',
    primaryColor: '#7c3aed',
    bubbleColor: '#7c3aed',
    bgPattern: 'doodles',
    description: 'Elegant vibrant purple with creative textures',
    previewColor: 'bg-purple-600',
  },
  'sunset-rose': {
    id: 'sunset-rose',
    name: 'Sunset Rose',
    mode: 'light',
    primaryColor: '#e11d48',
    bubbleColor: '#e11d48',
    bgPattern: 'dots',
    description: 'Warm energetic rose tone',
    previewColor: 'bg-rose-600',
  },
  'warm-amber': {
    id: 'warm-amber',
    name: 'Warm Amber',
    mode: 'light',
    primaryColor: '#d97706',
    bubbleColor: '#d97706',
    bgPattern: 'subtle',
    description: 'Golden cozy warmth with soft contrast',
    previewColor: 'bg-amber-600',
  },
  'slate-minimal': {
    id: 'slate-minimal',
    name: 'Slate Minimal',
    mode: 'light',
    primaryColor: '#334155',
    bubbleColor: '#334155',
    bgPattern: 'none',
    description: 'Clean modern slate monochrome',
    previewColor: 'bg-slate-700',
  },
  'midnight-dark': {
    id: 'midnight-dark',
    name: 'Midnight Dark',
    mode: 'dark',
    primaryColor: '#3b82f6',
    bubbleColor: '#2563eb',
    bgPattern: 'grid',
    description: 'Deep contrast dark theme with neon blue accents',
    previewColor: 'bg-slate-900 border border-blue-500',
  },
  'cyber-neon': {
    id: 'cyber-neon',
    name: 'Cyberpunk Neon',
    mode: 'dark',
    primaryColor: '#06b6d4',
    bubbleColor: '#0891b2',
    bgPattern: 'dots',
    description: 'Futuristic dark mode with vibrant cyan highlights',
    previewColor: 'bg-slate-950 border border-cyan-400',
  },
};

export const DEFAULT_THEME: ChatThemeConfig = THEME_PRESETS['classic-blue'];

export const PATTERN_OPTIONS = [
  { id: 'none', label: 'Plain Solid' },
  { id: 'dots', label: 'Subtle Dots' },
  { id: 'grid', label: 'Geometric Grid' },
  { id: 'doodles', label: 'Doodle Wave' },
  { id: 'subtle', label: 'Soft Gradient' },
];

export const getThemeBackgroundStyle = (theme?: ChatThemeConfig | null) => {
  const current = theme || DEFAULT_THEME;
  const isDark = current.mode === 'dark';

  let patternCss = '';

  switch (current.bgPattern) {
    case 'dots':
      patternCss = isDark
        ? 'radial-gradient(rgba(255, 255, 255, 0.08) 1.5px, transparent 1.5px)'
        : 'radial-gradient(rgba(0, 0, 0, 0.07) 1.5px, transparent 1.5px)';
      return {
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        backgroundImage: patternCss,
        backgroundSize: '24px 24px',
      };
    case 'grid':
      patternCss = isDark
        ? 'linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)'
        : 'linear-gradient(to right, rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, 0.05) 1px, transparent 1px)';
      return {
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        backgroundImage: patternCss,
        backgroundSize: '32px 32px',
      };
    case 'doodles':
      patternCss = isDark
        ? 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.04) 20%, transparent 20%), radial-gradient(circle at 0% 0%, rgba(255, 255, 255, 0.03) 25%, transparent 25%)'
        : 'radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0.03) 20%, transparent 20%), radial-gradient(circle at 0% 0%, rgba(0, 0, 0, 0.02) 25%, transparent 25%)';
      return {
        backgroundColor: isDark ? '#111827' : '#fdf2f8',
        backgroundImage: patternCss,
        backgroundSize: '40px 40px',
      };
    case 'subtle':
      return {
        background: isDark
          ? 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)'
          : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #f8fafc 100%)',
      };
    case 'none':
    default:
      return {
        backgroundColor: isDark ? '#0b0f19' : '#ffffff',
      };
  }
};
