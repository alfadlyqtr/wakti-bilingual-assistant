
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface GiftNotificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  giftType: 'voice_credits' | 'translation_credits';
  amount: number;
  sender: string;
}

export function GiftNotificationPopup({ 
  isOpen, 
  onClose, 
  giftType, 
  amount, 
  sender 
}: GiftNotificationPopupProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      // Auto close after 8 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  const giftTitle = giftType === 'voice_credits' ? 'Voice Characters' : 'Translation Credits';
  const giftIcon = giftType === 'voice_credits' ? '🎤' : '🌐';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Gift Card */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="relative z-10 w-full max-w-md"
          >
            <Card className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 border-0 shadow-2xl">
              <CardContent className="p-6 text-center text-white relative overflow-hidden">
                {/* Close Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="absolute top-2 right-2 text-white hover:bg-white/20 h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>

                {/* Confetti Effect */}
                {showConfetti && (
                  <div className="absolute inset-0 pointer-events-none">
                    {[...Array(20)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ 
                          x: Math.random() * 100 + '%',
                          y: '-10%',
                          opacity: 1,
                          scale: Math.random() * 0.5 + 0.5
                        }}
                        animate={{ 
                          y: '110%',
                          opacity: 0,
                          rotate: Math.random() * 360
                        }}
                        transition={{ 
                          duration: Math.random() * 2 + 2,
                          delay: Math.random() * 0.5
                        }}
                        className="absolute"
                      >
                        <Sparkles className="h-3 w-3 text-yellow-300" />
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Gift Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: "spring", duration: 0.8 }}
                  className="mb-4"
                >
                  <div className="w-16 h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-2">
                    <Gift className="h-8 w-8 text-white" />
                  </div>
                  <div className="text-4xl mb-2">{giftIcon}</div>
                </motion.div>

                {/* Title */}
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-bold mb-2"
                >
                  🎁 Surprise Gift!
                </motion.h2>

                {/* Message */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-2 mb-6"
                >
                  <p className="text-lg">
                    You've received <span className="font-bold">{amount.toLocaleString()}</span>
                  </p>
                  <p className="text-lg font-semibold">
                    {giftTitle}
                  </p>
                  <p className="text-sm opacity-90">
                    From: {sender}
                  </p>
                </motion.div>

                {/* CTA Button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Button
                    onClick={onClose}
                    className="bg-white text-purple-600 hover:bg-gray-100 font-semibold px-8 py-2"
                  >
                    Awesome! 🎉
                  </Button>
                </motion.div>

                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                  <div className="absolute top-4 left-4 w-2 h-2 bg-white/30 rounded-full animate-pulse"></div>
                  <div className="absolute top-8 right-6 w-1 h-1 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                  <div className="absolute bottom-6 left-8 w-3 h-3 bg-white/20 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                  <div className="absolute bottom-4 right-4 w-2 h-2 bg-white/35 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }}></div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
