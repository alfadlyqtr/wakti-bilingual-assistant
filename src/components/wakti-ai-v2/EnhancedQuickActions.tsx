import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, Palette, Zap, Shield, Smartphone, Database, Sparkles, 
  Image, Search, RefreshCw, Lightbulb, FileText, Calendar, 
  MessageSquare, Music, Video, Map, Share2, Download, 
  Settings, HelpCircle, ExternalLink, Code, Layout
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface QuickAction {
  id: string;
  label: string;
  labelAr: string;
  icon: React.ReactNode;
  prompt: string;
  category: 'design' | 'features' | 'security' | 'mobile' | 'backend' | 'content' | 'ai' | 'media';
  priority: number; // Higher = more relevant
}

interface QuickActionButtonsProps {
  responseContent: string;
  onActionClick: (prompt: string) => void;
  isRTL?: boolean;
  className?: string;
  messageContext?: {
    intent?: string;
    hasImage?: boolean;
    hasBrowsing?: boolean;
    hasError?: boolean;
    isTask?: boolean;
    isReminder?: boolean;
  };
}

// Enhanced context-aware action generation with priority scoring
const generateActionsFromResponse = (content: string, context?: QuickActionButtonsProps['messageContext']): QuickAction[] => {
  const actions: QuickAction[] = [];
  const lowerContent = content.toLowerCase();
  
  // ===== ERROR CONTEXT =====
  if (context?.hasError || lowerContent.includes('error') || lowerContent.includes('failed') || lowerContent.includes('خطأ')) {
    actions.push(
      { id: 'retry', label: 'Try Again', labelAr: 'حاول مرة أخرى', icon: <RefreshCw className="w-3.5 h-3.5" />, prompt: 'Please try again', category: 'features', priority: 100 },
      { id: 'explain-error', label: 'Explain Error', labelAr: 'اشرح الخطأ', icon: <HelpCircle className="w-3.5 h-3.5" />, prompt: 'Please explain what went wrong and how to fix it', category: 'ai', priority: 90 }
    );
  }

  // ===== IMAGE CONTEXT =====
  if (context?.hasImage || lowerContent.includes('image') || lowerContent.includes('صورة') || lowerContent.includes('photo')) {
    actions.push(
      { id: 'generate-similar', label: 'Generate Similar', labelAr: 'توليد مشابه', icon: <Image className="w-3.5 h-3.5" />, prompt: 'Generate a similar image with slight variations', category: 'media', priority: 85 },
      { id: 'edit-image', label: 'Edit Image', labelAr: 'تعديل الصورة', icon: <Palette className="w-3.5 h-3.5" />, prompt: 'Edit or modify this image', category: 'media', priority: 80 },
      { id: 'describe-image', label: 'Describe More', labelAr: 'وصف أكثر', icon: <FileText className="w-3.5 h-3.5" />, prompt: 'Describe this image in more detail', category: 'ai', priority: 75 }
    );
  }

  // ===== SEARCH/BROWSING CONTEXT =====
  if (context?.hasBrowsing || lowerContent.includes('search') || lowerContent.includes('found') || lowerContent.includes('بحث')) {
    actions.push(
      { id: 'search-more', label: 'Search More', labelAr: 'بحث أكثر', icon: <Search className="w-3.5 h-3.5" />, prompt: 'Search for more information on this topic', category: 'ai', priority: 85 },
      { id: 'summarize', label: 'Summarize', labelAr: 'تلخيص', icon: <FileText className="w-3.5 h-3.5" />, prompt: 'Summarize the key points from this search', category: 'ai', priority: 80 },
      { id: 'compare', label: 'Compare Options', labelAr: 'قارن الخيارات', icon: <Layout className="w-3.5 h-3.5" />, prompt: 'Compare the different options mentioned', category: 'features', priority: 70 }
    );
  }

  // ===== TASK/REMINDER CONTEXT =====
  if (context?.isTask || lowerContent.includes('task') || lowerContent.includes('مهمة') || lowerContent.includes('todo')) {
    actions.push(
      { id: 'add-subtasks', label: 'Add Subtasks', labelAr: 'إضافة مهام فرعية', icon: <Plus className="w-3.5 h-3.5" />, prompt: 'Break this task into smaller subtasks', category: 'features', priority: 85 },
      { id: 'set-deadline', label: 'Set Deadline', labelAr: 'تحديد موعد', icon: <Calendar className="w-3.5 h-3.5" />, prompt: 'Set a deadline for this task', category: 'features', priority: 80 },
      { id: 'prioritize', label: 'Prioritize', labelAr: 'تحديد الأولوية', icon: <Zap className="w-3.5 h-3.5" />, prompt: 'Help me prioritize this task', category: 'features', priority: 75 }
    );
  }

  if (context?.isReminder || lowerContent.includes('reminder') || lowerContent.includes('تذكير') || lowerContent.includes('remind')) {
    actions.push(
      { id: 'make-recurring', label: 'Make Recurring', labelAr: 'جعله متكرر', icon: <RefreshCw className="w-3.5 h-3.5" />, prompt: 'Make this a recurring reminder', category: 'features', priority: 85 },
      { id: 'change-time', label: 'Change Time', labelAr: 'تغيير الوقت', icon: <Calendar className="w-3.5 h-3.5" />, prompt: 'Change the time for this reminder', category: 'features', priority: 80 }
    );
  }

  // ===== NAVIGATION/MENU CONTEXT =====
  if (lowerContent.includes('navigation') || lowerContent.includes('nav') || lowerContent.includes('menu') || lowerContent.includes('header')) {
    actions.push(
      { id: 'mobile-menu', label: 'Add Mobile Menu', labelAr: 'إضافة قائمة الجوال', icon: <Smartphone className="w-3.5 h-3.5" />, prompt: 'Add a responsive mobile hamburger menu with smooth animations', category: 'mobile', priority: 70 },
      { id: 'search', label: 'Add Search', labelAr: 'إضافة بحث', icon: <Search className="w-3.5 h-3.5" />, prompt: 'Add a search functionality to the navigation', category: 'features', priority: 65 }
    );
  }

  // ===== FORM CONTEXT =====
  if (lowerContent.includes('form') || lowerContent.includes('input') || lowerContent.includes('field') || lowerContent.includes('submit')) {
    actions.push(
      { id: 'validation', label: 'Add Validation', labelAr: 'إضافة تحقق', icon: <Shield className="w-3.5 h-3.5" />, prompt: 'Add form validation with error messages and success states', category: 'security', priority: 70 },
      { id: 'submit-animation', label: 'Add Animation', labelAr: 'إضافة حركة', icon: <Sparkles className="w-3.5 h-3.5" />, prompt: 'Add loading spinner and success animation on form submit', category: 'design', priority: 65 }
    );
  }

  // ===== LIST/TABLE CONTEXT =====
  if (lowerContent.includes('list') || lowerContent.includes('table') || lowerContent.includes('items') || lowerContent.includes('grid')) {
    actions.push(
      { id: 'filtering', label: 'Add Filtering', labelAr: 'إضافة تصفية', icon: <Zap className="w-3.5 h-3.5" />, prompt: 'Add filtering options to filter the data', category: 'features', priority: 65 },
      { id: 'sorting', label: 'Add Sorting', labelAr: 'إضافة ترتيب', icon: <Zap className="w-3.5 h-3.5" />, prompt: 'Add sorting functionality to the list/table', category: 'features', priority: 60 }
    );
  }

  // ===== CODE/API CONTEXT =====
  if (lowerContent.includes('code') || lowerContent.includes('api') || lowerContent.includes('function') || lowerContent.includes('كود')) {
    actions.push(
      { id: 'explain-code', label: 'Explain Code', labelAr: 'اشرح الكود', icon: <Code className="w-3.5 h-3.5" />, prompt: 'Explain this code in simple terms', category: 'ai', priority: 75 },
      { id: 'optimize', label: 'Optimize', labelAr: 'تحسين', icon: <Zap className="w-3.5 h-3.5" />, prompt: 'Suggest optimizations for this code', category: 'features', priority: 70 }
    );
  }

  // ===== BACKEND/DATABASE CONTEXT =====
  if (lowerContent.includes('backend') || lowerContent.includes('database') || lowerContent.includes('supabase') || lowerContent.includes('fetch')) {
    actions.push(
      { id: 'error-handling', label: 'Add Error Handling', labelAr: 'معالجة الأخطاء', icon: <Shield className="w-3.5 h-3.5" />, prompt: 'Add proper error handling with user-friendly error messages', category: 'security', priority: 70 },
      { id: 'loading-state', label: 'Add Loading State', labelAr: 'حالة التحميل', icon: <Zap className="w-3.5 h-3.5" />, prompt: 'Add loading spinner while data is being fetched', category: 'features', priority: 65 }
    );
  }

  // ===== LOCATION/MAP CONTEXT =====
  if (lowerContent.includes('location') || lowerContent.includes('map') || lowerContent.includes('موقع') || lowerContent.includes('خريطة')) {
    actions.push(
      { id: 'open-maps', label: 'Open in Maps', labelAr: 'فتح في الخرائط', icon: <Map className="w-3.5 h-3.5" />, prompt: 'Show this location on a map', category: 'features', priority: 80 },
      { id: 'get-directions', label: 'Get Directions', labelAr: 'الحصول على الاتجاهات', icon: <ExternalLink className="w-3.5 h-3.5" />, prompt: 'Get directions to this location', category: 'features', priority: 75 }
    );
  }

  // ===== GENERAL AI CONTEXT =====
  if (lowerContent.includes('explain') || lowerContent.includes('اشرح') || lowerContent.includes('understand')) {
    actions.push(
      { id: 'simpler', label: 'Explain Simpler', labelAr: 'اشرح أبسط', icon: <Lightbulb className="w-3.5 h-3.5" />, prompt: 'Explain this in simpler terms', category: 'ai', priority: 70 },
      { id: 'examples', label: 'Give Examples', labelAr: 'أعط أمثلة', icon: <FileText className="w-3.5 h-3.5" />, prompt: 'Give me some examples', category: 'ai', priority: 65 }
    );
  }

  // ===== SHARE/EXPORT CONTEXT =====
  if (lowerContent.includes('share') || lowerContent.includes('export') || lowerContent.includes('مشاركة') || lowerContent.includes('download')) {
    actions.push(
      { id: 'share', label: 'Share', labelAr: 'مشاركة', icon: <Share2 className="w-3.5 h-3.5" />, prompt: 'Share this content', category: 'features', priority: 70 },
      { id: 'download', label: 'Download', labelAr: 'تحميل', icon: <Download className="w-3.5 h-3.5" />, prompt: 'Download this as a file', category: 'features', priority: 65 }
    );
  }

  // ===== QUESTION/HELP CONTEXT =====
  if (lowerContent.includes('?') || lowerContent.includes('؟') || lowerContent.includes('how') || lowerContent.includes('كيف') || lowerContent.includes('what') || lowerContent.includes('ما')) {
    actions.push(
      { id: 'more-details', label: 'More Details', labelAr: 'تفاصيل أكثر', icon: <Plus className="w-3.5 h-3.5" />, prompt: 'Tell me more about this', category: 'ai', priority: 60 },
      { id: 'related', label: 'Related Topics', labelAr: 'مواضيع ذات صلة', icon: <Lightbulb className="w-3.5 h-3.5" />, prompt: 'What are some related topics I should know about?', category: 'ai', priority: 55 }
    );
  }

  // Sort by priority and deduplicate by id, limit to 4
  const uniqueActions = actions
    .sort((a, b) => b.priority - a.priority)
    .filter((action, index, self) => 
      index === self.findIndex(a => a.id === action.id)
    )
    .slice(0, 4);

  return uniqueActions;
};

// Lovable-style solid button colors
const categoryColors: Record<string, string> = {
  design: 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600',
  features: 'bg-primary hover:bg-primary/90 text-primary-foreground border-primary',
  security: 'bg-green-600 hover:bg-green-700 text-white border-green-600',
  mobile: 'bg-orange-600 hover:bg-orange-700 text-white border-orange-600',
  backend: 'bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-600',
  content: 'bg-pink-600 hover:bg-pink-700 text-white border-pink-600',
  ai: 'bg-violet-600 hover:bg-violet-700 text-white border-violet-600',
  media: 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600',
};

export const QuickActionButtons: React.FC<QuickActionButtonsProps> = ({
  responseContent,
  onActionClick,
  isRTL = false,
  className = '',
  messageContext,
}) => {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const actions = useMemo(
    () => generateActionsFromResponse(responseContent, messageContext), 
    [responseContent, messageContext]
  );

  if (actions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.3 }}
      className={`flex flex-wrap gap-2 mt-3 ${isRTL ? 'flex-row-reverse' : ''} ${className}`}
    >
      {actions.map((action, index) => (
        <motion.div
          key={action.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 * index, duration: 0.15 }}
        >
          <Button
            variant="default"
            size="sm"
            onClick={() => onActionClick(action.prompt)}
            className={`h-8 px-3 text-xs font-medium rounded-full shadow-sm transition-all duration-200 ${categoryColors[action.category]}`}
          >
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
