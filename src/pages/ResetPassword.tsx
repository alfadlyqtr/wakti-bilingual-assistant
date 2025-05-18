import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/providers/ThemeProvider";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useTheme();

  // Get token from URL parameters
  const token = searchParams.get("token");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!token) {
      toast({
        title: language === 'en' ? "Invalid reset link" : "رابط إعادة التعيين غير صالح",
        description: language === 'en' ? "Please request a new password reset link" : "يرجى طلب رابط جديد لإعادة تعيين كلمة المرور",
        variant: "destructive",
      });
      return;
    }
    
    if (password !== confirmPassword) {
      toast({
        title: language === 'en' ? "Passwords don't match" : "كلمات المرور غير متطابقة",
        description: language === 'en' ? "Please make sure both passwords match" : "يرجى التأكد من تطابق كلمتي المرور",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await resetPassword(token, password);
      if (error) {
        toast({
          title: language === 'en' ? "Password reset failed" : "فشل إعادة تعيين كلمة المرور",
          description: error.error?.message || "An error occurred during password reset",
          variant: "destructive", 
        });
      } else {
        toast({
          title: language === 'en' ? "Password reset successful" : "تم إعادة تعيين كلمة المرور بنجاح",
          description: language === 'en' ? "You can now log in with your new password" : "يمكنك الآن تسجيل الدخول باستخدام كلمة المرور الجديدة",
          variant: "success",
        });
        navigate("/login");
      }
    } catch (error) {
      toast({
        title: language === 'en' ? "Password reset failed" : "فشل إعادة تعيين كلمة المرور",
        description: language === 'en' ? "Please try again or request a new reset link" : "يرجى المحاولة مرة أخرى أو طلب رابط إعادة تعيين جديد",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your new password below
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              id="password"
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <Input
              id="confirm-password"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full"
            />
          </div>
          
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Resetting..." : "Reset Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
