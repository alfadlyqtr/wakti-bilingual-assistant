
import React from 'react';
import { TextStyle } from '@/types/maw3d';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { Bold, Italic, Underline, Palette, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface TextStyleCustomizerProps {
  textStyle: TextStyle;
  onTextStyleChange: (updates: Partial<TextStyle>) => void;
}

const fontFamilies = [
  'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 
  'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact'
];

export const TextStyleCustomizer: React.FC<TextStyleCustomizerProps> = ({
  textStyle,
  onTextStyleChange
}) => {
  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string temporarily for better UX while typing
    if (value === '') {
      return;
    }
    
    const numValue = parseInt(value);
    // Only update if it's a valid number within reasonable bounds
    if (!isNaN(numValue) && numValue >= 8 && numValue <= 72) {
      onTextStyleChange({ fontSize: numValue });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">🎨 Text Styling</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="font-family">Font Family</Label>
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

        <div>
          <Label htmlFor="font-size">Font Size</Label>
          <Input
            id="font-size"
            type="number"
            min="8"
            max="72"
            value={textStyle.fontSize}
            onChange={handleFontSizeChange}
            onBlur={(e) => {
              // Ensure we have a valid value on blur
              const value = parseInt(e.target.value);
              if (isNaN(value) || value < 8) {
                onTextStyleChange({ fontSize: 8 });
              } else if (value > 72) {
                onTextStyleChange({ fontSize: 72 });
              }
            }}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="text-color">Text Color</Label>
        <Input
          id="text-color"
          type="color"
          value={textStyle.color}
          onChange={(e) => onTextStyleChange({ color: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Text Formatting</Label>
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
            <Toggle
              pressed={textStyle.hasShadow}
              onPressedChange={(pressed) => onTextStyleChange({ hasShadow: pressed })}
              className={`transition-all duration-200 ${
                textStyle.hasShadow 
                  ? 'shadow-lg shadow-black/25 bg-slate-100 dark:bg-slate-800' 
                  : 'hover:shadow-md hover:shadow-black/15'
              }`}
            >
              <Palette className="w-4 h-4" />
            </Toggle>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Text Alignment</Label>
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
