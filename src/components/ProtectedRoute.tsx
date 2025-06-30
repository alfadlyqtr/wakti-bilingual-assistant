
import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import SubscriptionOverlay from '@/components/SubscriptionOverlay';

interface ProtectedRouteProps {
  children: ReactNode;
  requireSubscription?: boolean;
}

export default function ProtectedRoute({ 
  children, 
  requireSubscription = true 
}: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const [showSubscriptionOverlay, setShowSubscriptionOverlay] = useState(false);

  useEffect(() => {
    // Show subscription overlay if user is not subscribed and subscription is required
    if (user && profile && requireSubscription && !profile.is_subscribed) {
      setShowSubscriptionOverlay(true);
    }
  }, [user, profile, requireSubscription]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Show subscription overlay if needed
  if (showSubscriptionOverlay) {
    return (
      <>
        {children}
        <SubscriptionOverlay 
          onClose={() => setShowSubscriptionOverlay(false)} 
        />
      </>
    );
  }

  return <>{children}</>;
}
