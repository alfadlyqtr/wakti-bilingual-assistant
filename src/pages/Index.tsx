
import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function Index() {
  const navigate = useNavigate();
  const { user, session, loading } = useAuth();
  
  useEffect(() => {
    // Show welcome toast only once when component mounts
    toast.success("Welcome to WAKTI", {
      description: "Your smart personal assistant",
      duration: 3000 // 3 seconds
    });
  }, []);
  
  // Show loading while checking auth state
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  // If user is authenticated, redirect to home
  if (user && session) {
    return <Navigate to="/home" replace />;
  }
  
  // If not authenticated, redirect to login page
  return <Navigate to="/login" replace />;
}
