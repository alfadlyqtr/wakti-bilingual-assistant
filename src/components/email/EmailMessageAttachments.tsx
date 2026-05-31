import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Paperclip } from 'lucide-react';
import { EmailMessageAttachment, formatAttachmentSize } from '@/utils/emailAttachmentDownload';

interface EmailMessageAttachmentsProps {
  attachments?: EmailMessageAttachment[];
  downloadingId?: string | null;
  language?: string;
  onDownload: (attachment: EmailMessageAttachment) => void | Promise<void>;
}

export function EmailMessageAttachments({
  attachments = [],
  downloadingId = null,
  language = 'en',
  onDownload,
}: EmailMessageAttachmentsProps) {
  if (!attachments.length) return null;

  const title = language === 'ar' ? 'المرفقات' : 'Attachments';
  const inlineLabel = language === 'ar' ? 'مضمن' : 'Inline';
  const downloadLabel = language === 'ar' ? 'تنزيل' : 'Download';

  return (
    <div className="mt-4 rounded-2xl border border-[#060541]/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,249,255,0.96))] p-3 shadow-[0_8px_24px_rgba(6,5,65,0.05)] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(18,22,31,0.92),rgba(11,14,21,0.9))] dark:shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Paperclip className="h-4 w-4" />
        <span>{title}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {attachments.map((attachment) => {
          const sizeLabel = formatAttachmentSize(attachment.size);
          const meta = [attachment.contentType || '', sizeLabel, attachment.inline ? inlineLabel : '']
            .filter(Boolean)
            .join(' · ');

          return (
            <div
              key={attachment.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[#060541]/10 bg-white/75 px-3 py-2 dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.88))]"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{attachment.name || 'attachment'}</div>
                {meta ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</div> : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onDownload(attachment)}
                disabled={downloadingId === attachment.id}
                className="shrink-0 gap-1.5 rounded-xl border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.96))] text-[#060541] hover:bg-[#eef2ff] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:text-foreground"
              >
                {downloadingId === attachment.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {downloadLabel}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
