
import React, { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';

interface TemplateSelectorProps {
  selectedTemplate: string;
  onTemplateSelect: (template: string) => void;
}

const templateCategories = {
  'Animation': {
    'Character Effects': [
      { id: 'hugging', name: 'Hugging', description: 'Create warm embrace animations' },
      { id: 'shake_it_dance', name: 'Shake it Dance', description: 'Dynamic dance movements' },
      { id: 'blow_a_kiss', name: 'Blow a Kiss', description: 'Romantic gesture animation' },
      { id: 'make_a_face', name: 'Make a Face', description: 'Expressive facial animations' },
      { id: 'finger_heart', name: 'Finger Heart', description: 'Cute heart gesture' },
    ],
    'Movement': [
      { id: 'walk_forward', name: 'Walk Forward', description: 'Natural walking motion' },
      { id: 'flying', name: 'Flying', description: 'Floating/flying effects' },
      { id: 'spin360', name: 'Spin 360', description: '360-degree rotation' },
    ]
  },
  'Style Effects': {
    'Artistic Styles': [
      { id: 'yayoi_kusama_style', name: 'Yayoi Kusama Style', description: 'Polka dot art style' },
      { id: 'american_comic', name: 'American Comic', description: 'Comic book style' },
      { id: 'simpsons_comic', name: 'Simpsons Comic', description: 'Simpsons animation style' },
      { id: 'irasutoya', name: 'Irasutoya', description: 'Japanese illustration style' },
    ],
    'Character Transforms': [
      { id: 'cartoon_doll', name: 'Cartoon Doll', description: 'Transform to cartoon character' },
      { id: 'toy_me', name: 'Toy Me', description: 'Toy-like transformation' },
      { id: 'fairy_me', name: 'Fairy Me', description: 'Magical fairy transformation' },
      { id: 'muscling', name: 'Muscling', description: 'Muscle enhancement effect' },
    ]
  },
  'Camera Effects': {
    'Zoom Effects': [
      { id: 'zoom_in_fast', name: 'Zoom In Fast', description: 'Fast zoom into subject' },
      { id: 'zoom_out_image', name: 'Zoom Out (Image)', description: 'Zoom out from image' },
      { id: 'zoom_out_start_end', name: 'Zoom Out (Start-End)', description: 'Start to end zoom out' },
    ],
    'Special Effects': [
      { id: 'ai_one_shot', name: 'AI One Shot', description: 'Single dramatic shot' },
      { id: 'outfit_show', name: 'Outfit Show', description: 'Fashion showcase effect' },
    ]
  },
  'Seasonal & Special': {
    'Occasions': [
      { id: 'send_roses', name: 'Send Roses', description: 'Romantic rose-giving animation' },
      { id: 'sakura_season', name: 'Sakura Season', description: 'Cherry blossom theme' },
      { id: 'carry_me', name: 'Carry Me', description: 'Carrying/lifting animation' },
    ],
    'Lifestyle': [
      { id: 'child_memory', name: 'Child Memory', description: 'Nostalgic childhood theme' },
      { id: 'hair_swap', name: 'Hair Swap', description: 'Hairstyle transformation' },
      { id: 'nap_me', name: 'Nap Me', description: 'Peaceful sleeping animation' },
      { id: 'pilot', name: 'Pilot', description: 'Aviation theme animation' },
    ]
  }
};

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedTemplate,
  onTemplateSelect,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [expandedCategory, setExpandedCategory] = useState<string>('');

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setSelectedSubcategory('');
    onTemplateSelect('');
    setExpandedCategory(expandedCategory === category ? '' : category);
  };

  const handleSubcategorySelect = (subcategory: string) => {
    setSelectedSubcategory(subcategory);
    onTemplateSelect('');
  };

  const handleTemplateSelect = (templateId: string) => {
    onTemplateSelect(templateId);
  };

  const getSelectedTemplateName = () => {
    for (const category of Object.values(templateCategories)) {
      for (const subcategory of Object.values(category)) {
        const template = subcategory.find(t => t.id === selectedTemplate);
        if (template) return template.name;
      }
    }
    return '';
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-indigo-500" />
        Select Template
      </h3>

      {/* Category Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Category</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {Object.keys(templateCategories).map((category) => (
            <button
              key={category}
              onClick={() => handleCategorySelect(category)}
              className={`p-3 text-left rounded-lg border transition-all ${
                selectedCategory === category
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                  : 'bg-muted border-border hover:bg-muted/80 text-foreground'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{category}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${
                  expandedCategory === category ? 'rotate-180' : ''
                }`} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Subcategory Selection */}
      {selectedCategory && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Subcategory</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.keys(templateCategories[selectedCategory as keyof typeof templateCategories]).map((subcategory) => (
              <button
                key={subcategory}
                onClick={() => handleSubcategorySelect(subcategory)}
                className={`p-3 text-left rounded-lg border transition-colors ${
                  selectedSubcategory === subcategory
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                    : 'bg-muted border-border hover:bg-muted/80 text-foreground'
                }`}
              >
                <span className="font-medium">{subcategory}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Template Selection */}
      {selectedCategory && selectedSubcategory && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Template</label>
          <div className="grid grid-cols-1 gap-2">
            {templateCategories[selectedCategory as keyof typeof templateCategories][selectedSubcategory as keyof typeof templateCategories[keyof typeof templateCategories]].map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template.id)}
                className={`p-4 text-left rounded-lg border transition-colors ${
                  selectedTemplate === template.id
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                    : 'bg-muted border-border hover:bg-muted/80 text-foreground'
                }`}
              >
                <div className="font-medium mb-1">{template.name}</div>
                <div className="text-sm text-muted-foreground">{template.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Template Summary */}
      {selectedTemplate && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="text-sm font-medium text-indigo-900">Selected Template:</div>
          <div className="text-indigo-700">{getSelectedTemplateName()}</div>
        </div>
      )}
    </div>
  );
};
