import { } from "react";
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
  
  // Get the location state to know where to redirect after login
  const locationState = location.state as LocationState;
  const from = locationState?.from || "/dashboard";

  // Navigation is now handled synchronously in LoginForm.tsx
  // This useEffect has been removed to eliminate the 100ms race condition

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-indigo-950/30 dark:via-background dark:to-purple-950/30">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
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
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-[calc(100vh-120px)] flex-col justify-center">
          <div className="w-full max-w-md mx-auto">
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

    </div>
  );
}
