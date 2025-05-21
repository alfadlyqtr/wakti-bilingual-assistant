
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast-helper";
import { PlayCircle, PauseCircle, Rewind, StopCircle } from "lucide-react";
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

    // Create audio element
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    // Set up event listeners
    audio.addEventListener('play', () => handlePlayStateChange(true));
    audio.addEventListener('pause', () => handlePlayStateChange(false));
    audio.addEventListener('ended', () => handlePlayStateChange(false));
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleMetadataLoaded);
    audio.addEventListener('error', handleAudioError);

    // Load the audio
    audio.load();

    // Cleanup function
    return () => {
      if (audio) {
        audio.pause();
        audio.removeEventListener('play', () => handlePlayStateChange(true));
        audio.removeEventListener('pause', () => handlePlayStateChange(false));
        audio.removeEventListener('ended', () => handlePlayStateChange(false));
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('loadedmetadata', handleMetadataLoaded);
        audio.removeEventListener('error', handleAudioError);
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
    console.error("Audio error:", e);
    const error = (e.target as HTMLAudioElement).error;
    const errorMessage = error ? 
      `Error code: ${error.code}. ${error.message || 'Unable to load audio.'}` : 
      'Unable to load audio.';
    
    setAudioState(prev => ({
      ...prev,
      isPlaying: false,
      error: true,
      errorMessage
    }));
    
    toast(labels.error || "Error playing audio");
  };

  const handlePlay = () => {
    if (audioRef.current) {
      if (audioState.error) {
        // Try to reload the audio if there was an error
        audioRef.current.load();
      }
      audioRef.current.play().catch(err => {
        console.error("Play error:", err);
        setAudioState(prev => ({
          ...prev,
          isPlaying: false,
          error: true,
          errorMessage: err.message || "Failed to play audio"
        }));
        toast(err.message || labels.error || "Error playing audio");
      });
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
      <div className="text-center py-2">
        <p className="text-sm text-destructive">
          {audioState.errorMessage || labels.error || "Unable to play audio"}
        </p>
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
          className="h-10 w-10 rounded-full" 
          onClick={handleRewind}
          title={labels.rewind}
        >
          <Rewind className="h-5 w-5" />
        </Button>
        
        {audioState.isPlaying ? (
          <Button 
            variant="outline" 
            size="icon"
            className="h-10 w-10 rounded-full" 
            onClick={handlePause}
            title={labels.pause}
          >
            <PauseCircle className="h-5 w-5" />
          </Button>
        ) : (
          <Button 
            variant="outline" 
            size="icon"
            className="h-10 w-10 rounded-full" 
            onClick={handlePlay}
            title={labels.play}
          >
            <PlayCircle className="h-5 w-5" />
          </Button>
        )}
        
        <Button 
          variant="outline" 
          size="icon"
          className="h-10 w-10 rounded-full" 
          onClick={handleStop}
          title={labels.stop}
        >
          <StopCircle className="h-5 w-5" />
        </Button>
      </div>
      
      <span className="text-sm text-muted-foreground">
        {audioState.isPlaying ? labels.pause : labels.play}
      </span>
    </div>
  );
};

export default AudioControls;
