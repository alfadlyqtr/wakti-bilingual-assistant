
import React from 'react';
import { Play, Sparkles, Camera, Wind, Palette } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Advanced';
  thumbnail: string;
  icon: React.ReactNode;
  prompt: string;
}

interface TemplateSelectorProps {
  selectedTemplate: string;
  onTemplateSelect: (templateId: string) => void;
}

const templates: Template[] = [
  // Portrait & Facial (7 templates)
  {
    id: 'eye_blink',
    name: 'Natural Eye Blink',
    description: 'Adds realistic blinking animation to portrait shots',
    category: 'Portrait & Facial',
    difficulty: 'Easy',
    thumbnail: '👁️',
    icon: <Play className="w-4 h-4" />,
    prompt: 'Generate natural eye blinking animation for portrait, subtle eyelid movement, realistic timing, maintain facial expression'
  },
  {
    id: 'smile_animation',
    name: 'Smile Animation',
    description: 'Creates a gentle smile appearing gradually',
    category: 'Portrait & Facial',
    difficulty: 'Easy',
    thumbnail: '😊',
    icon: <Play className="w-4 h-4" />,
    prompt: 'Animate a gentle smile appearing naturally, lip corners lifting, eyes brightening slightly, warm expression'
  },
  {
    id: 'hair_flow',
    name: 'Hair Movement',
    description: 'Adds natural hair flow and movement',
    category: 'Portrait & Facial',
    difficulty: 'Medium',
    thumbnail: '💁',
    icon: <Wind className="w-4 h-4" />,
    prompt: 'Create gentle hair movement, natural flow, soft swaying motion, maintain hair texture and color'
  },
  {
    id: 'subtle_portrait',
    name: 'Subtle Portrait Life',
    description: 'Adds minimal breathing and micro-movements',
    category: 'Portrait & Facial',
    difficulty: 'Easy',
    thumbnail: '👤',
    icon: <Play className="w-4 h-4" />,
    prompt: 'Add subtle life to portrait, gentle breathing motion, slight shoulder movement, natural alive feeling'
  },
  {
    id: 'face_tracking',
    name: 'Face Tracking',
    description: 'Smooth head movement following invisible path',
    category: 'Portrait & Facial',
    difficulty: 'Advanced',
    thumbnail: '🎯',
    icon: <Camera className="w-4 h-4" />,
    prompt: 'Create smooth head tracking movement, natural neck rotation, eyes following direction, realistic motion'
  },
  {
    id: 'expression_enhance',
    name: 'Expression Enhancement',
    description: 'Enhances existing facial expressions',
    category: 'Portrait & Facial',
    difficulty: 'Medium',
    thumbnail: '😃',
    icon: <Sparkles className="w-4 h-4" />,
    prompt: 'Enhance facial expression naturally, intensify existing emotion, maintain authenticity, smooth transition'
  },
  {
    id: 'lip_sync_ready',
    name: 'Lip Sync Ready',
    description: 'Prepares portrait for lip synchronization',
    category: 'Portrait & Facial',
    difficulty: 'Advanced',
    thumbnail: '🗣️',
    icon: <Play className="w-4 h-4" />,
    prompt: 'Create subtle lip movement preparation, natural mouth positioning, ready for speech animation'
  },

  // Camera Movement (6 templates)
  {
    id: 'zoom_in',
    name: 'Cinematic Zoom In',
    description: 'Smooth zoom into subject with focus pull',
    category: 'Camera Movement',
    difficulty: 'Medium',
    thumbnail: '🔍',
    icon: <Camera className="w-4 h-4" />,
    prompt: 'Create smooth cinematic zoom in, gradual focus on subject, professional camera movement, shallow depth of field'
  },
  {
    id: 'zoom_out',
    name: 'Reveal Zoom Out',
    description: 'Dramatic zoom out revealing environment',
    category: 'Camera Movement',
    difficulty: 'Medium',
    thumbnail: '📤',
    icon: <Camera className="w-4 h-4" />,
    prompt: 'Smooth zoom out revealing surroundings, dramatic scale reveal, cinematic pullback, environmental context'
  },
  {
    id: 'pan_left',
    name: 'Smooth Pan Left',
    description: 'Professional left panning movement',
    category: 'Camera Movement',
    difficulty: 'Easy',
    thumbnail: '⬅️',
    icon: <Camera className="w-4 h-4" />,
    prompt: 'Create smooth left panning motion, steady horizontal movement, maintain focus, professional camera work'
  },
  {
    id: 'pan_right',
    name: 'Smooth Pan Right',
    description: 'Professional right panning movement',
    category: 'Camera Movement',
    difficulty: 'Easy',
    thumbnail: '➡️',
    icon: <Camera className="w-4 h-4" />,
    prompt: 'Create smooth right panning motion, steady horizontal movement, maintain focus, professional camera work'
  },
  {
    id: 'dolly_zoom',
    name: 'Dolly Zoom Effect',
    description: 'Hitchcock-style dolly zoom (vertigo effect)',
    category: 'Camera Movement',
    difficulty: 'Advanced',
    thumbnail: '🌀',
    icon: <Camera className="w-4 h-4" />,
    prompt: 'Create dolly zoom effect, simultaneous zoom and dolly movement, background distortion, dramatic perspective shift'
  },
  {
    id: 'orbital_rotation',
    name: 'Orbital Rotation',
    description: 'Circular camera movement around subject',
    category: 'Camera Movement',
    difficulty: 'Advanced',
    thumbnail: '🔄',
    icon: <Camera className="w-4 h-4" />,
    prompt: 'Create orbital camera rotation around subject, smooth circular movement, maintain subject focus, dynamic perspective'
  },

  // Object Animation (5 templates)
  {
    id: 'floating_objects',
    name: 'Floating Objects',
    description: 'Makes objects appear to float gently',
    category: 'Object Animation',
    difficulty: 'Medium',
    thumbnail: '🎈',
    icon: <Wind className="w-4 h-4" />,
    prompt: 'Animate objects floating gently, up and down motion, weightless appearance, natural floating rhythm'
  },
  {
    id: 'rotation_spin',
    name: 'Object Rotation',
    description: 'Smooth rotation animation for objects',
    category: 'Object Animation',
    difficulty: 'Easy',
    thumbnail: '🔄',
    icon: <Play className="w-4 h-4" />,
    prompt: 'Create smooth object rotation, steady spinning motion, maintain object integrity, natural rotation axis'
  },
  {
    id: 'scale_pulse',
    name: 'Scale Pulsing',
    description: 'Rhythmic scaling animation',
    category: 'Object Animation',
    difficulty: 'Easy',
    thumbnail: '💓',
    icon: <Play className="w-4 h-4" />,
    prompt: 'Create rhythmic scaling animation, pulsing effect, grow and shrink smoothly, heartbeat-like rhythm'
  },
  {
    id: 'morphing_transform',
    name: 'Morphing Transform',
    description: 'Gradual shape transformation',
    category: 'Object Animation',
    difficulty: 'Advanced',
    thumbnail: '🔀',
    icon: <Sparkles className="w-4 h-4" />,
    prompt: 'Create gradual morphing transformation, smooth shape changes, maintain object essence, fluid transition'
  },
  {
    id: 'texture_flow',
    name: 'Texture Animation',
    description: 'Animates surface textures and patterns',
    category: 'Object Animation',
    difficulty: 'Medium',
    thumbnail: '🌊',
    icon: <Wind className="w-4 h-4" />,
    prompt: 'Animate surface textures, flowing patterns, material movement, maintain object structure'
  },

  // Environmental Effects (5 templates)
  {
    id: 'water_flow',
    name: 'Water Flow',
    description: 'Creates flowing water animation',
    category: 'Environmental Effects',
    difficulty: 'Medium',
    thumbnail: '🌊',
    icon: <Wind className="w-4 h-4" />,
    prompt: 'Create realistic water flow animation, natural water movement, ripples and waves, fluid dynamics'
  },
  {
    id: 'wind_sway',
    name: 'Wind Effect',
    description: 'Adds natural wind movement to scene',
    category: 'Environmental Effects',
    difficulty: 'Easy',
    thumbnail: '💨',
    icon: <Wind className="w-4 h-4" />,
    prompt: 'Add natural wind effects, gentle swaying motion, leaves rustling, atmospheric movement'
  },
  {
    id: 'fire_flicker',
    name: 'Fire Flicker',
    description: 'Realistic fire and flame animation',
    category: 'Environmental Effects',
    difficulty: 'Advanced',
    thumbnail: '🔥',
    icon: <Sparkles className="w-4 h-4" />,
    prompt: 'Create realistic fire flicker animation, dancing flames, natural fire movement, warm lighting effects'
  },
  {
    id: 'cloud_drift',
    name: 'Cloud Movement',
    description: 'Slow-moving cloud animation',
    category: 'Environmental Effects',
    difficulty: 'Easy',
    thumbnail: '☁️',
    icon: <Wind className="w-4 h-4" />,
    prompt: 'Create slow cloud movement, natural drift across sky, soft cloud motion, atmospheric depth'
  },
  {
    id: 'weather_effects',
    name: 'Weather Effects',
    description: 'Rain, snow, or atmospheric effects',
    category: 'Environmental Effects',
    difficulty: 'Medium',
    thumbnail: '🌧️',
    icon: <Wind className="w-4 h-4" />,
    prompt: 'Add weather effects, rain drops or snow falling, natural weather patterns, atmospheric enhancement'
  },

  // Creative & Artistic (5 templates)
  {
    id: 'magic_sparkle',
    name: 'Magic Sparkles',
    description: 'Adds magical sparkle effects',
    category: 'Creative & Artistic',
    difficulty: 'Medium',
    thumbnail: '✨',
    icon: <Sparkles className="w-4 h-4" />,
    prompt: 'Add magical sparkle effects, twinkling particles, fairy-like atmosphere, dreamy enhancement'
  },
  {
    id: 'ethereal_glow',
    name: 'Ethereal Glow',
    description: 'Soft glowing light effects',
    category: 'Creative & Artistic',
    difficulty: 'Medium',
    thumbnail: '🌟',
    icon: <Sparkles className="w-4 h-4" />,
    prompt: 'Create ethereal glow effects, soft luminous aura, dreamy lighting, mystical atmosphere'
  },
  {
    id: 'color_shift',
    name: 'Color Shifting',
    description: 'Gradual color transitions',
    category: 'Creative & Artistic',
    difficulty: 'Easy',
    thumbnail: '🎨',
    icon: <Palette className="w-4 h-4" />,
    prompt: 'Create gradual color shifting, smooth color transitions, artistic color flow, maintain image harmony'
  },
  {
    id: 'vintage_film',
    name: 'Vintage Film Look',
    description: 'Old film aesthetic with grain and flicker',
    category: 'Creative & Artistic',
    difficulty: 'Medium',
    thumbnail: '📽️',
    icon: <Camera className="w-4 h-4" />,
    prompt: 'Apply vintage film aesthetic, film grain, subtle flicker, nostalgic atmosphere, retro cinema feel'
  },
  {
    id: 'glitch_effect',
    name: 'Digital Glitch',
    description: 'Modern digital glitch effects',
    category: 'Creative & Artistic',
    difficulty: 'Advanced',
    thumbnail: '📱',
    icon: <Sparkles className="w-4 h-4" />,
    prompt: 'Create digital glitch effects, pixel distortion, modern digital aesthetic, controlled glitch artifacts'
  }
];

const categories = [
  'Portrait & Facial',
  'Camera Movement', 
  'Object Animation',
  'Environmental Effects',
  'Creative & Artistic'
];

const difficultyColors = {
  'Easy': 'bg-green-500',
  'Medium': 'bg-yellow-500', 
  'Advanced': 'bg-red-500'
};

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedTemplate,
  onTemplateSelect,
}) => {
  const [selectedCategory, setSelectedCategory] = React.useState<string>('All');

  const filteredTemplates = selectedCategory === 'All' 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground mb-4">Choose Video Template</h3>
        
        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === 'All'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            All ({templates.length})
          </button>
          {categories.map(category => {
            const count = templates.filter(t => t.category === category).length;
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {category} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            onClick={() => onTemplateSelect(template.id)}
            className={`group cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md ${
              selectedTemplate === template.id
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border hover:border-primary/50'
            }`}
          >
            {/* Template Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{template.thumbnail}</div>
                <div>
                  <h4 className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {template.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-1 rounded-full text-white ${difficultyColors[template.difficulty]}`}>
                      {template.difficulty}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {template.category}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-muted-foreground group-hover:text-primary transition-colors">
                {template.icon}
              </div>
            </div>

            {/* Template Description */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {template.description}
            </p>

            {/* Selection Indicator */}
            {selectedTemplate === template.id && (
              <div className="mt-3 flex items-center gap-2 text-primary text-sm font-medium">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                Selected
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No templates found in this category.</p>
        </div>
      )}
    </div>
  );
};

// Export templates for use in the modal
export { templates };
