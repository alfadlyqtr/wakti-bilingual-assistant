import React, { useCallback, useEffect, useState } from 'react';
import { useGmailMessages } from '@/hooks/useGmailMessages';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MailComposer, MailComposerPreset, MailComposerSubmitInput } from '@/components/email/MailComposer';
import { Send, Pencil } from 'lucide-react';

function GmailIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

interface GmailClientProps {
  connected: boolean;
  emailAddress?: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  language?: string;
  operatorPreset?: MailComposerPreset | null;
  onOperatorPresetConsumed?: () => void;
}

export function GmailClient({ connected, emailAddress, onConnect, onDisconnect, language = 'en', operatorPreset = null, onOperatorPresetConsumed }: GmailClientProps) {
  const gmail = useGmailMessages();
  const [showCompose, setShowCompose] = useState(false);
  const [activePreset, setActivePreset] = useState<MailComposerPreset | null>(operatorPreset);
  const connectedLabel = language === 'ar' ? 'متصل' : 'Connected';
  const mailboxLine = emailAddress ? `${language === 'ar' ? 'الحساب' : 'Account'}: ${emailAddress}` : 'Gmail account';
  const surfaceCardClass = 'rounded-[24px] border border-[#060541]/15 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(245,247,255,0.97))] p-3 text-[#060541] shadow-[0_16px_36px_rgba(6,5,65,0.08)] ring-1 ring-[#060541]/5 sm:p-4 dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(16,20,29,0.98),rgba(10,12,18,0.96))] dark:text-card-foreground dark:shadow-[0_18px_36px_rgba(0,0,0,0.4)] dark:ring-1 dark:ring-white/5';
  const chipClass = 'rounded-full border border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.98))] px-3 py-1 text-[11px] shadow-[0_4px_12px_rgba(6,5,65,0.05)] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]';

  useEffect(() => {
    if (!connected) {
      setShowCompose(false);
      setActivePreset(null);
    }
  }, [connected]);

  useEffect(() => {
    if (!operatorPreset) return;
    setActivePreset(operatorPreset);
    setShowCompose(true);
    onOperatorPresetConsumed?.();
  }, [onOperatorPresetConsumed, operatorPreset]);

  const handleCloseCompose = () => {
    setShowCompose(false);
    setActivePreset(null);
  };

  const handleSend = async (input: MailComposerSubmitInput) => {
    const ok = await gmail.sendMessage(input);
    if (!ok) return false;
    handleCloseCompose();
    return ok;
  };
  const handleOpenComposer = useCallback(() => {
    setActivePreset(null);
    setShowCompose(true);
  }, []);

  const disconnectedTitle = language === 'ar' ? 'Gmail غير متصل' : 'Gmail not connected';
  const disconnectedDescription = language === 'ar'
    ? 'اربط Gmail لكتابة الرسائل داخل وقتي ثم مراجعتها وإرسالها بسرعة.'
    : 'Connect Gmail to draft, review, and send faster inside Wakti.';
  const sendOnlyTitle = language === 'ar' ? 'إرسال Gmail فقط' : 'Gmail send only';
  const sendOnlyDescription = language === 'ar'
    ? 'اكتب داخل وقتي ثم راجع الرسالة وأرسلها من Gmail. لا نقرأ صندوق البريد.'
    : 'Write in Wakti, review the draft, then send with Gmail. No inbox reading.';
  const openComposerLabel = language === 'ar' ? 'اكتب رسالة' : 'Write email';
  const disconnectLabel = language === 'ar' ? 'فصل Gmail' : 'Disconnect Gmail';
  const connectedDescription = language === 'ar'
    ? 'اكتب وراجع وأرسل بسرعة باستخدام Gmail.'
    : 'Write, review, and send faster with Gmail.';
  const journeySteps = language === 'ar'
    ? ['1. اربط Gmail', '2. اكتب داخل وقتي', '3. راجع ثم أرسل']
    : ['1. Connect Gmail', '2. Draft in Wakti', '3. Review and send'];

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="rounded-full border border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.96))] p-4 shadow-[0_10px_24px_rgba(6,5,65,0.06)] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
          <GmailIcon size={32} />
        </div>
        <div className="max-w-md space-y-2">
          <div className="text-base font-semibold">{disconnectedTitle}</div>
          <div className="text-sm text-muted-foreground">{disconnectedDescription}</div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {journeySteps.map((step) => (
            <div key={step} className={`${chipClass} text-muted-foreground`}>
              {step}
            </div>
          ))}
        </div>
        <Button onClick={onConnect} className="bg-[#060541] hover:bg-[#0a0a5c] text-white gap-2">
          <GmailIcon size={14} />
          {language === 'ar' ? 'ربط Gmail' : 'Connect Gmail'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={surfaceCardClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.96))] shadow-[0_4px_12px_rgba(6,5,65,0.05)] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
                <GmailIcon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                  <span className="block max-w-full truncate text-base font-semibold text-foreground">{emailAddress || 'Gmail'}</span>
                  <Badge className="bg-green-600 text-white hover:bg-green-600 text-[10px] px-1.5 py-0">{connectedLabel}</Badge>
                </div>
                <div className="mt-1 max-w-full truncate text-xs text-muted-foreground">{mailboxLine}</div>
                <div className="mt-2 text-sm text-muted-foreground">{connectedDescription}</div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {emailAddress ? (
                <div className={`${chipClass} max-w-full text-muted-foreground`}>
                  <span className="block max-w-[220px] truncate sm:max-w-[280px]">{emailAddress}</span>
                </div>
              ) : null}
              <div className={`${chipClass} text-foreground/80`}>
                {sendOnlyTitle}
              </div>
            </div>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
            <Button
              size="sm"
              onClick={handleOpenComposer}
              className="h-10 flex-1 rounded-xl bg-blue-600 px-4 text-white hover:bg-blue-700 gap-1.5 sm:flex-none"
            >
              <Pencil className="h-3.5 w-3.5" />
              {openComposerLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDisconnect}
              className="h-10 rounded-xl border-[#060541]/16 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.96))] text-[#060541] shadow-[0_4px_12px_rgba(6,5,65,0.06)] hover:bg-[#f3f5ff] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:text-foreground dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)] dark:hover:!bg-[linear-gradient(180deg,rgba(26,31,43,0.96),rgba(14,17,24,0.94))]"
            >
              {disconnectLabel}
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-[360px] overflow-hidden rounded-[24px] border border-[#060541]/15 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(246,248,255,0.98))] text-[#060541] shadow-[0_16px_36px_rgba(6,5,65,0.08)] ring-1 ring-[#060541]/5 dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(16,20,29,0.98),rgba(10,12,18,0.96))] dark:text-card-foreground dark:shadow-[0_18px_36px_rgba(0,0,0,0.4)] dark:ring-1 dark:ring-white/5">
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-10 text-center sm:px-10">
          <div className="rounded-full border border-blue-500/20 bg-blue-50 p-4 text-blue-600 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
            <Send className="h-7 w-7" />
          </div>
          <div className="space-y-2 max-w-xl">
            <div className="text-lg font-semibold text-foreground">{sendOnlyTitle}</div>
            <p className="text-sm leading-6 text-muted-foreground">{sendOnlyDescription}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {journeySteps.map((step) => (
              <div key={step} className={`${chipClass} text-muted-foreground`}>
                {step}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              size="sm"
              onClick={handleOpenComposer}
              className="rounded-xl bg-blue-600 px-4 text-white hover:bg-blue-700 gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />
              {openComposerLabel}
            </Button>
            <div className={`${chipClass} text-muted-foreground`}>
              {language === 'ar' ? 'بدون صندوق بريد أو قراءة' : 'No inbox or mailbox reading'}
            </div>
          </div>
        </div>
      </div>

      {showCompose && (
        <MailComposer
          onClose={handleCloseCompose}
          onSend={handleSend}
          fromLabel={emailAddress || 'Gmail'}
          preset={activePreset}
        />
      )}
    </div>
  );
}
