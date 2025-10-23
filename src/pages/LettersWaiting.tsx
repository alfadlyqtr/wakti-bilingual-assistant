import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, ArrowLeft } from 'lucide-react';
import LettersBackdrop from '@/components/letters/LettersBackdrop';
import { Badge } from '@/components/ui/badge';

export default function LettersWaiting() {
  const { language } = useTheme();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { isHost?: boolean; gameCode?: string; gameTitle?: string; hostName?: string; maxPlayers?: number } };
  const isHost = !!location.state?.isHost;
  const [copied, setCopied] = useState(false);
  // Placeholder game code; in the future this would come from state/router.
  const [gameCode] = useState<string>(location.state?.gameCode || 'WABCDE');
  const [playersCount, setPlayersCount] = useState<number>(1);
  const maxPlayers = location.state?.maxPlayers || 5;
  const [gameTitle, setGameTitle] = useState<string | undefined>(location.state?.gameTitle);
  const [hostName, setHostName] = useState<string | undefined>(location.state?.hostName);

  useEffect(() => {
    try {
      if (gameCode) {
        const raw = localStorage.getItem(`wakti_letters_game_${gameCode}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (!gameTitle && parsed?.title) setGameTitle(parsed.title);
          if (!hostName && parsed?.hostName) setHostName(parsed.hostName);
        }
      }
    } catch {}
  }, [gameCode]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(gameCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="container mx-auto p-3 max-w-3xl relative min-h-[100dvh]">
      <LettersBackdrop density={60} />
      <div className="glass-hero px-5 py-4 mb-4 flex items-center justify-between gap-3 relative z-10 bg-white/60 dark:bg-gray-900/35">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/games')}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 bg-card text-foreground hover:bg-accent transition shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">{language === 'ar' ? 'رجوع' : 'Back'}</span>
          </button>
          <h1 className="text-xl font-semibold tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-600 bg-clip-text text-transparent drop-shadow">
            {language === 'ar' ? 'بانتظار الآخرين' : 'Waiting for others'}
          </h1>
        </div>
      </div>

      <div className="glass-hero p-5 rounded-xl space-y-6 relative z-10 bg-white/60 dark:bg-gray-900/35">
        <p className="text-muted-foreground">
          {language === 'ar'
            ? 'بانتظار انضمام اللاعبين… شارك رمز اللعبة مع أصدقائك.'
            : 'Waiting for players to join… Share the game code with your friends.'}
        </p>

        {(gameTitle || hostName) && (
          <div className="rounded-lg border p-4 bg-card/40">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {gameTitle && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">{language === 'ar' ? 'عنوان اللعبة' : 'Game title'}</div>
                  <div className="font-medium">{gameTitle}</div>
                </div>
              )}
              {hostName && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">{language === 'ar' ? 'المضيف' : 'Host'}</div>
                  <div className="font-medium">{hostName}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="wg-code">{language === 'ar' ? 'رمز اللعبة' : 'Game code'}</Label>
          <div className="flex gap-2">
            <Input id="wg-code" value={gameCode} readOnly />
            <Button type="button" variant="outline" onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" />
              {copied ? (language === 'ar' ? 'نُسخ' : 'Copied') : (language === 'ar' ? 'نسخ' : 'Copy')}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border p-4 bg-card/50">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">{language === 'ar' ? 'اللاعبون' : 'Players'}</h2>
            <Badge variant="secondary" className="rounded-full">
              {playersCount}/{maxPlayers}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{language === 'ar' ? 'سيظهر اللاعبون هنا عند الانضمام.' : 'Players will appear here as they join.'}</p>
        </div>

        {isHost && (
          <div className="pt-2 flex items-center justify-end">
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={playersCount < 2}
              title={playersCount < 2 ? (language === 'ar' ? 'يتطلب لاعبين على الأقل' : 'Requires at least 2 players') : undefined}
            >
              {language === 'ar' ? 'ابدأ اللعبة الآن' : 'Start game now'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
