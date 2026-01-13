import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Palette, Zap, Shield, Smartphone, Database, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface QuickAction {
  id: string;
  label: string;
  labelAr: string;
  icon: React.ReactNode;
  prompt: string;
  category: 'design' | 'features' | 'security' | 'mobile' | 'backend';
}

interface QuickActionButtonsProps {
  responseContent: string;
  onActionClick: (prompt: string) => void;
  isRTL?: boolean;
  className?: string;
}

// Generate context-aware actions based on AI response content
const generateActionsFromResponse = (content: string): QuickAction[] => {
  const actions: QuickAction[] = [];
  const lowerContent = content.toLowerCase();

  // Navigation-related actions
  if (lowerContent.includes('navigation') || lowerContent.includes('nav') || lowerContent.includes('menu') || lowerContent.includes('header')) {
    actions.push(
      { id: 'mobile-menu', label: 'Add Mobile Menu', labelAr: 'إضافة قائمة الجوال', icon: <Smartphone className="w-3.5 h-3.5" />, prompt: 'Add a responsive mobile hamburger menu with smooth animations', category: 'mobile' },
      { id: 'search', label: 'Add Search', labelAr: 'إضافة بحث', icon: <Zap className="w-3.5 h-3.5" />, prompt: 'Add a search functionality to the navigation', category: 'features' }
    );
  }

  // Form-related actions
  if (lowerContent.includes('form') || lowerContent.includes('input') || lowerContent.includes('field')) {
    actions.push(
      { id: 'validation', label: 'Add Validation', labelAr: 'إضافة تحقق', icon: <Shield className="w-3.5 h-3.5" />, prompt: 'Add form validation with error messages and success states', category: 'security' },
      { id: 'submit-animation', label: 'Add Submit Animation', labelAr: 'إضافة حركة الإرسال', icon: <Sparkles className="w-3.5 h-3.5" />, prompt: 'Add loading spinner and success animation on form submit', category: 'design' }
    );
  }

  // List/Table-related actions
  if (lowerContent.includes('list') || lowerContent.includes('table') || lowerContent.includes('data') || lowerContent.includes('items')) {
    actions.push(
      { id: 'filtering', label: 'Add Filtering', labelAr: 'إضافة تصفية', icon: <Zap className="w-3.5 h-3.5" />, prompt: 'Add filtering options to filter the data', category: 'features' },
      { id: 'sorting', label: 'Add Sorting', labelAr: 'إضافة ترتيب', icon: <Zap className="w-3.5 h-3.5" />, prompt: 'Add sorting functionality to the list/table', category: 'features' },
      { id: 'pagination', label: 'Add Pagination', labelAr: 'إضافة ترقيم', icon: <Zap className="w-3.5 h-3.5" />, prompt: 'Add pagination with page numbers and navigation', category: 'features' }
    );
  }

  // Component/UI-related actions
  if (lowerContent.includes('component') || lowerContent.includes('card') || lowerContent.includes('button') || lowerContent.includes('ui')) {
    actions.push(
      { id: 'animations', label: 'Add Animations', labelAr: 'إضافة حركات', icon: <Sparkles className="w-3.5 h-3.5" />, prompt: 'Add smooth entrance and hover animations using framer-motion', category: 'design' },
      { id: 'responsive', label: 'Make Responsive', labelAr: 'جعله متجاوب', icon: <Smartphone className="w-3.5 h-3.5" />, prompt: 'Ensure the component is fully responsive on all screen sizes', category: 'mobile' }
    );
  }

  // Backend/API-related actions
  if (lowerContent.includes('backend') || lowerContent.includes('api') || lowerContent.includes('database') || lowerContent.includes('supabase')) {
    actions.push(
      { id: 'auth', label: 'Add Authentication', labelAr: 'إضافة مصادقة', icon: <Shield className="w-3.5 h-3.5" />, prompt: 'Add user authentication to protect this feature', category: 'security' },
      { id: 'error-handling', label: 'Add Error Handling', labelAr: 'إضافة معالجة الأخطاء', icon: <Shield className="w-3.5 h-3.5" />, prompt: 'Add proper error handling with user-friendly error messages', category: 'security' }
    );
  }

  // Style-related actions
  if (lowerContent.includes('style') || lowerContent.includes('css') || lowerContent.includes('design') || lowerContent.includes('color')) {
    actions.push(
      { id: 'dark-mode', label: 'Add Dark Mode', labelAr: 'إضافة الوضع الداكن', icon: <Palette className="w-3.5 h-3.5" />, prompt: 'Add dark mode support with theme toggle', category: 'design' },
      { id: 'spacing', label: 'Improve Spacing', labelAr: 'تحسين المسافات', icon: <Palette className="w-3.5 h-3.5" />, prompt: 'Improve spacing and visual hierarchy', category: 'design' }
    );
  }

  // Default fallback actions if nothing matched
  if (actions.length === 0) {
    actions.push(
      { id: 'animations', label: 'Add Animations', labelAr: 'إضافة حركات', icon: <Sparkles className="w-3.5 h-3.5" />, prompt: 'Add smooth animations to enhance the user experience', category: 'design' },
      { id: 'responsive', label: 'Make Responsive', labelAr: 'جعله متجاوب', icon: <Smartphone className="w-3.5 h-3.5" />, prompt: 'Ensure everything is fully responsive on mobile devices', category: 'mobile' },
      { id: 'improve', label: 'Improve Design', labelAr: 'تحسين التصميم', icon: <Palette className="w-3.5 h-3.5" />, prompt: 'Improve the overall visual design and polish', category: 'design' }
    );
  }

  // Limit to 4 actions max
  return actions.slice(0, 4);
};

const categoryColors: Record<string, string> = {
  design: 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20',
  features: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
  security: 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20',
  mobile: 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20',
  backend: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20',
};

export const QuickActionButtons: React.FC<QuickActionButtonsProps> = ({
  responseContent,
  onActionClick,
  isRTL = false,
  className = '',
}) => {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const actions = useMemo(() => generateActionsFromResponse(responseContent), [responseContent]);

  if (actions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.3 }}
      className={`flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50 ${isRTL ? 'flex-row-reverse' : ''} ${className}`}
    >
      {actions.map((action, index) => (
        <motion.div
          key={action.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 * index, duration: 0.2 }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => onActionClick(action.prompt)}
            className={`h-8 text-xs font-medium border transition-all duration-200 ${categoryColors[action.category]}`}
          >
            <Plus className="w-3 h-3 mr-1" />
            {action.icon}
            <span className={`${isArabic ? 'mr-1.5' : 'ml-1.5'}`}>
              {isArabic ? action.labelAr : action.label}
            </span>
          </Button>
        </motion.div>
      ))}
    </motion.div>
  );
};

export default QuickActionButtons;
