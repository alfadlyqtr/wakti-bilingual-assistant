
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast-helper";
import { PlayCircle, PauseCircle, Rewind, StopCircle, Calendar } from "lucide-react";
import { AudioPlayerState } from "./types";

interface AudioControlsProps {
  audioUrl: string | null;
  onPlaybackChange?: (isPlaying: boolean) => void;
  labels: {
    play: string;
    pause: string;
    rewind: string;
    stop: string;
    error: string;
    autoDeleted?: string;
  };
}

const AudioControls: React.FC<AudioControlsProps> = ({ audioUrl, onPlaybackChange, labels }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioState, setAudioState] = useState<AudioPlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    error: false,
    errorMessage: null
  });

  // Initialize audio element
  useEffect(() => {
    if (!audioUrl) {
      setAudioState(prev => ({
        ...prev,
        error: true,
        errorMessage: "No audio URL provided"
      }));
      return;
    }

    // Normalize and clean the URL to avoid issues like leading spaces or encoded prefixes
    let cleanUrl = (audioUrl || '').trim();
    try {
      // Decode once to handle cases like '%20https://...'
      cleanUrl = decodeURIComponent(cleanUrl).trim();
    } catch {
      // If decode fails, continue with trimmed version
    }

    // Explicitly strip a leading space marker if it survived encoding
    if (cleanUrl.startsWith(' ')) {
      cleanUrl = cleanUrl.trimStart();
    }

    // Also handle a raw '%20' prefix that wasn't part of normal encoding
    if (cleanUrl.startsWith('%20')) {
      cleanUrl = cleanUrl.slice(3).trimStart();
    }

    // Create audio element
    const audio = new Audio();
    // Start with anonymous cross-origin for Supabase storage
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audioRef.current = audio;

    // Internal state to track if we've already tried the blob fallback
    let hasTriedBlobFallback = false;

    // Set up event listeners
    const onPlay = () => handlePlayStateChange(true);
    const onPause = () => handlePlayStateChange(false);
    const onEnded = () => handlePlayStateChange(false);
    const onTimeUpdate = () => handleTimeUpdate();
    const onMetadata = () => handleMetadataLoaded();
    
    const onError = async (e: Event) => {
      const error = (e.target as HTMLAudioElement).error;
      console.warn("Audio load error:", error?.code, error?.message);

      // If direct source fails and we haven't tried blob fallback yet
      if (!hasTriedBlobFallback && cleanUrl.startsWith('http')) {
        hasTriedBlobFallback = true;
        console.info("🔄 Apple/Safari Fallback: Fetching audio as Blob to bypass Range/CORS issues...");
        
        try {
          const response = await fetch(cleanUrl, { mode: 'cors' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          
          if (audioRef.current) {
            audioRef.current.src = objectUrl;
            audioRef.current.load();
            // Don't auto-play here, let user trigger it or wait for metadata
          }
        } catch (fetchErr) {
          console.error("Blob fallback failed:", fetchErr);
          handleAudioError(e);
        }
      } else {
        handleAudioError(e);
      }
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onMetadata);
    audio.addEventListener('error', onError);

    // Initial source set
    audio.src = cleanUrl;
    audio.load();

    // Cleanup function
    return () => {
      if (audio) {
        audio.pause();
        audio.removeEventListener('play', onPlay);
        audio.removeEventListener('pause', onPause);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('loadedmetadata', onMetadata);
        audio.removeEventListener('error', onError);
        
        if (audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }
        audioRef.current = null;
      }
    };
  }, [audioUrl]);

  const handlePlayStateChange = (isPlaying: boolean) => {
    setAudioState(prev => ({ ...prev, isPlaying }));
    if (onPlaybackChange) onPlaybackChange(isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setAudioState(prev => ({ 
        ...prev, 
        currentTime: audioRef.current?.currentTime || 0
      }));
    }
  };

  const handleMetadataLoaded = () => {
    if (audioRef.current) {
      setAudioState(prev => ({ 
        ...prev, 
        duration: audioRef.current?.duration || 0,
        error: false,
        errorMessage: null
      }));
    }
  };

  const handleAudioError = (e: Event) => {
    const audio = e.target as HTMLAudioElement;
    console.error("Audio error event:", e);
    const error = audio.error;
    
    let errorMessage = 'Unable to load audio.';
    if (error) {
      switch (error.code) {
        case 1: errorMessage = "Aborted: Playback stopped."; break;
        case 2: errorMessage = "Network Error: Check your connection."; break;
        case 3: errorMessage = "Decode Error: File corrupted or unsupported."; break;
        case 4: errorMessage = "Format Error: Not supported on this device."; break;
        default: errorMessage = `Error code: ${error.code}. ${error.message || ''}`;
      }
    }
    
    setAudioState(prev => ({
      ...prev,
      isPlaying: false,
      error: true,
      errorMessage
    }));
    
    toast(labels.error || errorMessage);
  };

  const handlePlay = () => {
    if (audioRef.current) {
      // If there was an error, try to reload once before playing
      if (audioState.error) {
        audioRef.current.load();
      }
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.error("Play error:", err);
          // Don't show toast for AbortError (often happens when pausing quickly)
          if (err.name !== 'AbortError') {
            setAudioState(prev => ({
              ...prev,
              isPlaying: false,
              error: true,
              errorMessage: err.message || "Failed to play audio"
            }));
            toast(err.message || labels.error || "Error playing audio");
          }
        });
      }
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const handleRewind = () => {
    if (audioRef.current) {
      // Rewind 10 seconds
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
      if (!audioState.isPlaying) {
        handlePlay();
      }
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  // If there's an error with the audio URL and we can't play it
  if (audioState.error) {
    return (
      <div className="text-center py-2 px-1 bg-destructive/10 rounded-md border border-destructive/20">
        <p className="text-[10px] leading-tight text-destructive font-medium mb-1">
          {audioState.errorMessage || labels.error || "Unable to play audio"}
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-6 text-[10px] py-0 px-2"
          onClick={() => {
            setAudioState(prev => ({ ...prev, error: false, errorMessage: null }));
            if (audioRef.current) audioRef.current.load();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-2">
      {/* Audio controls row */}
      <div className="flex gap-3 justify-center">
        <Button 
          variant="outline" 
          size="icon"
          className="h-10 w-10 rounded-full active:scale-95 transition-transform" 
          onPointerUp={(e) => {
            e.preventDefault();
            handleRewind();
          }}
          title={labels.rewind}
        >
          <Rewind className="h-5 w-5" />
        </Button>
        
        {audioState.isPlaying ? (
          <Button 
            variant="outline" 
            size="icon"
            className="h-10 w-10 rounded-full active:scale-95 transition-transform" 
            onPointerUp={(e) => {
              e.preventDefault();
              handlePause();
            }}
            title={labels.pause}
          >
            <PauseCircle className="h-5 w-5" />
          </Button>
        ) : (
          <Button 
            variant="outline" 
            size="icon"
            className="h-10 w-10 rounded-full active:scale-95 transition-transform" 
            onPointerUp={(e) => {
              e.preventDefault();
              handlePlay();
            }}
            title={labels.play}
          >
            <PlayCircle className="h-5 w-5" />
          </Button>
        )}
        
        <Button 
          variant="outline" 
          size="icon"
          className="h-10 w-10 rounded-full active:scale-95 transition-transform" 
          onPointerUp={(e) => {
            e.preventDefault();
            handleStop();
          }}
          title={labels.stop}
        >
          <StopCircle className="h-5 w-5" />
        </Button>
      </div>
      
      <span className="text-xs text-muted-foreground font-medium">
        {audioState.isPlaying ? labels.pause : labels.play}
      </span>
    </div>
  );
};

export default AudioControls;
