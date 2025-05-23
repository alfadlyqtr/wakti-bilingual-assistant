
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Type } from "lucide-react";
import { cn } from "@/lib/utils";

interface TextStyleControlsProps {
  fontSize: number;
  textColor: string;
  textAlign: 'left' | 'center' | 'right';
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  fontFamily?: string;
  onFontSizeChange: (size: number) => void;
  onTextColorChange: (color: string) => void;
  onTextAlignChange: (align: 'left' | 'center' | 'right') => void;
  onFontWeightChange: (weight: 'normal' | 'bold') => void;
  onFontStyleChange: (style: 'normal' | 'italic') => void;
  onTextDecorationChange: (decoration: 'none' | 'underline') => void;
  onFontFamilyChange?: (family: string) => void;
}

const fontFamilies = [
  { value: 'Inter', label: 'Inter (Default)' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Playfair Display', label: 'Playfair Display' },
];

export default function TextStyleControls({
  fontSize,
  textColor,
  textAlign,
  fontWeight,
  fontStyle,
  textDecoration,
  fontFamily = 'Inter',
  onFontSizeChange,
  onTextColorChange,
  onTextAlignChange,
  onFontWeightChange,
  onFontStyleChange,
  onTextDecorationChange,
  onFontFamilyChange
}: TextStyleControlsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Type className="h-4 w-4" />
          Text Styling
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Font and Size Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Font Family</Label>
            <Select value={fontFamily} onValueChange={(value) => onFontFamilyChange?.(value)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select font" />
              </SelectTrigger>
              <SelectContent>
                {fontFamilies.map((font) => (
                  <SelectItem key={font.value} value={font.value}>
                    <span style={{ fontFamily: font.value }}>{font.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Font Size</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={fontSize}
                onChange={(e) => onFontSizeChange(parseInt(e.target.value) || 18)}
                min="12"
                max="72"
                className="h-9"
              />
              <span className="text-xs text-muted-foreground min-w-[20px]">px</span>
            </div>
          </div>
        </div>

        {/* Color and Formatting Row */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Text Color</Label>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Input
                  type="color"
                  value={textColor}
                  onChange={(e) => onTextColorChange(e.target.value)}
                  className="w-12 h-9 p-1 rounded-md cursor-pointer border"
                />
              </div>
              <Input
                type="text"
                value={textColor}
                onChange={(e) => onTextColorChange(e.target.value)}
                placeholder="#ffffff"
                className="flex-1 h-9 font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Formatting</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={fontWeight === 'bold' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onFontWeightChange(fontWeight === 'bold' ? 'normal' : 'bold')}
                className="h-9 px-3"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={fontStyle === 'italic' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onFontStyleChange(fontStyle === 'italic' ? 'normal' : 'italic')}
                className="h-9 px-3"
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={textDecoration === 'underline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onTextDecorationChange(textDecoration === 'underline' ? 'none' : 'underline')}
                className="h-9 px-3"
              >
                <Underline className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Text Alignment</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={textAlign === 'left' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onTextAlignChange('left')}
                className="h-9 px-3"
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={textAlign === 'center' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onTextAlignChange('center')}
                className="h-9 px-3"
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={textAlign === 'right' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onTextAlignChange('right')}
                className="h-9 px-3"
              >
                <AlignRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Preview</Label>
          <div className="p-4 bg-muted/50 rounded-lg border-2 border-dashed border-muted-foreground/20">
            <p
              style={{
                fontSize: `${fontSize}px`,
                color: textColor,
                textAlign: textAlign,
                fontWeight: fontWeight,
                fontStyle: fontStyle,
                textDecoration: textDecoration,
                fontFamily: fontFamily,
                lineHeight: '1.4',
              }}
            >
              Sample Event Title
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
