
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type RecordingType = 'note' | 'summary' | 'meeting' | 'lecture' | 'idea';
export type RecordingStep = 'idle' | 'intake' | 'recording' | 'processing' | 'transcript' | 'summary' | 'complete' | 'error';
export type ProcessingStage = 'uploading' | 'transcribing' | 'summarizing' | 'generating_tts' | 'finalizing' | null;

interface RecordingState {
  // Recording metadata
  recordingId: string | null;
  title: string;
  recordingType: RecordingType;
  
  // Recording status
  currentStep: RecordingStep;
  processingStage: ProcessingStage;
  isProcessing: boolean;
  progress: number | null;
  
  // Recording data
  audioBlob: Blob | null;
  audioUrl: string | null;
  transcription: string | null;
  summary: string | null;
  summaryAudioUrl: string | null;
  
  // Recording timing
  recordingStartTime: number | null;
  recordingDuration: number;
  
  // Error handling
  errorMessage: string | null;
  
  // Actions
  setRecordingId: (id: string | null) => void;
  setTitle: (title: string) => void;
  setRecordingType: (type: RecordingType) => void;
  setCurrentStep: (step: RecordingStep) => void;
  setProcessingStage: (stage: ProcessingStage) => void;
  setProgress: (progress: number | null) => void;
  setAudioBlob: (blob: Blob | null) => void;
  setAudioUrl: (url: string | null) => void;
  setTranscription: (text: string | null) => void;
  setSummary: (text: string | null) => void;
  setSummaryAudioUrl: (url: string | null) => void;
  setRecordingStartTime: (time: number | null) => void;
  setRecordingDuration: (duration: number) => void;
  setError: (message: string | null) => void;
  reset: () => void;
}

const initialState = {
  recordingId: null,
  title: '',
  recordingType: 'note' as RecordingType,
  
  currentStep: 'idle' as RecordingStep,
  processingStage: null,
  isProcessing: false,
  progress: null,
  
  audioBlob: null,
  audioUrl: null,
  transcription: null,
  summary: null,
  summaryAudioUrl: null,
  
  recordingStartTime: null,
  recordingDuration: 0,
  
  errorMessage: null,
};

export const useRecordingStore = create<RecordingState>()(
  devtools(
    (set) => ({
      ...initialState,
      
      setRecordingId: (id) => set({ recordingId: id }),
      setTitle: (title) => set({ title }),
      setRecordingType: (recordingType) => set({ recordingType }),
      setCurrentStep: (step) => set((state) => ({ 
        currentStep: step,
        isProcessing: step === 'processing',
        processingStage: step === 'processing' ? state.processingStage : null,
      })),
      setProcessingStage: (stage) => set({ processingStage: stage }),
      setProgress: (progress) => set({ progress }),
      setAudioBlob: (blob) => set({ audioBlob: blob }),
      setAudioUrl: (url) => set({ audioUrl: url }),
      setTranscription: (text) => set({ transcription: text }),
      setSummary: (text) => set({ summary: text }),
      setSummaryAudioUrl: (url) => set({ summaryAudioUrl: url }),
      setRecordingStartTime: (time) => set({ recordingStartTime: time }),
      setRecordingDuration: (duration) => set({ recordingDuration: duration }),
      setError: (message) => set({ 
        errorMessage: message, 
        currentStep: message ? 'error' : 'idle' 
      }),
      reset: () => set(initialState),
    }),
    { name: 'recording-store' }
  )
);
