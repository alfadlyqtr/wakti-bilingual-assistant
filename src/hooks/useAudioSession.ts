import { useRef, useCallback, useEffect } from 'react';

export type AudioSource = 'youtube' | 'tts' | 'voice-recording' | 'other';

interface AudioSession {
  id: string;
  source: AudioSource;
  element?: HTMLAudioElement | any; // YouTube player or Audio element
  priority: number; // Higher = more important
}

class AudioSessionManager {
  private sessions = new Map<string, AudioSession>();
  private currentSession: AudioSession | null = null;
  private listeners = new Set<(session: AudioSession | null) => void>();
  private unlocked = false;

  // iOS requires user gesture to unlock audio context
  async unlockAudio() {
    if (this.unlocked) return true;
    try {
      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjmH0fPTgjMGHm7A7+OZURE';
      audio.volume = 0.01;
      await audio.play();
      audio.pause();
      audio.remove();
      this.unlocked = true;
      return true;
    } catch {
      return false;
    }
  }

  // Original manager kept for compatibility but not used by the hook any more
  register(id: string, source: AudioSource, element?: any, priority = 1): AudioSession {
    const session: AudioSession = { id, source, element, priority };
    this.sessions.set(id, session);
    return session;
  }
  unregister(id: string) { this.sessions.delete(id); }
  async requestPlayback(_id: string): Promise<boolean> { return true; }
  async stopSession(_id: string) { /* no-op */ }
  getCurrentSession(): AudioSession | null { return null; }
  isPlaying(_id: string): boolean { return false; }
  subscribe(_cb: (session: AudioSession | null) => void) { return () => {}; }
}

// Global singleton instance
const audioSessionManager = new AudioSessionManager();

export function useAudioSession() {
  const sessionRef = useRef<AudioSession | null>(null);

  // No-op session manager: always allow playback; no arbitration across all devices
  const register = useCallback((id: string, source: AudioSource, element?: any, priority = 1) => {
    sessionRef.current = null; // no session stored
    return null as any;
  }, []);

  const unregister = useCallback((_id: string) => {
    sessionRef.current = null;
  }, []);

  const requestPlayback = useCallback(async (_id: string) => {
    return true; // never gate playback
  }, []);

  const stopSession = useCallback(async (_id: string) => {
    // no-op
  }, []);

  const isPlaying = useCallback((_id: string) => {
    return false; // no active session concept
  }, []);

  const unlockAudio = useCallback(async () => {
    // Keep iOS unlock behavior for autoplay friendliness
    return audioSessionManager.unlockAudio();
  }, []);

  // No subscription necessary in no-op mode
  useEffect(() => { return () => {}; }, []);

  return {
    register,
    unregister,
    requestPlayback,
    stopSession,
    isPlaying,
    unlockAudio,
    currentSession: null
  };
}

export default useAudioSession;
