
// This is a helper for toast messages to extend our existing toast functionality
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/providers/ThemeProvider";

export const useToastHelper = () => {
  const { toast } = useToast();
  const { language } = useTheme();
  
  const showSuccess = (message: string) => {
    toast({
      title: language === 'ar' ? 'نجاح' : 'Success',
      description: message,
      variant: "success"
    });
  };
  
  const showError = (message: string) => {
    toast({
      title: language === 'ar' ? 'خطأ' : 'Error',
      description: message,
      variant: "destructive"
    });
  };
  
  const showInfo = (message: string) => {
    toast({
      title: language === 'ar' ? 'معلومات' : 'Information',
      description: message,
      variant: "default"
    });
  };
  
  return { showSuccess, showError, showInfo };
};
