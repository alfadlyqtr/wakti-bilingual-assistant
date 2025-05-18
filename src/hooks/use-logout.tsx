
import { useAuth } from "@/contexts/AuthContext";
import { useToastHelper } from "./use-toast-helper";

/**
 * Custom hook that provides a logout function that handles the logout process
 */
export function useLogout() {
  const { logout } = useAuth();
  const { showSuccess, showError } = useToastHelper();

  /**
   * Handles the logout process - calls the logout function from AuthContext
   */
  const handleLogout = async (): Promise<void> => {
    console.log(`[${new Date().toISOString()}] useLogout: Initiating logout process`);
    
    try {
      await logout();
      // Navigation is handled directly in the AuthContext
    } catch (error) {
      console.error(`[${new Date().toISOString()}] useLogout: Error during logout:`, error);
      showError("Failed to log out. Please try again.");
    }
  };

  return { handleLogout };
}
