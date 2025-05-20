
import { useState, useRef, useEffect } from 'react';
import { useRecordingStore } from './useRecordingStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';
import { v4 as uuidv4 } from 'uuid';

// Maximum recording duration (2 hours = 7200 seconds)
export const MAX_RECORDING_DURATION = 7200;

export const useRecordingHandlers = () => {
  const { language } = useTheme();
  const { user } = useAuth();
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const timerInterval = useRef<number | null>(null);
  
  const {
    recordingId,
    recordingDuration,
    currentStep,
    title,
    recordingType,
    setRecordingId,
    setRecordingDuration,
    setCurrentStep,
    setAudioBlob,
    setAudioUrl,
    setProcessingStage,
    setProgress,
    setError,
    setRecordingStartTime,
  } = useRecordingStore();

  // Clean up resources when unmounting
  useEffect(() => {
    return () => {
      if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
        mediaRecorder.current.stop();
      }
      
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, []);

  // Update timer during recording
  useEffect(() => {
    if (isRecording && !isPaused) {
      const startTime = Date.now() - (recordingDuration * 1000);
      setRecordingStartTime(startTime);
      
      timerInterval.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        
        if (elapsed >= MAX_RECORDING_DURATION) {
          stopRecording();
        } else {
          setRecordingDuration(elapsed);
        }
      }, 1000);
    } else if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }
    
    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, [isRecording, isPaused, setRecordingDuration, setRecordingStartTime, recordingDuration]);

  const startRecording = async () => {
    try {
      audioChunks.current = [];
      setRecordingDuration(0);
      setRecordingStartTime(Date.now());
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Always use MP3 format when possible, fallback to other formats
      const mimeType = getMimeType();
      mediaRecorder.current = new MediaRecorder(stream, { mimeType });
      
      // Generate a unique ID for this recording
      const newRecordingId = uuidv4();
      setRecordingId(newRecordingId);
      
      // Set up data handling
      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };
      
      // Start recording
      mediaRecorder.current.start(1000);
      setIsRecording(true);
      setCurrentStep('recording');
      
      console.log('Recording started with format:', mimeType);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setError(language === 'ar' 
        ? 'فشل في بدء التسجيل. يرجى التحقق من إذن الميكروفون.' 
        : 'Failed to start recording. Please check microphone permission.');
    }
  };
  
  const pauseRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.pause();
      setIsPaused(true);
    }
  };
  
  const resumeRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'paused') {
      mediaRecorder.current.resume();
      setIsPaused(false);
    }
  };

  const stopRecording = () => {
    if (!mediaRecorder.current) return;
    
    return new Promise<void>((resolve) => {
      if (mediaRecorder.current?.state === 'inactive') {
        resolve();
        return;
      }
      
      mediaRecorder.current!.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/mp3' });
          setAudioBlob(audioBlob);
          
          // Create a URL for the recorded audio
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
          
          // Reset recording state
          setIsRecording(false);
          setIsPaused(false);
          
          // Stop all audio tracks to release the microphone
          mediaRecorder.current?.stream.getTracks().forEach(track => track.stop());
          
          resolve();
        } catch (error) {
          console.error('Error processing recording:', error);
          setError(language === 'ar'
            ? 'حدث خطأ أثناء معالجة التسجيل'
            : 'Error processing recording');
          resolve();
        }
      };
      
      mediaRecorder.current!.stop();
    });
  };

  const uploadRecording = async () => {
    if (!user) {
      setError(language === 'ar'
        ? 'يجب تسجيل الدخول لتحميل التسجيلات'
        : 'Must be logged in to upload recordings');
      return null;
    }
    
    if (!recordingId || !audioChunks.current.length) {
      setError(language === 'ar'
        ? 'لا يوجد تسجيل للتحميل'
        : 'No recording to upload');
      return null;
    }
    
    try {
      setProcessingStage('uploading');
      setProgress(10);
      
      const audioBlob = new Blob(audioChunks.current, { type: 'audio/mp3' });
      
      // Create storage path
      const userId = user.id;
      const filePath = `${userId}/${recordingId}/recording.mp3`;
      const storagePath = `voice_recordings/${filePath}`;
      
      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice_recordings')
        .upload(filePath, audioBlob);
      
      if (uploadError) {
        throw new Error(`Upload error: ${uploadError.message}`);
      }
      
      setProgress(30);
      
      // Get public URL for the uploaded file
      const { data: publicUrlData } = await supabase.storage
        .from('voice_recordings')
        .getPublicUrl(filePath);
      
      const audioUrl = publicUrlData.publicUrl;
      
      // Create record in voice_summaries table
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 10); // Expires in 10 days
      
      const finalTitle = title || (language === 'ar' ? 'تسجيل بدون عنوان' : 'Untitled Recording');
      
      const { data: summaryData, error: summaryError } = await supabase
        .from('voice_summaries')
        .insert({
          id: recordingId,
          user_id: userId,
          title: finalTitle,
          type: recordingType,
          audio_url: audioUrl,
          expires_at: expiresAt.toISOString(),
          host: userId
        })
        .select()
        .single();
      
      if (summaryError) {
        throw new Error(`Database error: ${summaryError.message}`);
      }
      
      setProgress(50);
      return recordingId;
      
    } catch (error) {
      console.error('Error uploading recording:', error);
      setError(language === 'ar'
        ? 'فشل في تحميل التسجيل'
        : 'Failed to upload recording');
      return null;
    }
  };

  // Get supported MIME type for recording (always prefer MP3)
  const getMimeType = (): string => {
    const preferredTypes = [
      'audio/mp3',
      'audio/mpeg',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/wav'
    ];
    
    // First try MP3 format
    for (const type of ['audio/mp3', 'audio/mpeg']) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    // Fall back to other formats if MP3 isn't supported
    for (const type of preferredTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    // Final fallback
    return 'audio/webm';
  };

  return {
    isRecording,
    isPaused,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    uploadRecording,
  };
};
