
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
    <div className="p-8 relative">
      {/* Logout Button - Top Left */}
      <div className="absolute top-4 left-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleLogout}
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          {language === 'ar' ? 'خروج' : 'Logout'}
        </Button>
      </div>

      {/* Language Toggle - Top Right */}
      <div className="absolute top-4 right-4">
        <ThemeLanguageToggle />
      </div>

      <div className="text-center mb-8 mt-8">
        <h2 className="text-3xl font-bold mb-4">
          {language === 'ar' ? 'اختر خطة الاشتراك' : 'Choose Your Subscription Plan'}
        </h2>
        <p className="text-muted-foreground">
          {language === 'ar' 
            ? 'ادفع بسهولة باستخدام الفوران من أي بنك في قطر'
            : 'Pay easily using Fawran from any bank in Qatar'
          }
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Monthly Plan */}
        <Card className="p-6 hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50">
          <div className="text-center">
            <h3 className="text-xl font-bold mb-2">
              {language === 'ar' ? 'الخطة الشهرية' : 'Monthly Plan'}
            </h3>
            <div className="text-4xl font-bold text-primary mb-4">
              60 QAR
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {language === 'ar' ? 'شهرياً' : 'per month'}
            </p>
            
            <ul className="space-y-3 mb-6 text-left">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  {language === 'ar' ? 'جميع ميزات WAKTI' : 'All WAKTI features'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  {language === 'ar' ? 'مساعد الذكي' : 'AI Assistant'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  {language === 'ar' ? 'المهام والتذكيرات' : 'Tasks & Reminders'}
                </span>
              </li>
            </ul>

            <Button 
              className="w-full"
              onClick={() => onPlanSelect('monthly')}
            >
              {language === 'ar' ? 'اختر الخطة الشهرية' : 'Select Monthly Plan'}
            </Button>
          </div>
        </Card>

        {/* Yearly Plan */}
        <Card className="p-6 hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50 relative">
          <div className="absolute -top-3 -right-3">
            <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <Star className="h-3 w-3" />
              {language === 'ar' ? 'وفر 17%' : 'Save 17%'}
            </div>
          </div>
          
          <div className="text-center">
            <h3 className="text-xl font-bold mb-2">
              {language === 'ar' ? 'الخطة السنوية' : 'Yearly Plan'}
            </h3>
            <div className="text-4xl font-bold text-primary mb-4">
              600 QAR
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {language === 'ar' ? 'سنوياً' : 'per year'}
            </p>
            
            <ul className="space-y-3 mb-6 text-left">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  {language === 'ar' ? 'جميع ميزات WAKTI' : 'All WAKTI features'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  {language === 'ar' ? 'مساعد الذكي' : 'AI Assistant'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  {language === 'ar' ? 'المهام والتذكيرات' : 'Tasks & Reminders'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-green-600">
                  {language === 'ar' ? 'توفير 120 ريال سنوياً' : 'Save 120 QAR yearly'}
                </span>
              </li>
            </ul>

            <Button 
              className="w-full bg-green-600 hover:bg-green-700"
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
