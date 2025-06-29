
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, X, Sparkles, Mic, Languages } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface GiftData {
  gift_type: 'voice_credits' | 'translation_credits';
  amount: number;
  new_balance: number;
  sender: string;
}

interface GiftNotificationPopupProps {
  isOpen: boolean;
  giftData: GiftData | null;
  onClose: () => void;
  onAcknowledge: () => void;
}

export function GiftNotificationPopup({ 
  isOpen, 
  giftData, 
  onClose, 
  onAcknowledge 
}: GiftNotificationPopupProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      // Auto-dismiss after 8 seconds
      const timer = setTimeout(() => {
        handleAcknowledge();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleAcknowledge = () => {
    onAcknowledge();
    onClose();
  };

  if (!giftData) return null;

  const isVoiceCredits = giftData.gift_type === 'voice_credits';
  const icon = isVoiceCredits ? <Mic className="h-6 w-6" /> : <Languages className="h-6 w-6" />;
  const creditType = isVoiceCredits ? 'Voice Characters' : 'Translation Credits';
  const iconColor = isVoiceCredits ? 'text-accent-blue' : 'text-accent-green';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Confetti Effect */}
          {showConfetti && (
            <div className="fixed inset-0 pointer-events-none z-50">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-gradient-to-r from-accent-purple to-accent-pink rounded-full"
                  initial={{
                    x: Math.random() * window.innerWidth,
                    y: -10,
                    rotate: 0,
                  }}
                  animate={{
                    y: window.innerHeight + 10,
                    rotate: 360,
                    x: Math.random() * window.innerWidth,
                  }}
                  transition={{
                    duration: 3,
                    delay: Math.random() * 2,
                    ease: "easeOut",
                  }}
                />
              ))}
            </div>
          )}

          {/* Gift Popup */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: 50 }}
            transition={{ type: "spring", damping: 15, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-md"
          >
            <Card className="enhanced-card relative overflow-hidden">
              {/* Close Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="absolute top-2 right-2 z-10 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Animated Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-accent-purple/10 via-accent-pink/10 to-accent-blue/10" />
              
              <CardContent className="p-6 relative">
                {/* Header with Gift Icon */}
                <div className="text-center mb-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", damping: 10 }}
                    className="inline-flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-full mb-3 relative"
                  >
                    <Gift className="h-8 w-8 text-white" />
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="absolute -top-1 -right-1"
                    >
                      <Sparkles className="h-6 w-6 text-accent-yellow" />
                    </motion.div>
                  </motion.div>
                  
                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-xl font-bold text-enhanced-heading mb-2"
                  >
                    🎁 Gift from {giftData.sender}!
                  </motion.h2>
                </div>

                {/* Gift Details */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-center mb-6"
                >
                  <div className="flex items-center justify-center mb-3">
                    <div className={`p-3 rounded-full bg-gradient-secondary/20 mr-3 ${iconColor}`}>
                      {icon}
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-enhanced-heading">
                        +{giftData.amount.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">{creditType}</p>
                    </div>
                  </div>
                  
                  <p className="text-enhanced-text">
                    You have received <strong>{giftData.amount.toLocaleString()}</strong> {creditType.toLowerCase()} 
                    as a gift from the Wakti Admin Team!
                  </p>
                  
                  <div className="mt-4 p-3 bg-gradient-secondary/10 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">New Balance:</span>
                      <Badge variant="secondary" className="font-semibold">
                        {giftData.new_balance.toLocaleString()} {isVoiceCredits ? 'Characters' : 'Credits'}
                      </Badge>
                    </div>
                  </div>
                </motion.div>

                {/* Action Button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-center"
                >
                  <Button
                    onClick={handleAcknowledge}
                    className="btn-enhanced w-full"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Thank You!
                  </Button>
                  
                  <p className="text-xs text-muted-foreground mt-2">
                    This popup will auto-close in a few seconds
                  </p>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
