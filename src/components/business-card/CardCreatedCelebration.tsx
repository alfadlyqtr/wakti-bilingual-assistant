import React, { useEffect, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Sparkles, PartyPopper } from 'lucide-react';

interface CardCreatedCelebrationProps {
  isOpen: boolean;
  onContinue: () => void;
}

const translations = {
  en: {
    title: 'Woohoo!',
    subtitle: 'Your card is all set to make new connections!',
    continue: 'Continue to Builder',
  },
  ar: {
    title: 'رائع!',
    subtitle: 'بطاقتك جاهزة لإنشاء اتصالات جديدة!',
    continue: 'المتابعة إلى المنشئ',
  },
};

// Confetti particle component
const ConfettiParticle: React.FC<{ delay: number; left: number; color: string }> = ({ delay, left, color }) => (
  <div
    className="absolute w-3 h-3 rounded-sm animate-confetti-fall"
    style={{
      left: `${left}%`,
      top: '-10px',
      backgroundColor: color,
      animationDelay: `${delay}ms`,
      transform: `rotate(${Math.random() * 360}deg)`,
    }}
  />
);

export const CardCreatedCelebration: React.FC<CardCreatedCelebrationProps> = ({
  isOpen,
  onContinue,
}) => {
  const { language } = useTheme();
  const t = translations[language] || translations.en;
  const isRTL = language === 'ar';
  const [confetti, setConfetti] = useState<{ id: number; delay: number; left: number; color: string }[]>([]);

  // Generate confetti on open
  useEffect(() => {
    if (isOpen) {
      const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
      const particles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        delay: Math.random() * 1000,
        left: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
      setConfetti(particles);
    } else {
      setConfetti([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onContinue}
      />
      
      {/* Confetti container */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confetti.map((particle) => (
          <ConfettiParticle
            key={particle.id}
            delay={particle.delay}
            left={particle.left}
            color={particle.color}
          />
        ))}
      </div>

      {/* Modal */}
      <div 
        className={`relative z-10 bg-background rounded-3xl p-8 mx-4 max-w-sm w-full shadow-2xl animate-celebration-pop ${isRTL ? 'rtl' : 'ltr'}`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Sparkle decorations */}
        <div className="absolute -top-3 -left-3 w-8 h-8 text-yellow-400 animate-pulse">
          <Sparkles className="w-full h-full" />
        </div>
        <div className="absolute -top-2 -right-2 w-6 h-6 text-pink-400 animate-pulse" style={{ animationDelay: '200ms' }}>
          <Sparkles className="w-full h-full" />
        </div>
        <div className="absolute -bottom-2 left-1/4 w-5 h-5 text-blue-400 animate-pulse" style={{ animationDelay: '400ms' }}>
          <Sparkles className="w-full h-full" />
        </div>

        {/* Content */}
        <div className="text-center">
          {/* Waving hand emoji with animation */}
          <div className="text-6xl mb-4 animate-wave inline-block">
            👋
          </div>
          
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {t.title}
          </h2>
          
          <p className="text-muted-foreground mb-6">
            {t.subtitle}
          </p>

          <Button
            onClick={onContinue}
            className="w-full h-12 text-lg font-semibold rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/25 transition-all active:scale-95"
          >
            <PartyPopper className="w-5 h-5 mr-2" />
            {t.continue}
          </Button>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        
        @keyframes celebration-pop {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes wave {
          0%, 100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(20deg);
          }
          75% {
            transform: rotate(-20deg);
          }
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        .animate-confetti-fall {
          animation: confetti-fall 3s ease-out forwards;
        }
        
        .animate-celebration-pop {
          animation: celebration-pop 0.5s ease-out forwards;
        }
        
        .animate-wave {
          animation: wave 1s ease-in-out infinite;
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default CardCreatedCelebration;
