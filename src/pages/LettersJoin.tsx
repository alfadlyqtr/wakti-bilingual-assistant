// @ts-nocheck
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import LettersBackdrop from '@/components/letters/LettersBackdrop';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function LettersJoin() {
  const { language } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [startedHost, setStartedHost] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function handleJoin() {
    const digits = code.trim().toUpperCase().replace(/^W?/, '').replace(/\D/g, '').slice(0, 6);
    const clean = digits.length === 6 ? ('W' + digits) : '';
    if (!/^W\d{6}$/.test(clean)) return;
    if (!user?.id) {
      setErrorMessage(language === 'ar' ? 'يجب تسجيل الدخول للانضمام إلى لعبة الحروف.' : 'You need to be logged in to join a Letters game.');
      return;
    }
    const displayName = (user?.user_metadata?.full_name
      || user?.user_metadata?.display_name
      || user?.user_metadata?.username
      || user?.email?.split('@')[0]
      || (language === 'ar' ? 'لاعب' : 'Player')) as string;
    setErrorMessage(null);
    setJoining(true);
    try {
      // Check if the game has already started BEFORE joining
      const { data, error } = await supabase
        .from('letters_games')
        .select('started_at, host_name, phase')
        .eq('code', clean)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setErrorMessage(language === 'ar' ? 'لم يتم العثور على هذه اللعبة.' : 'This game could not be found.');
        return;
      }
      if (data.started_at || data.phase === 'countdown' || data.phase === 'playing' || data.phase === 'scoring' || data.phase === 'done') {
        setStartedHost(data.host_name || (language === 'ar' ? 'المضيف' : 'Host'));
        return; // do not insert player; do not navigate
      }
      // Safe to join
      const { error: joinError } = await supabase.from('letters_players').upsert({
        game_code: clean,
        user_id: user.id,
        name: displayName,
      });
      if (joinError) throw joinError;
      navigate('/games/letters/waiting', { state: { isHost: false, gameCode: clean } });
    } catch (error: any) {
      setErrorMessage(error?.message || (language === 'ar' ? 'تعذر الانضمام إلى اللعبة الآن.' : 'Could not join the game right now.'));
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="container mx-auto p-3 max-w-3xl relative min-h-[100dvh]">
      <LettersBackdrop density={60} />

      <div className="glass-hero p-5 rounded-xl space-y-5 relative z-10 bg-white/60 dark:bg-gray-900/35">
        {startedHost && (
          <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 px-4 py-2">
            {language === 'ar'
              ? `تم بدء اللعبة بالفعل بواسطة ${startedHost}`
              : `Game already started by ${startedHost}`}
          </div>
        )}
        {errorMessage && (
          <div className="rounded-md border border-rose-200 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200 px-4 py-2">
            {errorMessage}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/games')}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 bg-card text-foreground hover:bg-accent transition shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">{language === 'ar' ? 'رجوع' : 'Back'}</span>
            </button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="join-code">{language === 'ar' ? 'رمز اللعبة' : 'Game code'}</Label>
            <Input
              id="join-code"
              value={code}
              onChange={(e) => { const raw=e.target.value.toUpperCase(); const digits=raw.replace(/^W?/, '').replace(/\D/g,'').slice(0,6); setCode(digits ? ('W'+digits) : ''); }}
              placeholder={language === 'ar' ? 'اكتب رمز اللعبة (مثال: W123456)' : 'Enter game code (e.g., W123456)'}
            />
          </div>
          <div className="pt-2">
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleJoin} disabled={!!startedHost || joining}>
              {joining ? (language === 'ar' ? 'جارٍ الانضمام...' : 'Joining...') : (language === 'ar' ? 'انضم' : 'Join')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
