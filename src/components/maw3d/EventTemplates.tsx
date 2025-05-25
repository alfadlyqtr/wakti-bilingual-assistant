
import React from 'react';
import { EventTemplate } from '@/types/maw3d';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface EventTemplatesProps {
  onSelectTemplate: (template: EventTemplate | null) => void;
  selectedTemplate: EventTemplate | null;
}

const templates: EventTemplate[] = [
  {
    id: 'birthday',
    name: 'Birthday',
    title: 'Happy Birthday!',
    description: 'Join us for a birthday celebration',
    background_type: 'gradient',
    background_value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    text_style: {
      fontSize: 24,
      fontFamily: 'Arial',
      isBold: true,
      isItalic: false,
      isUnderline: false,
      hasShadow: true,
      alignment: 'center',
      color: '#ffffff'
    }
  },
  {
    id: 'meeting',
    name: 'Meeting',
    title: 'Team Meeting',
    description: 'Important team discussion',
    background_type: 'color',
    background_value: '#1e40af',
    text_style: {
      fontSize: 18,
      fontFamily: 'Arial',
      isBold: false,
      isItalic: false,
      isUnderline: false,
      hasShadow: false,
      alignment: 'left',
      color: '#ffffff'
    }
  },
  {
    id: 'gathering',
    name: 'Gathering',
    title: 'Friends Gathering',
    description: 'Come and join us for a fun time',
    background_type: 'gradient',
    background_value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    text_style: {
      fontSize: 20,
      fontFamily: 'Arial',
      isBold: true,
      isItalic: false,
      isUnderline: false,
      hasShadow: true,
      alignment: 'center',
      color: '#ffffff'
    }
  }
];

export const EventTemplates: React.FC<EventTemplatesProps> = ({
  onSelectTemplate,
  selectedTemplate
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Choose a Template (Optional)</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card 
          className={`cursor-pointer border-2 ${!selectedTemplate ? 'border-primary' : 'border-border'}`}
          onClick={() => onSelectTemplate(null)}
        >
          <CardContent className="p-4 text-center">
            <div className="w-full h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-md mb-2 flex items-center justify-center">
              <span className="text-gray-500">Start from Scratch</span>
            </div>
            <h4 className="font-medium">Blank Template</h4>
          </CardContent>
        </Card>

        {templates.map((template) => (
          <Card 
            key={template.id}
            className={`cursor-pointer border-2 ${selectedTemplate?.id === template.id ? 'border-primary' : 'border-border'}`}
            onClick={() => onSelectTemplate(template)}
          >
            <CardContent className="p-4 text-center">
              <div 
                className="w-full h-24 rounded-md mb-2 flex items-center justify-center"
                style={{
                  background: template.background_type === 'gradient' 
                    ? template.background_value 
                    : template.background_value,
                  color: template.text_style.color,
                  fontSize: `${Math.max(template.text_style.fontSize - 8, 12)}px`,
                  fontWeight: template.text_style.isBold ? 'bold' : 'normal',
                  fontStyle: template.text_style.isItalic ? 'italic' : 'normal',
                  textDecoration: template.text_style.isUnderline ? 'underline' : 'none',
                  textShadow: template.text_style.hasShadow ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none',
                  textAlign: template.text_style.alignment
                }}
              >
                {template.title}
              </div>
              <h4 className="font-medium">{template.name}</h4>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
