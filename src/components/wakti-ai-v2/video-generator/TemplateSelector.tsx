
import React from 'react';
import { Video, Sparkles, Play } from 'lucide-react';

interface TemplateSelectorProps {
  selectedTemplate: string;
  onTemplateSelect: (template: string) => void;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail: string;
}

const templates: Template[] = [
  // Motion Templates
  { id: 'zoom_in', name: 'Zoom In', description: 'Smooth zoom into the image', category: 'Motion', thumbnail: '🔍' },
  { id: 'zoom_out', name: 'Zoom Out', description: 'Pull back to reveal more', category: 'Motion', thumbnail: '🔍' },
  { id: 'pan_left', name: 'Pan Left', description: 'Camera moves left', category: 'Motion', thumbnail: '⬅️' },
  { id: 'pan_right', name: 'Pan Right', description: 'Camera moves right', category: 'Motion', thumbnail: '➡️' },
  { id: 'tilt_up', name: 'Tilt Up', description: 'Camera tilts upward', category: 'Motion', thumbnail: '⬆️' },
  { id: 'tilt_down', name: 'Tilt Down', description: 'Camera tilts downward', category: 'Motion', thumbnail: '⬇️' },
  
  // Cinematic Templates
  { id: 'cinematic_slow', name: 'Cinematic Slow', description: 'Slow, dramatic movement', category: 'Cinematic', thumbnail: '🎬' },
  { id: 'dolly_zoom', name: 'Dolly Zoom', description: 'Famous Hitchcock effect', category: 'Cinematic', thumbnail: '🎥' },
  { id: 'establishing_shot', name: 'Establishing Shot', description: 'Wide revealing shot', category: 'Cinematic', thumbnail: '🌅' },
  { id: 'close_up_reveal', name: 'Close-up Reveal', description: 'Dramatic close-up', category: 'Cinematic', thumbnail: '👁️' },
  
  // Nature Templates
  { id: 'water_flow', name: 'Water Flow', description: 'Flowing water animation', category: 'Nature', thumbnail: '🌊' },
  { id: 'wind_sway', name: 'Wind Sway', description: 'Gentle swaying motion', category: 'Nature', thumbnail: '🍃' },
  { id: 'fire_flicker', name: 'Fire Flicker', description: 'Flickering flames', category: 'Nature', thumbnail: '🔥' },
  { id: 'cloud_drift', name: 'Cloud Drift', description: 'Drifting clouds', category: 'Nature', thumbnail: '☁️' },
  
  // Portrait Templates
  { id: 'portrait_subtle', name: 'Portrait Subtle', description: 'Gentle portrait animation', category: 'Portrait', thumbnail: '👤' },
  { id: 'eye_blink', name: 'Eye Blink', description: 'Natural blinking', category: 'Portrait', thumbnail: '👁️' },
  { id: 'hair_flow', name: 'Hair Flow', description: 'Flowing hair movement', category: 'Portrait', thumbnail: '💇' },
  { id: 'smile_animate', name: 'Smile Animate', description: 'Animated smile', category: 'Portrait', thumbnail: '😊' },
  
  // Fantasy Templates
  { id: 'magic_sparkle', name: 'Magic Sparkle', description: 'Magical sparkling effects', category: 'Fantasy', thumbnail: '✨' },
  { id: 'ethereal_glow', name: 'Ethereal Glow', description: 'Mystical glowing effect', category: 'Fantasy', thumbnail: '🌟' },
  { id: 'floating_objects', name: 'Floating Objects', description: 'Objects floating magically', category: 'Fantasy', thumbnail: '🪄' },
  
  // Urban Templates
  { id: 'traffic_flow', name: 'Traffic Flow', description: 'Moving traffic lights', category: 'Urban', thumbnail: '🚦' },
  { id: 'neon_flicker', name: 'Neon Flicker', description: 'Flickering neon signs', category: 'Urban', thumbnail: '🌃' },
  { id: 'window_lights', name: 'Window Lights', description: 'Lights in windows', category: 'Urban', thumbnail: '🏢' }
];

const categories = ['Motion', 'Cinematic', 'Nature', 'Portrait', 'Fantasy', 'Urban'];

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedTemplate,
  onTemplateSelect,
}) => {
  const [selectedCategory, setSelectedCategory] = React.useState('Motion');

  const filteredTemplates = templates.filter(template => template.category === selectedCategory);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-indigo-500 rounded-lg text-white">
          <Video className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-medium text-foreground">Choose Template</h3>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === category
                ? 'bg-indigo-500 text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
        {filteredTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => onTemplateSelect(template.id)}
            className={`p-3 rounded-lg border text-left transition-all hover:scale-[1.02] ${
              selectedTemplate === template.id
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20'
                : 'border-border hover:border-indigo-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{template.thumbnail}</span>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-foreground truncate">
                  {template.name}
                </h4>
              </div>
              {selectedTemplate === template.id && (
                <Play className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {template.description}
            </p>
          </button>
        ))}
      </div>

      {selectedTemplate && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span className="text-sm text-foreground">
            Selected: {templates.find(t => t.id === selectedTemplate)?.name}
          </span>
        </div>
      )}
    </div>
  );
};
