
import React, { useRef, useEffect, useState } from "react";

interface WaveformVisualizerProps {
  isRecording: boolean;
  audioStream?: MediaStream | null;
  height?: number;
  backgroundColor?: string;
  barColor?: string;
}

export default function WaveformVisualizer({
  isRecording,
  audioStream,
  height = 60,
  backgroundColor = 'rgba(209, 213, 219, 0.2)',
  barColor = 'rgba(79, 70, 229, 0.6)'
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // Initialize and cleanup audio processing
  useEffect(() => {
    if (!isRecording || !audioStream) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
      
      if (audioContext) {
        analyserRef.current = null;
        setAudioContext(null);
      }
      
      // Clear canvas when not recording
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
      
      return;
    }

    // Create audio context and analyser when recording starts
    const context = new AudioContext();
    setAudioContext(context);
    
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    const source = context.createMediaStreamSource(audioStream);
    source.connect(analyser);
    analyserRef.current = analyser;
    
    // Start visualization
    animateWaveform();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      if (context && context.state !== 'closed') {
        context.close();
      }
      
      analyserRef.current = null;
    };
  }, [isRecording, audioStream]);

  // Animate the waveform
  const animateWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to match parent container
    const parentWidth = canvas.parentElement?.clientWidth || canvas.width;
    canvas.width = parentWidth;
    canvas.height = height;
    
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording || !ctx || !analyser) return;
      
      analyser.getByteFrequencyData(dataArray);
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw waveform
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        
        // Use dynamic opacity based on amplitude
        const opacity = 0.2 + (dataArray[i] / 255) * 0.8;
        ctx.fillStyle = barColor.replace('0.6', opacity.toString());
        
        // Center the bars vertically
        const y = (canvas.height - barHeight) / 2;
        ctx.fillRect(x, y, barWidth, barHeight);
        
        x += barWidth + 1;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);
  };

  return (
    <div className="w-full h-full overflow-hidden rounded-md">
      <canvas 
        ref={canvasRef} 
        className="w-full" 
        height={height}
        style={{ height: `${height}px` }} 
      />
    </div>
  );
}
