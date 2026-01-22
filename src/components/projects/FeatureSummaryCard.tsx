import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  ShoppingBag, 
  LogIn, 
  Image, 
  MessageSquare, 
  ShoppingCart, 
  CreditCard, 
  User, 
  Globe, 
  Home,
  CheckCircle2,
  Circle,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnalyzedRequest, DetectedFeature, FeatureType } from '@/utils/requestAnalyzer';

interface FeatureSummaryCardProps {
  analysis: AnalyzedRequest;
  currentFeatureIndex: number;
  onStartConfiguration: () => void;
  onSkipWizards: () => void;
  isRTL?: boolean;
}

const FEATURE_ICONS: Record<FeatureType, React.ReactNode> = {
  landing: <Home className="h-4 w-4" />,
  booking: <Calendar className="h-4 w-4" />,
  products: <ShoppingBag className="h-4 w-4" />,
  cart: <ShoppingCart className="h-4 w-4" />,
  checkout: <CreditCard className="h-4 w-4" />,
  auth: <LogIn className="h-4 w-4" />,
  account: <User className="h-4 w-4" />,
  media: <Image className="h-4 w-4" />,
  contact: <MessageSquare className="h-4 w-4" />,
  bilingual: <Globe className="h-4 w-4" />,
};

const FEATURE_COLORS: Record<FeatureType, string> = {
  landing: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  booking: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  products: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  cart: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  checkout: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  auth: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  account: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
  media: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
  contact: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
  bilingual: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
};

export const FeatureSummaryCard: React.FC<FeatureSummaryCardProps> = ({
  analysis,
  currentFeatureIndex,
  onStartConfiguration,
  onSkipWizards,
  isRTL = false,
}) => {
  const wizardFeatures = analysis.features.filter(f => f.requiresWizard);
  const autoFeatures = analysis.features.filter(f => !f.requiresWizard);
  
  return (
    <div className={cn(
      "w-full max-w-md bg-gradient-to-br from-indigo-950/90 to-slate-900/90 border border-white/10 rounded-xl overflow-hidden shadow-xl",
      isRTL && "text-right"
    )}>
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-b border-white/10">
        <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
          <Sparkles className="h-5 w-5 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">
            {isRTL ? 'تم اكتشاف مشروع متعدد الميزات!' : 'Multi-Feature Project Detected!'}
          </h3>
        </div>
        <p className="text-xs text-white/60 mt-1">
          {isRTL 
            ? `سأساعدك في إعداد ${analysis.businessType} الخاص بك خطوة بخطوة`
            : `I'll help you set up your ${analysis.businessType} step by step`
          }
        </p>
      </div>
      
      {/* Features List */}
      <div className="p-4 space-y-3">
        {/* Features requiring wizard configuration */}
        {wizardFeatures.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-white/40 font-medium">
              {isRTL ? 'يحتاج إعداد' : 'Needs Configuration'}
            </p>
            {wizardFeatures.map((feature, idx) => (
              <div 
                key={feature.type}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg border transition-all",
                  FEATURE_COLORS[feature.type],
                  idx < currentFeatureIndex && "opacity-50",
                  isRTL && "flex-row-reverse"
                )}
              >
                <div className="shrink-0">
                  {idx < currentFeatureIndex ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    FEATURE_ICONS[feature.type]
                  )}
                </div>
                <span className="text-sm font-medium flex-1">{feature.description}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10">
                  {idx + 1}/{wizardFeatures.length}
                </span>
              </div>
            ))}
          </div>
        )}
        
        {/* Auto-generated features */}
        {autoFeatures.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-white/40 font-medium">
              {isRTL ? 'سيتم إنشاؤه تلقائياً' : 'Auto-Generated'}
            </p>
            <div className="flex flex-wrap gap-2">
              {autoFeatures.map((feature) => (
                <div 
                  key={feature.type}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs",
                    FEATURE_COLORS[feature.type],
                    isRTL && "flex-row-reverse"
                  )}
                >
                  {FEATURE_ICONS[feature.type]}
                  <span>{feature.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className={cn(
        "px-4 py-3 bg-black/20 border-t border-white/10 flex gap-2",
        isRTL && "flex-row-reverse"
      )}>
        <Button
          onClick={onStartConfiguration}
          className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium"
        >
          <span className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            {isRTL ? 'ابدأ الإعداد' : 'Start Configuration'}
            <ArrowRight className={cn("h-4 w-4", isRTL && "rotate-180")} />
          </span>
        </Button>
        <Button
          onClick={onSkipWizards}
          variant="outline"
          className="border-white/20 text-white/70 hover:text-white hover:bg-white/10"
        >
          {isRTL ? 'دع الذكاء الاصطناعي يقرر' : 'Let AI Decide'}
        </Button>
      </div>
    </div>
  );
};

export default FeatureSummaryCard;
