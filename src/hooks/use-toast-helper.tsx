
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
    });
  };

  const showError = (message: string) => {
    console.log('Showing error toast:', message);
    toast({
      title: message,
      variant: "destructive",
    });
  };

  const showInfo = (message: string) => {
    console.log('Showing info toast:', message);
    toast({
      title: message,
    });
  };

  return {
    showSuccess,
    showError,
    showInfo,
  };
}
