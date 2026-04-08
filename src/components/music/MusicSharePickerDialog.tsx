import { useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/providers/ThemeProvider';
import { getMutualMusicShareRecipients, MusicShareRecipient, sendMusicTrackShare } from '@/services/musicShareService';
import { Music2, Search, Send, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type ShareTrackTarget = {
  id: string;
  title: string;
  coverUrl: string | null;
};

interface MusicSharePickerDialogProps {
  isOpen: boolean;
  track: ShareTrackTarget | null;
  onClose: () => void;
  onSent?: () => void;
}

export function MusicSharePickerDialog({ isOpen, track, onClose, onSent }: MusicSharePickerDialogProps) {
  const { language } = useTheme();
  const isAr = language === 'ar';
  const [contacts, setContacts] = useState<MusicShareRecipient[]>([]);
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
    getMutualMusicShareRecipients()
      .then((rows) => {
        if (active) setContacts(rows);
      })
      .catch((error) => {
        console.error('[MusicSharePickerDialog] load error:', error);
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

  const handleSend = async (recipient: MusicShareRecipient) => {
    if (!track || sendingId) return;
    setSendingId(recipient.id);
    try {
      await sendMusicTrackShare({ recipientId: recipient.id, trackId: track.id });
      toast.success(isAr ? `تم إرسال ${track.title} إلى ${recipient.displayName}` : `${track.title} sent to ${recipient.displayName}`);
      onSent?.();
      onClose();
    } catch (error: any) {
      console.error('[MusicSharePickerDialog] send error:', error);
      toast.error((isAr ? 'فشل إرسال المقطع' : 'Failed to send track') + (error?.message ? `: ${error.message}` : ''));
    } finally {
      setSendingId(null);
    }
  };

  if (!isOpen || !track) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/65 backdrop-blur-md" onClick={onClose} aria-label={isAr ? 'إغلاق' : 'Close'} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[1.8rem] border border-fuchsia-400/20 bg-[linear-gradient(135deg,#0c0f14_0%,rgba(35,19,52,0.98)_45%,rgba(20,31,54,0.98)_100%)] text-white shadow-[0_20px_60px_rgba(0,0,0,0.55),0_0_40px_rgba(168,85,247,0.18)]">
        <div className="relative overflow-hidden border-b border-white/10 px-5 pb-4 pt-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(217,70,239,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.18),transparent_35%)]" />
          <button type="button" onClick={onClose} aria-label={isAr ? 'إغلاق' : 'Close'} className="absolute right-3 top-3 z-10 rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
          <div className="relative z-10 flex items-center gap-3">
            <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              {track.coverUrl ? (
                <img src={track.coverUrl} alt={track.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-fuchsia-500/20 to-sky-500/20">
                  <Music2 className="h-7 w-7 text-fuchsia-200" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 inline-flex items-center gap-1 rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-200">
                <Send className="h-3 w-3" />
                {isAr ? 'مشاركة وقتي' : 'Wakti Share'}
              </div>
              <h2 className="truncate text-lg font-extrabold">{track.title}</h2>
              <p className="mt-1 text-sm text-white/75">
                {isAr ? 'أرسل هذا المقطع مباشرة إلى جهات اتصالك المشتركة.' : 'Send this track directly to your mutual Wakti contacts.'}
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
            {isAr ? 'سيظهر للطرف الآخر إشعار جميل داخل التطبيق. إذا قبل، سيتم حفظ المقطع في تبويب الموسيقى المحفوظة.' : 'The other person will receive an in-app popup. If they accept, the track will be saved in their Saved Music tab.'}
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
                {isAr ? 'لا توجد جهات اتصال مشتركة متاحة للمشاركة حالياً.' : 'No mutual contacts available to share with right now.'}
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <div key={contact.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                  <Avatar className="h-11 w-11 border border-white/10">
                    <AvatarImage src={contact.avatarUrl} alt={contact.displayName} />
                    <AvatarFallback className="bg-gradient-to-br from-fuchsia-500/70 to-sky-500/70 text-white">
                      {(contact.displayName || contact.username).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{contact.displayName}</p>
                    <p className="truncate text-xs text-white/55">@{contact.username}</p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleSend(contact)}
                    disabled={sendingId === contact.id}
                    className="bg-gradient-to-r from-fuchsia-500 via-purple-500 to-sky-500 text-white shadow-[0_10px_24px_rgba(168,85,247,0.35)] hover:opacity-95"
                  >
                    {sendingId === contact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? 'إرسال' : 'Send')}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
