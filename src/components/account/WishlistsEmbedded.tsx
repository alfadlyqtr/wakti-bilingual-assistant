import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, GiftIcon, Plus, Globe, Users, Lock, CalendarIcon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function WishlistsEmbedded({ language, userId, navigate }: { language: string; userId?: string; navigate: any }) {
  const { data: wishlists = [], isLoading } = useQuery({
    queryKey: ["wishlists", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await (supabase as any)
        .from("wishlists")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const privacyConfig = {
    public: { icon: Globe, label: { en: "Public", ar: "عام" }, color: "text-blue-500" },
    contacts: { icon: Users, label: { en: "Contacts", ar: "جهات الاتصال" }, color: "text-green-500" },
    private: { icon: Lock, label: { en: "Private", ar: "خاص" }, color: "text-gray-500" },
  };

  const wishlistRootPath = "/wishlists?from=account";

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">{language === 'ar' ? 'قوائم الرغبات' : 'My Wishlists'}</h2>
        <Button size="sm" onClick={() => navigate(wishlistRootPath)}>
          <Plus className="h-4 w-4 mr-1" />
          {language === 'ar' ? 'جديد' : 'New'}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : wishlists.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <GiftIcon className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm font-medium mb-1">
              {language === 'ar' ? 'لا توجد قوائم بعد' : 'No wishlists yet'}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {language === 'ar' ? 'أنشئ قائمتك الأولى وشاركها مع أصدقائك' : 'Create your first list and share it with friends'}
            </p>
            <Button size="sm" onClick={() => navigate(wishlistRootPath)}>
              <Plus className="h-4 w-4 mr-1" />
              {language === 'ar' ? 'إنشاء قائمة' : 'Create Wishlist'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {wishlists.map((list: any) => {
            const PrivacyIcon = privacyConfig[list.privacy as keyof typeof privacyConfig].icon;
            return (
              <Card
                key={list.id}
                className="cursor-pointer transition-all active:scale-[0.99] border border-border/60"
                onClick={() => navigate(`/wishlists?list=${list.id}&from=account`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base truncate">{list.title}</h3>
                        <PrivacyIcon className={cn("h-3.5 w-3.5 flex-shrink-0", privacyConfig[list.privacy as keyof typeof privacyConfig].color)} />
                      </div>
                      {list.description && (
                        <p className="text-xs text-muted-foreground truncate mb-2">{list.description}</p>
                      )}
                      {list.event_date && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {new Date(list.event_date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
