
import { toast } from "sonner";
import { useTheme } from "@/providers/ThemeProvider";

export function useToastHelper() {
  const { language } = useTheme();
  const DEFAULT_DURATION = 3000; // 3 seconds

  const showSuccess = (message: string, duration = DEFAULT_DURATION) => {
    console.log('Showing success toast:', message);
    toast.success(message, {
      duration
    });
  };

  const showError = (message: string, duration = DEFAULT_DURATION) => {
    console.log('Showing error toast:', message);
    toast.error(message, {
      duration
    });
  };

  const showInfo = (message: string, duration = DEFAULT_DURATION) => {
    console.log('Showing info toast:', message);
    toast(message, {
      duration
    });
  };

  const showLoading = (message: string, duration = Infinity) => {
    console.log('Showing loading toast:', message);
    return toast.loading(message, {
      duration
    });
  };

  return {
    showSuccess,
    showError,
    showInfo,
    showLoading
  };
}
