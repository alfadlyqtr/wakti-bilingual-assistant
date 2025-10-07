export type Lang = 'en' | 'ar' | string;

// Ensures Arabic uses Gregorian calendar while keeping other locales unchanged
export function formatDate(d: Date, language: Lang, opts: Intl.DateTimeFormatOptions = {}) {
  const base: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...opts,
  };
  const options = (language === 'ar') ? { ...base, calendar: 'gregory' } : base;
  // Use provided language when available, otherwise fall back to browser default
  const locale = language || undefined;
  try {
    return new Intl.DateTimeFormat(locale, options).format(d);
  } catch {
    // Fallback without calendar if environment lacks support
    const { calendar: _cal, ...rest } = options as any;
    return new Intl.DateTimeFormat(locale, rest).format(d);
  }
}

export function formatTime(d: Date, language: Lang, opts: Intl.DateTimeFormatOptions = {}) {
  const base: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  };
  const options = (language === 'ar') ? { ...base, calendar: 'gregory' } : base;
  const locale = language || undefined;
  try {
    return new Intl.DateTimeFormat(locale, options).format(d);
  } catch {
    const { calendar: _cal, ...rest } = options as any;
    return new Intl.DateTimeFormat(locale, rest).format(d);
  }
}
