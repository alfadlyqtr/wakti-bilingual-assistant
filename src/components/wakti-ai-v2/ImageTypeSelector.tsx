
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
    id: 'passport',
    name: 'Passport',
    icon: '🛂',
    description: 'Passport documents for travel',
    hint: 'Extract passport info, check expiry, provide travel advice',
    examples: ['Check passport expiry', 'Extract passport details'],
    examplePrompt: 'This is a PASSPORT - extract personal information, passport number, issue/expiry dates, check if expired, and provide renewal advice if needed'
  },
  {
    id: 'id_card',
    name: 'ID Card',
    icon: '🆔',
    description: 'National ID cards, residency permits',
    hint: 'Extract ID details, check validity dates',
    examples: ['Extract ID info', 'Check ID expiry'],
    examplePrompt: 'This is an ID CARD - extract personal details, ID number, validity dates, check expiry status and warn if expired'
  },
  {
    id: 'certificate',
    name: 'Certificate/Document',
    icon: '📄',
    description: 'Certificates, licenses, official documents',
    hint: 'Extract document info, dates, qualifications',
    examples: ['Read certificate', 'Extract document details'],
    examplePrompt: 'This is a CERTIFICATE/DOCUMENT - extract institution, dates, qualifications, validity period, and any important details'
  },
  {
    id: 'financial',
    name: 'Bills/Receipts',
    icon: '💰',
    description: 'Bills, receipts, invoices, bank statements',
    hint: 'Extract amounts, dates, calculate totals',
    examples: ['Split restaurant bill', 'Extract invoice details'],
    examplePrompt: 'This is a BILL/RECEIPT - extract amounts, dates, items, calculate totals, and provide financial breakdown'
  },
  {
    id: 'person',
    name: 'Person/Photo',
    icon: '👤',
    description: 'Photos of people, portraits, group photos',
    hint: 'Describe people, appearance, activities',
    examples: ['Describe person', 'Analyze group photo'],
    examplePrompt: 'This is a PHOTO of a person/people - describe appearance, clothing, setting, activities, and any notable details'
  },
  {
    id: 'place',
    name: 'Place/Building',
    icon: '🏢',
    description: 'Buildings, locations, landmarks, scenery',
    hint: 'Describe location, architecture, features',
    examples: ['Identify building', 'Describe location'],
    examplePrompt: 'This is a PLACE/BUILDING - describe the location, architecture, notable features, and any identifying details'
  },
  {
    id: 'screenshots',
    name: 'Screenshot',
    icon: '📱',
    description: 'App screens, website captures, UI elements',
    hint: 'Read and explain interface elements',
    examples: ['Explain app interface', 'Read screen content'],
    examplePrompt: 'This is a SCREENSHOT - describe the interface, buttons, text, functionality, and explain what is shown on screen'
  },
  {
    id: 'text_image',
    name: 'Text Extraction',
    icon: '📝',
    description: 'Signs, handwritten notes, text in images',
    hint: 'Extract and transcribe all visible text',
    examples: ['Extract text', 'Transcribe handwriting'],
    examplePrompt: 'This is TEXT EXTRACTION - extract and transcribe all visible text accurately, including handwritten content if present'
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

export { IMAGE_TYPES };
