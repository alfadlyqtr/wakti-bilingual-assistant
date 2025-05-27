
import React from 'react';
import { TextStyle } from '@/types/maw3d';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { Slider } from '@/components/ui/slider';
import { Bold, Italic, Underline, Minus, Plus, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { t } from '@/utils/translations';

interface TextStyleCustomizerProps {
  textStyle: TextStyle;
  onTextStyleChange: (updates: Partial<TextStyle>) => void;
  language: string;
}

const fontFamilies = [
  'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 
  'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact'
];

export const TextStyleCustomizer: React.FC<TextStyleCustomizerProps> = ({
  textStyle,
  onTextStyleChange,
  language
}) => {
  const handleFontSizeChange = (value: number[]) => {
    onTextStyleChange({ fontSize: value[0] });
  };

  const adjustFontSize = (delta: number) => {
    const newSize = Math.max(8, Math.min(72, textStyle.fontSize + delta));
    onTextStyleChange({ fontSize: newSize });
  };

  const handleShadowChange = (value: number[]) => {
    onTextStyleChange({ hasShadow: value[0] > 0 });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <Label htmlFor="font-family">{t('fontFamily', language)}</Label>
          <Select 
            value={textStyle.fontFamily} 
            onValueChange={(value) => onTextStyleChange({ fontFamily: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fontFamilies.map((font) => (
                <SelectItem key={font} value={font}>{font}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mobile-friendly font size control */}
        <div>
          <Label htmlFor="font-size">{t('fontSize', language)}: {textStyle.fontSize}px</Label>
          <div className="space-y-3 mt-2">
            {/* Slider for smooth control */}
            <Slider
              value={[textStyle.fontSize]}
              onValueChange={handleFontSizeChange}
              min={8}
              max={72}
              step={1}
              className="w-full"
            />
            
            {/* Button controls for precise adjustment */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => adjustFontSize(-2)}
                className="h-8 w-8 p-0"
              >
                <Minus className="w-3 h-3" />
              </Button>
              <div className="min-w-[60px] text-center text-sm font-medium">
                {textStyle.fontSize}px
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => adjustFontSize(2)}
                className="h-8 w-8 p-0"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="text-color">{t('textColor', language)}</Label>
        <Input
          id="text-color"
          type="color"
          value={textStyle.color}
          onChange={(e) => onTextStyleChange({ color: e.target.value })}
        />
      </div>

      {/* Shadow slider placed under text color */}
      <div>
        <Label>{t('textShadow', language)}</Label>
        <Slider
          value={[textStyle.hasShadow ? 5 : 0]}
          onValueChange={handleShadowChange}
          min={0}
          max={10}
          step={1}
          className="w-full mt-2"
        />
        <p className="text-xs text-muted-foreground mt-1">
          {textStyle.hasShadow ? t('shadowEnabled', language) : t('shadowDisabled', language)}
        </p>
      </div>

      {/* Text Formatting and Text Alignment side by side */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>{t('textFormatting', language)}</Label>
          <div className="flex gap-2">
            <Toggle
              pressed={textStyle.isBold}
              onPressedChange={(pressed) => onTextStyleChange({ isBold: pressed })}
            >
              <Bold className="w-4 h-4" />
            </Toggle>
            <Toggle
              pressed={textStyle.isItalic}
              onPressedChange={(pressed) => onTextStyleChange({ isItalic: pressed })}
            >
              <Italic className="w-4 h-4" />
            </Toggle>
            <Toggle
              pressed={textStyle.isUnderline}
              onPressedChange={(pressed) => onTextStyleChange({ isUnderline: pressed })}
            >
              <Underline className="w-4 h-4" />
            </Toggle>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('textAlignment', language)}</Label>
          <div className="flex gap-2">
            <Toggle
              pressed={textStyle.alignment === 'left'}
              onPressedChange={() => onTextStyleChange({ alignment: 'left' })}
            >
              <AlignLeft className="w-4 h-4" />
            </Toggle>
            <Toggle
              pressed={textStyle.alignment === 'center'}
              onPressedChange={() => onTextStyleChange({ alignment: 'center' })}
            >
              <AlignCenter className="w-4 h-4" />
            </Toggle>
            <Toggle
              pressed={textStyle.alignment === 'right'}
              onPressedChange={() => onTextStyleChange({ alignment: 'right' })}
            >
              <AlignRight className="w-4 h-4" />
            </Toggle>
          </div>
        </div>
      </div>
    </div>
  );
};
