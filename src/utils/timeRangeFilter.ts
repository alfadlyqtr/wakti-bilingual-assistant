export type TimeRange = '1d' | '1w' | '2w' | '1m' | '3m' | '6m';

/**
 * Get the cutoff date for a given time range
 */
export function getDateForTimeRange(timeRange: TimeRange): Date {
  const now = new Date();
  const daysMap: Record<TimeRange, number> = {
    '1d': 1,
    '1w': 7,
    '2w': 14,
    '1m': 30,
    '3m': 90,
    '6m': 180,
  };
  
  const days = daysMap[timeRange];
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Filter array of items by date field and time range
 */
export function filterByTimeRange<T extends { start?: string; end?: string; created_at?: string; date?: string }>(
  items: T[],
  timeRange: TimeRange
): T[] {
  const cutoffDate = getDateForTimeRange(timeRange);
  
  return items.filter(item => {
    // Try different date fields that might exist
    const dateStr = item.start || item.end || item.created_at || item.date;
    if (!dateStr) return true; // Keep items without dates
    
    const itemDate = new Date(dateStr);
    return itemDate >= cutoffDate;
  });
}

/**
 * Get the most recent item from an array
 */
export function getMostRecent<T extends { start?: string; end?: string; created_at?: string; date?: string }>(
  items: T[]
): T | null {
  if (!items || items.length === 0) return null;
  
  return items.reduce((latest, current) => {
    const latestDate = new Date(latest.start || latest.end || latest.created_at || latest.date || 0);
    const currentDate = new Date(current.start || current.end || current.created_at || current.date || 0);
    return currentDate > latestDate ? current : latest;
  });
}
