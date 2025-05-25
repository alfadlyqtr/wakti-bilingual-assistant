
import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTheme } from "@/providers/ThemeProvider";

export default function Index() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Show welcome toast with 3 second auto-dismiss
    toast.success("Welcome to WAKTI", {
      description: "Your smart personal assistant",
      duration: 3000 // 3 seconds
    });
    
    // Redirect to home instead of login
    navigate("/home");
  }, [navigate]);
  
  return <div className="loading">Loading...</div>;
}
