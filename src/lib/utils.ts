
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helper function to get color by entry type
export function getEntryTypeColor(type: string): string {
  switch(type) {
    case 'task':
      return 'green-500';
    case 'event':
      return 'blue-500';
    case 'reminder':
      return 'red-500';
    case 'manual_note':
      return 'yellow-500';
    default:
      return 'gray-500';
  }
}

// Safe date formatting helper
export function isValidDate(date: any): boolean {
  if (!date) return false;
  const d = new Date(date);
  return !isNaN(d.getTime());
}
