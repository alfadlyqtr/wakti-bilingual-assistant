import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { t } from '@/utils/translations';
import type { EventStyle, EventStyleSection } from '@/types/maw3d';

interface Props {
  language: 'en' | 'ar';
  value: EventStyle;
  onChange: (v: EventStyle) => void;
}

const defaultSection = (): EventStyleSection => ({
  liquidGlass: true,
  background: { type: 'solid', color: 'rgba(255,255,255,0.08)' },
  border: { radius: 16, width: 1, color: 'rgba(255,255,255,0.18)' },
  buttonStyle: 'glass'
});

export default function EventStyleCustomizer({ language, value, onChange }: Props) {
  const update = (patch: Partial<EventStyle>) => onChange({ ...value, ...patch });
  const updateCard = (patch: Partial<EventStyleSection>) => update({ card: { ...value.card, ...patch } as EventStyleSection });
  const updateLower = (patch: Partial<EventStyleSection>) => update({ lowerSection: { ...(value.lowerSection || defaultSection()), ...patch } as EventStyleSection });

  const section = value.card;
  const lower = value.lowerSection || defaultSection();

  return (
    <Card className="backdrop-blur-xl bg-gradient-card border-border/50 shadow-soft">
      <CardContent className="space-y-5 p-4 sm:p-5 pb-16">
        <div className="flex items-center gap-3">
          <Switch checked={section.liquidGlass} onCheckedChange={(v) => updateCard({ liquidGlass: v })} />
          <Label>{language === 'ar' ? 'الزجاج السائل (علوي)' : 'Liquid Glass (Card)'}</Label>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="space-y-3">
            <Label>{language === 'ar' ? 'إطار البطاقة' : 'Card Border'}</Label>
            <div className="w-full">
              <Select value={section.border.mode || 'border'} onValueChange={(v) => updateCard({ border: { ...section.border, mode: v as any } })}>
                <SelectTrigger className="mt-2 w-full">
                  <SelectValue placeholder={language === 'ar' ? 'نمط الإطار' : 'Border Style'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="border">{language === 'ar' ? 'إطار خارجي' : 'Border (default)'}</SelectItem>
                  <SelectItem value="outline">{language === 'ar' ? 'إطار محدد خارجي' : 'Outline (outside)'}</SelectItem>
                  <SelectItem value="inline">{language === 'ar' ? 'إطار محدد داخلي' : 'Inline (inside)'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
              <div>
                <Label>{language === 'ar' ? 'نصف القطر' : 'Radius'}</Label>
                <Slider value={[section.border.radius]} onValueChange={(v) => updateCard({ border: { ...section.border, radius: v[0] } })} min={0} max={32} step={1} className="mt-2" />
              </div>
              <div>
                <Label>{language === 'ar' ? 'السُمك' : 'Width'}</Label>
                <Slider value={[section.border.width]} onValueChange={(v) => updateCard({ border: { ...section.border, width: v[0] } })} min={0} max={6} step={1} className="mt-2" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>{language === 'ar' ? 'لون الإطار' : 'Border Color'}</Label>
              <input type="color" value={section.border.color as any || '#ffffff'} onChange={(e) => updateCard({ border: { ...section.border, color: e.target.value } })} className="h-8 w-16 rounded border" />
            </div>
          </div>

        </div>

        {value.cardMode === 'split' && (
          <div className="space-y-4 pt-2 border-t">
            <div className="flex items-center gap-3">
              <Switch checked={lower.liquidGlass} onCheckedChange={(v) => updateLower({ liquidGlass: v })} />
              <Label>{language === 'ar' ? 'الزجاج السائل (سفلي)' : 'Liquid Glass (Lower Section)'}</Label>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="space-y-3">
                <Label>{language === 'ar' ? 'خلفية القسم السفلي' : 'Lower Background'}</Label>
                <Select value={lower.background.type} onValueChange={(v) => updateLower({ background: { ...lower.background, type: v as 'solid' | 'gradient' } })}>
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">{language === 'ar' ? 'لون ثابت' : 'Solid'}</SelectItem>
                    <SelectItem value="gradient">{language === 'ar' ? 'تدرّج' : 'Gradient'}</SelectItem>
                  </SelectContent>
                </Select>
                {lower.background.type === 'solid' ? (
                  <div className="flex items-center justify-between">
                    <Label>{language === 'ar' ? 'اللون' : 'Color'}</Label>
                    <input type="color" value={(lower.background.color as string) || '#ffffff'} onChange={(e) => updateLower({ background: { ...lower.background, color: e.target.value } })} className="h-8 w-16 rounded border" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{language === 'ar' ? 'من' : 'From'}</Label>
                      <input type="color" value={lower.background.gradient?.from || '#8ec5fc'} onChange={(e) => updateLower({ background: { ...lower.background, gradient: { ...(lower.background.gradient || { to: '#e0c3fc', angle: 135 }), from: e.target.value } } })} className="h-8 w-16 rounded border" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>{language === 'ar' ? 'إلى' : 'To'}</Label>
                      <input type="color" value={lower.background.gradient?.to || '#e0c3fc'} onChange={(e) => updateLower({ background: { ...lower.background, gradient: { ...(lower.background.gradient || { from: '#8ec5fc', angle: 135 }), to: e.target.value } } })} className="h-8 w-16 rounded border" />
                    </div>
                    <div>
                      <Label>{language === 'ar' ? 'الزاوية' : 'Angle'}</Label>
                      <Slider value={[lower.background.gradient?.angle ?? 135]} onValueChange={(v) => updateLower({ background: { ...lower.background, gradient: { ...(lower.background.gradient || { from: '#8ec5fc', to: '#e0c3fc' }), angle: v[0] } } })} min={0} max={360} step={5} className="mt-2" />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label>{language === 'ar' ? 'إطار القسم السفلي' : 'Lower Border'}</Label>
                <div className="w-full">
                  <Label>{language === 'ar' ? 'نمط الإطار' : 'Border Style'}</Label>
                  <Select value={lower.border.mode || 'border'} onValueChange={(v) => updateLower({ border: { ...lower.border, mode: v as any } })}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="border">{language === 'ar' ? 'إطار خارجي' : 'Border (default)'}</SelectItem>
                      <SelectItem value="outline">{language === 'ar' ? 'إطار محدد خارجي' : 'Outline (outside)'}</SelectItem>
                      <SelectItem value="inline">{language === 'ar' ? 'إطار محدد داخلي' : 'Inline (inside)'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
                  <div>
                    <Label>{language === 'ar' ? 'نصف القطر' : 'Radius'}</Label>
                    <Slider value={[lower.border.radius]} onValueChange={(v) => updateLower({ border: { ...lower.border, radius: v[0] } })} min={0} max={32} step={1} className="mt-2" />
                  </div>
                  <div>
                    <Label>{language === 'ar' ? 'السُمك' : 'Width'}</Label>
                    <Slider value={[lower.border.width]} onValueChange={(v) => updateLower({ border: { ...lower.border, width: v[0] } })} min={0} max={6} step={1} className="mt-2" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>{language === 'ar' ? 'لون الإطار' : 'Border Color'}</Label>
                  <input type="color" value={lower.border.color as any || '#ffffff'} onChange={(e) => updateLower({ border: { ...lower.border, color: e.target.value } })} className="h-8 w-16 rounded border" />
                </div>

                {/* Lower Button Style and Border */}
                <div className="pt-2 space-y-2 border-t">
                  <div className="flex items-center justify-between gap-3">
                    <Label>{language === 'ar' ? 'نمط أزرار القسم السفلي' : 'Lower Button Style'}</Label>
                    <div className="w-full">
                      <Select value={lower.buttonStyle || 'glass'} onValueChange={(v) => updateLower({ buttonStyle: v as any })}>
                        <SelectTrigger className="mt-2 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="glass">{language === 'ar' ? 'زجاجي' : 'Glass'}</SelectItem>
                          <SelectItem value="solid">{language === 'ar' ? 'صلب' : 'Solid'}</SelectItem>
                          <SelectItem value="outline">{language === 'ar' ? 'محدد' : 'Outline'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {lower.buttonStyle === 'solid' && (
                    <div className="flex items-center justify-between">
                      <Label>{language === 'ar' ? 'لون الزر' : 'Button Color'}</Label>
                      <input
                        type="color"
                        value={(lower.buttonColor as any) || '#3b82f6'}
                        onChange={(e) => updateLower({ buttonColor: e.target.value })}
                        className="h-8 w-16 rounded border"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
                    <div>
                      <Label>{language === 'ar' ? 'نصف قطر زر' : 'Button Radius'}</Label>
                      <Slider value={[lower.buttonBorder?.radius ?? 12]} onValueChange={(v) => updateLower({ buttonBorder: { ...(lower.buttonBorder || { width: 1, color: '#ffffff' }), radius: v[0] } })} min={0} max={32} step={1} className="mt-2" />
                    </div>
                    <div>
                      <Label>{language === 'ar' ? 'سُمك إطار الزر' : 'Button Border Width'}</Label>
                      <Slider value={[lower.buttonBorder?.width ?? 1]} onValueChange={(v) => updateLower({ buttonBorder: { ...(lower.buttonBorder || { radius: 12, color: '#ffffff' }), width: v[0] } })} min={0} max={6} step={1} className="mt-2" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>{language === 'ar' ? 'لون إطار الزر' : 'Button Border Color'}</Label>
                    <input type="color" value={(lower.buttonBorder?.color as any) || '#ffffff'} onChange={(e) => updateLower({ buttonBorder: { ...(lower.buttonBorder || { radius: 12, width: 1 }), color: e.target.value } })} className="h-8 w-16 rounded border" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={!!value.chips?.enabled} onCheckedChange={(v) => update({ chips: { enabled: v } })} />
              <Label>{language === 'ar' ? 'عرض المعلومات كشرائح زجاجية' : 'Show info as glass chips'}</Label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
