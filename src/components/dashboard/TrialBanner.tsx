
import { useState, useEffect } from "react";
import { X, Clock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";

export function TrialBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const { language } = useTheme();
  const { profile } = useAuth();

  // Hide if user is subscribed
  if (profile?.is_subscribed) {
    return null;
  }

  if (!isVisible) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 relative overflow-hidden">
      <CardContent className="p-4">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 text-white hover:bg-white/20"
          onClick={() => setIsVisible(false)}
        >
          <X className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-full">
            <Crown className="h-5 w-5" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-1">
              {language === "ar" 
                ? "استمتع بتجربة واقتي المميزة" 
                : "Enjoy Wakti Premium Experience"
              }
            </h3>
            <p className="text-xs opacity-90">
              {language === "ar"
                ? "احصل على وصول كامل لجميع الميزات المتقدمة"
                : "Get full access to all premium features"
              }
            </p>
          </div>
          
          <div className="flex items-center gap-2 text-xs">
            <Clock className="h-4 w-4" />
            <span>
              {language === "ar" ? "تجربة مجانية" : "Free Trial"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
