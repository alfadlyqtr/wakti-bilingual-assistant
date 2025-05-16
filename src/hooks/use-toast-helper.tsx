
import { useToast } from "./use-toast";
import { useTheme } from "@/providers/ThemeProvider";

export function useToastHelper() {
  const { toast } = useToast();
  const { language } = useTheme();

  const showSuccess = (message: string) => {
    console.log('Showing success toast:', message);
    toast({
      title: message,
      variant: "success",
      duration: 3000
    });
  };

  const showError = (message: string) => {
    console.log('Showing error toast:', message);
    toast({
      title: message,
      variant: "destructive",
      duration: 5000
    });
  };

  const showInfo = (message: string) => {
    console.log('Showing info toast:', message);
    toast({
      title: message,
      duration: 3000
    });
  };

  const showLoading = (message: string) => {
    console.log('Showing loading toast:', message);
    return toast({
      title: message,
      duration: 9999999, // Long duration to keep it visible until dismissed
    });
  };

  return {
    showSuccess,
    showError,
    showInfo,
    showLoading
  };
}
