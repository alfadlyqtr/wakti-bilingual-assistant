
import { useState, useRef, useEffect, useCallback } from "react";
import { useRecordingStore } from "./useRecordingStore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getBestSupportedMimeType, formatRecordingTime, generateRecordingPath } from "@/utils/audioUtils";

export const useRecordingHandlers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  
  const { 
    recordingId,
    status, 
    recordingDuration, 
    recordingStartTime,
    setStatus, 
    setAudioBlob, 
    setAudioUrl,
    setRecordingDuration,
    setRecordingStartTime,
    setError
  } = useRecordingStore();

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, []);

  // Timer update logic
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerInterval.current = setInterval(() => {
        if (recordingStartTime) {
          const elapsed = Math.floor((new Date().getTime() - recordingStartTime.getTime()) / 1000);
          setRecordingDuration(elapsed);
        }
      }, 1000);
    } else {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    }

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, [isRecording, isPaused, recordingStartTime, setRecordingDuration]);

  const startRecording = useCallback(async () => {
    try {
      audioChunks.current = [];
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getBestSupportedMimeType();
      
      mediaRecorder.current = new MediaRecorder(stream, { mimeType });
      
      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };
      
      mediaRecorder.current.onstop = async () => {
        // Create audio blob from chunks
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/mp3' });
        setAudioBlob(audioBlob);
        
        // Create object URL for playback
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(audioUrl);
        
        setIsRecording(false);
        setIsPaused(false);
        setStatus('stopped');
      };
      
      // Start recording
      mediaRecorder.current.start(1000);
      setIsRecording(true);
      setIsPaused(false);
      setStatus('recording');
      setRecordingStartTime(new Date());
      
      toast({
        title: "Recording started",
        description: "Your voice is now being recorded",
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        variant: "destructive",
        title: "Recording Error",
        description: "Could not access microphone",
      });
      setError("Could not access microphone");
    }
  }, [setAudioBlob, setAudioUrl, setStatus, setRecordingStartTime, setError, toast]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorder.current && isRecording && !isPaused) {
      mediaRecorder.current.pause();
      setIsPaused(true);
      setStatus('paused');
    }
  }, [isRecording, isPaused, setStatus]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorder.current && isRecording && isPaused) {
      mediaRecorder.current.resume();
      setIsPaused(false);
      setStatus('recording');
    }
  }, [isRecording, isPaused, setStatus]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      
      // Stop all audio tracks
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      
      // Clear timer
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    }
  }, [isRecording]);

  const uploadRecording = useCallback(async () => {
    if (!user || !user.id) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in to upload recordings",
      });
      return null;
    }

    if (!audioChunks.current.length) {
      toast({
        variant: "destructive",
        title: "No Recording",
        description: "No audio recording to upload",
      });
      return null;
    }

    try {
      setStatus('uploading');
      
      // Create a single MP3 blob from all chunks
      const audioBlob = new Blob(audioChunks.current, { type: 'audio/mp3' });
      
      // Generate the path for storage
      const filePath = generateRecordingPath(user.id, recordingId);
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('voice_recordings')
        .upload(filePath, audioBlob, {
          cacheControl: '3600',
          upsert: true,
        });
        
      if (error) {
        throw error;
      }
      
      // Get public URL (but don't use it directly until needed)
      const { data: { publicUrl } } = supabase.storage
        .from('voice_recordings')
        .getPublicUrl(filePath);
        
      toast({
        title: "Recording Uploaded",
        description: "Your recording has been uploaded successfully",
      });
      
      return publicUrl;
    } catch (error) {
      console.error("Error uploading recording:", error);
      toast({
        variant: "destructive",
        title: "Upload Error",
        description: "Failed to upload the recording",
      });
      setError("Failed to upload the recording");
      setStatus('error');
      return null;
    }
  }, [user, recordingId, setStatus, setError, toast]);
  
  const formattedDuration = formatRecordingTime(recordingDuration);
  
  return {
    isRecording,
    isPaused,
    formattedDuration,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    uploadRecording
  };
};
