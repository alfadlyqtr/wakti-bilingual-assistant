
import React from 'react';
import { EventTemplate } from '@/types/maw3d';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { t } from '@/utils/translations';

interface EventTemplatesProps {
  onSelectTemplate: (template: EventTemplate | null) => void;
  selectedTemplate: EventTemplate | null;
  language: string;
}

const getTemplateTranslations = (language: string) => ({
  birthday: {
    name: language === 'ar' ? 'عيد ميلاد' : 'Birthday',
    title: language === 'ar' ? 'عيد ميلاد سعيد!' : 'Happy Birthday!',
    description: language === 'ar' ? 'انضم إلينا للاحتفال بعيد الميلاد' : 'Join us for a birthday celebration'
  },
  meeting: {
    name: language === 'ar' ? 'اجتماع' : 'Meeting',
    title: language === 'ar' ? 'اجتماع الفريق' : 'Team Meeting',
    description: language === 'ar' ? 'مناقشة مهمة للفريق' : 'Important team discussion'
  },
  gathering: {
    name: language === 'ar' ? 'تجمع' : 'Gathering',
    title: language === 'ar' ? 'تجمع الأصدقاء' : 'Friends Gathering',
    description: language === 'ar' ? 'تعال وانضم إلينا لقضاء وقت ممتع' : 'Come and join us for a fun time'
  }
});

const templates: EventTemplate[] = [
  {
    id: 'birthday',
    name: 'Birthday',
    preview: 'Birthday Party',
    title: 'Happy Birthday!',
    description: 'Join us for a birthday celebration',
    organizer: '',
    background_type: 'gradient',
    background_value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    text_style: {
      fontSize: 24,
      fontFamily: 'Arial',
      isBold: true,
      isItalic: false,
      isUnderline: false,
      hasShadow: true,
      shadowIntensity: 5,
      alignment: 'center',
      color: '#ffffff'
    }
  },
  {
    id: 'meeting',
    name: 'Meeting',
    preview: 'Business Meeting',
    title: 'Team Meeting',
    description: 'Important team discussion',
    organizer: '',
    background_type: 'color',
    background_value: '#1e40af',
    text_style: {
      fontSize: 18,
      fontFamily: 'Arial',
      isBold: false,
      isItalic: false,
      isUnderline: false,
      hasShadow: false,
      shadowIntensity: 0,
      alignment: 'left',
      color: '#ffffff'
    }
  },
  {
    id: 'gathering',
    name: 'Gathering',
    preview: 'Social Gathering',
    title: 'Friends Gathering',
    description: 'Come and join us for a fun time',
    organizer: '',
    background_type: 'gradient',
    background_value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    text_style: {
      fontSize: 20,
      fontFamily: 'Arial',
      isBold: true,
      isItalic: false,
      isUnderline: false,
      hasShadow: true,
      shadowIntensity: 3,
      alignment: 'center',
      color: '#ffffff'
    }
  }
];

export const EventTemplates: React.FC<EventTemplatesProps> = ({
  onSelectTemplate,
  selectedTemplate,
  language
}) => {
  const templateTranslations = getTemplateTranslations(language);

  const handleTemplateSelect = (template: EventTemplate | null) => {
    if (template) {
      // Apply language-specific translations to the template
      const translatedTemplate = {
        ...template,
        title: templateTranslations[template.id as keyof typeof templateTranslations]?.title || template.title,
        description: templateTranslations[template.id as keyof typeof templateTranslations]?.description || template.description
      };
      onSelectTemplate(translatedTemplate);
    } else {
      onSelectTemplate(null);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t('chooseTemplate', language)} ({t('optional', language)})</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card 
          className={`cursor-pointer border-2 ${!selectedTemplate ? 'border-primary' : 'border-border'}`}
          onClick={() => onSelectTemplate(null)}
        >
          <CardContent className="p-4 text-center">
            <div className="w-full h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-md mb-2 flex items-center justify-center">
              <span className="text-gray-500">{t('startFromScratch', language)}</span>
            </div>
            <h4 className="font-medium">{t('blankTemplate', language)}</h4>
          </CardContent>
        </Card>

        {templates.map((template) => {
          const translation = templateTranslations[template.id as keyof typeof templateTranslations];
          return (
            <Card 
              key={template.id}
              className={`cursor-pointer border-2 ${selectedTemplate?.id === template.id ? 'border-primary' : 'border-border'}`}
              onClick={() => handleTemplateSelect(template)}
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
                    textShadow: template.text_style.hasShadow ? `2px 2px 4px rgba(0,0,0,${(template.text_style.shadowIntensity || 5) / 10})` : 'none',
                    textAlign: template.text_style.alignment
                  }}
                >
                  {translation?.title || template.title}
                </div>
                <h4 className="font-medium">{translation?.name || template.name}</h4>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
