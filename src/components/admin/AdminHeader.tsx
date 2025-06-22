
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}

export const AdminHeader = ({ title, subtitle, icon, children }: AdminHeaderProps) => {
  const navigate = useNavigate();

  const handleBackToAdmin = () => {
    console.log('AD button clicked - navigating to /admindash');
    navigate('/admindash');
  };

  return (
    <header className="bg-gradient-nav backdrop-blur-xl border-b border-border/50 px-3 sm:px-6 py-3 sm:py-4 sticky top-0 z-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToAdmin}
            className="rounded-full hover:bg-accent/10 font-bold text-sm sm:text-lg px-2 sm:px-3 bg-gradient-primary text-white hover:bg-gradient-secondary transition-all duration-300"
          >
            AD
          </Button>
          {icon}
          <div>
            <h1 className="text-base sm:text-lg lg:text-xl font-bold text-enhanced-heading">{title}</h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {children && (
          <div className="flex items-center space-x-2">
            {children}
          </div>
        )}
      </div>
    </header>
  );
};
