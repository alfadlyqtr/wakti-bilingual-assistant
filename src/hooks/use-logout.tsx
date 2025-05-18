
import { useAuth } from "@/contexts/AuthContext";
import { useToastHelper } from "./use-toast-helper";
import { useNavigate } from "react-router-dom";

/**
 * Custom hook that provides a logout function that handles the logout process
 */
export function useLogout() {
  const { logout } = useAuth();
  const { showSuccess, showError } = useToastHelper();
  const navigate = useNavigate();

  /**
   * Handles the logout process - calls the logout function from AuthContext
   * and handles navigation after logout is complete
   */
  const handleLogout = async (): Promise<void> => {
    console.log(`[${new Date().toISOString()}] useLogout: Initiating logout process`);
    
    try {
      const result = await logout();
      
      if (result.success) {
        // Only navigate here after successful logout
        console.log(`[${new Date().toISOString()}] useLogout: Logout successful, redirecting to login`);
        navigate('/login', { replace: true });
      } else {
        showError(result.error || "Failed to log out. Please try again.");
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] useLogout: Error during logout:`, error);
      showError("Failed to log out. Please try again.");
    }
  };

  return { handleLogout };
}
