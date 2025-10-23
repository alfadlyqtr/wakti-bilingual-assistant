import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import LettersBackdrop from '@/components/letters/LettersBackdrop';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';

export default function LettersJoin() {
  const { language } = useTheme();
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  function handleJoin() {
    // Placeholder: navigate to waiting page passing state (not host)
    navigate('/games/letters/waiting', { state: { isHost: false, gameCode: code } });
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
            {language === 'ar' ? 'انضمام إلى لعبة مشتركة' : 'Join shared game'}
          </h1>
        </div>
      </div>

      <div className="glass-hero p-5 rounded-xl space-y-5 relative z-10 bg-white/60 dark:bg-gray-900/35">
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
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleJoin} disabled={code.trim().length < 6}>
            {language === 'ar' ? 'انضمام' : 'Join'}
          </Button>
        </div>
      </div>
    </div>
  );
}
