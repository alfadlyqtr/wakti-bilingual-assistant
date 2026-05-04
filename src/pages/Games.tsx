import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { ChessTab } from '@/components/wakti-ai-v2/games/ChessTab';
import { TicTacToeTab } from '@/components/wakti-ai-v2/games/TicTacToeTab';
import { SolitaireGame } from '@/components/wakti-ai-v2/games/SolitaireGame';
import { Gamepad2, Castle, Grid3x3, Spade, Languages, ArrowLeft } from 'lucide-react';

type GameScreen = 'home' | 'chess' | 'tictactoe' | 'solitaire' | 'letters';

type GameInviteTargetState = {
  gameInviteTarget?: {
    gameType: 'chess' | 'tictactoe';
    gameCode: string;
    launchToken?: string;
  };
};

export default function Games() {
  const { language } = useTheme();
  const [screen, setScreen] = useState<GameScreen>('home');
  const [chessInviteCode, setChessInviteCode] = useState<string | null>(null);
  const [ticTacToeInviteCode, setTicTacToeInviteCode] = useState<string | null>(null);
  const [chessInviteLaunchToken, setChessInviteLaunchToken] = useState<string | null>(null);
  const [ticTacToeInviteLaunchToken, setTicTacToeInviteLaunchToken] = useState<string | null>(null);
  const [chessExitHandler, setChessExitHandler] = useState<(() => Promise<void>) | null>(null);
  const [ticTacToeExitHandler, setTicTacToeExitHandler] = useState<(() => Promise<void>) | null>(null);

  const registerChessExitHandler = React.useCallback(
    (handler: (() => Promise<void>) | null) => setChessExitHandler(() => handler),
    [],
  );
  const registerTicTacToeExitHandler = React.useCallback(
    (handler: (() => Promise<void>) | null) => setTicTacToeExitHandler(() => handler),
    [],
  );
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const processedInviteNavigationRef = useRef<string | null>(null);

  const isArabic = language === 'ar';

  useEffect(() => {
    const routeState = location.state as GameInviteTargetState | null;
    const searchParams = new URLSearchParams(location.search);
    const queryGameType = searchParams.get('gameInviteType');
    const queryGameCode = searchParams.get('gameInviteCode');
    const queryLaunchToken = searchParams.get('gameInviteLaunch');

    const inviteTarget = queryGameType && queryGameCode
      ? {
          gameType: queryGameType as 'chess' | 'tictactoe',
          gameCode: queryGameCode,
          launchToken: queryLaunchToken ?? undefined,
        }
      : routeState?.gameInviteTarget;

    if (!inviteTarget?.gameCode) return;

    const processingKey = inviteTarget.launchToken || `${location.key}:${inviteTarget.gameType}:${inviteTarget.gameCode}`;
    if (processedInviteNavigationRef.current === processingKey) return;
    processedInviteNavigationRef.current = processingKey;

    if (inviteTarget.gameType === 'chess') {
      setChessInviteCode(inviteTarget.gameCode);
      setChessInviteLaunchToken(inviteTarget.launchToken || processingKey);
      setScreen('chess');
    }

    if (inviteTarget.gameType === 'tictactoe') {
      setTicTacToeInviteCode(inviteTarget.gameCode);
      setTicTacToeInviteLaunchToken(inviteTarget.launchToken || processingKey);
      setScreen('tictactoe');
    }
  }, [location.key, location.search, location.state]);

  const gameCards = useMemo(() => ([
    {
      key: 'chess' as const,
      title: isArabic ? 'شطرنج' : 'Chess',
      subtitle: isArabic ? 'ذكاء واستراتيجية ضد الذكاء الاصطناعي أو صديق' : 'Strategy battles against AI or a friend',
      icon: Castle,
      glow: 'from-blue-600 to-cyan-500',
      badge: isArabic ? 'ذكي' : 'Smart',
    },
    {
      key: 'tictactoe' as const,
      title: isArabic ? 'إكس-أو' : 'Tic-Tac-Toe',
      subtitle: isArabic ? 'سريعة وخفيفة وتنافسية' : 'Fast, clean, and competitive',
      icon: Grid3x3,
      glow: 'from-blue-500 to-cyan-500',
      badge: isArabic ? 'سريع' : 'Quick',
    },
    {
      key: 'solitaire' as const,
      title: isArabic ? 'سوليتير' : 'Solitaire',
      subtitle: isArabic ? 'جلسة فردية هادئة وممتعة' : 'A polished solo card session',
      icon: Spade,
      glow: 'from-blue-600 to-cyan-500',
      badge: isArabic ? 'فردي' : 'Solo',
    },
    {
      key: 'letters' as const,
      title: isArabic ? 'الحروف' : 'Letters',
      subtitle: isArabic ? 'ألعب ضد الذكاء الاصطناعي أو مع الآخرين' : 'Play against AI or with other people',
      icon: Languages,
      glow: 'from-emerald-600 to-teal-500',
      badge: isArabic ? 'جاهز' : 'Ready',
    },
  ]), [isArabic]);

  const selectedTitle = (() => {
    if (screen === 'chess') return isArabic ? 'شطرنج' : 'Chess';
    if (screen === 'tictactoe') return isArabic ? 'إكس-أو' : 'Tic-Tac-Toe';
    if (screen === 'solitaire') return isArabic ? 'سوليتير' : 'Solitaire';
    if (screen === 'letters') return isArabic ? 'الحروف' : 'Letters';
    return isArabic ? 'الألعاب' : 'Games';
  })();

  const selectedSubtitle = (() => {
    if (screen === 'chess') return chessExitHandler ? '' : (isArabic ? 'اختر طريقتك ثم ابدأ اللعب' : 'Pick your mode and start playing');
    if (screen === 'tictactoe') return ticTacToeExitHandler ? '' : (isArabic ? 'ابدأ بسرعة ضد الذكاء الاصطناعي أو صديق' : 'Jump in against AI or a friend');
    if (screen === 'solitaire') return isArabic ? 'جلسة فردية أنيقة وهادئة' : 'A focused solo session';
    if (screen === 'letters') return isArabic ? 'اختر اللعب ضد الذكاء الاصطناعي أو لعبة مشتركة' : 'Choose AI play or a shared game';
    return '';
  })();

  const handleTopBack = async () => {
    if (isNavigatingBack) return;

    const activeExitHandler =
      screen === 'chess'
        ? chessExitHandler
        : screen === 'tictactoe'
          ? ticTacToeExitHandler
          : null;

    if (!activeExitHandler) {
      setScreen('home');
      return;
    }

    setIsNavigatingBack(true);
    try {
      await activeExitHandler();
      setScreen('home');
    } catch {
      return;
    } finally {
      setIsNavigatingBack(false);
    }
  };

  if (screen !== 'home') {
    return (
      <div className="min-h-screen bg-[#FCFEFD] dark:bg-[#0C0F14]">
        {/* Polished Header with Back Button */}
        <div className="sticky top-0 z-50 bg-[#FCFEFD]/80 dark:bg-[#0C0F14]/80 backdrop-blur-xl border-b border-[#E9CEB0]/20 dark:border-white/5">
          <div className="container mx-auto px-4 py-3 max-w-5xl">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleTopBack}
                disabled={isNavigatingBack}
                className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-[#060541] to-[#1a1a6e] px-4 py-2 text-sm font-medium text-white shadow-[0_4px_14px_rgba(6,5,65,0.25)] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(6,5,65,0.35)] hover:-translate-y-0.5 active:translate-y-0 dark:from-white/10 dark:to-white/5 dark:shadow-[0_4px_14px_rgba(0,0,0,0.4)]"
              >
                <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
                Back
              </button>
              <div className="flex-1">
                <h1 className="text-lg font-bold text-[#060541] dark:text-white">{selectedTitle}</h1>
                {selectedSubtitle && <p className="text-sm text-[#060541]/50 dark:text-white/40">{selectedSubtitle}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Game Content */}
        <div className="container mx-auto px-4 pb-4 pt-3 max-w-5xl">
          {screen === 'chess' && (
            <ChessTab
              key={chessInviteLaunchToken || 'chess'}
              inviteCode={chessInviteCode}
              inviteLaunchToken={chessInviteLaunchToken}
              onInviteCodeConsumed={() => setChessInviteCode(null)}
              onRegisterGameExitHandler={registerChessExitHandler}
            />
          )}
          {screen === 'tictactoe' && (
            <TicTacToeTab
              key={ticTacToeInviteLaunchToken || 'tictactoe'}
              inviteCode={ticTacToeInviteCode}
              inviteLaunchToken={ticTacToeInviteLaunchToken}
              onInviteCodeConsumed={() => setTicTacToeInviteCode(null)}
              onRegisterGameExitHandler={registerTicTacToeExitHandler}
            />
          )}
          {screen === 'solitaire' && <SolitaireGame onBack={() => setScreen('home')} />}
          {screen === 'letters' && (
            <div className="rounded-2xl border border-[#E9CEB0]/30 bg-white p-6 shadow-[0_8px_32px_rgba(6,5,65,0.08)] dark:border-white/10 dark:bg-gradient-to-br dark:from-[#1a1d26] dark:via-[#141720] dark:to-[#0f1118] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              <h2 className="mb-4 text-xl font-bold text-[#060541] dark:text-white">{isArabic ? 'لعبة الحروف' : 'Letters Game'}</h2>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button onClick={() => navigate('/games/letters/create')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 text-sm font-medium text-white shadow-[0_4px_14px_rgba(37,99,235,0.3)] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(37,99,235,0.4)] hover:-translate-y-0.5">
                  {isArabic ? 'إنشاء لعبة مشتركة' : 'Create shared game'}
                </button>
                <button onClick={() => navigate('/games/letters/join')} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#E9CEB0] bg-[#E9CEB0]/10 px-6 py-3 text-sm font-medium text-[#060541] transition-all duration-200 hover:bg-[#E9CEB0]/20 dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
                  {isArabic ? 'الانضمام إلى لعبة مشتركة' : 'Join shared game'}
                </button>
                <button onClick={() => navigate('/games/letters/ai')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-medium text-white shadow-[0_4px_14px_rgba(16,185,129,0.3)] transition-all duration-200 hover:shadow-[0_6px_20px_rgba(16,185,129,0.4)] hover:-translate-y-0.5">
                  {isArabic ? 'ابدأ الآن ضد الذكاء الاصطناعي' : 'Start now against AI'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FCFEFD] dark:bg-[#0C0F14]">
      <div className="container mx-auto p-4 max-w-5xl">
        {/* Polished Header */}
        <div className="mb-8 text-center">
          <div className="relative mx-auto mb-6 inline-flex">
            {/* Glow behind icon */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-500 opacity-20 blur-2xl" />
            <div className="relative inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-[0_8px_32px_rgba(37,99,235,0.4)]">
              <Gamepad2 className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="mb-2 text-3xl font-bold text-[#060541] dark:text-white">
            {language === 'ar' ? 'الألعاب' : 'Games'}
          </h1>
          <p className="text-base text-[#060541]/60 dark:text-white/50">
            {isArabic ? 'اختر لعبتك المفضلة وابدأ اللعب' : 'Pick your favorite game and start playing'}
          </p>
        </div>

        {/* Games Grid - Premium Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {gameCards.map((game) => {
            const Icon = game.icon;
            return (
              <button
                key={game.key}
                type="button"
                onClick={() => setScreen(game.key)}
                className="group relative overflow-hidden rounded-3xl border border-[#E9CEB0]/40 bg-white p-5 shadow-[0_8px_30px_rgba(6,5,65,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(6,5,65,0.15)] dark:border-white/10 dark:bg-gradient-to-br dark:from-[#1a1d26] dark:via-[#161921] dark:to-[#11131a] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] dark:hover:shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
              >
                {/* Animated gradient border on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${game.glow} opacity-0 transition-opacity duration-500 group-hover:opacity-20`} />
                
                {/* Icon with stronger shadow */}
                <div className={`relative mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${game.glow} text-white shadow-[0_8px_20px_rgba(0,0,0,0.2)] transition-transform duration-300 group-hover:scale-110`}>
                  <Icon className="h-6 w-6" />
                </div>

                {/* Title - Larger and bolder, with padding to avoid arrow overlap */}
                <div className="relative pr-8 text-left">
                  <div className="text-base font-bold text-[#060541] transition-colors group-hover:text-[#060541]/80 dark:text-white dark:group-hover:text-white/90">
                    {game.title}
                  </div>
                  <div className="mt-1.5 text-sm leading-relaxed text-[#060541]/50 dark:text-white/40">
                    {game.subtitle}
                  </div>
                </div>

                {/* Play arrow with animation - positioned to not overlap */}
                <div className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#060541]/5 text-[#060541]/30 transition-all duration-300 group-hover:bg-[#060541]/10 group-hover:text-[#060541]/50 dark:bg-white/5 dark:text-white/20 dark:group-hover:bg-white/10 dark:group-hover:text-white/40">
                  <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
