import React, { ReactNode } from 'react';
import { GiftNotificationProvider } from '@/components/notifications/GiftNotificationProvider';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AppLayout } from '@/components/AppLayout';

interface ProtectedAppLayoutProps {
  children: ReactNode;
}

/**
 * Wrapper component that combines:
 * - GiftNotificationProvider (for gift notifications)
 * - ErrorBoundary (catches WebSocket/real-time errors)
 * - AppLayout (main app shell with navigation)
 * 
 * Use this for all protected routes to ensure graceful error handling.
 */
export function ProtectedAppLayout({ children }: ProtectedAppLayoutProps) {
  return (
    <GiftNotificationProvider>
      <ErrorBoundary>
        <AppLayout>
          {children}
        </AppLayout>
      </ErrorBoundary>
    </GiftNotificationProvider>
  );
}
