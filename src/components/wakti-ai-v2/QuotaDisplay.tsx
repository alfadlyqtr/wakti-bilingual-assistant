
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';

interface QuotaDisplayProps {
  quotaStatus?: any;
  searchQuotaStatus?: any;
  activeTrigger?: string;
}

export function QuotaDisplay({ quotaStatus, searchQuotaStatus, activeTrigger }: QuotaDisplayProps) {
  const { language } = useTheme();

  // QUOTA REMOVAL: No longer display any quota information
  // All users now have unlimited access to search functionality
  return null;
}
