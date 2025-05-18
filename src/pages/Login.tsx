
import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Logo3D } from "@/components/Logo3D";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(supabase.auth.getUser());
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language, theme } = useTheme();
  
  // Check if user is already authenticated
  const isAuthenticated = !!user;
  
  // Log the initial authentication state
  console.log(`[${new Date().toISOString()}] Login: Initial authentication state:`, isAuthenticated ? "authenticated" : "not authenticated");

  // Handle login form submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(`[${new Date().toISOString()}] Login: Attempting login with email: ${email}`);
    
    try {
      setLoading(true);
      
      // Call Supabase auth sign-in API
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error(`[${new Date().toISOString()}] Login: Error during login:`, error.message);
        toast({
          title: t("login_failed", language),
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      
      // Log successful login
      console.log(`[${new Date().toISOString()}] Login: Successful login for user:`, data.user?.id);
      
      // Show success toast
      toast({
        title: t("login_successful", language),
        description: t("welcome_back", language),
        variant: "default",
      });
      
      // Navigate to dashboard immediately on successful login
      console.log(`[${new Date().toISOString()}] Login: Redirecting to dashboard after successful login`);
      navigate("/dashboard");
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Login: Unexpected error:`, error);
      toast({
        title: t("login_failed", language),
        description: t("unexpected_error", language),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // If already authenticated, redirect to dashboard
  if (isAuthenticated) {
    console.log(`[${new Date().toISOString()}] Login: User already authenticated, redirecting to dashboard`);
    return <Navigate to="/dashboard" replace />;
  }
  
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header with logo and theme toggle */}
      <div className="flex items-center justify-between p-4">
        <Logo3D size="sm" onClick={() => navigate('/home')} />
        <ThemeLanguageToggle />
      </div>
      
      {/* Login form */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Logo3D size="lg" className="mx-auto mb-4" />
            <h1 className="text-2xl font-bold">{t("login", language)}</h1>
            <p className="text-muted-foreground mt-2">{t("enter_credentials", language)}</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
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
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">{t("password", language)}</Label>
                <Button 
                  type="button" 
                  variant="link" 
                  size="sm" 
                  className="p-0 h-auto"
                  onClick={() => navigate('/forgot-password')}
                >
                  {t("forgot_password", language)}
                </Button>
              </div>
              <Input 
                id="password"
                type="password" 
                placeholder={t("password_placeholder", language)}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full"
                disabled={loading}
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={loading}
            >
              {loading ? t("logging_in", language) : t("login", language)}
            </Button>
            
            <div className="text-center text-sm">
              <span className="text-muted-foreground">{t("dont_have_account", language)}</span>{" "}
              <Button 
                type="button" 
                variant="link" 
                size="sm" 
                className="p-0 h-auto"
                onClick={() => navigate('/signup')}
              >
                {t("signup", language)}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
