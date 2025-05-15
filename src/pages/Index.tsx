
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useTheme } from "@/providers/ThemeProvider";

const Index = () => {
  const { language } = useTheme();

  useEffect(() => {
    toast({
      title: language === 'ar' ? "تم تحديث الإعدادات" : "Settings Updated",
      description: language === 'ar' 
        ? "تم تحديث إعدادات الأمان وسياسة دورة الحياة للتخزين" 
        : "Storage security and lifecycle policies have been updated",
      variant: "default",
    });
  }, [language]);

  return <Navigate to="/dashboard" replace />;
};

export default Index;
