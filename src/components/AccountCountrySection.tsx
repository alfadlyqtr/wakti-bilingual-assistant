
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Edit, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { countries, getCountryByCode } from "@/utils/countries";
import { useUserProfile } from "@/hooks/useUserProfile";

export function AccountCountrySection() {
  const { language } = useTheme();
  const { profile, refetch } = useUserProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(profile?.country_code || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!profile?.id) return;
    
    setIsLoading(true);
    try {
      const countryData = getCountryByCode(selectedCountry);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          country: countryData?.name || null,
          country_code: selectedCountry || null,
        })
        .eq('id', profile.id);

      if (error) {
        throw error;
      }

      toast.success(language === 'en' ? 'Country updated successfully' : 'تم تحديث البلد بنجاح');
      setIsEditing(false);
      refetch();
    } catch (error) {
      console.error('Error updating country:', error);
      toast.error(language === 'en' ? 'Failed to update country' : 'فشل في تحديث البلد');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedCountry(profile?.country_code || "");
    setIsEditing(false);
  };

  const translations = {
    en: {
      country: "Country",
      notSet: "Not set",
      edit: "Edit",
      save: "Save",
      cancel: "Cancel",
      selectCountry: "Select your country"
    },
    ar: {
      country: "البلد",
      notSet: "غير محدد",
      edit: "تعديل",
      save: "حفظ",
      cancel: "إلغاء",
      selectCountry: "اختر بلدك"
    }
  };

  const t = translations[language];
  const currentCountry = getCountryByCode(profile?.country_code || "");

  return (
    <div className="space-y-4 p-6 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <Label className="text-base font-medium">{t.country}</Label>
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
          {currentCountry 
            ? (language === 'ar' ? currentCountry.nameAr : currentCountry.name)
            : t.notSet
          }
        </div>
      ) : (
        <div className="space-y-3">
          <Select 
            value={selectedCountry} 
            onValueChange={setSelectedCountry}
            disabled={isLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t.selectCountry} />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {countries.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {language === 'ar' ? c.nameAr : c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
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
