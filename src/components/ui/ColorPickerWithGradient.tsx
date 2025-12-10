import React, { useState, useEffect } from 'react';

interface ColorPickerWithGradientProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

// Parse gradient string: "gradient:#color1,#color2,angle"
const parseGradient = (value: string): { color1: string; color2: string; angle: number } | null => {
  if (!value.startsWith('gradient:')) return null;
  const parts = value.replace('gradient:', '').split(',');
  if (parts.length >= 2) {
    return {
      color1: parts[0] || '#000000',
      color2: parts[1] || '#ffffff',
      angle: parseInt(parts[2]) || 135,
    };
  }
  return null;
};

// Build gradient string
const buildGradient = (color1: string, color2: string, angle: number): string => {
  return `gradient:${color1},${color2},${angle}`;
};

// Get CSS for preview
const getPreviewStyle = (value: string): React.CSSProperties => {
  const gradient = parseGradient(value);
  if (gradient) {
    return {
      background: `linear-gradient(${gradient.angle}deg, ${gradient.color1}, ${gradient.color2})`,
    };
  }
  return { backgroundColor: value || '#000000' };
};

export const ColorPickerWithGradient: React.FC<ColorPickerWithGradientProps> = ({
  value,
  onChange,
  label,
}) => {
  const isGradient = value.startsWith('gradient:');
  const gradient = parseGradient(value);
  
  const [mode, setMode] = useState<'solid' | 'gradient'>(isGradient ? 'gradient' : 'solid');
  const [solidColor, setSolidColor] = useState(isGradient ? '#000000' : (value || '#000000'));
  const [gradientColor1, setGradientColor1] = useState(gradient?.color1 || '#000000');
  const [gradientColor2, setGradientColor2] = useState(gradient?.color2 || '#ffffff');
  const [gradientAngle, setGradientAngle] = useState(gradient?.angle || 135);

  // Sync internal state when value prop changes
  useEffect(() => {
    const isGrad = value.startsWith('gradient:');
    if (isGrad) {
      const g = parseGradient(value);
      if (g) {
        setMode('gradient');
        setGradientColor1(g.color1);
        setGradientColor2(g.color2);
        setGradientAngle(g.angle);
      }
    } else {
      setMode('solid');
      setSolidColor(value || '#000000');
    }
  }, [value]);

  const handleModeChange = (newMode: 'solid' | 'gradient') => {
    setMode(newMode);
    if (newMode === 'solid') {
      onChange(solidColor);
    } else {
      onChange(buildGradient(gradientColor1, gradientColor2, gradientAngle));
    }
  };

  const handleSolidChange = (color: string) => {
    setSolidColor(color);
    if (mode === 'solid') {
      onChange(color);
    }
  };

  const handleGradientChange = (color1: string, color2: string, angle: number) => {
    setGradientColor1(color1);
    setGradientColor2(color2);
    setGradientAngle(angle);
    if (mode === 'gradient') {
      onChange(buildGradient(color1, color2, angle));
    }
  };

  const angles = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <div className="flex flex-col gap-2">
      {/* Mode Toggle */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name={`color-mode-${label}`}
            checked={mode === 'solid'}
            onChange={() => handleModeChange('solid')}
            className="w-3.5 h-3.5 accent-primary"
          />
          <span className="text-xs text-slate-600 dark:text-slate-300">Solid</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name={`color-mode-${label}`}
            checked={mode === 'gradient'}
            onChange={() => handleModeChange('gradient')}
            className="w-3.5 h-3.5 accent-primary"
          />
          <span className="text-xs text-slate-600 dark:text-slate-300">Gradient</span>
        </label>
        {/* Preview */}
        <div 
          className="w-6 h-6 rounded border border-slate-400 ml-auto"
          style={getPreviewStyle(mode === 'solid' ? solidColor : buildGradient(gradientColor1, gradientColor2, gradientAngle))}
        />
      </div>

      {/* Solid Mode */}
      {mode === 'solid' && (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={solidColor}
            onChange={(e) => handleSolidChange(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-2 border-slate-300"
          />
          <input
            type="text"
            value={solidColor}
            onChange={(e) => handleSolidChange(e.target.value)}
            className="w-20 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            placeholder="#hex"
          />
        </div>
      )}

      {/* Gradient Mode */}
      {mode === 'gradient' && (
        <div className="flex flex-col gap-2">
          {/* Color 1 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-8">From:</span>
            <input
              type="color"
              value={gradientColor1}
              onChange={(e) => handleGradientChange(e.target.value, gradientColor2, gradientAngle)}
              className="w-7 h-7 rounded cursor-pointer border-2 border-slate-300"
            />
            <input
              type="text"
              value={gradientColor1}
              onChange={(e) => handleGradientChange(e.target.value, gradientColor2, gradientAngle)}
              className="w-20 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="#hex"
            />
          </div>
          {/* Color 2 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-8">To:</span>
            <input
              type="color"
              value={gradientColor2}
              onChange={(e) => handleGradientChange(gradientColor1, e.target.value, gradientAngle)}
              className="w-7 h-7 rounded cursor-pointer border-2 border-slate-300"
            />
            <input
              type="text"
              value={gradientColor2}
              onChange={(e) => handleGradientChange(gradientColor1, e.target.value, gradientAngle)}
              className="w-20 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              placeholder="#hex"
            />
          </div>
          {/* Angle */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-slate-400 w-8">Angle:</span>
            {angles.map((angle) => (
              <button
                key={angle}
                onClick={() => handleGradientChange(gradientColor1, gradientColor2, angle)}
                className={`px-1.5 py-0.5 text-xs rounded ${
                  gradientAngle === angle 
                    ? 'bg-primary text-white' 
                    : 'bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500'
                }`}
              >
                {angle}°
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper to get CSS style from value (for rendering in slides)
export const getColorStyle = (value: string, property: 'background' | 'color' = 'background'): React.CSSProperties => {
  if (!value) return {};
  
  const gradient = parseGradient(value);
  if (gradient) {
    if (property === 'background') {
      return {
        background: `linear-gradient(${gradient.angle}deg, ${gradient.color1}, ${gradient.color2})`,
      };
    }
    // For text color with gradient, use first color as fallback
    return { color: gradient.color1 };
  }
  
  if (property === 'background') {
    return { backgroundColor: value };
  }
  return { color: value };
};

// Helper to check if value is gradient
export const isGradientValue = (value: string): boolean => {
  return value?.startsWith('gradient:') || false;
};

export default ColorPickerWithGradient;
