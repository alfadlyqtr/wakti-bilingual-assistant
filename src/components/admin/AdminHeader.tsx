
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

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

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border px-4 sm:px-6 lg:px-8 py-3">
      <div className="space-y-3">
        {/* Top Line: Title + Subtitle + Theme Toggle */}
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
          <ThemeToggle />
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
