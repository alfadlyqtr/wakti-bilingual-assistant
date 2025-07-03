
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, X } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { TicTacToeGame } from './games/TicTacToeGame';
import { ChessGame } from './games/ChessGame';
import { SolitaireGame } from './games/SolitaireGame';

interface GameModeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GameType = 'selection' | 'tic-tac-toe' | 'chess' | 'solitaire';

export function GameModeModal({ open, onOpenChange }: GameModeModalProps) {
  const { language } = useTheme();
  const [currentGame, setCurrentGame] = useState<GameType>('selection');

  const handleClose = () => {
    setCurrentGame('selection');
    onOpenChange(false);
  };

  const handleBack = () => {
    setCurrentGame('selection');
  };

  const renderGameSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300 mb-2">
          {language === 'ar' ? 'اختر لعبة' : 'Choose a Game'}
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          {language === 'ar' ? 'اختر لعبة للعب مع الذكاء الاصطناعي' : 'Select a game to play with AI'}
        </p>
      </div>
      
      <div className="grid gap-4">
        <Button
          onClick={() => setCurrentGame('tic-tac-toe')}
          className="h-20 text-lg bg-blue-500 hover:bg-blue-600 text-white"
        >
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🟦</span>
            <span>{language === 'ar' ? 'العب إكس أو' : 'Play Tic-Tac-Toe'}</span>
          </div>
        </Button>
        
        <Button
          onClick={() => setCurrentGame('chess')}
          className="h-20 text-lg bg-amber-600 hover:bg-amber-700 text-white"
        >
          <div className="flex items-center space-x-3">
            <span className="text-2xl">♟️</span>
            <span>{language === 'ar' ? 'العب شطرنج' : 'Play Chess'}</span>
          </div>
        </Button>
        
        <Button
          onClick={() => setCurrentGame('solitaire')}
          className="h-20 text-lg bg-green-600 hover:bg-green-700 text-white"
        >
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🃏</span>
            <span>{language === 'ar' ? 'العب سوليتير' : 'Play Solitaire'}</span>
          </div>
        </Button>
      </div>
    </div>
  );

  const renderCurrentGame = () => {
    switch (currentGame) {
      case 'tic-tac-toe':
        return <TicTacToeGame onBack={handleBack} />;
      case 'chess':
        return <ChessGame onBack={handleBack} />;
      case 'solitaire':
        return <SolitaireGame onBack={handleBack} />;
      default:
        return renderGameSelection();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        hideCloseButton={true}
      >
        <DialogHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            {currentGame !== 'selection' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>
              {currentGame === 'selection' 
                ? (language === 'ar' ? 'وضع الألعاب' : 'Game Mode')
                : currentGame === 'tic-tac-toe'
                ? (language === 'ar' ? 'إكس أو' : 'Tic-Tac-Toe')
                : currentGame === 'chess'
                ? (language === 'ar' ? 'شطرنج' : 'Chess')
                : (language === 'ar' ? 'سوليتير' : 'Solitaire')
              }
            </DialogTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="mt-4">
          {renderCurrentGame()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
