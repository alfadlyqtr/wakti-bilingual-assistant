// Theme accent color helper - includes hex for inline styles
export const getThemeAccent = (themeKey: string) => {
  switch (themeKey) {
    case 'pitch_deck': return { bg: 'bg-emerald-500', text: 'text-emerald-400', light: 'text-emerald-300', hex: '#10b981' };
    case 'creative': return { bg: 'bg-orange-500', text: 'text-orange-400', light: 'text-orange-200', hex: '#f97316' };
    case 'professional': return { bg: 'bg-indigo-500', text: 'text-indigo-400', light: 'text-indigo-300', hex: '#6366f1' };
    case 'academic': return { bg: 'bg-cyan-500', text: 'text-cyan-400', light: 'text-cyan-300', hex: '#06b6d4' };
    default: return { bg: 'bg-blue-500', text: 'text-blue-400', light: 'text-blue-300', hex: '#3b82f6' };
  }
};

/**
 * Get theme accent color hex
 */
export function getThemeAccentHex(theme: string): string {
  switch (theme) {
    case 'pitch_deck': return '#10b981';
    case 'creative': return '#f97316';
    case 'professional': return '#6366f1';
    case 'academic': return '#06b6d4';
    default: return '#64748b';
  }
}

/**
 * Get theme background colors for canvas
 */
export function getThemeBackgroundColors(theme: string): { from: string; to: string; overlay?: string } {
  switch (theme) {
    case 'academic':
      return { from: '#0f172a', to: '#1e293b', overlay: 'rgba(30, 58, 138, 0.1)' };
    case 'pitch_deck':
      return { from: '#0f172a', to: '#1e293b', overlay: 'rgba(16, 185, 129, 0.1)' };
    case 'creative':
      return { from: '#ea580c', to: '#db2777', overlay: 'rgba(249, 115, 22, 0.1)' };
    case 'professional':
      return { from: '#1e293b', to: '#312e81', overlay: 'rgba(99, 102, 241, 0.1)' };
    default:
      return { from: '#1e293b', to: '#0f172a' };
  }
}
