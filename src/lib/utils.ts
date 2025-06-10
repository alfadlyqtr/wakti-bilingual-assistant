
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Enhanced date validation function that handles relative dates
export function isValidDate(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  
  // Handle relative dates
  const relativeDates = ['today', 'tomorrow', 'yesterday'];
  if (relativeDates.includes(dateString.toLowerCase())) {
    return true;
  }
  
  // Handle actual date strings
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

// Convert relative dates to actual dates
export function convertRelativeDate(dateString: string): string {
  if (!dateString) return '';
  
  const today = new Date();
  
  if (dateString.toLowerCase() === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  
  if (dateString.toLowerCase() === 'today') {
    return today.toISOString().split('T')[0];
  }
  
  if (dateString.toLowerCase() === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  
  // If it's already a valid date format, return as is
  const parsed = new Date(dateString);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  
  return dateString;
}

// Format date for display (user-friendly)
export function formatDateForDisplay(dateString: string): string {
  if (!dateString) return '';
  
  // Check if it's still a relative term
  if (dateString === 'tomorrow') {
    return 'Tomorrow';
  }
  if (dateString === 'today') {
    return 'Today';
  }
  if (dateString === 'yesterday') {
    return 'Yesterday';
  }
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Return original if can't parse
    }
    
    // Check if it's today, tomorrow, or yesterday by comparing dates
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const dateStr = date.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    if (dateStr === todayStr) {
      return 'Today';
    } else if (dateStr === tomorrowStr) {
      return 'Tomorrow';
    } else if (dateStr === yesterdayStr) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  } catch {
    return dateString;
  }
}
