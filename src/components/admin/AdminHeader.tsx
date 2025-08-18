
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { LogOut } from "lucide-react";

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}

export const AdminHeader = ({ title, subtitle, icon, children }: AdminHeaderProps) => {
  const navigate = useNavigate();

  const handleBackToAdmin = () => {
    console.log('Admin Header - navigating back to admin dashboard');
    navigate('/admindash');
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[AdminHeader] signOut error', err);
    } finally {
      try { localStorage.removeItem('admin_session'); } catch {}
      navigate('/mqtr');
    }
  };

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border px-4 sm:px-6 lg:px-8 py-3">
      <div className="space-y-3">
        {/* Top Line: Title + Subtitle + Theme Toggle + Logout */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold leading-none text-foreground flex items-center gap-2">
            {title}
            {subtitle && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground font-normal">{subtitle}</span>
              </>
            )}
          </h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="outline"
              size="icon"
              onClick={handleLogout}
              className="w-9 h-9 rounded-full bg-gradient-card border-accent/30 hover:shadow-glow transition-all duration-300 hover:scale-110"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
        
        {/* Bottom Line: AD Button + Icon + Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToAdmin}
              className="rounded-full border border-border bg-background/50 text-foreground hover:bg-accent font-medium text-xs px-3 py-1.5"
            >
              AD
            </Button>
            {icon}
          </div>
          <div className="flex items-center gap-3">
            {children}
          </div>
        </div>
      </div>
    </header>
  );
};
