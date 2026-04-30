import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircleMore } from 'lucide-react';

export type PresetGameMessageKey = 'good_luck' | 'nice_move' | 'your_turn' | 'good_game' | 'gotta_go';
export type GameMessageKey = PresetGameMessageKey | 'custom';

interface ChatMessageLike {
  id: string;
  user_id: string;
  message_key: GameMessageKey;
  custom_text?: string | null;
  created_at: string;
}

interface Props<T extends ChatMessageLike> {
  language: string;
  currentUserId?: string;
  messages: T[];
  sendingValue: PresetGameMessageKey | null;
  disabled?: boolean;
  onSendPreset: (messageKey: PresetGameMessageKey) => void;
  getSenderName: (userId: string) => string;
}

const PRESET_KEYS: PresetGameMessageKey[] = ['good_luck', 'nice_move', 'your_turn', 'good_game', 'gotta_go'];

export function MultiplayerQuickChat<T extends ChatMessageLike>({
  language,
  currentUserId,
  messages,
  sendingValue,
  disabled = false,
  onSendPreset,
  getSenderName,
}: Props<T>) {
  const isAr = language === 'ar';

  const labels: Record<PresetGameMessageKey, string> = {
    good_luck: isAr ? 'حظاً موفقاً' : 'Good luck',
    nice_move: isAr ? 'حركة جميلة' : 'Nice move',
    your_turn: isAr ? 'دورك' : 'Your turn',
    good_game: isAr ? 'لعبة جميلة' : 'Good game',
    gotta_go: isAr ? 'لازم أمشي' : 'I gotta go',
  };

  const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;

  const latestMessageText = latestMessage
    ? latestMessage.message_key === 'custom'
      ? latestMessage.custom_text || ''
      : labels[latestMessage.message_key]
    : null;

  const latestMessageIsMine = latestMessage?.user_id === currentUserId;

  const latestSenderName = latestMessage
    ? getSenderName(latestMessage.user_id)
    : null;

  return (
    <div className="space-y-2 rounded-2xl border border-[#E9CEB0]/40 bg-gradient-to-br from-white via-[#fbfdff] to-[#eef7ff] p-2.5 shadow-[0_8px_24px_rgba(6,5,65,0.12)] dark:border-white/10 dark:bg-gradient-to-br dark:from-[#161824] dark:to-[#0f1118] dark:shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
      <div className="flex items-start gap-2">
        <div className="flex items-center gap-2 pt-1 text-sm font-medium text-[#060541] dark:text-white/90">
          <MessageCircleMore className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
          <span>{isAr ? 'رسائل سريعة' : 'Quick chat'}</span>
        </div>

        <div className="min-w-0 flex-1 rounded-xl border border-[#060541]/10 bg-white/80 px-2.5 py-2 dark:border-white/8 dark:bg-black/10">
          {!latestMessage ? (
            <div className="truncate text-[11px] text-[#060541]/55 dark:text-white/55">
              {isAr ? 'لا توجد رسائل بعد. اضغط على رد سريع.' : 'No messages yet. Tap a quick reply.'}
            </div>
          ) : (
            <div className={`flex min-w-0 items-center gap-2 ${latestMessageIsMine ? 'justify-end text-right' : 'justify-start text-left'}`}>
              {!latestMessageIsMine && (
                <span className="max-w-[35%] truncate text-[10px] text-[#060541]/55 dark:text-white/55">
                  {latestSenderName}
                </span>
              )}
              <div className={`min-w-0 max-w-[75%] truncate rounded-full px-2.5 py-1 text-[11px] ${latestMessageIsMine ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_6px_18px_rgba(37,99,235,0.28)]' : 'border border-[#060541]/10 bg-white text-[#060541]/90 shadow-[0_4px_12px_rgba(6,5,65,0.08)] dark:border-white/10 dark:bg-slate-900/70 dark:text-white/90'}`}>
                {latestMessageText}
              </div>
              {latestMessageIsMine && (
                <span className="max-w-[35%] truncate text-[10px] text-[#060541]/55 dark:text-white/55">
                  {latestSenderName}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-hide pb-0.5">
        <div className="flex min-w-max flex-nowrap gap-1.5">
          {PRESET_KEYS.map((key) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              disabled={disabled || sendingValue !== null}
              onClick={() => onSendPreset(key)}
              className={`min-h-[30px] whitespace-nowrap rounded-full border-[#060541]/10 bg-white px-2.5 text-[11px] text-[#060541]/85 shadow-[0_4px_12px_rgba(6,5,65,0.06)] hover:bg-[#eef7ff] dark:border-white/10 dark:bg-slate-800/70 dark:text-white/85 dark:hover:bg-slate-700/80 ${sendingValue === key ? 'opacity-70' : ''}`}
            >
              {labels[key]}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
