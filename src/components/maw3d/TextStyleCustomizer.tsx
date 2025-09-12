
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Type, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { t } from '@/utils/translations';
import { TextStyle } from '@/types/maw3d';

interface TextStyleCustomizerProps {
  textStyle: TextStyle;
  onTextStyleChange: (updates: Partial<TextStyle>) => void;
  language: 'en' | 'ar';
}

export default function TextStyleCustomizer({
  textStyle,
  onTextStyleChange,
  language,
}: TextStyleCustomizerProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label>{t('fontFamily', language)}</Label>
        <Select 
          value={textStyle.fontFamily} 
          onValueChange={(value) => onTextStyleChange({ fontFamily: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Inter">Inter</SelectItem>
            <SelectItem value="Arial">Arial</SelectItem>
            <SelectItem value="Georgia">Georgia</SelectItem>
            <SelectItem value="Times New Roman">Times New Roman</SelectItem>
            <SelectItem value="Helvetica">Helvetica</SelectItem>
            <SelectItem value="Cairo">Cairo (Arabic)</SelectItem>
            <SelectItem value="Amiri">Amiri (Arabic)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>{t('fontSize', language)}</Label>
        <Slider
          value={[textStyle.fontSize]}
          onValueChange={(value) => onTextStyleChange({ fontSize: value[0] })}
          min={12}
          max={72}
          step={2}
          className="mt-2"
        />
        <span className="text-sm text-muted-foreground">{textStyle.fontSize}px</span>
      </div>

      <div>
        <Label>{t('textColor', language)}</Label>
        <input
          type="color"
          value={textStyle.color}
          onChange={(e) => onTextStyleChange({ color: e.target.value })}
          className="w-full h-10 rounded border mt-2"
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>{t('bold', language)}</Label>
        <Switch
          checked={textStyle.isBold}
          onCheckedChange={(checked) => onTextStyleChange({ isBold: checked })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>{t('italic', language)}</Label>
        <Switch
          checked={textStyle.isItalic}
          onCheckedChange={(checked) => onTextStyleChange({ isItalic: checked })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>{t('underline', language)}</Label>
        <Switch
          checked={textStyle.isUnderline}
          onCheckedChange={(checked) => onTextStyleChange({ isUnderline: checked })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>{t('textShadow', language)}</Label>
        <Switch
          checked={textStyle.hasShadow}
          onCheckedChange={(checked) => onTextStyleChange({ hasShadow: checked })}
        />
        <span className="text-sm text-muted-foreground ml-2">
          {textStyle.hasShadow ? t('shadowEnabled', language) : t('shadowDisabled', language)}
        </span>
      </div>

      {textStyle.hasShadow && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>{t('shadowColor', language)}</Label>
            <input
              type="color"
              value={textStyle.shadowColor ?? '#000000'}
              onChange={(e) => onTextStyleChange({ shadowColor: e.target.value })}
              className="h-8 w-16 rounded border"
              aria-label="Shadow Color"
            />
          </div>
          <div>
            <Label>{t('shadowBrightness', language)}</Label>
            <Slider
              value={[textStyle.shadowIntensity ?? 5]}
              onValueChange={(value) => onTextStyleChange({ shadowIntensity: value[0] })}
              min={0}
              max={10}
              step={1}
              className="mt-2"
            />
            <span className="text-sm text-muted-foreground">
              {(Math.round(((textStyle.shadowIntensity ?? 5) / 10) * 100))}%
            </span>
          </div>
        </div>
      )}

      <div>
        <Label>{t('textAlignment', language)}</Label>
        <RadioGroup 
          value={textStyle.alignment} 
          onValueChange={(value) => onTextStyleChange({ alignment: value as 'left' | 'center' | 'right' })}
          className="flex gap-4 mt-2"
        >
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
    </div>
  );
}
