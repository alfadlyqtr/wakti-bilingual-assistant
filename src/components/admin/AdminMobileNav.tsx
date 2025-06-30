
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users, MessageSquare, CreditCard, Gift, Receipt } from "lucide-react";

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
      label: 'Subs',
      color: 'text-accent-blue'
    },
    {
      id: 'fawran',
      path: '/admin/fawran-payments',
      icon: Receipt,
      label: 'Fawran',
      color: 'text-accent-purple'
    },
    {
      id: 'quotas',
      path: '/admin/quotas',
      icon: Gift,
      label: 'Quotas',
      color: 'text-accent-cyan'
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-border/30 bg-gradient-nav backdrop-blur-xl shadow-vibrant px-1 py-2 z-40">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-5 gap-1">
          {navItems.map(({ id, path, icon: Icon, label, color }) => (
            <Button
              key={id}
              variant={isActive(path) ? 'default' : 'outline'}
              size="sm"
              onClick={() => navigate(path)}
              className={`
                flex flex-col items-center justify-center h-12 w-full rounded-lg transition-all duration-300
                ${isActive(path) 
                  ? 'btn-enhanced shadow-colored scale-105 border-accent-blue/30' 
                  : 'btn-secondary-enhanced hover:scale-105 hover:shadow-glow'
                }
              `}
            >
              <Icon className={`h-3 w-3 mb-0.5 ${isActive(path) ? 'text-white' : color}`} />
              <span className="text-xs font-semibold">{label}</span>
            </Button>
          ))}
        </div>
      </div>
    </nav>
  );
};
