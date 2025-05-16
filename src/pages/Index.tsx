
import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast"; // Direct import from hooks
import { useTheme } from "@/providers/ThemeProvider";

export default function Index() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Show welcome toast
    toast.success({
      title: "Welcome to WAKTI",
      description: "Your smart personal assistant"
    });
    
    // Redirect to login or dashboard
    navigate("/login");
  }, [navigate]);
  
  return <div className="loading">Loading...</div>;
}
