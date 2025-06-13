
import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Type, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { t } from '@/utils/translations';
import { useTheme } from '@/providers/ThemeProvider';

interface TextStyleControlsProps {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  textShadow: boolean;
  textAlignment: 'left' | 'center' | 'right';
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  onFontFamilyChange: (value: string) => void;
  onFontSizeChange: (value: number[]) => void;
  onTextColorChange: (value: string) => void;
  onTextShadowChange: (value: boolean) => void;
  onTextAlignmentChange: (value: 'left' | 'center' | 'right') => void;
  onFontWeightChange: (value: 'normal' | 'bold') => void;
  onFontStyleChange: (value: 'normal' | 'italic') => void;
  onTextDecorationChange: (value: 'none' | 'underline') => void;
}

export default function TextStyleControls({
  fontFamily,
  fontSize,
  textColor,
  textShadow,
  textAlignment,
  fontWeight,
  fontStyle,
  textDecoration,
  onFontFamilyChange,
  onFontSizeChange,
  onTextColorChange,
  onTextShadowChange,
  onTextAlignmentChange,
  onFontWeightChange,
  onFontStyleChange,
  onTextDecorationChange,
}: TextStyleControlsProps) {
  const { language } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Type className="w-4 h-4" />
          {t('textStyling', language)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>{t('fontFamily', language)}</Label>
          <Select value={fontFamily} onValueChange={onFontFamilyChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Inter">Inter</SelectItem>
              <SelectItem value="Arial">Arial</SelectItem>
              <SelectItem value="Georgia">Georgia</SelectItem>
              <SelectItem value="Times New Roman">Times New Roman</SelectItem>
              <SelectItem value="Helvetica">Helvetica</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>{t('fontSize', language)}</Label>
          <Slider
            value={[fontSize]}
            onValueChange={onFontSizeChange}
            min={12}
            max={72}
            step={2}
            className="mt-2"
          />
          <span className="text-sm text-muted-foreground">{fontSize}px</span>
        </div>

        <div>
          <Label>{t('textColor', language)}</Label>
          <input
            type="color"
            value={textColor}
            onChange={(e) => onTextColorChange(e.target.value)}
            className="w-full h-10 rounded border"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label>{t('fontWeight', language)}</Label>
          <Select value={fontWeight} onValueChange={onFontWeightChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">{t('normal', language)}</SelectItem>
              <SelectItem value="bold">{t('bold', language)}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label>{t('fontStyle', language)}</Label>
          <Select value={fontStyle} onValueChange={onFontStyleChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">{t('normal', language)}</SelectItem>
              <SelectItem value="italic">{t('italic', language)}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label>{t('textDecoration', language)}</Label>
          <Select value={textDecoration} onValueChange={onTextDecorationChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('none', language)}</SelectItem>
              <SelectItem value="underline">{t('underline', language)}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label>{t('textShadow', language)}</Label>
          <Switch
            checked={textShadow}
            onCheckedChange={onTextShadowChange}
          />
        </div>

        <div>
          <Label>{t('textAlignment', language)}</Label>
          <RadioGroup value={textAlignment} onValueChange={onTextAlignmentChange} className="flex gap-4 mt-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="left" id="left" />
              <Label htmlFor="left" className="flex items-center gap-1">
                <AlignLeft className="w-4 h-4" />
                {t('left', language)}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="center" id="center" />
              <Label htmlFor="center" className="flex items-center gap-1">
                <AlignCenter className="w-4 h-4" />
                {t('center', language)}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="right" id="right" />
              <Label htmlFor="right" className="flex items-center gap-1">
                <AlignRight className="w-4 h-4" />
                {t('right', language)}
              </Label>
            </div>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
}
