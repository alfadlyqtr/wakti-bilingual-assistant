import { useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/providers/ThemeProvider';
import {
  GameInviteRecipient,
  GameInviteType,
  getMutualGameInviteRecipients,
  sendGameInvite,
} from '@/services/gameInviteService';
import { Loader2, Search, Send, Shield, X, Grid3x3 } from 'lucide-react';
import { toast } from 'sonner';
import { Logo3D } from '@/components/Logo3D';

interface GameInvitePickerDialogProps {
  isOpen: boolean;
  gameType: GameInviteType;
  gameCode: string | null;
  onClose: () => void;
  onSent?: () => void;
}

export function GameInvitePickerDialog({
  isOpen,
  gameType,
  gameCode,
  onClose,
  onSent,
}: GameInvitePickerDialogProps) {
  const { language } = useTheme();
  const isAr = language === 'ar';
  const [contacts, setContacts] = useState<GameInviteRecipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }

    let active = true;
    setLoading(true);
    getMutualGameInviteRecipients()
      .then((rows) => {
        if (active) setContacts(rows);
      })
      .catch((error) => {
        console.error('[GameInvitePickerDialog] load error:', error);
        toast.error(isAr ? 'فشل تحميل جهات الاتصال' : 'Failed to load contacts');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAr, isOpen]);

  const filteredContacts = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return contacts;
    return contacts.filter((contact) => {
      const haystack = `${contact.displayName} ${contact.username}`.toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [contacts, query]);

  const gameTitle = gameType === 'chess'
    ? (isAr ? 'الشطرنج' : 'Chess')
    : (isAr ? 'إكس-أو' : 'Tic-Tac-Toe');

  const AccentIcon = gameType === 'chess' ? Shield : Grid3x3;

  const handleSend = async (recipient: GameInviteRecipient) => {
    if (!gameCode || sendingId) return;
    setSendingId(recipient.id);
    try {
      await sendGameInvite({ recipientId: recipient.id, gameType, gameCode });
      toast.success(
        isAr
          ? `تم إرسال دعوة ${gameTitle} إلى ${recipient.displayName}`
          : `${gameTitle} invite sent to ${recipient.displayName}`,
      );
      onSent?.();
      onClose();
    } catch (error: any) {
      console.error('[GameInvitePickerDialog] send error:', error);
      toast.error((isAr ? 'فشل إرسال الدعوة' : 'Failed to send invite') + (error?.message ? `: ${error.message}` : ''));
    } finally {
      setSendingId(null);
    }
  };

  if (!isOpen || !gameCode) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/65 backdrop-blur-md" onClick={onClose} aria-label={isAr ? 'إغلاق' : 'Close'} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[1.8rem] border border-sky-400/20 bg-[linear-gradient(135deg,#0c0f14_0%,rgba(17,30,52,0.98)_45%,rgba(8,38,51,0.98)_100%)] text-white shadow-[0_20px_60px_rgba(0,0,0,0.55),0_0_40px_rgba(37,99,235,0.16)]">
        <div className="relative overflow-hidden border-b border-white/10 px-5 pb-4 pt-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.24),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.20),transparent_35%)]" />
          <button type="button" onClick={onClose} aria-label={isAr ? 'إغلاق' : 'Close'} className="absolute right-3 top-3 z-10 rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              <Logo3D size="sm" className="h-12 w-12 cursor-default hover:scale-100" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 inline-flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200">
                <Send className="h-3 w-3" />
                {isAr ? 'دعوة وقتي' : 'Wakti Invite'}
              </div>
              <h2 className="truncate text-lg font-extrabold">{gameTitle}</h2>
              <p className="mt-1 text-sm text-white/75">
                {isAr ? 'ادعُ أحد جهات اتصالك المشتركة للعب معك مباشرة.' : 'Invite one of your mutual Wakti contacts to play with you directly.'}
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
            {isAr ? 'سيتلقى الطرف الآخر نافذة دعوة جميلة داخل التطبيق. إذا قبل، سيدخل مباشرة إلى شاشة اللعبة.' : 'The other person will receive a polished in-app invite popup. If they accept, they will go straight into the game screen.'}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isAr ? 'ابحث في جهات الاتصال...' : 'Search contacts...'}
              className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/35"
            />
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-white/60">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-white/60">
                {isAr ? 'لا توجد جهات اتصال مشتركة متاحة للدعوة الآن.' : 'No mutual contacts available to invite right now.'}
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <div key={contact.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <Avatar className="h-11 w-11 border border-white/10">
                    <AvatarImage src={contact.avatarUrl} alt={contact.displayName} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500/70 to-cyan-500/70 text-white">
                      {(contact.displayName || contact.username).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{contact.displayName}</p>
                    <p className="truncate text-xs text-white/55">@{contact.username}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSend(contact)}
                    disabled={sendingId === contact.id}
                    className="inline-flex min-w-[88px] items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)] transition-opacity hover:opacity-95 disabled:opacity-70"
                  >
                    {sendingId === contact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? 'إرسال' : 'Send')}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
