import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTheme } from '@/providers/ThemeProvider';
import { ChessGame } from '@/components/wakti-ai-v2/games/ChessGame';
import { TicTacToeGame } from '@/components/wakti-ai-v2/games/TicTacToeGame';
import { SolitaireGame } from '@/components/wakti-ai-v2/games/SolitaireGame';
import { Gamepad2, Castle, Grid3x3, Spade, Type } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function Games() {
  const { language } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('letters');
  const [aiDifficulty, setAiDifficulty] = useState<'easy'|'medium'|'hard'|'auto'>('medium');
  const [roundsTarget, setRoundsTarget] = useState<1|3>(1);
  const [timerSec, setTimerSec] = useState<60|90>(60);

  const isArabic = language === 'ar';

  const EN_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const AR_LETTERS = ["ا","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز","س","ش","ص","ض","ط","ظ","ع","غ","ف","ق","ك","ل","م","ن","ه","و","ي"];
  function randomLetter(lang: 'ar'|'en'){
    const pool = lang==='ar'?AR_LETTERS:EN_LETTERS;
    return pool[Math.floor(Math.random()*pool.length)];
  }

  function handleStartVsAI(){
    // Go to Create page in AI mode with chosen settings; the host will create the game and add AI before starting the round.
    const params = new URLSearchParams({
      ai: '1',
      diff: aiDifficulty,
      rounds: String(roundsTarget),
      timer: String(timerSec),
    });
    navigate(`/letters/create?${params.toString()}`);
  }

  return (
    <div className="container mx-auto p-3 max-w-4xl">
      <div className="glass-hero px-5 py-4 mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-indigo-500" />
          {language === 'ar' ? 'الألعاب' : 'Games'}
        </h1>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex w-full items-stretch justify-between bg-transparent gap-2 p-2 rounded-xl mb-4 md:mb-6">
          <TabsTrigger value="chess" className="flex-1 whitespace-nowrap font-medium bg-card hover:-translate-y-[1px] data-[state=active]:bg-gradient-to-r data-[state=active]:backdrop-blur-sm relative after:absolute after:left-3 after:right-3 after:-bottom-0.5 after:h-0 after:bg-transparent duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50 flex items-center justify-center gap-2 px-3 py-3 sm:py-2 text-xs sm:text-sm min-h-[44px] sm:min-h-[40px] rounded-full border-2 shadow-md bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/60 dark:to-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:from-gray-100 hover:to-white dark:hover:from-gray-700 dark:hover:to-gray-600 hover:shadow-lg transition-all data-[state=active]:from-purple-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:border-purple-300 data-[state=active]:shadow-[0_6px_20px_rgba(147,51,234,0.35)] dark:data-[state=active]:from-purple-600 dark:data-[state=active]:to-blue-700">
            <Castle className="h-4 w-4" />
            {language === 'ar' ? 'شطرنج' : 'Chess'}
          </TabsTrigger>
          <TabsTrigger value="tictactoe" className="flex-1 whitespace-nowrap font-medium bg-card hover:-translate-y-[1px] data-[state=active]:bg-gradient-to-r data-[state=active]:backdrop-blur-sm relative after:absolute after:left-3 after:right-3 after:-bottom-0.5 after:h-0 after:bg-transparent duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50 flex items-center justify-center gap-2 px-3 py-3 sm:py-2 text-xs sm:text-sm min-h-[44px] sm:min-h-[40px] rounded-full border-2 shadow-md bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/60 dark:to-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:from-gray-100 hover:to-white dark:hover:from-gray-700 dark:hover:to-gray-600 hover:shadow-lg transition-all data-[state=active]:from-purple-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:border-purple-300 data-[state=active]:shadow-[0_6px_20px_rgba(147,51,234,0.35)] dark:data-[state=active]:from-purple-600 dark:data-[state=active]:to-blue-700">
            <Grid3x3 className="h-4 w-4" />
            {language === 'ar' ? 'إكس-أو' : 'Tic‑Tac‑Toe'}
          </TabsTrigger>
          <TabsTrigger value="solitaire" className="flex-1 whitespace-nowrap font-medium bg-card hover:-translate-y-[1px] data-[state=active]:bg-gradient-to-r data-[state=active]:backdrop-blur-sm relative after:absolute after:left-3 after:right-3 after:-bottom-0.5 after:h-0 after:bg-transparent duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50 flex items-center justify-center gap-2 px-3 py-3 sm:py-2 text-xs sm:text-sm min-h-[44px] sm:min-h-[40px] rounded-full border-2 shadow-md bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/60 dark:to-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:from-gray-100 hover:to-white dark:hover:from-gray-700 dark:hover:to-gray-600 hover:shadow-lg transition-all data-[state=active]:from-purple-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:border-purple-300 data-[state=active]:shadow-[0_6px_20px_rgba(147,51,234,0.35)] dark:data-[state=active]:from-purple-600 dark:data-[state=active]:to-blue-700">
            <Spade className="h-4 w-4" />
            {language === 'ar' ? 'سوليتير' : 'Solitaire'}
          </TabsTrigger>
          <TabsTrigger value="letters" className="flex-1 whitespace-nowrap font-medium bg-card hover:-translate-y-[1px] data-[state=active]:bg-gradient-to-r data-[state=active]:backdrop-blur-sm relative after:absolute after:left-3 after:right-3 after:-bottom-0.5 after:h-0 after:bg-transparent duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50 flex items-center justify-center gap-2 px-3 py-3 sm:py-2 text-xs sm:text-sm min-h-[44px] sm:min-h-[40px] rounded-full border-2 shadow-md bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/60 dark:to-gray-700/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:from-gray-100 hover:to-white dark:hover:from-gray-700 dark:hover:to-gray-600 hover:shadow-lg transition-all data-[state=active]:from-purple-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:border-purple-300 data-[state=active]:shadow-[0_6px_20px_rgba(147,51,234,0.35)] dark:data-[state=active]:from-purple-600 dark:data-[state=active]:to-blue-700">
            <Type className="h-4 w-4" />
            {language === 'ar' ? 'الحروف' : 'Letters'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chess" className="mt-4">
          <ChessGame onBack={() => { /* no-op on page */ }} />
        </TabsContent>
        <TabsContent value="tictactoe" className="mt-4">
          <TicTacToeGame onBack={() => { /* no-op on page */ }} />
        </TabsContent>
        <TabsContent value="solitaire" className="mt-4">
          <SolitaireGame onBack={() => { /* no-op on page */ }} />
        </TabsContent>
        <TabsContent value="letters" className="mt-4">
          <div className="glass-hero p-4 rounded-xl flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              {language === 'ar' ? 'لعبة الحروف (AR/EN) — انضم برمز بسيط' : 'Letters (AR/EN) — Join by simple code'}
            </h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/letters/create" className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition">
                {language === 'ar' ? 'إنشاء لعبة' : 'Create Game'}
              </Link>
              <Link to="/letters/join" className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition">
                {language === 'ar' ? 'انضم برمز' : 'Join with Code'}
              </Link>
              <button onClick={handleStartVsAI} className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition">
                {language === 'ar' ? 'ابدأ ضد الذكاء الاصطناعي' : 'Start vs AI'}
              </button>
            </div>
            
            <p className="text-sm text-muted-foreground">
              {language === 'ar'
                ? 'اختر العربية أو الإنجليزية، حتى 5 لاعبين، مؤقت 60/90 ثانية، والنتائج مع منصة التتويج وملف PDF.'
                : 'Pick Arabic or English, up to 5 players, 60/90s timer, with podium and PDF results.'}
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
