
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Star, LogOut } from 'lucide-react';
import { ThemeLanguageToggle } from '@/components/ThemeLanguageToggle';
import type { PlanType } from './FawranPaymentOverlay';

interface PlanSelectionProps {
  onPlanSelect: (plan: PlanType) => void;
}

export function PlanSelection({ onPlanSelect }: PlanSelectionProps) {
  const { language } = useTheme();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="p-4 sm:p-8 relative">
      {/* Logout Button - Top Left */}
      <div className="absolute top-2 sm:top-4 left-2 sm:left-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleLogout}
          className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
        >
          <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">
            {language === 'ar' ? 'خروج' : 'Logout'}
          </span>
        </Button>
      </div>

      {/* Language Toggle - Top Right */}
      <div className="absolute top-2 sm:top-4 right-2 sm:right-4">
        <ThemeLanguageToggle />
      </div>

      <div className="text-center mb-6 sm:mb-8 mt-12 sm:mt-8">
        {/* Account Creation Indicator */}
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-xs sm:text-sm text-green-700 dark:text-green-300 font-medium">
            {language === 'ar' 
              ? '✅ تم إنشاء حسابك وتأكيد البريد الإلكتروني - شكراً لك! يجب إكمال الاشتراك خلال 90 دقيقة من إنشاء الحساب 👇'
              : '✅ Your account created and email confirmed - thank you! Must complete subscription within 90 minutes from account creation 👇'
            }
          </p>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">
          {language === 'ar' ? 'اختر خطة الاشتراك' : 'Choose Your Subscription Plan'}
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base">
          {language === 'ar' 
            ? 'ادفع بسهولة باستخدام فوران من أي بنك في قطر'
            : 'Pay easily using Fawran from any bank in Qatar'
          }
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
        {/* Monthly Plan */}
        <Card className="p-4 sm:p-6 hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50">
          <div className="text-center">
            <h3 className="text-lg sm:text-xl font-bold mb-2">
              {language === 'ar' ? 'الخطة الشهرية' : 'Monthly Plan'}
            </h3>
            <div className="text-3xl sm:text-4xl font-bold text-primary mb-4">
              60 QAR
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {language === 'ar' ? 'شهرياً' : 'per month'}
            </p>
            
            <ul className="space-y-2 sm:space-y-3 mb-6 text-left">
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
                <span className="text-xs sm:text-sm">
                  {language === 'ar' ? 'جميع ميزات WAKTI' : 'All WAKTI features'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
                <span className="text-xs sm:text-sm">
                  {language === 'ar' ? 'مساعد الذكي' : 'AI Assistant'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
                <span className="text-xs sm:text-sm">
                  {language === 'ar' ? 'المهام والتذكيرات' : 'Tasks & Reminders'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
                <span className="text-xs sm:text-sm">
                  {language === 'ar' ? 'ادفع كما تستخدم شهرياً' : 'Pay as you go monthly'}
                </span>
              </li>
            </ul>

            <Button 
              className="w-full text-sm sm:text-base"
              onClick={() => onPlanSelect('monthly')}
            >
              {language === 'ar' ? 'اختر الخطة الشهرية' : 'Select Monthly Plan'}
            </Button>
          </div>
        </Card>

        {/* Yearly Plan */}
        <Card className="p-4 sm:p-6 hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50 relative">
          <div className="absolute -top-2 sm:-top-3 -right-2 sm:-right-3">
            <div className="bg-green-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <Star className="h-3 w-3" />
              {language === 'ar' ? 'وفر 17%' : 'Save 17%'}
            </div>
          </div>
          
          <div className="text-center">
            <h3 className="text-lg sm:text-xl font-bold mb-2">
              {language === 'ar' ? 'الخطة السنوية' : 'Yearly Plan'}
            </h3>
            <div className="text-3xl sm:text-4xl font-bold text-primary mb-4">
              600 QAR
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {language === 'ar' ? 'سنوياً' : 'per year'}
            </p>
            
            <ul className="space-y-2 sm:space-y-3 mb-6 text-left">
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
                <span className="text-xs sm:text-sm">
                  {language === 'ar' ? 'جميع ميزات WAKTI' : 'All WAKTI features'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
                <span className="text-xs sm:text-sm">
                  {language === 'ar' ? 'مساعد الذكي' : 'AI Assistant'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
                <span className="text-xs sm:text-sm">
                  {language === 'ar' ? 'المهام والتذكيرات' : 'Tasks & Reminders'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-green-600">
                  {language === 'ar' ? 'توفير 120 ريال سنوياً' : 'Save 120 QAR yearly'}
                </span>
              </li>
            </ul>

            <Button 
              className="w-full bg-green-600 hover:bg-green-700 text-sm sm:text-base"
              onClick={() => onPlanSelect('yearly')}
            >
              {language === 'ar' ? 'اختر الخطة السنوية' : 'Select Yearly Plan'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
