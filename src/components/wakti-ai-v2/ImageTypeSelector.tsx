
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
  examplePrompt: string;
}

const IMAGE_TYPES: ImageTypeOption[] = [
  {
    id: 'document',
    name: 'Document/ID',
    icon: '📄',
    description: 'Passports, IDs, licenses, certificates',
    hint: 'I will extract information, check expiry dates, and validate details',
    examples: ['Extract passport info', 'Check ID expiry', 'Read certificate details'],
    examplePrompt: 'Extract all information from this document including names, dates, expiry dates, and validate if still valid'
  },
  {
    id: 'bill_receipt',
    name: 'Bills/Receipts',
    icon: '💰',
    description: 'Financial documents, invoices, receipts',
    hint: 'I will extract amounts, dates, items, and financial details',
    examples: ['Split restaurant bill', 'Extract invoice details', 'Calculate totals'],
    examplePrompt: 'Break down this receipt - show all items, prices, totals, and provide split options if needed'
  },
  {
    id: 'report_chart',
    name: 'Reports/Charts',
    icon: '📊',
    description: 'Data analysis, graphs, business reports',
    hint: 'I will analyze data, summarize findings, and explain trends',
    examples: ['Summarize report', 'Explain chart data', 'Extract key insights'],
    examplePrompt: 'Analyze this chart/report and provide key insights, trends, and a detailed summary of the data'
  },
  {
    id: 'text_image',
    name: 'Text Extraction',
    icon: '🔤',
    description: 'Screenshots, signs, handwritten notes',
    hint: 'I will extract and transcribe all visible text accurately',
    examples: ['Extract text', 'Transcribe handwriting', 'Read signs'],
    examplePrompt: 'Extract and transcribe all visible text from this image, including any handwritten content'
  },
  {
    id: 'person',
    name: 'People/Photos',
    icon: '👥',
    description: 'Person identification, group photos',
    hint: 'I will describe appearance, clothing, expressions, and activities',
    examples: ['Describe person', 'Identify clothing style', 'Analyze expression'],
    examplePrompt: 'Describe the people in this photo including their appearance, clothing, expressions, and what they are doing'
  },
  {
    id: 'place_building',
    name: 'Places/Buildings',
    icon: '🏢',
    description: 'Locations, architecture, landmarks',
    hint: 'I will describe the location, architecture, and surroundings',
    examples: ['Identify landmark', 'Describe architecture', 'Location details'],
    examplePrompt: 'Describe this location including the architecture, surroundings, and any notable features or landmarks'
  },
  {
    id: 'medical',
    name: 'Medical Documents',
    icon: '🩺',
    description: 'Lab results, prescriptions, medical reports',
    hint: 'I will extract medical information and explain results',
    examples: ['Read lab results', 'Explain prescription', 'Summarize report'],
    examplePrompt: 'Extract and explain the medical information from this document, including key results and recommendations'
  },
  {
    id: 'educational',
    name: 'Educational Content',
    icon: '📚',
    description: 'Homework, exams, study materials',
    hint: 'I will help with educational content and provide explanations',
    examples: ['Solve homework', 'Explain concepts', 'Grade assignment'],
    examplePrompt: 'Help me understand this educational content - explain the concepts and provide detailed guidance'
  },
  {
    id: 'food_menu',
    name: 'Food/Menu',
    icon: '🍕',
    description: 'Restaurant menus, food items, recipes',
    hint: 'I will read menus, identify food items, and provide recommendations',
    examples: ['Read menu', 'Identify dish', 'Suggest options'],
    examplePrompt: 'Read this menu or food image and provide recommendations, prices, and detailed descriptions'
  },
  {
    id: 'vehicle_transport',
    name: 'Vehicles/Transport',
    icon: '🚗',
    description: 'Car documents, tickets, vehicle info',
    hint: 'I will extract vehicle information and transportation details',
    examples: ['Read car registration', 'Extract ticket info', 'Vehicle details'],
    examplePrompt: 'Extract all vehicle or transportation information from this document including details, dates, and validity'
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
        <SelectTrigger className="h-8 w-40 bg-white/95 dark:bg-gray-800/90 border border-primary/20 hover:border-primary/40 rounded-lg text-xs">
          <SelectValue placeholder={language === 'ar' ? 'نوع الصورة' : 'Select type'} />
        </SelectTrigger>
        <SelectContent className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto">
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
