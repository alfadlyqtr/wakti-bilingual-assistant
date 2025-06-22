
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users, MessageSquare, CreditCard, Gift } from "lucide-react";

export const AdminMobileNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    {
      id: 'users',
      path: '/admin/users',
      icon: Users,
      label: 'Users',
      color: 'text-accent-green'
    },
    {
      id: 'messages',
      path: '/admin/messages',
      icon: MessageSquare,
      label: 'Messages',
      color: 'text-accent-orange'
    },
    {
      id: 'subscriptions',
      path: '/admin/subscriptions',
      icon: CreditCard,
      label: 'Subscriptions',
      color: 'text-accent-blue'
    },
    {
      id: 'quotas',
      path: '/admin/quotas',
      icon: Gift,
      label: 'Quotas',
      color: 'text-accent-purple'
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-border/30 bg-gradient-nav backdrop-blur-xl shadow-vibrant px-2 sm:px-3 py-2 sm:py-3 z-40">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-4 gap-1 sm:gap-2">
          {navItems.map(({ id, path, icon: Icon, label, color }) => (
            <Button
              key={id}
              variant={isActive(path) ? 'default' : 'outline'}
              size="sm"
              onClick={() => navigate(path)}
              className={`
                flex flex-col items-center justify-center h-12 sm:h-14 w-full rounded-lg transition-all duration-300
                ${isActive(path) 
                  ? 'btn-enhanced shadow-colored scale-105 border-accent-blue/30' 
                  : 'btn-secondary-enhanced hover:scale-105 hover:shadow-glow'
                }
              `}
            >
              <Icon className={`h-4 w-4 mb-0.5 ${isActive(path) ? 'text-white' : color}`} />
              <span className="text-xs font-semibold">{label}</span>
            </Button>
          ))}
        </div>
      </div>
    </nav>
  );
};
