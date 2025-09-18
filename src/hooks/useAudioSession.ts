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
      // Create a silent audio element and try to play it
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

  register(id: string, source: AudioSource, element?: any, priority = 1): AudioSession {
    const session: AudioSession = { id, source, element, priority };
    this.sessions.set(id, session);
    return session;
  }

  unregister(id: string) {
    const session = this.sessions.get(id);
    if (session === this.currentSession) {
      this.currentSession = null;
      this.notifyListeners();
    }
    this.sessions.delete(id);
  }

  async requestPlayback(id: string): Promise<boolean> {
    const session = this.sessions.get(id);
    if (!session) return false;

    // Unlock audio on first user interaction
    await this.unlockAudio();

    // Stop current session if different and lower priority
    if (this.currentSession && this.currentSession.id !== id) {
      if (this.currentSession.priority >= session.priority) {
        return false; // Higher priority session is playing
      }
      await this.stopCurrent();
    }

    this.currentSession = session;
    this.notifyListeners();
    
    // Dispatch global event for coordination
    try {
      window.dispatchEvent(new CustomEvent('wakti-audio-session-changed', { 
        detail: { activeSource: session.source, sessionId: id } 
      }));
    } catch {}

    return true;
  }

  async stopSession(id: string) {
    const session = this.sessions.get(id);
    if (!session) return;

    if (this.currentSession?.id === id) {
      this.currentSession = null;
      this.notifyListeners();
      
      try {
        window.dispatchEvent(new CustomEvent('wakti-audio-session-changed', { 
          detail: { activeSource: null, sessionId: null } 
        }));
      } catch {}
    }
  }

  private async stopCurrent() {
    if (!this.currentSession) return;

    const { source, element, id } = this.currentSession;
    
    try {
      if (source === 'youtube' && element) {
        element.pauseVideo?.();
      } else if (source === 'tts' && element instanceof HTMLAudioElement) {
        element.pause();
        element.currentTime = 0;
      }
    } catch {}

    // Dispatch stop event for the specific source
    try {
      window.dispatchEvent(new CustomEvent(`wakti-${source}-stopped`, { 
        detail: { sessionId: id } 
      }));
    } catch {}
  }

  getCurrentSession(): AudioSession | null {
    return this.currentSession;
  }

  isPlaying(id: string): boolean {
    return this.currentSession?.id === id;
  }

  subscribe(callback: (session: AudioSession | null) => void) {
    this.listeners.add(callback);
    return () => { this.listeners.delete(callback); };
  }

  private notifyListeners() {
    this.listeners.forEach(callback => {
      try { callback(this.currentSession); } catch {}
    });
  }
}

// Global singleton instance
const audioSessionManager = new AudioSessionManager();

export function useAudioSession() {
  const sessionRef = useRef<AudioSession | null>(null);

  const register = useCallback((id: string, source: AudioSource, element?: any, priority = 1) => {
    sessionRef.current = audioSessionManager.register(id, source, element, priority);
    return sessionRef.current;
  }, []);

  const unregister = useCallback((id: string) => {
    audioSessionManager.unregister(id);
    sessionRef.current = null;
  }, []);

  const requestPlayback = useCallback(async (id: string) => {
    return audioSessionManager.requestPlayback(id);
  }, []);

  const stopSession = useCallback(async (id: string) => {
    return audioSessionManager.stopSession(id);
  }, []);

  const isPlaying = useCallback((id: string) => {
    return audioSessionManager.isPlaying(id);
  }, []);

  const unlockAudio = useCallback(async () => {
    return audioSessionManager.unlockAudio();
  }, []);

  // Subscribe to session changes
  useEffect(() => {
    const unsubscribe = audioSessionManager.subscribe((session) => {
      // This will trigger re-renders when session changes
    });
    return unsubscribe;
  }, []);

  return {
    register,
    unregister,
    requestPlayback,
    stopSession,
    isPlaying,
    unlockAudio,
    currentSession: audioSessionManager.getCurrentSession()
  };
}

export default useAudioSession;
