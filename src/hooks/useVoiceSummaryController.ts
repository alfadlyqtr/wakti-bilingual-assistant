
import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/providers/ThemeProvider";
import {
  getBestSupportedMimeType,
  getFileExtension
} from "@/utils/audioUtils";

// Possible overall states for the recording process
export type RecordingState = 
  | "idle"             // Initial state, ready to record
  | "recording"        // Currently recording
  | "processing"       // Processing the recording (transcribing, summarizing)
  | "completed"        // Recording successfully processed
  | "error";           // Error state

// Specific processing steps within the processing state
export type ProcessingStep = 
  | "none"             // No processing happening
  | "uploading"        // Uploading audio file
  | "transcribing"     // Specifically in the transcription phase
  | "summarizing"      // Specifically in the summarization phase 
  | "generating_tts"   // Generating text-to-speech for the summary
  | "finalizing"       // Final database updates
  | "complete";        // All processing complete

interface VoiceSummaryState {
  recordingState: RecordingState;
  processingStep: ProcessingStep;
  recordingTime: number;
  recordingId: string | null;
  errorMessage: string | null;
  isRecordingDone: boolean;
  isAudioUploaded: boolean;
  isTranscriptionComplete: boolean;
  isSummaryComplete: boolean;
  isTTSComplete: boolean;
  isFullyReady: boolean;
  progress: number; // 0-100 percent
}

interface VoiceSummaryController {
  state: VoiceSummaryState;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  resetRecording: () => void;
  checkProcessingStatus: (recordingId: string) => Promise<void>;
  getStatus: () => { state: RecordingState, step: ProcessingStep, progress: number };
  waitForCompletion: (recordingId: string) => Promise<boolean>;
}

const MAX_RECORDING_TIME = 120; // 2 minutes maximum
const MAX_PROCESSING_ATTEMPTS = 30; // Maximum polling attempts
const POLLING_INTERVAL = 2000; // Poll every 2 seconds

export function useVoiceSummaryController(): VoiceSummaryController {
  const { user } = useAuth();
  const { language } = useTheme();
  const { toast } = useToast();
  
  // Core recording state
  const [state, setState] = useState<VoiceSummaryState>({
    recordingState: "idle",
    processingStep: "none",
    recordingTime: 0,
    recordingId: null,
    errorMessage: null,
    isRecordingDone: false,
    isAudioUploaded: false,
    isTranscriptionComplete: false,
    isSummaryComplete: false,
    isTTSComplete: false,
    isFullyReady: false,
    progress: 0
  });
  
  // Recording utilities
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const attemptCountRef = useRef<number>(0);
  
  // Debug logger
  const logStep = useCallback((message: string) => {
    console.log(`[VoiceSummaryController] ${message}`);
  }, []);
  
  // Calculate progress based on current step
  const calculateProgress = useCallback((step: ProcessingStep): number => {
    switch(step) {
      case "none": return 0;
      case "uploading": return 10;
      case "transcribing": return 30;
      case "summarizing": return 60;
      case "generating_tts": return 80;
      case "finalizing": return 90;
      case "complete": return 100;
      default: return 0;
    }
  }, []);

  // Update state with proper progress calculation
  const updateState = useCallback((updates: Partial<VoiceSummaryState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };

      // Calculate progress based on completion flags
      let progressValue = 0;
      
      if (newState.isRecordingDone) progressValue = 10;
      if (newState.isAudioUploaded) progressValue = 20;
      if (newState.isTranscriptionComplete) progressValue = 50;
      if (newState.isSummaryComplete) progressValue = 80;
      if (newState.isTTSComplete) progressValue = 90;
      if (newState.isFullyReady) progressValue = 100;
      
      // Override with step-based progress for more granularity
      const stepProgress = calculateProgress(newState.processingStep);
      progressValue = Math.max(progressValue, stepProgress);

      // Update the isFullyReady flag if all steps are complete
      const fullyReady = 
        newState.isRecordingDone &&
        newState.isAudioUploaded &&
        newState.isTranscriptionComplete &&
        newState.isSummaryComplete &&
        newState.processingStep === "complete";
      
      return {
        ...newState,
        isFullyReady: fullyReady,
        progress: progressValue
      };
    });
  }, [calculateProgress]);
  
  // Reset timer utility
  const resetTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    updateState({
      recordingTime: 0
    });
  }, [updateState]);
  
  // Stop polling utility
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    attemptCountRef.current = 0;
  }, []);
  
  // Full reset to initial state
  const resetRecording = useCallback(() => {
    logStep("Resetting recording state");
    
    // Stop any ongoing recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      
      // Clean up media tracks
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    }
    
    // Reset timer
    resetTimer();
    
    // Stop polling
    stopPolling();
    
    // Clear audio chunks
    audioChunksRef.current = [];
    
    // Reset state
    setState({
      recordingState: "idle",
      processingStep: "none",
      recordingTime: 0,
      recordingId: null,
      errorMessage: null,
      isRecordingDone: false,
      isAudioUploaded: false,
      isTranscriptionComplete: false,
      isSummaryComplete: false,
      isTTSComplete: false,
      isFullyReady: false,
      progress: 0
    });
  }, [resetTimer, stopPolling, logStep]);
  
  const cancelRecording = useCallback(() => {
    logStep("Canceling recording");
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      
      // Clean up media tracks
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    }
    
    resetTimer();
    stopPolling();
    
    // Clear audio chunks
    audioChunksRef.current = [];
    
    setState({
      recordingState: "idle",
      processingStep: "none",
      recordingTime: 0,
      recordingId: null,
      errorMessage: null,
      isRecordingDone: false,
      isAudioUploaded: false,
      isTranscriptionComplete: false,
      isSummaryComplete: false,
      isTTSComplete: false,
      isFullyReady: false,
      progress: 0
    });
    
    toast({
      title: language === 'ar' ? 'تم إلغاء التسجيل' : 'Recording cancelled',
      variant: "default"
    });
  }, [resetTimer, stopPolling, toast, language, logStep]);
  
  // Get current status
  const getStatus = useCallback(() => {
    return {
      state: state.recordingState,
      step: state.processingStep,
      progress: state.progress
    };
  }, [state.recordingState, state.processingStep, state.progress]);

  // Start recording process
  const startRecording = useCallback(async () => {
    logStep("Starting recording");
    
    // Check authentication
    if (!user) {
      toast({
        title: language === 'ar' ? 'يجب تسجيل الدخول لاستخدام هذه الميزة' : 'Login required for this feature',
        variant: "destructive"
      });
      return;
    }
    
    try {
      updateState({ 
        recordingState: "recording",
        errorMessage: null,
        isRecordingDone: false
      });
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Set up media recorder with supported format
      const mimeType = getBestSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      
      // Handle data available event
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      // Handle recorder stop event
      recorder.onstop = async () => {
        logStep("Recording stopped, processing beginning");
        
        // Update state to processing and set recording as done
        updateState({
          recordingState: "processing",
          processingStep: "uploading",
          isRecordingDone: true
        });
        
        // Create a unique recording ID
        const recordingId = crypto.randomUUID();
        updateState({ recordingId });
        
        // Process the recording
        await processRecording(audioChunksRef.current, mimeType, recordingId);
      };
      
      // Start recording
      recorder.start(1000); // Collect data in 1-second chunks
      
      // Start timer
      resetTimer();
      timerIntervalRef.current = setInterval(() => {
        setState(prev => {
          if (prev.recordingTime >= MAX_RECORDING_TIME - 1) {
            // Stop recording when time limit is reached
            if (recorder.state === 'recording') {
              recorder.stop();
              toast({
                title: language === 'ar' ? 'انتهى وقت التسجيل' : 'Recording time limit reached',
                variant: "default"
              });
            }
            
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
            
            return {
              ...prev,
              recordingTime: MAX_RECORDING_TIME
            };
          }
          
          return {
            ...prev,
            recordingTime: prev.recordingTime + 1
          };
        });
      }, 1000);
      
      toast({
        title: language === 'ar' ? 'بدأ التسجيل... تحدث الآن' : 'Recording started... speak now',
        variant: "default"
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      updateState({
        recordingState: "error",
        errorMessage: language === 'ar'
          ? 'يرجى السماح بالوصول إلى الميكروفون'
          : 'Please allow microphone access'
      });
      
      toast({
        title: language === 'ar'
          ? 'يرجى السماح بالوصول إلى الميكروفون'
          : 'Please allow microphone access',
        variant: "destructive"
      });
    }
  }, [user, toast, language, resetTimer, updateState, logStep]);
  
  // Check the processing status of a recording
  const checkProcessingStatus = useCallback(async (recordingId: string): Promise<void> => {
    logStep(`Checking processing status for recording: ${recordingId}`);
    
    try {
      if (!recordingId) {
        throw new Error('No recording ID provided');
      }
      
      // Fetch the latest recording data
      const { data: recording, error } = await supabase
        .from('voice_summaries')
        .select('*')
        .eq('id', recordingId)
        .single();
      
      if (error) {
        logStep(`Error fetching recording: ${error.message}`);
        throw error;
      }
      
      if (!recording) {
        logStep('Recording not found');
        throw new Error('Recording not found');
      }
      
      // Update state based on recording data
      const updates: Partial<VoiceSummaryState> = {
        recordingId: recording.id,
      };
      
      // Check if transcription is complete
      if (recording.transcript) {
        if (!state.isTranscriptionComplete) {
          logStep('Transcription is complete');
        }
        updates.isTranscriptionComplete = true;
        
        // If transcript exists but we were in transcribing step, move to summarizing
        if (state.processingStep === 'transcribing') {
          updates.processingStep = 'summarizing';
        }
      } else if (state.processingStep === 'uploading') {
        // If no transcript yet and we've uploaded, we're transcribing
        updates.processingStep = 'transcribing';
      }
      
      // Check if summary is complete
      if (recording.summary) {
        if (!state.isSummaryComplete) {
          logStep('Summary is complete');
        }
        updates.isSummaryComplete = true;
        
        // If summary exists but we were in summarizing step, move to TTS
        if (state.processingStep === 'summarizing') {
          updates.processingStep = 'generating_tts';
        }
      }
      
      // Check if TTS is complete
      if (recording.summary_audio_url) {
        if (!state.isTTSComplete) {
          logStep('TTS is complete');
        }
        updates.isTTSComplete = true;
        
        // If TTS exists but we were in TTS step, move to finalizing
        if (state.processingStep === 'generating_tts') {
          updates.processingStep = 'finalizing';
        }
      }
      
      // Check if everything is complete
      if (
        updates.isTranscriptionComplete && 
        updates.isSummaryComplete && 
        updates.isTTSComplete
      ) {
        logStep('All processing complete');
        updates.processingStep = 'complete';
        updates.recordingState = 'completed';
        updates.isFullyReady = true;
        
        // Also update the database to mark the recording as ready
        await supabase
          .from('voice_summaries')
          .update({
            is_ready: true
          })
          .eq('id', recordingId);
      }
      
      // Update the state
      updateState(updates);
      
    } catch (error) {
      console.error('Error checking processing status:', error);
      // Don't update state to error here, just log the error
      // We'll retry on the next poll
    }
  }, [state.processingStep, state.isTranscriptionComplete, state.isSummaryComplete, state.isTTSComplete, updateState, logStep]);
  
  // Wait for completion function with polling
  const waitForCompletion = useCallback(async (recordingId: string): Promise<boolean> => {
    logStep(`Waiting for completion of recording: ${recordingId}`);
    
    return new Promise((resolve) => {
      // Stop any existing polling
      stopPolling();
      
      // Reset attempt counter
      attemptCountRef.current = 0;
      
      // Start polling
      pollingIntervalRef.current = setInterval(async () => {
        // Check if we've exceeded the maximum number of attempts
        if (attemptCountRef.current >= MAX_PROCESSING_ATTEMPTS) {
          logStep('Maximum polling attempts reached');
          stopPolling();
          
          // Don't fail the process, just return not fully ready
          updateState({
            processingStep: 'complete',  // We're done trying
            recordingState: 'completed'  // Allow the user to proceed anyway
          });
          
          resolve(false);
          return;
        }
        
        attemptCountRef.current++;
        logStep(`Polling attempt ${attemptCountRef.current}/${MAX_PROCESSING_ATTEMPTS}`);
        
        try {
          // Check the status
          await checkProcessingStatus(recordingId);
          
          // If fully ready, resolve
          if (state.isFullyReady) {
            logStep('Recording is fully ready');
            stopPolling();
            resolve(true);
            return;
          }
          
          // If in error state, resolve with false
          if (state.recordingState === 'error') {
            logStep('Recording is in error state');
            stopPolling();
            resolve(false);
            return;
          }
        } catch (error) {
          console.error('Error polling for completion:', error);
          // Continue polling on error
        }
      }, POLLING_INTERVAL);
    });
  }, [state.isFullyReady, state.recordingState, stopPolling, checkProcessingStatus, updateState, logStep]);
  
  // Process the recording (upload, transcribe, summarize, TTS)
  const processRecording = async (audioChunks: Blob[], mimeType: string, recordingId: string) => {
    logStep(`Processing recording: ${recordingId}`);
    
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Create a blob from audio chunks
      const fileExt = getFileExtension(mimeType);
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      
      // Create a file name with structured path
      const fileName = `${user.id}/${recordingId}/recording.${fileExt}`;
      
      // Create a voice summary record in the database first
      // This ensures we have a record even if transcription fails
      const title = language === 'ar' ? 'تسجيل جديد' : 'New Recording';
      const defaultExpiryDate = new Date();
      defaultExpiryDate.setDate(defaultExpiryDate.getDate() + 30); // 30 days expiry
      
      logStep('Creating initial database record');
      const { data: summaryData, error: summaryError } = await supabase
        .from('voice_summaries')
        .insert({
          id: recordingId,
          user_id: user.id,
          audio_url: fileName,
          title: title,
          type: 'meeting',
          expires_at: defaultExpiryDate.toISOString(),
          is_ready: false  // Mark as not ready initially
        })
        .select()
        .single();
        
      if (summaryError) {
        throw new Error(`Failed to create recording entry: ${summaryError.message}`);
      }
      
      // Upload the audio file to Supabase storage
      logStep('Uploading audio file');
      updateState({ processingStep: "uploading" });
      
      const { error: uploadError } = await supabase.storage
        .from('voice_recordings')
        .upload(fileName, audioBlob);
        
      if (uploadError) {
        throw new Error(`Failed to upload recording: ${uploadError.message}`);
      }
      
      // Mark audio as uploaded
      updateState({ isAudioUploaded: true, processingStep: "transcribing" });
      logStep('Audio uploaded successfully, beginning transcription process');
      
      // Get the public URL for the audio file
      const { data: publicUrlData } = supabase
        .storage
        .from('voice_recordings')
        .getPublicUrl(fileName);
        
      // Update the database with the public URL
      await supabase
        .from('voice_summaries')
        .update({
          audio_url: publicUrlData.publicUrl
        })
        .eq('id', recordingId);
      
      // Start the processing chain
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('No auth session');
      }
      
      // Call the transcribe-audio edge function to start the process
      logStep('Calling transcribe-audio edge function');
      toast({
        title: language === 'ar' ? 'جارِ التعرف على الصوت...' : 'Transcribing audio...',
        variant: "default"
      });
      
      const transcribeResponse = await fetch(
        "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/transcribe-audio",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session.access_token}`
          },
          body: JSON.stringify({
            recordingId: fileName,
            summaryId: recordingId
          }),
        }
      );

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json();
        throw new Error(`Transcription failed: ${errorData.error || 'Unknown error'}`);
      }
      
      logStep('Transcription initiated successfully, waiting for completion');
      
      // Start the polling process to wait for completion
      waitForCompletion(recordingId);
      
      return recordingId;
    } catch (error) {
      console.error('Error processing recording:', error);
      
      updateState({
        recordingState: "error",
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      
      toast({
        title: language === 'ar'
          ? 'حدث خطأ أثناء معالجة التسجيل'
          : 'Error processing recording',
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive"
      });
      
      return null;
    }
  };
  
  // Stop the current recording
  const stopRecording = useCallback(() => {
    logStep("Manually stopping recording");
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      
      toast({
        title: language === 'ar' ? 'جارِ معالجة التسجيل...' : 'Processing recording...',
        variant: "default"
      });
    }
  }, [toast, language, logStep]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetRecording();
    };
  }, [resetRecording]);
  
  return {
    state,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording,
    checkProcessingStatus,
    getStatus,
    waitForCompletion
  };
}
