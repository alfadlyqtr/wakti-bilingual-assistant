import { useState, useRef, useCallback } from 'react';
import type { ClarifyingQuestion } from '@/components/projects/ClarifyingQuestionsModal';

interface PhotoSelectorState {
  show: boolean;
  searchTerm: string;
  initialTab: 'stock' | 'user';
  multiSelect: boolean;
  showOnlyUserPhotos: boolean;
  isChangingCarouselImages: boolean;
  savedPrompt: string;
}

interface ImageSourceDialogState {
  show: boolean;
  pendingPrompt: string;
  isGenerating: boolean;
}

interface PendingElementImageEdit {
  elementInfo: any;
  originalPrompt: string;
}

interface MigrationState {
  show: boolean;
  pending: {
    title: string;
    titleAr?: string;
    sqlPreview: string;
    description?: string;
    descriptionAr?: string;
  } | null;
  alwaysAllow: boolean;
}

interface UseWizardsReturn {
  // Stock photo selector
  photoSelector: PhotoSelectorState;
  setPhotoSelectorShow: (show: boolean) => void;
  setPhotoSearchTerm: (term: string) => void;
  setPhotoSelectorInitialTab: (tab: 'stock' | 'user') => void;
  setPhotoSelectorMultiSelect: (multi: boolean) => void;
  setPhotoSelectorShowOnlyUserPhotos: (only: boolean) => void;
  setIsChangingCarouselImages: (changing: boolean) => void;
  setSavedPromptForPhotos: (prompt: string) => void;
  
  // Image source dialog
  imageSourceDialog: ImageSourceDialogState;
  setShowImageSourceDialog: (show: boolean) => void;
  setPendingImagePrompt: (prompt: string) => void;
  setIsAIGeneratingImages: (generating: boolean) => void;
  
  // Pending element image edit
  pendingElementImageEdit: PendingElementImageEdit | null;
  setPendingElementImageEdit: React.Dispatch<React.SetStateAction<PendingElementImageEdit | null>>;
  
  // Booking/Contact wizards
  showBookingWizard: boolean;
  setShowBookingWizard: React.Dispatch<React.SetStateAction<boolean>>;
  showContactWizard: boolean;
  setShowContactWizard: React.Dispatch<React.SetStateAction<boolean>>;
  pendingFormPrompt: string;
  setPendingFormPrompt: React.Dispatch<React.SetStateAction<string>>;
  skipFormWizardRef: React.MutableRefObject<boolean>;
  skipUserMessageSaveRef: React.MutableRefObject<boolean>;
  
  // Clarifying questions
  showClarifyingQuestions: boolean;
  setShowClarifyingQuestions: React.Dispatch<React.SetStateAction<boolean>>;
  clarifyingQuestions: ClarifyingQuestion[];
  setClarifyingQuestions: React.Dispatch<React.SetStateAction<ClarifyingQuestion[]>>;
  pendingPrompt: string;
  setPendingPrompt: React.Dispatch<React.SetStateAction<string>>;
  
  // Migration approval
  migration: MigrationState;
  setShowMigrationApproval: (show: boolean) => void;
  setPendingMigration: (migration: MigrationState['pending']) => void;
  setAlwaysAllowMigrations: (allow: boolean) => void;
  
  // User instructions
  userInstructions: string;
  setUserInstructions: React.Dispatch<React.SetStateAction<string>>;
  tempInstructions: string;
  setTempInstructions: React.Dispatch<React.SetStateAction<string>>;
  
  // Uploading state
  isUploadingAttachedImages: boolean;
  setIsUploadingAttachedImages: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Build prompt with answers helper
  buildPromptWithAnswers: (basePrompt: string, answers: Record<string, string | string[]>) => string;
}

export function useWizards(): UseWizardsReturn {
  // Stock photo selector
  const [showStockPhotoSelector, setShowStockPhotoSelector] = useState(false);
  const [photoSearchTerm, setPhotoSearchTerm] = useState('');
  const [photoSelectorInitialTab, setPhotoSelectorInitialTab] = useState<'stock' | 'user'>('stock');
  const [photoSelectorMultiSelect, setPhotoSelectorMultiSelect] = useState(false);
  const [photoSelectorShowOnlyUserPhotos, setPhotoSelectorShowOnlyUserPhotos] = useState(false);
  const [isChangingCarouselImages, setIsChangingCarouselImages] = useState(false);
  const [savedPromptForPhotos, setSavedPromptForPhotos] = useState('');
  
  // Image source dialog
  const [showImageSourceDialog, setShowImageSourceDialog] = useState(false);
  const [pendingImagePrompt, setPendingImagePrompt] = useState('');
  const [isAIGeneratingImages, setIsAIGeneratingImages] = useState(false);
  
  // Pending element image edit
  const [pendingElementImageEdit, setPendingElementImageEdit] = useState<PendingElementImageEdit | null>(null);
  
  // Booking/Contact wizards
  const [showBookingWizard, setShowBookingWizard] = useState(false);
  const [showContactWizard, setShowContactWizard] = useState(false);
  const [pendingFormPrompt, setPendingFormPrompt] = useState('');
  const skipFormWizardRef = useRef(false);
  const skipUserMessageSaveRef = useRef(false);
  
  // Clarifying questions
  const [showClarifyingQuestions, setShowClarifyingQuestions] = useState(false);
  const [clarifyingQuestions, setClarifyingQuestions] = useState<ClarifyingQuestion[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState('');
  
  // Migration approval
  const [showMigrationApproval, setShowMigrationApproval] = useState(false);
  const [pendingMigration, setPendingMigration] = useState<MigrationState['pending']>(null);
  const [alwaysAllowMigrations, setAlwaysAllowMigrations] = useState(false);
  
  // User instructions
  const [userInstructions, setUserInstructions] = useState('');
  const [tempInstructions, setTempInstructions] = useState('');
  
  // Uploading state
  const [isUploadingAttachedImages, setIsUploadingAttachedImages] = useState(false);
  
  // Build prompt with answers
  const buildPromptWithAnswers = useCallback((basePrompt: string, answers: Record<string, string | string[]>) => {
    const answerText = Object.entries(answers)
      .map(([question, answer]) => {
        const answerStr = Array.isArray(answer) ? answer.join(', ') : answer;
        return `- ${question}: ${answerStr}`;
      })
      .join('\n');
    return `${basePrompt}\n\nUser preferences:\n${answerText}`;
  }, []);

  return {
    photoSelector: {
      show: showStockPhotoSelector,
      searchTerm: photoSearchTerm,
      initialTab: photoSelectorInitialTab,
      multiSelect: photoSelectorMultiSelect,
      showOnlyUserPhotos: photoSelectorShowOnlyUserPhotos,
      isChangingCarouselImages,
      savedPrompt: savedPromptForPhotos,
    },
    setPhotoSelectorShow: setShowStockPhotoSelector,
    setPhotoSearchTerm,
    setPhotoSelectorInitialTab,
    setPhotoSelectorMultiSelect,
    setPhotoSelectorShowOnlyUserPhotos,
    setIsChangingCarouselImages,
    setSavedPromptForPhotos,
    
    imageSourceDialog: {
      show: showImageSourceDialog,
      pendingPrompt: pendingImagePrompt,
      isGenerating: isAIGeneratingImages,
    },
    setShowImageSourceDialog,
    setPendingImagePrompt,
    setIsAIGeneratingImages,
    
    pendingElementImageEdit,
    setPendingElementImageEdit,
    
    showBookingWizard,
    setShowBookingWizard,
    showContactWizard,
    setShowContactWizard,
    pendingFormPrompt,
    setPendingFormPrompt,
    skipFormWizardRef,
    skipUserMessageSaveRef,
    
    showClarifyingQuestions,
    setShowClarifyingQuestions,
    clarifyingQuestions,
    setClarifyingQuestions,
    pendingPrompt,
    setPendingPrompt,
    
    migration: {
      show: showMigrationApproval,
      pending: pendingMigration,
      alwaysAllow: alwaysAllowMigrations,
    },
    setShowMigrationApproval,
    setPendingMigration,
    setAlwaysAllowMigrations,
    
    userInstructions,
    setUserInstructions,
    tempInstructions,
    setTempInstructions,
    
    isUploadingAttachedImages,
    setIsUploadingAttachedImages,
    
    buildPromptWithAnswers,
  };
}
