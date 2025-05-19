
import { useToast } from "./use-toast";
import { useTheme } from "@/providers/ThemeProvider";

export function useToastHelper() {
  const { toast } = useToast();
  const { language } = useTheme();
  const DEFAULT_DURATION = 3000; // 3 seconds

  const showSuccess = (message: string, duration = DEFAULT_DURATION) => {
    console.log('Showing success toast:', message);
    toast({
      title: message,
      variant: "success",
      duration
    });
  };

  const showError = (message: string, duration = DEFAULT_DURATION) => {
    console.log('Showing error toast:', message);
    toast({
      title: message,
      variant: "destructive",
      duration
    });
  };

  const showInfo = (message: string, duration = DEFAULT_DURATION) => {
    console.log('Showing info toast:', message);
    toast({
      title: message,
      duration
    });
  };

  const showLoading = (message: string, duration = Infinity) => {
    console.log('Showing loading toast:', message);
    return toast({
      title: message,
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
