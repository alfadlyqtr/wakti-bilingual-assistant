
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
    name: 'ID/Documents',
    icon: '🆔',
    description: 'Passports, IDs, licenses, certificates',
    hint: 'Extract info, check dates, validate details',
    examples: ['Extract passport info', 'Check ID expiry'],
    examplePrompt: 'Extract all information from this document including names, dates, expiry dates, and validate if still valid'
  },
  {
    id: 'business_docs',
    name: 'Business Documents',
    icon: '📊',
    description: 'Reports, contracts, business papers',
    hint: 'Analyze business content and extract key info',
    examples: ['Summarize contract', 'Extract business data'],
    examplePrompt: 'Analyze this business document and provide key insights, terms, and important details'
  },
  {
    id: 'financial',
    name: 'Financial Documents',
    icon: '💰',
    description: 'Bills, receipts, invoices, bank statements',
    hint: 'Extract amounts, dates, calculate totals',
    examples: ['Split restaurant bill', 'Extract invoice details'],
    examplePrompt: 'Break down this financial document - show all amounts, dates, totals, and provide calculations if needed'
  },
  {
    id: 'screenshots',
    name: 'Screenshots',
    icon: '📱',
    description: 'App screens, website captures, UI elements',
    hint: 'Read and explain interface elements',
    examples: ['Explain app interface', 'Read screen content'],
    examplePrompt: 'Describe what is shown in this screenshot including buttons, text, and functionality'
  },
  {
    id: 'text_image',
    name: 'Text Extraction',
    icon: '📝',
    description: 'Signs, handwritten notes, text in images',
    hint: 'Extract and transcribe all visible text',
    examples: ['Extract text', 'Transcribe handwriting'],
    examplePrompt: 'Extract and transcribe all visible text from this image, including any handwritten content'
  },
  {
    id: 'academic',
    name: 'Academic Work',
    icon: '🎓',
    description: 'Homework, exams, study materials, research',
    hint: 'Help with educational content and explanations',
    examples: ['Solve homework', 'Explain concepts'],
    examplePrompt: 'Help me understand this academic content - explain the concepts and provide detailed guidance'
  },
  {
    id: 'medical',
    name: 'Medical Documents',
    icon: '🩺',
    description: 'Lab results, prescriptions, medical reports',
    hint: 'Extract medical info and explain results',
    examples: ['Read lab results', 'Explain prescription'],
    examplePrompt: 'Extract and explain the medical information from this document, including key results and recommendations'
  },
  {
    id: 'technical',
    name: 'Technical Diagrams',
    icon: '⚙️',
    description: 'Charts, graphs, technical drawings, blueprints',
    hint: 'Analyze technical content and data',
    examples: ['Explain chart data', 'Analyze diagram'],
    examplePrompt: 'Analyze this technical diagram/chart and provide detailed explanations of the data and components'
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
