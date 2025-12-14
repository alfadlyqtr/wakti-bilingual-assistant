
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users, MessageSquare, CreditCard, Gift, Brain } from "lucide-react";

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
      id: 'quotas',
      path: '/admin/quotas',
      icon: Gift,
      label: 'Quotas',
      color: 'text-accent-cyan'
    },
    {
      id: 'ai-usage',
      path: '/admin/ai-usage',
      icon: Brain,
      label: 'AI',
      color: 'text-accent-purple'
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#0c0f14]/90 backdrop-blur-xl px-2 py-2 z-40">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-5 gap-1">
          {navItems.map(({ id, path, icon: Icon, label, color }) => (
            <Button
              key={id}
              variant="ghost"
              size="sm"
              onClick={() => navigate(path)}
              className={`
                flex flex-col items-center justify-center h-12 w-full rounded-lg transition-all duration-300
                ${isActive(path) 
                  ? 'bg-white/10 text-white border border-white/20' 
                  : 'text-white/70 hover:bg-white/5 hover:text-white/90'
                }
              `}
            >
              <Icon className={`h-3 w-3 mb-0.5 ${isActive(path) ? 'text-white' : color}`} />
              <span className="text-xs font-medium">{label}</span>
            </Button>
          ))}
        </div>
      </div>
    </nav>
  );
};
