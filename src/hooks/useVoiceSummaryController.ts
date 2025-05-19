
import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/providers/ThemeProvider";
import { transcribeAudio } from "@/services/chatService";
import {
  getBestSupportedMimeType,
  getFileExtension,
  formatRecordingTime,
} from "@/utils/audioUtils";

export type RecordingState = 
  | "idle"             // Initial state, ready to record
  | "recording"        // Currently recording
  | "processing"       // Processing the recording (transcribing, summarizing)
  | "transcribing"     // Specifically in the transcription phase
  | "summarizing"      // Specifically in the summarization phase 
  | "completed"        // Recording successfully processed
  | "error";           // Error state

export type ProcessingStep = "none" | "transcribing" | "summarizing" | "complete";

interface VoiceSummaryState {
  recordingState: RecordingState;
  processingStep: ProcessingStep;
  recordingTime: number;
  recordingId: string | null;
  errorMessage: string | null;
}

interface VoiceSummaryController {
  state: VoiceSummaryState;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  resetRecording: () => void;
}

const MAX_RECORDING_TIME = 120; // 2 minutes maximum

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
    errorMessage: null
  });
  
  // Recording utilities
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const resetTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      recordingTime: 0
    }));
  }, []);
  
  const resetRecording = useCallback(() => {
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
    
    // Clear audio chunks
    audioChunksRef.current = [];
    
    // Reset state
    setState({
      recordingState: "idle",
      processingStep: "none",
      recordingTime: 0,
      recordingId: null,
      errorMessage: null
    });
  }, [resetTimer]);
  
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      
      // Clean up media tracks
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    }
    
    resetTimer();
    
    // Clear audio chunks
    audioChunksRef.current = [];
    
    setState({
      recordingState: "idle",
      processingStep: "none",
      recordingTime: 0,
      recordingId: null,
      errorMessage: null
    });
    
    toast({
      title: language === 'ar' ? 'تم إلغاء التسجيل' : 'Recording cancelled',
      variant: "default"
    });
  }, [resetTimer, toast, language]);
  
  const startRecording = useCallback(async () => {
    // Check authentication
    if (!user) {
      toast({
        title: language === 'ar' ? 'يجب تسجيل الدخول لاستخدام هذه الميزة' : 'Login required for this feature',
        variant: "destructive"
      });
      return;
    }
    
    try {
      setState(prev => ({
        ...prev, 
        recordingState: "recording",
        errorMessage: null
      }));
      
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
        // Update state to processing
        setState(prev => ({
          ...prev,
          recordingState: "processing",
          processingStep: "transcribing"
        }));
        
        // Process the recording
        await processRecording(audioChunksRef.current, mimeType);
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
      setState(prev => ({
        ...prev,
        recordingState: "error",
        errorMessage: language === 'ar'
          ? 'يرجى السماح بالوصول إلى الميكروفون'
          : 'Please allow microphone access'
      }));
      
      toast({
        title: language === 'ar'
          ? 'يرجى السماح بالوصول إلى الميكروفون'
          : 'Please allow microphone access',
        variant: "destructive"
      });
    }
  }, [user, toast, language, resetTimer]);
  
  // Process the recording (transcribe and summarize)
  const processRecording = async (audioChunks: Blob[], mimeType: string) => {
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Create a blob from audio chunks
      const fileExt = getFileExtension(mimeType);
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      
      // Create a unique recording ID and file name
      const recordingId = crypto.randomUUID();
      const fileName = `${user.id}/${recordingId}/recording.${fileExt}`;
      
      // Create a voice summary record in the database first
      // This ensures we have a record even if transcription fails
      const title = language === 'ar' ? 'تسجيل جديد' : 'New Recording';
      const defaultExpiryDate = new Date();
      defaultExpiryDate.setDate(defaultExpiryDate.getDate() + 30); // 30 days expiry
      
      const { data: summaryData, error: summaryError } = await supabase
        .from('voice_summaries')
        .insert({
          id: recordingId,
          user_id: user.id,
          audio_url: fileName,
          title: title,
          type: 'meeting',
          expires_at: defaultExpiryDate.toISOString()
        })
        .select()
        .single();
        
      if (summaryError) {
        throw new Error(`Failed to create recording entry: ${summaryError.message}`);
      }
      
      // Update our state with the recording ID
      setState(prev => ({
        ...prev,
        recordingId: recordingId
      }));
      
      // Upload the audio file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('voice_recordings')
        .upload(fileName, audioBlob);
        
      if (uploadError) {
        throw new Error(`Failed to upload recording: ${uploadError.message}`);
      }
      
      // Step 1: Transcribe the audio
      setState(prev => ({
        ...prev,
        processingStep: "transcribing"
      }));
      
      toast({
        title: language === 'ar' ? 'جارِ التعرف على الصوت...' : 'Transcribing audio...',
        variant: "default"
      });
      
      const text = await transcribeAudio(fileName);
      
      if (!text) {
        throw new Error('Transcription failed');
      }
      
      // Step 2: Generate summary
      setState(prev => ({
        ...prev,
        processingStep: "summarizing"
      }));
      
      toast({
        title: language === 'ar' ? 'جارِ إنشاء الملخص...' : 'Generating summary...',
        variant: "default"
      });
      
      // Call the generate-summary edge function
      const { data: summaryResult, error: summaryGenerationError } = await supabase.functions
        .invoke('generate-summary', {
          body: { recordingId }
        });
      
      if (summaryGenerationError) {
        console.error('Error generating summary:', summaryGenerationError);
        // Continue anyway - the summary can be generated later
      }
      
      // Set state to completed
      setState(prev => ({
        ...prev,
        recordingState: "completed",
        processingStep: "complete"
      }));
      
      toast({
        title: language === 'ar' ? 'تم معالجة التسجيل بنجاح' : 'Recording processed successfully',
        variant: "success"
      });
      
      return recordingId;
    } catch (error) {
      console.error('Error processing recording:', error);
      
      setState(prev => ({
        ...prev,
        recordingState: "error",
        errorMessage: error instanceof Error ? error.message : String(error)
      }));
      
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      
      toast({
        title: language === 'ar' ? 'جارِ معالجة التسجيل...' : 'Processing recording...',
        variant: "default"
      });
    }
  }, [toast, language]);
  
  return {
    state,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording
  };
}
