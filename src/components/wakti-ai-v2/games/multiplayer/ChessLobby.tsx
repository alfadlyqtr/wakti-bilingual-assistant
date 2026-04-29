import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { ChessMultiplayerService, ChessSide } from '@/services/ChessMultiplayerService';

interface Props {
  onEnterGame: (code: string) => void;
  onCancel: () => void;
}

export function ChessLobby({ onEnterGame, onCancel }: Props) {
  const { language } = useTheme();
  const { user } = useAuth();
  const isAr = language === 'ar';

  const defaultName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.username as string | undefined) ||
    user?.email?.split('@')[0] ||
    (isAr ? 'لاعب' : 'Player');

  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [name, setName] = useState(defaultName);
  const [color, setColor] = useState<ChessSide>('white');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!user?.id) {
      toast.error(isAr ? 'يرجى تسجيل الدخول' : 'Please sign in');
      return;
    }
    setBusy(true);
    try {
      const newCode = await ChessMultiplayerService.createGame(name.trim() || defaultName, color);
      onEnterGame(newCode);
    } catch (e: any) {
      toast.error(e?.message || (isAr ? 'تعذر إنشاء اللعبة' : 'Could not create game'));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!user?.id) {
      toast.error(isAr ? 'يرجى تسجيل الدخول' : 'Please sign in');
      return;
    }
    const clean = code.trim().toUpperCase();
    if (clean.length !== 4) {
      toast.error(isAr ? 'الرمز يجب أن يكون 4 أحرف' : 'Code must be 4 characters');
      return;
    }
    setBusy(true);
    try {
      await ChessMultiplayerService.joinGame(clean, name.trim() || defaultName);
      onEnterGame(clean);
    } catch (e: any) {
      toast.error(e?.message || (isAr ? 'تعذر الانضمام' : 'Could not join'));
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'menu') {
    return (
      <div className="space-y-4 max-w-sm mx-auto">
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          {isAr ? 'العب الشطرنج مع صديق عبر رمز قصير' : 'Play chess with a friend using a short code'}
        </p>
        <Button onClick={() => setMode('create')} className="w-full min-h-[48px]">
          {isAr ? 'إنشاء لعبة' : 'Create game'}
        </Button>
        <Button onClick={() => setMode('join')} variant="outline" className="w-full min-h-[48px]">
          {isAr ? 'الانضمام برمز' : 'Join with code'}
        </Button>
        <Button onClick={onCancel} variant="ghost" className="w-full min-h-[40px] text-xs">
          {isAr ? 'رجوع' : 'Back'}
        </Button>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="space-y-4 max-w-sm mx-auto">
        <div>
          <Label className="text-xs">{isAr ? 'اسمك' : 'Your name'}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
        </div>
        <div>
          <Label className="text-xs mb-1 block">{isAr ? 'اختر لونك' : 'Choose your color'}</Label>
          <div className="flex gap-2">
            <Button
              variant={color === 'white' ? 'default' : 'outline'}
              onClick={() => setColor('white')}
              className="flex-1 min-h-[44px]"
            >
              ⚪ {isAr ? 'أبيض' : 'White'}
            </Button>
            <Button
              variant={color === 'black' ? 'default' : 'outline'}
              onClick={() => setColor('black')}
              className="flex-1 min-h-[44px]"
            >
              ⚫ {isAr ? 'أسود' : 'Black'}
            </Button>
          </div>
        </div>
        <Button onClick={handleCreate} disabled={busy} className="w-full min-h-[48px]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? 'إنشاء ومشاركة الرمز' : 'Create & share code')}
        </Button>
        <Button onClick={() => setMode('menu')} variant="ghost" className="w-full min-h-[40px] text-xs">
          {isAr ? 'رجوع' : 'Back'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-sm mx-auto">
      <div>
        <Label className="text-xs">{isAr ? 'اسمك' : 'Your name'}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
      </div>
      <div>
        <Label className="text-xs">{isAr ? 'رمز اللعبة' : 'Game code'}</Label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
          placeholder="ABCD"
          className="font-mono tracking-widest text-center text-lg"
          maxLength={4}
        />
      </div>
      <Button onClick={handleJoin} disabled={busy || code.length !== 4} className="w-full min-h-[48px]">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? 'انضمام' : 'Join')}
      </Button>
      <Button onClick={() => setMode('menu')} variant="ghost" className="w-full min-h-[40px] text-xs">
        {isAr ? 'رجوع' : 'Back'}
      </Button>
    </div>
  );
}
