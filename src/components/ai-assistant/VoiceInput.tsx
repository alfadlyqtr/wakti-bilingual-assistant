
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { t } from "@/utils/translations";

interface VoiceInputProps {
  isActive: boolean;
  onToggle: () => void;
  onTranscript: (transcript: string) => void;
  language: string;
}

export function VoiceInput({
  isActive,
  onToggle,
  onTranscript,
  language
}: VoiceInputProps) {
  const [waveform, setWaveform] = useState<number[]>([]);

  // Simulate recording with animated waveform
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isActive) {
      // Generate random waveform
      interval = setInterval(() => {
        const newWaveform = Array.from({ length: 12 }, () => Math.random() * 0.8 + 0.2);
        setWaveform(newWaveform);
      }, 100);
      
      // Simulate a voice recording after 3 seconds
      setTimeout(() => {
        onTranscript(language === "ar" ? 
          "أنشئ مهمة جديدة: اجتماع مع الفريق غدًا" : 
          "Create a task: Team meeting tomorrow");
      }, 3000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, onTranscript, language]);

  return (
    <button
      onClick={onToggle}
      className={cn(
        "p-2 rounded-full transition-colors relative",
        isActive ? "bg-red-500 text-white" : "hover:bg-accent"
      )}
      aria-label={isActive ? t("stopListening", language) : t("startVoiceInput", language)}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mic">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" x2="12" y1="19" y2="22"/>
      </svg>
      
      {isActive && waveform.length > 0 && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-500 px-3 py-1 rounded-full flex items-center gap-0.5">
          {waveform.map((value, idx) => (
            <motion.div
              key={idx}
              className="w-0.5 bg-white"
              style={{ height: `${value * 16}px` }}
              animate={{ height: `${value * 16}px` }}
              transition={{ duration: 0.1 }}
            />
          ))}
        </div>
      )}
    </button>
  );
}
