export function formatDayLabel(dateStr: string, language: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const messageDate = new Date(date);
  messageDate.setHours(0, 0, 0, 0);

  if (messageDate.getTime() === today.getTime()) {
    return language === 'ar' ? 'اليوم' : 'Today';
  }
  if (messageDate.getTime() === yesterday.getTime()) {
    return language === 'ar' ? 'أمس' : 'Yesterday';
  }

  const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 7) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return language === 'ar' ? daysAr[messageDate.getDay()] : days[messageDate.getDay()];
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  const day = messageDate.getDate();
  const month = language === 'ar' ? monthsAr[messageDate.getMonth()] : months[messageDate.getMonth()];
  const year = messageDate.getFullYear();
  const currentYear = today.getFullYear();

  if (year === currentYear) {
    return `${day} ${month}`;
  }

  return `${day} ${month} ${year}`;
}

export function formatBubbleTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timeStr = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);

  if (sameDay || isYesterday) {
    return timeStr;
  }

  const datePart = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(d);

  const year = d.getFullYear();
  const currentYear = now.getFullYear();

  if (year === currentYear) {
    return `${datePart}, ${timeStr}`;
  }

  const dateWithYear = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);

  return `${dateWithYear}, ${timeStr}`;
}

export function isSameDay(date1: string | Date, date2: string | Date): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}
