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
  dynamicSuggestions?: string[]; // 🎯 Context-aware suggestions from code mode
}

// 🎯 PRIORITY 1: Extract options from AI questions (emoji-prefixed lines)
// When AI asks "Would you like me to:" with options, extract those as chips
const extractQuestionOptions = (content: string): QuickAction[] => {
  const options: QuickAction[] = [];
  
  // Pattern: Lines starting with emoji like 🔍, 🔗, 📝, ✨, etc. followed by text
  const emojiPattern = /[🔍🔗📝✨🎨💡🔧⚡🚀📦🎯✅❌🔄📋🛠️]\s*([^\n?]+)\??/g;
  
  const matches = content.matchAll(emojiPattern);
  for (const match of matches) {
    const optionText = match[1].trim().replace(/[?？]$/, '').trim();
    // Only include reasonable length options
    if (optionText.length > 3 && optionText.length < 80) {
      options.push({
        id: `option-${options.length}`,
        label: optionText,
        labelAr: optionText, // Keep original for now
        icon: <Sparkles className="w-3.5 h-3.5" />,
        prompt: optionText, // Use the option text as the prompt
        category: 'features'
      });
    }
  }
  
  return options.slice(0, 3); // Max 3 question options
};

// Generate context-aware actions based on AI response content
// Returns EMPTY array if no strong match found (no static fallback)
const generateActionsFromResponse = (content: string): QuickAction[] => {
  // 🎯 FIRST: Check if AI asked a question with options
  const questionOptions = extractQuestionOptions(content);
  if (questionOptions.length >= 2) {
    console.log('[QuickActionButtons] Found AI question options:', questionOptions.map(o => o.label));
    return questionOptions;
  }
  
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
  if (lowerContent.includes('form') || lowerContent.includes('input') || lowerContent.includes('field') || lowerContent.includes('submit')) {
    actions.push(
      { id: 'validation', label: 'Add Validation', labelAr: 'إضافة تحقق', icon: <Shield className="w-3.5 h-3.5" />, prompt: 'Add form validation with error messages and success states', category: 'security' },
      { id: 'submit-animation', label: 'Add Submit Animation', labelAr: 'إضافة حركة الإرسال', icon: <Sparkles className="w-3.5 h-3.5" />, prompt: 'Add loading spinner and success animation on form submit', category: 'design' }
    );
  }

  // List/Table-related actions
  if (lowerContent.includes('list') || lowerContent.includes('table') || lowerContent.includes('items') || lowerContent.includes('grid')) {
    actions.push(
      { id: 'filtering', label: 'Add Filtering', labelAr: 'إضافة تصفية', icon: <Zap className="w-3.5 h-3.5" />, prompt: 'Add filtering options to filter the data', category: 'features' },
      { id: 'sorting', label: 'Add Sorting', labelAr: 'إضافة ترتيب', icon: <Zap className="w-3.5 h-3.5" />, prompt: 'Add sorting functionality to the list/table', category: 'features' }
    );
  }

  // Image/Carousel-related actions
  if (lowerContent.includes('image') || lowerContent.includes('carousel') || lowerContent.includes('gallery') || lowerContent.includes('photo') || lowerContent.includes('slider')) {
    actions.push(
      { id: 'change-images', label: 'Change Images', labelAr: 'تغيير الصور', icon: <Palette className="w-3.5 h-3.5" />, prompt: 'Change the images to different ones', category: 'design' },
      { id: 'add-lightbox', label: 'Add Lightbox', labelAr: 'إضافة عرض مكبر', icon: <Zap className="w-3.5 h-3.5" />, prompt: 'Add lightbox popup when clicking on images', category: 'features' }
    );
  }

  // Button-related actions
  if (lowerContent.includes('button') || lowerContent.includes('cta') || lowerContent.includes('click')) {
    actions.push(
      { id: 'hover-effect', label: 'Add Hover Effect', labelAr: 'إضافة تأثير hover', icon: <Sparkles className="w-3.5 h-3.5" />, prompt: 'Add smooth hover effect and transition to the button', category: 'design' },
      { id: 'icon', label: 'Add Icon', labelAr: 'إضافة أيقونة', icon: <Plus className="w-3.5 h-3.5" />, prompt: 'Add an appropriate icon to the button', category: 'design' }
    );
  }

  // Backend/API-related actions
  if (lowerContent.includes('backend') || lowerContent.includes('api') || lowerContent.includes('database') || lowerContent.includes('supabase') || lowerContent.includes('fetch')) {
    actions.push(
      { id: 'error-handling', label: 'Add Error Handling', labelAr: 'إضافة معالجة الأخطاء', icon: <Shield className="w-3.5 h-3.5" />, prompt: 'Add proper error handling with user-friendly error messages', category: 'security' },
      { id: 'loading-state', label: 'Add Loading State', labelAr: 'إضافة حالة التحميل', icon: <Zap className="w-3.5 h-3.5" />, prompt: 'Add loading spinner while data is being fetched', category: 'features' }
    );
  }

  // Hero/Banner-related actions
  if (lowerContent.includes('hero') || lowerContent.includes('banner') || lowerContent.includes('landing')) {
    actions.push(
      { id: 'animate-hero', label: 'Animate Hero', labelAr: 'تحريك البانر', icon: <Sparkles className="w-3.5 h-3.5" />, prompt: 'Add entrance animations to the hero section', category: 'design' },
      { id: 'parallax', label: 'Add Parallax', labelAr: 'إضافة تأثير Parallax', icon: <Zap className="w-3.5 h-3.5" />, prompt: 'Add parallax scrolling effect to the hero section', category: 'features' }
    );
  }

  // Card-related actions  
  if (lowerContent.includes('card') || lowerContent.includes('tile') || lowerContent.includes('box')) {
    actions.push(
      { id: 'hover-lift', label: 'Add Hover Lift', labelAr: 'إضافة رفع عند التحويم', icon: <Sparkles className="w-3.5 h-3.5" />, prompt: 'Add lift/scale effect on card hover', category: 'design' },
      { id: 'shadow', label: 'Add Shadow', labelAr: 'إضافة ظل', icon: <Palette className="w-3.5 h-3.5" />, prompt: 'Add elegant shadow to the card', category: 'design' }
    );
  }

  // Products/Shop page mentioned
  if (lowerContent.includes('product') || lowerContent.includes('shop') || lowerContent.includes('inventory')) {
    actions.push(
      { id: 'link-products', label: 'Add products link to header', labelAr: 'أضف رابط المنتجات للهيدر', icon: <Plus className="w-3.5 h-3.5" />, prompt: 'Add a link to the products page in the header navigation', category: 'features' },
      { id: 'show-products', label: 'Show products page', labelAr: 'اعرض صفحة المنتجات', icon: <Zap className="w-3.5 h-3.5" />, prompt: 'Show me the products page in the preview', category: 'features' }
    );
  }

  // Page/File mentioned
  if (lowerContent.includes('page') || lowerContent.includes('.js') || lowerContent.includes('.tsx') || lowerContent.includes('file')) {
    actions.push(
      { id: 'add-link', label: 'Add link to this page', labelAr: 'أضف رابط لهذه الصفحة', icon: <Plus className="w-3.5 h-3.5" />, prompt: 'Add a navigation link to this page', category: 'features' },
      { id: 'edit-page', label: 'Edit this page', labelAr: 'عدّل هذه الصفحة', icon: <Zap className="w-3.5 h-3.5" />, prompt: 'Make changes to this page', category: 'features' }
    );
  }

  // NO STATIC FALLBACK - only return actions if there's context
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
  dynamicSuggestions = [],
}) => {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  // 🎯 PRIORITY: Use dynamic suggestions if provided, otherwise generate from response
  const actions = useMemo(() => {
    // If we have dynamic suggestions from code mode, use those first
    if (dynamicSuggestions.length > 0) {
      return dynamicSuggestions.map((suggestion, idx) => ({
        id: `dynamic-${idx}`,
        label: suggestion,
        labelAr: suggestion,
        icon: <Sparkles className="w-3.5 h-3.5" />,
        prompt: suggestion,
        category: 'features' as const
      }));
    }
    // Otherwise, generate from response content
    return generateActionsFromResponse(responseContent);
  }, [responseContent, dynamicSuggestions]);

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
