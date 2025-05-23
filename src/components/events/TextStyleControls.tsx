
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TextStyleControlsProps {
  fontSize: number;
  textColor: string;
  textAlign: 'left' | 'center' | 'right';
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  onFontSizeChange: (size: number) => void;
  onTextColorChange: (color: string) => void;
  onTextAlignChange: (align: 'left' | 'center' | 'right') => void;
  onFontWeightChange: (weight: 'normal' | 'bold') => void;
  onFontStyleChange: (style: 'normal' | 'italic') => void;
  onTextDecorationChange: (decoration: 'none' | 'underline') => void;
}

export default function TextStyleControls({
  fontSize,
  textColor,
  textAlign,
  fontWeight,
  fontStyle,
  textDecoration,
  onFontSizeChange,
  onTextColorChange,
  onTextAlignChange,
  onFontWeightChange,
  onFontStyleChange,
  onTextDecorationChange
}: TextStyleControlsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Text Styling</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Font Size */}
        <div className="space-y-2">
          <Label className="text-sm">Font Size</Label>
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              value={fontSize}
              onChange={(e) => onFontSizeChange(parseInt(e.target.value) || 18)}
              min="12"
              max="72"
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">px</span>
          </div>
        </div>

        {/* Text Color */}
        <div className="space-y-2">
          <Label className="text-sm">Text Color</Label>
          <div className="flex items-center space-x-2">
            <Input
              type="color"
              value={textColor}
              onChange={(e) => onTextColorChange(e.target.value)}
              className="w-12 h-8 p-1 rounded cursor-pointer"
            />
            <Input
              type="text"
              value={textColor}
              onChange={(e) => onTextColorChange(e.target.value)}
              placeholder="#ffffff"
              className="flex-1"
            />
          </div>
        </div>

        {/* Text Formatting */}
        <div className="space-y-2">
          <Label className="text-sm">Formatting</Label>
          <div className="flex gap-1">
            <Button
              type="button"
              variant={fontWeight === 'bold' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onFontWeightChange(fontWeight === 'bold' ? 'normal' : 'bold')}
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={fontStyle === 'italic' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onFontStyleChange(fontStyle === 'italic' ? 'normal' : 'italic')}
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={textDecoration === 'underline' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onTextDecorationChange(textDecoration === 'underline' ? 'none' : 'underline')}
            >
              <Underline className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Text Alignment */}
        <div className="space-y-2">
          <Label className="text-sm">Text Alignment</Label>
          <div className="flex gap-1">
            <Button
              type="button"
              variant={textAlign === 'left' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onTextAlignChange('left')}
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={textAlign === 'center' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onTextAlignChange('center')}
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={textAlign === 'right' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onTextAlignChange('right')}
            >
              <AlignRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <Label className="text-sm">Preview</Label>
          <div className="p-3 bg-muted rounded-md">
            <p
              style={{
                fontSize: `${fontSize}px`,
                color: textColor,
                textAlign: textAlign,
                fontWeight: fontWeight,
                fontStyle: fontStyle,
                textDecoration: textDecoration,
              }}
            >
              Sample event title
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
