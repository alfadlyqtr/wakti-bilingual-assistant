import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pipette, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WAKTI_COLOR_PALETTE } from '../../types/visual-edit';

interface ColorPickerPopoverProps {
  color: string;
  onChange: (color: string) => void;
  presets?: string[];
  label?: string;
  isRTL?: boolean;
}

export function ColorPickerPopover({
  color,
  onChange,
  presets = WAKTI_COLOR_PALETTE,
  label,
  isRTL = false,
}: ColorPickerPopoverProps) {
  const [showEyeDropper, setShowEyeDropper] = useState(false);
  const [localColor, setLocalColor] = useState(color);

  // Check for EyeDropper API support
  useEffect(() => {
    setShowEyeDropper('EyeDropper' in window);
  }, []);

  // Sync local color with prop
  useEffect(() => {
    setLocalColor(color);
  }, [color]);

  const handleEyeDropper = async () => {
    try {
      const eyeDropper = new (window as any).EyeDropper();
      const result = await eyeDropper.open();
      onChange(result.sRGBHex);
      setLocalColor(result.sRGBHex);
    } catch (e) {
      console.log('EyeDropper cancelled or not supported');
    }
  };

  const handleInputChange = (value: string) => {
    setLocalColor(value);
    // Only apply if it looks like a valid color
    if (/^#[0-9A-Fa-f]{6}$/.test(value) || /^#[0-9A-Fa-f]{3}$/.test(value)) {
      onChange(value);
    }
  };

  const handleInputBlur = () => {
    // Apply color on blur if valid
    if (/^#[0-9A-Fa-f]{6}$/.test(localColor) || /^#[0-9A-Fa-f]{3}$/.test(localColor)) {
      onChange(localColor);
    } else {
      // Reset to current valid color
      setLocalColor(color);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          className="w-8 h-8 rounded-lg border-2 border-zinc-600 hover:border-indigo-500 transition-colors overflow-hidden"
          title={label}
        >
          <div 
            className="w-full h-full" 
            style={{ backgroundColor: color }} 
          />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 p-4 bg-zinc-900 border-zinc-700"
        align={isRTL ? 'end' : 'start'}
      >
        {label && (
          <div className="flex items-center gap-2 mb-3">
            <Palette className="h-4 w-4 text-indigo-400" />
            <span className="text-xs font-medium text-white">{label}</span>
          </div>
        )}

        {/* Color presets grid */}
        <div className="grid grid-cols-8 gap-1.5 mb-4">
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => {
                onChange(preset);
                setLocalColor(preset);
              }}
              className={cn(
                "w-6 h-6 rounded transition-transform hover:scale-110 border border-zinc-700",
                color.toLowerCase() === preset.toLowerCase() && "ring-2 ring-indigo-500 ring-offset-1 ring-offset-zinc-900"
              )}
              style={{ backgroundColor: preset }}
              title={preset}
            />
          ))}
        </div>

        {/* Color input row */}
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={localColor}
            onChange={(e) => {
              onChange(e.target.value);
              setLocalColor(e.target.value);
            }}
            className="w-10 h-10 rounded cursor-pointer border-0 p-0 bg-transparent"
          />
          <Input
            value={localColor}
            onChange={(e) => handleInputChange(e.target.value)}
            onBlur={handleInputBlur}
            className="flex-1 font-mono text-xs h-8 bg-zinc-800 border-zinc-700"
            placeholder="#000000"
          />
          {showEyeDropper && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleEyeDropper}
              className="h-8 w-8 hover:bg-zinc-800"
              title={isRTL ? 'اختيار لون من الشاشة' : 'Pick color from screen'}
            >
              <Pipette className="h-4 w-4 text-zinc-400" />
            </Button>
          )}
        </div>

        {/* Transparency slider could be added here in the future */}
      </PopoverContent>
    </Popover>
  );
}
