
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TrialBannerProps {
  trialDaysLeft: number;
  language: 'en' | 'ar';
}

export const TrialBanner: React.FC<TrialBannerProps> = ({ trialDaysLeft, language }) => {
  if (trialDaysLeft <= 0) return null;

  return (
    <Card className="mb-4 bg-primary/5 border-primary/20">
      <CardContent className="p-3">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-medium">
              {language === 'ar' ? "أيام التجربة المجانية" : "Free Trial Days"}:
            </p>
            <p className="text-xl font-bold">{trialDaysLeft} {language === 'ar' ? "أيام متبقية" : "days left"}</p>
          </div>
          <Button size="sm">{language === 'ar' ? "ترقية" : "Upgrade"}</Button>
        </div>
      </CardContent>
    </Card>
  );
};
