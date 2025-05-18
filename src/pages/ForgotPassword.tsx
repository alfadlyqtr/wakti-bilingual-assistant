
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo3D } from "@/components/Logo3D";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      console.log(`[${new Date().toISOString()}] ForgotPassword: Sending reset instructions to ${email}`);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) {
        console.error(`[${new Date().toISOString()}] ForgotPassword: Error sending reset instructions:`, error);
        toast({
          title: "Failed to Send Instructions",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      
      console.log(`[${new Date().toISOString()}] ForgotPassword: Reset instructions sent successfully`);
      setSubmitted(true);
      toast({
        title: "Instructions Sent",
        description: "Check your email for password reset instructions.",
        variant: "default",
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ForgotPassword: Unexpected error:`, error);
      toast({
        title: "Failed to Send Instructions",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header with logo and theme toggle */}
      <div className="flex items-center justify-between p-4">
        <Logo3D size="sm" onClick={() => navigate('/home')} />
        <ThemeLanguageToggle />
      </div>
      
      {/* Forgot password form */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Logo3D size="lg" className="mx-auto mb-4" />
            <h1 className="text-2xl font-bold">{t("reset_password", language)}</h1>
            {!submitted ? (
              <p className="text-muted-foreground mt-2">{t("reset_instructions", language)}</p>
            ) : (
              <p className="text-muted-foreground mt-2">
                We've sent instructions to <strong>{email}</strong>. 
                Check your email and follow the instructions to reset your password.
              </p>
            )}
          </div>
          
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">{t("email", language)}</Label>
                <Input 
                  id="email"
                  type="email" 
                  placeholder={t("email_placeholder", language)}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full"
                  disabled={loading}
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={loading}
              >
                {loading ? "Sending..." : t("send_instructions", language)}
              </Button>
              
              <div className="text-center">
                <Button 
                  type="button" 
                  variant="link" 
                  className="mt-2"
                  onClick={() => navigate('/login')}
                >
                  {t("back_to_login", language)}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <Button 
                className="w-full"
                onClick={() => navigate('/login')}
              >
                {t("back_to_login", language)}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
