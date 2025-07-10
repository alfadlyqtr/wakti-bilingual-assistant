
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from '@/providers/ThemeProvider';

export interface ImageTypeOption {
  id: string;
  name: string;
  icon: string;
  description: string;
  hint: string;
  examples: string[];
}

const IMAGE_TYPES: ImageTypeOption[] = [
  {
    id: 'document',
    name: 'Document',
    icon: '📄',
    description: 'ID, Passport, Certificate, License',
    hint: 'I will extract information, check expiry dates, and validate details',
    examples: ['Extract passport info', 'Check ID expiry', 'Read certificate details']
  },
  {
    id: 'bill_receipt',
    name: 'Bill/Receipt',
    icon: '💰',
    description: 'Financial documents, invoices, receipts',
    hint: 'I will extract amounts, dates, items, and financial details',
    examples: ['Split restaurant bill', 'Extract invoice details', 'Calculate totals']
  },
  {
    id: 'person',
    name: 'Person',
    icon: '👤',
    description: 'Photos of people, portraits',
    hint: 'I will describe appearance, clothing, expressions, and activities',
    examples: ['Describe person', 'Identify clothing style', 'Analyze expression']
  },
  {
    id: 'place_building',
    name: 'Place/Building',
    icon: '🏢',
    description: 'Locations, buildings, landmarks',
    hint: 'I will describe the location, architecture, and surroundings',
    examples: ['Identify landmark', 'Describe architecture', 'Location details']
  },
  {
    id: 'report_chart',
    name: 'Report/Chart',
    icon: '📊',
    description: 'Data visualizations, reports, graphs',
    hint: 'I will analyze data, summarize findings, and explain trends',
    examples: ['Summarize report', 'Explain chart data', 'Extract key insights']
  },
  {
    id: 'text_image',
    name: 'Text in Image',
    icon: '🔤',
    description: 'Screenshots, signs, written text',
    hint: 'I will extract and transcribe all visible text accurately',
    examples: ['Extract text', 'Transcribe handwriting', 'Read signs']
  },
  {
    id: 'other',
    name: 'Other',
    icon: '❓',
    description: 'General image analysis',
    hint: 'I will provide detailed description and analysis',
    examples: ['Describe image', 'General analysis', 'Identify objects']
  }
];

interface ImageTypeSelectorProps {
  selectedType: string | null;
  onTypeSelect: (type: ImageTypeOption) => void;
  className?: string;
  compact?: boolean;
}

export function ImageTypeSelector({ selectedType, onTypeSelect, className = '', compact = false }: ImageTypeSelectorProps) {
  const { language } = useTheme();

  const selectedImageType = IMAGE_TYPES.find(type => type.id === selectedType);

  if (compact) {
    return (
      <Select
        value={selectedType || ''}
        onValueChange={(value) => {
          const imageType = IMAGE_TYPES.find(type => type.id === value);
          if (imageType) onTypeSelect(imageType);
        }}
      >
        <SelectTrigger className="h-8 w-32 bg-white/95 dark:bg-gray-800/90 border border-primary/20 hover:border-primary/40 rounded-lg text-xs">
          <SelectValue placeholder={language === 'ar' ? 'نوع' : 'Type'} />
        </SelectTrigger>
        <SelectContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-xl shadow-2xl z-50">
          {IMAGE_TYPES.map((type) => (
            <SelectItem 
              key={type.id} 
              value={type.id}
              className="flex items-center gap-2 p-2 hover:bg-primary/10 focus:bg-primary/10 rounded-lg cursor-pointer transition-colors text-xs"
            >
              <span className="text-sm">{type.icon}</span>
              <span className="font-medium">{type.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          {language === 'ar' ? 'نوع الصورة' : 'Image Type'}
        </label>
        <Select
          value={selectedType || ''}
          onValueChange={(value) => {
            const imageType = IMAGE_TYPES.find(type => type.id === value);
            if (imageType) onTypeSelect(imageType);
          }}
        >
          <SelectTrigger className="w-full h-12 bg-white/95 dark:bg-gray-800/90 border-2 border-primary/20 hover:border-primary/40 focus:border-primary/60 rounded-xl">
            <SelectValue placeholder={language === 'ar' ? 'اختر نوع الصورة...' : 'Select image type...'} />
          </SelectTrigger>
          <SelectContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-xl shadow-2xl max-h-80 overflow-y-auto z-50">
            {IMAGE_TYPES.map((type) => (
              <SelectItem 
                key={type.id} 
                value={type.id}
                className="flex items-start gap-3 p-3 hover:bg-primary/10 focus:bg-primary/10 rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-3 w-full">
                  <span className="text-lg flex-shrink-0 mt-0.5">{type.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">{type.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {type.description}
                    </div>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedImageType && (
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{selectedImageType.icon}</span>
            <span className="font-medium text-sm text-foreground">{selectedImageType.name}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {selectedImageType.hint}
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {selectedImageType.examples.slice(0, 2).map((example, index) => (
              <span 
                key={index}
                className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
              >
                {example}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { IMAGE_TYPES };
