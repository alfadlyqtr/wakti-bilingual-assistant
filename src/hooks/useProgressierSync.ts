
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { progressierService } from '@/services/progressierService';
import { getCurrentUser } from '@/utils/auth';

export function useProgressierSync() {
  const { user, loading } = useAuth();
  const [isSync, setIsSync] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const syncUser = async () => {
      if (loading || !user || isSync) return;

      try {
        console.log('Starting Progressier sync for user:', user.id);
        
        // Get additional user data
        const fullUser = await getCurrentUser();
        const userMetadata = fullUser?.user_metadata || {};
        
        // Prepare user data for Progressier
        const userData = {
          userId: user.id,
          email: user.email || undefined,
          displayName: userMetadata.display_name || user.email || 'WAKTI User',
          tags: ['wakti-user'], // Basic tag for all users
        };

        await progressierService.addUser(userData);
        
        if (isMounted) {
          setIsSync(true);
          setSyncError(null);
          console.log('Progressier sync completed successfully');
        }
      } catch (error) {
        console.error('Progressier sync failed:', error);
        if (isMounted) {
          setSyncError(error instanceof Error ? error.message : 'Sync failed');
        }
      }
    };

    // Wait for window load and a small delay to ensure Progressier script is ready
    if (document.readyState === 'complete') {
      setTimeout(syncUser, 1000);
    } else {
      window.addEventListener('load', () => {
        setTimeout(syncUser, 1000);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [user, loading, isSync]);

  const retrySync = async () => {
    setIsSync(false);
    setSyncError(null);
  };

  return {
    isSync,
    syncError,
    retrySync,
  };
}
