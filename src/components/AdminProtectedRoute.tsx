import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AdminAuthProvider, useAdminAuth } from "@/contexts/AdminAuthContext";

interface AdminProtectedRouteProps {
  children: ReactNode;
}

function AdminProtectedRouteContent({ children }: AdminProtectedRouteProps) {
  const { isAdmin, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0c0f14] text-white/90 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Validating admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/mqtr" replace />;
  }

  return <>{children}</>;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  return (
    <AdminAuthProvider>
      <AdminProtectedRouteContent>{children}</AdminProtectedRouteContent>
    </AdminAuthProvider>
  );
}

