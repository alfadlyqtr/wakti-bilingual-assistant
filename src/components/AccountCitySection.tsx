import { useEffect, useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
// Select removed; we now use a simple input
import { Building2, Edit, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserProfile } from "@/hooks/useUserProfile";
// No city dataset or service; users will type their city

export function AccountCitySection() {
  const { language } = useTheme();
  const { profile, refetch } = useUserProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [city, setCity] = useState<string>(((profile as any)?.city) || "");
  const [isLoading, setIsLoading] = useState(false);
  // No fetched cities or suggestions – minimal UI for performance

  // Keep local city state in sync when profile changes (e.g., after updating country)
  useEffect(() => {
    setCity(((profile as any)?.city) || "");
    // Nothing else to reset
  }, [((profile as any)?.city), ((profile as any)?.country_code)]);

  const handleSave = async () => {
    if (!profile?.id) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ city: city || null })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success(language === 'en' ? 'City updated successfully' : 'تم تحديث المدينة بنجاح');
      setIsEditing(false);
      refetch();
    } catch (error) {
      console.error('Error updating city:', error);
      toast.error(language === 'en' ? 'Failed to update city' : 'فشل في تحديث المدينة');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setCity(((profile as any)?.city) || "");
    setIsEditing(false);
  };

  const t = {
    en: { city: 'City', notSet: 'Not set', edit: 'Edit', save: 'Save', cancel: 'Cancel', placeholder: 'Doha' },
    ar: { city: 'المدينة', notSet: 'غير محدد', edit: 'تعديل', save: 'حفظ', cancel: 'إلغاء', placeholder: 'الدوحة' }
  }[language];

  return (
    <div className="space-y-4 p-6 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <Label className="text-base font-medium">{t.city}</Label>
        </div>
        {!isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1"
          >
            <Edit className="h-4 w-4" />
            {t.edit}
          </Button>
        )}
      </div>

      {!isEditing ? (
        <div className="text-sm text-muted-foreground">
          {((profile as any)?.city && ((profile as any).city as string).trim()) ? (profile as any).city : t.notSet}
        </div>
      ) : (
        <div className="space-y-3">
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={t.placeholder}
            disabled={isLoading}
            className="w-full"
          />

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isLoading}
              className="flex items-center gap-1"
            >
              <X className="h-4 w-4" />
              {t.cancel}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isLoading}
              className="flex items-center gap-1"
            >
              <Check className="h-4 w-4" />
              {t.save}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
