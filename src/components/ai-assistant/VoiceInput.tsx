
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIMode } from "./types";

// Define mode colors for VoiceInput matching
const MODE_COLORS = {
  general: "#858384",
  writer: "#fcfefd",
  creative: "#e9ceb0",
  assistant: "#0c0f14"
};

interface VoiceInputProps {
  isActive: boolean;
  onToggle: () => void;
  onTranscript: (transcript: string) => void;
  language: string;
  activeMode: AIMode;
}

export function VoiceInput({
  isActive,
  onToggle,
  onTranscript,
  language,
  activeMode
}: VoiceInputProps) {
  const [waveform, setWaveform] = useState<number[]>([]);
  const modeColor = MODE_COLORS[activeMode];

  // Simulate recording with animated waveform
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isActive) {
      // Generate random waveform
      interval = setInterval(() => {
        const newWaveform = Array.from({ length: 30 }, () => Math.random() * 0.8 + 0.2);
        setWaveform(newWaveform);
      }, 80);
      
      // Simulate a voice recording after 3 seconds
      setTimeout(() => {
        onTranscript(language === "ar" ? 
          "أنشئ مهمة جديدة: اجتماع مع الفريق غدًا" : 
          "Create a new task: Team meeting tomorrow");
        onToggle();
      }, 3000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, onTranscript, language, onToggle]);

  return (
    <div className="relative">
      <Button
        onClick={onToggle}
        variant={isActive ? "destructive" : "outline"}
        size="icon"
        className={cn(
          "rounded-full transition-all relative opacity-100", // Removed hover:opacity-100 to make always visible
          isActive ? "animate-pulse" : "hover:bg-accent/80"
        )}
        style={!isActive ? {
          borderColor: modeColor,
          color: modeColor,
        } : undefined}
        aria-label={isActive ? 
          t("stopListening" as TranslationKey, language) : 
          t("startVoiceInput" as TranslationKey, language)
        }
      >
        <Mic size={20} />
      </Button>

      <AnimatePresence>
        {isActive && waveform.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: -50, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className="absolute left-1/2 transform -translate-x-1/2 bg-destructive text-destructive-foreground px-4 py-2 rounded-full flex items-center gap-0.5 shadow-lg"
            style={{ width: '240px' }}
          >
            {waveform.map((value, idx) => (
              <motion.div
                key={idx}
                className="flex-1 bg-current"
                style={{ height: `${value * 20}px` }}
                animate={{ 
                  height: `${value * 20}px`,
                  opacity: value * 1.2
                }}
                transition={{ duration: 0.1 }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
