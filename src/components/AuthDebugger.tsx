
import { useAuth } from "@/contexts/AuthContext";

const AuthDebugger = () => {
  const { user, session, isLoading } = useAuth();

  if (process.env.NODE_ENV === 'production') {
    return null; // Hide in production
  }

  const formatSession = () => {
    if (!session) return 'No active session';
    
    return {
      userId: session.user?.id,
      expiresAt: new Date(session.expires_at! * 1000).toLocaleTimeString(),
      accessToken: `${session.access_token.substring(0, 8)}...`,
    };
  };

  return (
    <div className="fixed bottom-4 right-4 p-2 bg-black/80 text-white rounded text-xs max-w-xs z-50 overflow-hidden">
      <div className="font-bold mb-1">Auth Debug:</div>
      <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
      <div>User: {user ? `${user.email} (${user.id.slice(0, 6)}...)` : 'None'}</div>
      <div>Session: {session ? 'Active' : 'None'}</div>
      <div className="text-xs text-gray-400 mt-1 break-all">
        {JSON.stringify(formatSession(), null, 2)}
      </div>
    </div>
  );
};

export default AuthDebugger;
