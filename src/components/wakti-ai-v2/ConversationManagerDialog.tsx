import React, { useEffect, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Bookmark, Trash2 } from 'lucide-react';
import { normalizeConversationTitle } from '@/services/SavedConversationsService';

interface ManagedConversation {
  id: string;
  title: string;
  is_saved?: boolean;
}

interface ConversationManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ManagedConversation | null;
  onSave: (id: string, updates: { title: string; is_saved: boolean }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ConversationManagerDialog({
  open,
  onOpenChange,
  conversation,
  onSave,
  onDelete,
}: ConversationManagerDialogProps) {
  const { language } = useTheme();
  const [title, setTitle] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!conversation) {
      setTitle('');
      setIsSaved(false);
      return;
    }

    setTitle(normalizeConversationTitle(conversation.title || '', 'Conversation'));
    setIsSaved(conversation.is_saved === true);
  }, [conversation]);

  const copy = {
    title: language === 'ar' ? 'إدارة المحادثة' : 'Manage conversation',
    body: language === 'ar'
      ? 'عدّل اسم المحادثة واحمِها من الحذف التلقائي.'
      : 'Rename the chat and protect it from auto-removal.',
    name: language === 'ar' ? 'اسم المحادثة' : 'Chat name',
    nameHint: language === 'ar' ? 'كلمتان كحد أقصى' : '2 words maximum',
    protect: language === 'ar' ? 'حفظ وحماية هذه المحادثة' : 'Save and protect this chat',
    protectHint: language === 'ar'
      ? 'المحادثات المحفوظة لا تُستبدل تلقائياً عندما تمتلئ القائمة.'
      : 'Saved chats are never auto-replaced when the list is full.',
    cancel: language === 'ar' ? 'إلغاء' : 'Cancel',
    save: language === 'ar' ? 'حفظ التغييرات' : 'Save changes',
    deleting: language === 'ar' ? 'جارٍ الحذف...' : 'Deleting...',
    delete: language === 'ar' ? 'حذف المحادثة' : 'Delete chat',
  };

  const handleSave = async () => {
    const normalizedTitle = normalizeConversationTitle(title, 'Conversation');
    if (!conversation || !normalizedTitle.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave(conversation.id, {
        title: normalizedTitle,
        is_saved: isSaved,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!conversation) return;
    setIsDeleting(true);
    try {
      await onDelete(conversation.id);
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[12020]"
        className="z-[12030] max-w-md rounded-3xl border-[rgba(233,206,176,0.9)] bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(252,254,253,0.99)_48%,rgba(248,244,236,0.98)_100%)] p-5 shadow-[0_20px_44px_rgba(6,5,65,0.14)]"
        title={copy.title}
        description={copy.body}
      >
        <DialogHeader className="text-left">
          <DialogTitle className="text-[hsl(243_84%_14%)]">{copy.title}</DialogTitle>
          <DialogDescription className="text-[hsl(243_20%_34%)]">{copy.body}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="conversation-title" className="text-[hsl(243_84%_14%)]">{copy.name}</Label>
            <Input
              id="conversation-title"
              value={title}
              onChange={(event) => setTitle(normalizeConversationTitle(event.target.value, ''))}
              placeholder={language === 'ar' ? 'مثال: أجهزة كمبيوتر' : 'Example: PC Build'}
              className="border-[rgba(6,5,65,0.1)] bg-white text-[hsl(243_84%_14%)]"
            />
            <p className="text-xs text-[hsl(243_20%_34%)]">{copy.nameHint}</p>
          </div>

          <div className="rounded-2xl border border-[rgba(233,206,176,0.95)] bg-white/90 p-3 shadow-[0_8px_20px_rgba(6,5,65,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[hsl(243_84%_14%)]">
                  <Bookmark className="h-4 w-4" />
                  {copy.protect}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[hsl(243_20%_34%)]">{copy.protectHint}</p>
              </div>
              <Switch checked={isSaved} onCheckedChange={setIsSaved} />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2 gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleDelete}
            disabled={isDeleting || isSubmitting}
            className="border-red-200 bg-white text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? copy.deleting : copy.delete}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting || isDeleting}>
              {copy.cancel}
            </Button>
            <Button type="button" onClick={handleSave} disabled={!title.trim() || isSubmitting || isDeleting}>
              {copy.save}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
