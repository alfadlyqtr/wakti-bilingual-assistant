
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
    console.log('Admin Header - navigating back to admin dashboard');
    navigate('/admindash');
  };

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-[#0c0f14]/70 border-b border-white/5 px-4 sm:px-6 lg:px-8 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToAdmin}
            className="rounded-full border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 font-medium text-xs px-2 sm:px-3"
          >
            AD
          </Button>
          {icon}
          <div>
            <h1 className="text-base sm:text-lg font-semibold leading-none text-white/90">{title}</h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-white/70">{subtitle}</p>
            )}
          </div>
        </div>
        {children && (
          <div className="flex items-center gap-2 sm:gap-3">
            {children}
          </div>
        )}
      </div>
    </header>
  );
};
