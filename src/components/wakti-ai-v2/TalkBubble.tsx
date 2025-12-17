import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Mic } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';

interface TalkBubbleProps {
  isOpen: boolean;
  onClose: () => void;
  onUserMessage: (text: string) => void;
  onAssistantMessage: (text: string, audioUrl?: string) => void;
}

const MAX_RECORD_SECONDS = 15;

export function TalkBubble({ isOpen, onClose, onUserMessage, onAssistantMessage }: TalkBubbleProps) {
  const { language } = useTheme();
  const [isHolding, setIsHolding] = useState(false);
  const [countdown, setCountdown] = useState(MAX_RECORD_SECONDS);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartRef = useRef<number>(0);

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen) {
      cleanup();
    }
    return () => cleanup();
  }, [isOpen]);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setIsHolding(false);
    setCountdown(MAX_RECORD_SECONDS);
    setLiveTranscript('');
    setStatus('idle');
    setMicLevel(0);
    setError(null);
  }, []);

  // Mic level animation
  const updateMicLevel = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    setMicLevel(Math.min(1, avg / 128));
    if (isHolding) {
      animationFrameRef.current = requestAnimationFrame(updateMicLevel);
    }
  }, [isHolding]);

  // Start recording session
  const startSession = useCallback(async () => {
    setError(null);
    setStatus('listening');
    setLiveTranscript('');
    setCountdown(MAX_RECORD_SECONDS);
    holdStartRef.current = Date.now();

    try {
      // Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup analyser for mic level
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Create RTCPeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Add audio track
      stream.getAudioTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle incoming audio from OpenAI
      pc.ontrack = (event) => {
        if (audioRef.current && event.streams[0]) {
          audioRef.current.srcObject = event.streams[0];
          audioRef.current.play().catch(() => { /* ignore autoplay issues */ });
        }
      };

      // Create data channel for events
      const dc = pc.createDataChannel('oai-events', { ordered: true });
      dcRef.current = dc;

      dc.onopen = () => {
        // Send session.update with instructions
        const instructions = language === 'ar'
          ? `أنت مساعد Wakti الصوتي. أجب بإيجاز ووضوح. تحدث بالعربية. كن ودودًا ومفيدًا.`
          : `You are Wakti Voice Assistant. Answer concisely and clearly. Be friendly and helpful. Keep responses brief.`;
        
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions,
            input_audio_transcription: { model: 'whisper-1' },
            turn_detection: { type: 'server_vad' },
          }
        }));
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleRealtimeEvent(msg);
        } catch (e) {
          console.warn('Failed to parse realtime event:', e);
        }
      };

      // Create offer
      await pc.setLocalDescription();
      const offer = pc.localDescription;

      if (!offer) {
        throw new Error('Failed to create SDP offer');
      }

      // Get session token from backend
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await supabase.functions.invoke('openai-realtime-session', {
        body: { sdp_offer: offer.sdp, language },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (response.error || !response.data?.sdp_answer) {
        throw new Error(response.error?.message || 'Failed to get SDP answer');
      }

      // Set remote description
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: response.data.sdp_answer,
      });

      // Start countdown
      countdownIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - holdStartRef.current) / 1000);
        const remaining = Math.max(0, MAX_RECORD_SECONDS - elapsed);
        setCountdown(remaining);
        if (remaining <= 0) {
          stopRecording();
        }
      }, 200);

      // Start mic level animation
      updateMicLevel();

    } catch (err) {
      console.error('Failed to start talk session:', err);
      setError(language === 'ar' ? 'فشل بدء الجلسة' : 'Failed to start session');
      setStatus('idle');
      cleanup();
    }
  }, [language, cleanup, updateMicLevel]);

  // Handle realtime events from OpenAI
  const handleRealtimeEvent = useCallback((msg: any) => {
    console.log('[Talk] Realtime event:', msg.type, msg);
    switch (msg.type) {
      case 'session.created':
      case 'session.updated':
        console.log('[Talk] Session ready');
        break;
      case 'conversation.item.input_audio_transcription.completed':
        // User's speech transcribed
        if (msg.transcript) {
          setLiveTranscript(msg.transcript);
          onUserMessage(msg.transcript);
        }
        break;
      case 'response.audio_transcript.delta':
        // AI speaking - partial transcript
        setStatus('speaking');
        break;
      case 'response.audio_transcript.done':
        // AI finished speaking
        if (msg.transcript) {
          onAssistantMessage(msg.transcript);
        }
        setStatus('idle');
        break;
      case 'response.done':
        console.log('[Talk] Response complete');
        setStatus('idle');
        break;
      case 'error':
        console.error('[Talk] Realtime error:', msg);
        setError(msg.error?.message || 'Realtime error');
        setStatus('idle');
        break;
      default:
        break;
    }
  }, [onUserMessage, onAssistantMessage]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop mic tracks but keep connection for response
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    setIsHolding(false);
    setStatus('processing');

    // Send input_audio_buffer.commit to finalize
    if (dcRef.current && dcRef.current.readyState === 'open') {
      console.log('[Talk] Sending commit and response.create');
      dcRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      dcRef.current.send(JSON.stringify({ type: 'response.create' }));
    } else {
      console.warn('[Talk] Data channel not open, cannot send commit');
      setError(language === 'ar' ? 'فشل الاتصال' : 'Connection failed');
      setStatus('idle');
    }

    // Timeout fallback: if still processing after 15s, reset to idle
    setTimeout(() => {
      setStatus((prev) => {
        if (prev === 'processing') {
          console.warn('[Talk] Processing timeout, resetting to idle');
          setError(language === 'ar' ? 'انتهت المهلة' : 'Response timeout');
          return 'idle';
        }
        return prev;
      });
    }, 15000);
  }, [language]);

  // Hold handlers
  const handleHoldStart = useCallback(() => {
    if (status === 'idle' || status === 'speaking') {
      setIsHolding(true);
      startSession();
    }
  }, [status, startSession]);

  const handleHoldEnd = useCallback(() => {
    if (isHolding) {
      stopRecording();
    }
  }, [isHolding, stopRecording]);

  if (!isOpen) return null;

  const statusText = {
    idle: language === 'ar' ? 'اضغط مع الاستمرار للتحدث' : 'Hold to talk',
    listening: language === 'ar' ? 'جارٍ الاستماع...' : 'Listening...',
    processing: language === 'ar' ? 'جارٍ المعالجة...' : 'Processing...',
    speaking: language === 'ar' ? 'Wakti يتحدث...' : 'Wakti speaking...',
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md" style={{ paddingTop: 'env(safe-area-inset-top, 20px)', paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}>
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} autoPlay className="hidden" />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
        aria-label="Close"
      >
        <X className="w-7 h-7 text-white" />
      </button>

      <div className="flex flex-col items-center gap-5 p-6">
        {/* Siri-style animated orb with CSS animations */}
        <div className={`siri-orb-container ${isHolding ? 'listening' : ''} ${status === 'speaking' ? 'speaking' : ''}`}>
          <div className="siri-orb">
            <div className="siri-orb-gradient"></div>
            <div className="siri-orb-highlight"></div>
            <div className="siri-orb-shine"></div>
          </div>
          <div className="siri-glow"></div>
        </div>
        
        {/* Siri orb CSS animations */}
        <style>{`
          .siri-orb-container {
            position: relative;
            width: 140px;
            height: 140px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .siri-orb {
            position: relative;
            width: 120px;
            height: 120px;
            border-radius: 50%;
            overflow: hidden;
            animation: siriFloat 4s ease-in-out infinite;
          }
          
          .siri-orb-gradient {
            position: absolute;
            inset: -50%;
            background: conic-gradient(
              from 0deg,
              hsl(200, 100%, 60%),
              hsl(260, 90%, 65%),
              hsl(320, 85%, 60%),
              hsl(280, 80%, 55%),
              hsl(210, 100%, 65%),
              hsl(200, 100%, 60%)
            );
            animation: siriRotate 6s linear infinite;
            filter: blur(8px);
          }
          
          .siri-orb-highlight {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: radial-gradient(
              ellipse 60% 40% at 30% 25%,
              rgba(255, 255, 255, 0.8) 0%,
              rgba(255, 255, 255, 0.2) 30%,
              transparent 60%
            );
            animation: siriHighlight 3s ease-in-out infinite;
          }
          
          .siri-orb-shine {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: radial-gradient(
              circle at 70% 70%,
              rgba(255, 100, 200, 0.4) 0%,
              transparent 50%
            );
            animation: siriShine 4s ease-in-out infinite reverse;
          }
          
          .siri-glow {
            position: absolute;
            inset: -20px;
            border-radius: 50%;
            background: radial-gradient(
              circle,
              hsla(280, 90%, 65%, 0.4) 0%,
              hsla(210, 100%, 60%, 0.2) 40%,
              transparent 70%
            );
            animation: siriGlow 3s ease-in-out infinite;
            filter: blur(15px);
          }
          
          /* Listening state - more active */
          .siri-orb-container.listening .siri-orb {
            animation: siriFloat 1.5s ease-in-out infinite, siriBounce 0.3s ease-in-out infinite;
          }
          .siri-orb-container.listening .siri-orb-gradient {
            animation: siriRotate 2s linear infinite;
          }
          .siri-orb-container.listening .siri-glow {
            animation: siriGlowActive 0.5s ease-in-out infinite;
          }
          
          /* Speaking state - pulsing */
          .siri-orb-container.speaking .siri-orb {
            animation: siriSpeak 0.8s ease-in-out infinite;
          }
          .siri-orb-container.speaking .siri-glow {
            animation: siriGlowSpeak 0.8s ease-in-out infinite;
          }
          
          @keyframes siriRotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          @keyframes siriFloat {
            0%, 100% { transform: scale(1) translateY(0); }
            50% { transform: scale(1.03) translateY(-3px); }
          }
          
          @keyframes siriBounce {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
          }
          
          @keyframes siriHighlight {
            0%, 100% { opacity: 0.8; transform: translateX(0) translateY(0); }
            33% { opacity: 1; transform: translateX(5px) translateY(-3px); }
            66% { opacity: 0.9; transform: translateX(-3px) translateY(2px); }
          }
          
          @keyframes siriShine {
            0%, 100% { opacity: 0.6; transform: translateX(0) translateY(0); }
            50% { opacity: 1; transform: translateX(-5px) translateY(-5px); }
          }
          
          @keyframes siriGlow {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 0.9; transform: scale(1.1); }
          }
          
          @keyframes siriGlowActive {
            0%, 100% { opacity: 0.7; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.2); }
          }
          
          @keyframes siriSpeak {
            0%, 100% { transform: scale(1); }
            25% { transform: scale(1.05); }
            50% { transform: scale(0.98); }
            75% { transform: scale(1.03); }
          }
          
          @keyframes siriGlowSpeak {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            25% { opacity: 1; transform: scale(1.15); }
            50% { opacity: 0.7; transform: scale(1.05); }
            75% { opacity: 0.9; transform: scale(1.2); }
          }
        `}</style>

        {/* Countdown */}
        {isHolding && (
          <div className="text-2xl font-bold text-white tabular-nums">
            {countdown}s
          </div>
        )}

        {/* Status text */}
        <div className="text-lg text-white/80">
          {statusText[status]}
        </div>

        {/* Live transcript */}
        {liveTranscript && (
          <div className="max-w-xs text-center text-sm text-white/60 italic">
            "{liveTranscript}"
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Hold to talk button */}
        <button
          onMouseDown={handleHoldStart}
          onMouseUp={handleHoldEnd}
          onMouseLeave={handleHoldEnd}
          onTouchStart={handleHoldStart}
          onTouchEnd={handleHoldEnd}
          disabled={status === 'processing'}
          className={`
            flex items-center justify-center w-20 h-20 rounded-full transition-all duration-150
            ${isHolding 
              ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/50' 
              : 'bg-white/20 hover:bg-white/30 active:scale-95'}
            ${status === 'processing' ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          aria-label={statusText[status]}
        >
          <Mic className={`w-8 h-8 ${isHolding ? 'text-white' : 'text-white/80'}`} />
        </button>

        {/* Waveform bars (simple visualization) */}
        {isHolding && (
          <div className="flex items-end gap-1 h-8">
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-white/60 rounded-full transition-all duration-75"
                style={{
                  height: `${8 + Math.random() * micLevel * 24}px`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
