
import { useToast } from "./use-toast";
import { useTheme } from "@/providers/ThemeProvider";

export function useToastHelper() {
  const { toast } = useToast();
  const { language } = useTheme();

  const showSuccess = (message: string) => {
    toast({
      title: message,
      variant: "success",
    });
  };

  const showError = (message: string) => {
    toast({
      title: message,
      variant: "destructive",
    });
  };

  const showInfo = (message: string) => {
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
