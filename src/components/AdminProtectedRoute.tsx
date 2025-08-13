
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { adminSwBypass } from "@/utils/adminSwBypass";

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { isLoading, isAdmin } = useAdminAuth();

  useEffect(() => { adminSwBypass(); }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Validating admin access...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/mqtr" replace />;
  }

  return <>{children}</>;
}
