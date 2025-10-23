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

  async function handleJoin() {
    const clean = code.trim().toUpperCase();
    if (clean.length < 6) return;
    const displayName = (user?.user_metadata?.full_name
      || user?.user_metadata?.display_name
      || user?.user_metadata?.username
      || user?.email?.split('@')[0]
      || (language === 'ar' ? 'لاعب' : 'Player')) as string;
    try {
      // Check if the game has already started BEFORE joining
      const { data } = await supabase
        .from('letters_games')
        .select('started_at, host_name')
        .eq('code', clean)
        .maybeSingle();
      if (data && data.started_at) {
        setStartedHost(data.host_name || (language === 'ar' ? 'المضيف' : 'Host'));
        return; // do not insert player; do not navigate
      }
      // Safe to join
      await supabase.from('letters_players').upsert({
        game_code: clean,
        user_id: user?.id || null,
        name: displayName,
      });
    } catch {}
    navigate('/games/letters/waiting', { state: { isHost: false, gameCode: clean } });
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
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={language === 'ar' ? 'اكتب رمز اللعبة (مثال: WABCDE)' : 'Enter game code (e.g., WABCDE)'}
            />
          </div>
          <div className="pt-2">
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleJoin} disabled={!!startedHost}>
              {language === 'ar' ? 'انضم' : 'Join'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
