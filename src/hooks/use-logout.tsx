
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToastHelper } from "./use-toast-helper";

/**
 * Custom hook that provides a logout function that handles the logout process
 * and includes proper logging, error handling, and toast notifications.
 */
export function useLogout() {
  const { logout } = useAuth();
  const { showSuccess, showError } = useToastHelper();

  /**
   * Handles the logout process, with proper error handling and notifications
   */
  const handleLogout = async (): Promise<void> => {
    console.log(`[${new Date().toISOString()}] useLogout: Initiating logout process`);
    
    try {
      await logout();
      console.log(`[${new Date().toISOString()}] useLogout: Logout successful, navigation handled by ProtectedRoute`);
      
      // No need to navigate manually - ProtectedRoute will handle redirection
      // This prevents navigation race conditions
      
      showSuccess("You have been logged out successfully");
    } catch (error) {
      console.error(`[${new Date().toISOString()}] useLogout: Error during logout:`, error);
      showError("Failed to log out. Please try again.");
    }
  };

  return { handleLogout };
}
