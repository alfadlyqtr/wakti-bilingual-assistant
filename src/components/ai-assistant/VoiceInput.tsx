
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        const newWaveform = Array.from({ length: 20 }, () => Math.random() * 0.8 + 0.2);
        setWaveform(newWaveform);
      }, 100);
      
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
        variant={isActive ? "destructive" : "ghost"}
        size="icon"
        className={cn(
          "rounded-full transition-all relative",
          isActive && "animate-pulse"
        )}
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
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: -50 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-1/2 transform -translate-x-1/2 bg-destructive text-destructive-foreground px-3 py-1 rounded-full flex items-center gap-0.5"
            style={{ width: '200px' }}
          >
            {waveform.map((value, idx) => (
              <motion.div
                key={idx}
                className="flex-1 bg-current"
                style={{ height: `${value * 16}px` }}
                animate={{ height: `${value * 16}px` }}
                transition={{ duration: 0.1 }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
