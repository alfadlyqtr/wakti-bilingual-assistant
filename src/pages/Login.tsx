
import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import { Logo3D } from "@/components/Logo3D";
import { LoginForm } from "@/components/LoginForm";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Define the type for location state
interface LocationState {
  from?: string;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useTheme();
  const { user, session, isLoading: authLoading } = useAuth();
  const navigationInProgress = useRef(false);
  
  // Get the location state to know where to redirect after login
  const locationState = location.state as LocationState;
  const from = locationState?.from || "/dashboard";

  // Add effect to check auth state and redirect if already logged in
  useEffect(() => {
    console.log("Login: Auth state check", { 
      user: !!user, 
      session: !!session, 
      authLoading,
      currentPath: location.pathname,
      redirectTo: from
    });
    
    if (user && session && !authLoading && !navigationInProgress.current) {
      console.log("Login: User already authenticated, redirecting to:", from);
      navigationInProgress.current = true;
      setTimeout(() => {
        navigate(from);
        navigationInProgress.current = false;
      }, 100);
    }
  }, [user, session, authLoading, navigate, location.pathname, from]);

  return (
    <div className="mobile-container">
      <header className="mobile-header">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 mr-2"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs">{language === 'en' ? 'Back to Home' : 'العودة للرئيسية'}</span>
          </Button>
        </div>
        <ThemeLanguageToggle />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="flex min-h-[80vh] flex-col justify-center py-6 px-6 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            {/* App logo with navigation to home */}
            <div 
              className="inline-block cursor-pointer mb-4"
              onClick={() => navigate("/")}
            >
              <Logo3D size="lg" />
            </div>
            <h1 className="text-2xl font-bold">
              {language === 'en' ? 'Login' : 'تسجيل الدخول'}
            </h1>
          </div>

          <LoginForm 
            redirectTo={from}
            showForgotPassword={true}
            showSignupLink={true}
          />
        </div>
      </div>
    </div>
  );
}
