import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Pause, RotateCcw, Trophy } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { ZumaGameEngine } from './ZumaGameEngine';
import { GameState, ZumaGameData } from './ZumaTypes';

interface ZumaGameProps {
  onBack: () => void;
}

export function ZumaGame({ onBack }: ZumaGameProps) {
  const { language } = useTheme();
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameEngineRef = useRef<ZumaGameEngine | null>(null);
  
  const [gameState, setGameState] = useState<GameState>('menu');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [bestScore, setBestScore] = useState(0);
  const [hasProgress, setHasProgress] = useState(false);

  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'player';

  useEffect(() => {
    // Load best score and check for saved progress
    const savedBestScore = localStorage.getItem(`zuma_best_scores_${username}`);
    const savedProgress = localStorage.getItem(`zuma_saved_game_${username}`);
    
    if (savedBestScore) {
      setBestScore(parseInt(savedBestScore));
    }
    
    if (savedProgress) {
      setHasProgress(true);
    }
  }, [username]);

  useEffect(() => {
    if (canvasRef.current && gameState === 'playing') {
      gameEngineRef.current = new ZumaGameEngine(canvasRef.current, {
        onScoreUpdate: setScore,
        onLevelUpdate: setLevel,
        onGameOver: handleGameOver,
        onGameComplete: handleGameComplete
      });

      gameEngineRef.current.start();

      return () => {
        if (gameEngineRef.current) {
          gameEngineRef.current.destroy();
          gameEngineRef.current = null;
        }
      };
    }
  }, [gameState]);

  const handleGameOver = (finalScore: number) => {
    setGameState('gameOver');
    
    // Save best score
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      localStorage.setItem(`zuma_best_scores_${username}`, finalScore.toString());
    }
    
    // Clear saved progress
    localStorage.removeItem(`zuma_saved_game_${username}`);
    setHasProgress(false);
  };

  const handleGameComplete = (finalScore: number) => {
    setGameState('victory');
    
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      localStorage.setItem(`zuma_best_scores_${username}`, finalScore.toString());
    }
    
    localStorage.removeItem(`zuma_saved_game_${username}`);
    setHasProgress(false);
  };

  const startNewGame = () => {
    setScore(0);
    setLevel(1);
    setGameState('playing');
    localStorage.removeItem(`zuma_saved_game_${username}`);
    setHasProgress(false);
  };

  const continueGame = () => {
    const savedData = localStorage.getItem(`zuma_saved_game_${username}`);
    if (savedData) {
      const gameData: ZumaGameData = JSON.parse(savedData);
      setScore(gameData.score);
      setLevel(gameData.level);
    }
    setGameState('playing');
  };

  const pauseGame = () => {
    if (gameEngineRef.current) {
      gameEngineRef.current.pause();
      
      // Save current progress
      const gameData: ZumaGameData = {
        score,
        level,
        timestamp: Date.now()
      };
      localStorage.setItem(`zuma_saved_game_${username}`, JSON.stringify(gameData));
      setHasProgress(true);
    }
    setGameState('paused');
  };

  const resumeGame = () => {
    if (gameEngineRef.current) {
      gameEngineRef.current.resume();
    }
    setGameState('playing');
  };

  const restartGame = () => {
    if (gameEngineRef.current) {
      gameEngineRef.current.restart();
    }
    setScore(0);
    setLevel(1);
    setGameState('playing');
  };

  const renderMenu = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-6 p-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-primary mb-2">
          {language === 'ar' ? 'زوما' : 'Zuma'}
        </h2>
        <p className="text-muted-foreground text-sm">
          {language === 'ar' 
            ? 'أطلق الكرات الملونة وطابق ثلاث أو أكثر لتفجيرها!' 
            : 'Shoot colored balls and match three or more to pop them!'
          }
        </p>
      </div>

      {bestScore > 0 && (
        <div className="flex items-center gap-2 text-yellow-500">
          <Trophy className="h-4 w-4" />
          <span className="text-sm">
            {language === 'ar' ? `أفضل نتيجة: ${bestScore}` : `Best Score: ${bestScore}`}
          </span>
        </div>
      )}

      <div className="space-y-3 w-full max-w-xs">
        <Button 
          onClick={startNewGame}
          className="w-full h-12 text-base"
        >
          {language === 'ar' ? 'لعبة جديدة' : 'New Game'}
        </Button>
        
        {hasProgress && (
          <Button 
            onClick={continueGame}
            variant="outline"
            className="w-full h-12 text-base"
          >
            {language === 'ar' ? 'متابعة اللعب' : 'Continue Game'}
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground text-center max-w-sm">
        {language === 'ar' 
          ? 'اضغط على الشاشة لإطلاق الكرات. امنع وصول السلسلة إلى النهاية!'
          : 'Tap the screen to shoot balls. Prevent the chain from reaching the end!'
        }
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="flex flex-col h-full">
      {/* Game Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/50">
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-muted-foreground">
              {language === 'ar' ? 'النقاط:' : 'Score:'}
            </span>
            <span className="font-bold ml-1">{score}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">
              {language === 'ar' ? 'المستوى:' : 'Level:'}
            </span>
            <span className="font-bold ml-1">{level}</span>
          </div>
        </div>
        
        <Button
          onClick={pauseGame}
          variant="outline"
          size="sm"
        >
          <Pause className="h-4 w-4" />
        </Button>
      </div>

      {/* Game Canvas */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full bg-gradient-to-b from-blue-900 to-green-900"
          style={{ touchAction: 'none' }}
        />
      </div>
    </div>
  );

  const renderPaused = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-6 p-6">
      <div className="text-center">
        <h3 className="text-xl font-bold mb-2">
          {language === 'ar' ? 'اللعبة متوقفة' : 'Game Paused'}
        </h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <div>{language === 'ar' ? `النقاط: ${score}` : `Score: ${score}`}</div>
          <div>{language === 'ar' ? `المستوى: ${level}` : `Level: ${level}`}</div>
        </div>
      </div>

      <div className="space-y-3 w-full max-w-xs">
        <Button onClick={resumeGame} className="w-full">
          <Play className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'متابعة' : 'Resume'}
        </Button>
        
        <Button onClick={restartGame} variant="outline" className="w-full">
          <RotateCcw className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'إعادة التشغيل' : 'Restart'}
        </Button>
        
        <Button onClick={() => setGameState('menu')} variant="ghost" className="w-full">
          {language === 'ar' ? 'القائمة الرئيسية' : 'Main Menu'}
        </Button>
      </div>
    </div>
  );

  const renderGameOver = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-6 p-6">
      <div className="text-center">
        <h3 className="text-xl font-bold text-red-500 mb-2">
          {language === 'ar' ? 'انتهت اللعبة!' : 'Game Over!'}
        </h3>
        <div className="text-lg font-semibold mb-1">
          {language === 'ar' ? `النتيجة النهائية: ${score}` : `Final Score: ${score}`}
        </div>
        {score === bestScore && bestScore > 0 && (
          <div className="text-sm text-yellow-500 flex items-center justify-center gap-1">
            <Trophy className="h-4 w-4" />
            {language === 'ar' ? 'رقم قياسي جديد!' : 'New Best Score!'}
          </div>
        )}
      </div>

      <div className="space-y-3 w-full max-w-xs">
        <Button onClick={startNewGame} className="w-full">
          {language === 'ar' ? 'العب مرة أخرى' : 'Play Again'}
        </Button>
        
        <Button onClick={() => setGameState('menu')} variant="outline" className="w-full">
          {language === 'ar' ? 'القائمة الرئيسية' : 'Main Menu'}
        </Button>
      </div>
    </div>
  );

  const renderVictory = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-6 p-6">
      <div className="text-center">
        <h3 className="text-xl font-bold text-green-500 mb-2">
          {language === 'ar' ? '🎉 مبروك!' : '🎉 Victory!'}
        </h3>
        <div className="text-lg font-semibold mb-1">
          {language === 'ar' ? `النتيجة النهائية: ${score}` : `Final Score: ${score}`}
        </div>
        {score === bestScore && (
          <div className="text-sm text-yellow-500 flex items-center justify-center gap-1">
            <Trophy className="h-4 w-4" />
            {language === 'ar' ? 'رقم قياسي جديد!' : 'New Best Score!'}
          </div>
        )}
      </div>

      <div className="space-y-3 w-full max-w-xs">
        <Button onClick={startNewGame} className="w-full">
          {language === 'ar' ? 'العب مرة أخرى' : 'Play Again'}
        </Button>
        
        <Button onClick={() => setGameState('menu')} variant="outline" className="w-full">
          {language === 'ar' ? 'القائمة الرئيسية' : 'Main Menu'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="h-[600px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button
          onClick={onBack}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <h2 className="font-semibold">
          {language === 'ar' ? 'زوما' : 'Zuma'}
        </h2>
        
        <div className="w-8" /> {/* Spacer */}
      </div>

      {/* Game Content */}
      <div className="flex-1">
        {gameState === 'menu' && renderMenu()}
        {gameState === 'playing' && renderGame()}
        {gameState === 'paused' && renderPaused()}
        {gameState === 'gameOver' && renderGameOver()}
        {gameState === 'victory' && renderVictory()}
      </div>
    </div>
  );
}