
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';

interface QuotaDisplayProps {
  quotaStatus?: any;
  searchQuotaStatus?: any;
  activeTrigger?: string;
}

export function QuotaDisplay({ quotaStatus, searchQuotaStatus, activeTrigger }: QuotaDisplayProps) {
  const { language } = useTheme();

  // QUOTA REMOVAL: Regular search quota completely removed
  // No longer display any quota information for regular searches
  // All users now have unlimited access to regular search functionality
  return null;
}
