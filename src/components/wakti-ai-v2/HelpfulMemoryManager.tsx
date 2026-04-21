import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { onEvent } from '@/utils/eventBus';
import {
  HelpfulMemoryCategory,
  HelpfulMemoryRecord,
  HelpfulMemoryScope,
  HelpfulMemoryService,
} from '@/services/HelpfulMemoryService';

interface HelpfulMemoryManagerProps {
  currentConversationId: string | null;
}

const emptyDraft = {
  memoryText: '',
  category: 'saved_context' as HelpfulMemoryCategory,
  scope: 'all_chats' as HelpfulMemoryScope,
};

export function HelpfulMemoryManager({ currentConversationId }: HelpfulMemoryManagerProps) {
  const { language } = useTheme();
  const { showError, showSuccess } = useToastHelper();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [helpfulMemoryEnabled, setHelpfulMemoryEnabled] = useState(true);
  const [items, setItems] = useState<HelpfulMemoryRecord[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const loadInFlightRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);

  const labels = useMemo(() => ({
    title: language === 'ar' ? 'Helpful Memory' : 'Helpful Memory',
    subtitle: language === 'ar'
      ? 'أشياء يتذكرها وقتي ليساعدك بشكل أفضل. يمكنك تعديلها أو حذفها في أي وقت.'
      : 'Things Wakti remembers to help you better. You can edit or remove them anytime.',
    intro: language === 'ar'
      ? 'وقتي يستخدم النوعين معاً تلقائياً: ما ينفع في كل المحادثات، وما يخص هذه المحادثة فقط.'
      : 'Wakti uses both kinds automatically: what helps in every chat, and what only belongs to this chat.',
    allChats: language === 'ar' ? 'كل المحادثات' : 'All Chats',
    thisChat: language === 'ar' ? 'هذه المحادثة' : 'This Chat',
    worksEverywhere: language === 'ar' ? 'يعمل في كل المحادثات' : 'Works in every chat',
    onlyThisChat: language === 'ar' ? 'يعمل فقط هنا' : 'Only in this chat',
    worksEverywhereHint: language === 'ar' ? 'للتفضيلات الثابتة، المشاريع، والأشياء المتكررة.' : 'Best for stable preferences, projects, and recurring context.',
    onlyThisChatHint: language === 'ar' ? 'يستخدم فقط داخل هذه المحادثة الحالية.' : 'Used only inside this current conversation.',
    addMemory: language === 'ar' ? 'إضافة ذاكرة' : 'Add Memory',
    editMemory: language === 'ar' ? 'تعديل الذاكرة' : 'Edit Memory',
    newMemory: language === 'ar' ? 'ذاكرة جديدة' : 'New Memory',
    save: language === 'ar' ? 'حفظ' : 'Save',
    cancel: language === 'ar' ? 'إلغاء' : 'Cancel',
    memoryPaused: language === 'ar' ? 'Helpful Memory متوقف حالياً. لن يستخدم وقتي أي ذاكرة ولن يحفظ جديدة حتى تعيده للتشغيل.' : 'Helpful Memory is paused. Wakti will not use or save memory until you turn it back on.',
    noItems: language === 'ar' ? 'لا توجد عناصر هنا بعد.' : 'Nothing saved here yet.',
    noChat: language === 'ar' ? 'افتح محادثة أولاً لحفظ ذاكرة خاصة بهذه المحادثة.' : 'Open a conversation first to save This Chat memory.',
    sourceAuto: language === 'ar' ? 'التقطها وقتي' : 'Auto-saved',
    sourceUser: language === 'ar' ? 'أضفتها أنت' : 'You added this',
    sourceConfirmed: language === 'ar' ? 'أكدتها أنت' : 'Confirmed',
    sensitive: language === 'ar' ? 'شخصية' : 'Personal',
    normal: language === 'ar' ? 'عادية' : 'Normal',
    syncing: language === 'ar' ? 'جاري التحديث...' : 'Syncing...',
    emptyAllChats: language === 'ar' ? 'لا توجد ذاكرة عامة بعد.' : 'No all-chats memory saved yet.',
    emptyThisChat: language === 'ar' ? 'لا توجد ذاكرة خاصة بهذه المحادثة بعد.' : 'No this-chat memory saved yet.',
    addHere: language === 'ar' ? 'إضافة هنا' : 'Add here',
    addEverywhere: language === 'ar' ? 'إضافة لكل المحادثات' : 'Add for all chats',
  }), [language]);

  const categoryLabel = useCallback((category: HelpfulMemoryCategory) => {
    switch (category) {
      case 'preference':
        return language === 'ar' ? 'التفضيلات' : 'Preferences';
      case 'project':
        return language === 'ar' ? 'المشاريع' : 'Projects';
      case 'goal':
        return language === 'ar' ? 'الأهداف' : 'Goals';
      default:
        return language === 'ar' ? 'سياق محفوظ' : 'Saved Context';
    }
  }, [language]);

  const allChatsItems = useMemo(() => items.filter((item) => item.scope === 'all_chats'), [items]);
  const thisChatItems = useMemo(() => {
    if (!currentConversationId) return [] as HelpfulMemoryRecord[];
    return items.filter((item) => item.scope === 'this_chat' && item.conversationId === currentConversationId);
  }, [currentConversationId, items]);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (loadInFlightRef.current) return;
    const silent = options?.silent === true;
    loadInFlightRef.current = true;
    if (silent) setIsRefreshing(true);
    else if (!hasLoadedOnceRef.current) setIsLoading(true);
    try {
      const [settings, memories] = await Promise.all([
        HelpfulMemoryService.getSettings(),
        HelpfulMemoryService.listMemories(undefined, currentConversationId)
      ]);
      setHelpfulMemoryEnabled(settings.helpfulMemoryEnabled);
      setItems(memories);
      hasLoadedOnceRef.current = true;
    } catch (error) {
      console.error('Helpful memory load failed', error);
      if (!silent) {
        showError(language === 'ar' ? 'تعذر تحميل Helpful Memory' : 'Failed to load Helpful Memory');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      loadInFlightRef.current = false;
    }
  }, [currentConversationId, language, showError]);

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    loadData();
  }, [loadData]);

  useEffect(() => {
    return onEvent('wakti-ai-stream-finished', () => {
      loadData({ silent: true }).catch(() => {});
    });
  }, [loadData]);

  const resetEditor = useCallback(() => {
    setEditorOpen(false);
    setEditingId(null);
    setDraft(emptyDraft);
  }, []);

  const handleToggle = async (next: boolean) => {
    setHelpfulMemoryEnabled(next);
    try {
      await HelpfulMemoryService.updateSettings(next);
      showSuccess(next
        ? (language === 'ar' ? 'تم تشغيل Helpful Memory' : 'Helpful Memory turned on')
        : (language === 'ar' ? 'تم إيقاف Helpful Memory' : 'Helpful Memory turned off'));
    } catch (error) {
      console.error('Helpful memory settings save failed', error);
      setHelpfulMemoryEnabled(!next);
      showError(language === 'ar' ? 'تعذر حفظ إعداد Helpful Memory' : 'Failed to save Helpful Memory setting');
    }
  };

  const handleStartAdd = (scope: HelpfulMemoryScope) => {
    setEditingId(null);
    setDraft({
      ...emptyDraft,
      scope,
    });
    setEditorOpen(true);
  };

  const handleStartEdit = (item: HelpfulMemoryRecord) => {
    setEditingId(item.id);
    setDraft({
      memoryText: item.memoryText,
      category: item.category,
      scope: item.scope,
    });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editingId) {
        await HelpfulMemoryService.updateMemory(editingId, {
          memoryText: draft.memoryText,
          category: draft.category,
          scope: draft.scope,
          conversationId: draft.scope === 'this_chat' ? currentConversationId : null,
        });
        showSuccess(language === 'ar' ? 'تم تحديث الذاكرة' : 'Memory updated');
      } else {
        await HelpfulMemoryService.saveMemory({
          memoryText: draft.memoryText,
          category: draft.category,
          scope: draft.scope,
          conversationId: draft.scope === 'this_chat' ? currentConversationId : null,
        });
        showSuccess(language === 'ar' ? 'تم حفظ الذاكرة' : 'Memory saved');
      }
      resetEditor();
      await loadData({ silent: true });
    } catch (error: any) {
      console.error('Helpful memory save failed', error);
      showError(error?.message || (language === 'ar' ? 'تعذر حفظ الذاكرة' : 'Failed to save memory'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await HelpfulMemoryService.deleteMemory(id);
      showSuccess(language === 'ar' ? 'تم حذف الذاكرة' : 'Memory deleted');
      await loadData({ silent: true });
    } catch (error) {
      console.error('Helpful memory delete failed', error);
      showError(language === 'ar' ? 'تعذر حذف الذاكرة' : 'Failed to delete memory');
    }
  };

  const renderMemoryCard = (item: HelpfulMemoryRecord) => (
    <div key={item.id} className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(12,15,20,0.92)_0%,rgba(30,41,59,0.92)_100%)] p-3 shadow-[0_6px_24px_rgba(0,0,0,0.28)]">
      <div className="text-sm leading-relaxed text-slate-100">{item.memoryText}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge className="border-transparent bg-white/10 text-[10px] text-slate-200 hover:bg-white/10">
          {categoryLabel(item.category)}
        </Badge>
        <Badge className="border-transparent bg-white/10 text-[10px] text-slate-200 hover:bg-white/10">
          {item.source === 'auto_saved' ? labels.sourceAuto : item.source === 'user_added' ? labels.sourceUser : labels.sourceConfirmed}
        </Badge>
        <Badge className={`border-transparent text-[10px] hover:opacity-100 ${item.sensitivity === 'careful' ? 'bg-amber-400/15 text-amber-100' : 'bg-emerald-400/15 text-emerald-100'}`}>
          {item.sensitivity === 'careful' ? labels.sensitive : labels.normal}
        </Badge>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => handleStartEdit(item)}
          className="h-8 rounded-xl border-white/10 bg-transparent px-3 text-xs text-slate-200 hover:bg-white/10"
        >
          <Pencil className="mr-1 h-3.5 w-3.5" />
          {language === 'ar' ? 'تعديل' : 'Edit'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => handleDelete(item.id)}
          className="h-8 rounded-xl border-red-400/20 bg-transparent px-3 text-xs text-red-200 hover:bg-red-500/10"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          {language === 'ar' ? 'حذف' : 'Delete'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-foreground">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Brain className="h-4 w-4 text-blue-300" />
            <span>{labels.title}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            {labels.subtitle}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            {labels.intro}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2 py-1.5">
          <span className="text-xs text-slate-300">{helpfulMemoryEnabled ? 'On' : 'Off'}</span>
          <Switch checked={helpfulMemoryEnabled} onCheckedChange={handleToggle} />
        </div>
      </div>

      {!helpfulMemoryEnabled && (
        <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          {labels.memoryPaused}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2">
        <div className="text-xs text-slate-300">
          {currentConversationId
            ? (language === 'ar' ? 'الذاكرة الآن متصلة بالمحادثة الحالية وكل المحادثات.' : 'Memory is now connected to both this chat and all chats.')
            : (language === 'ar' ? 'الذاكرة العامة تعمل الآن. افتح محادثة لإضافة ذاكرة تخص هذه المحادثة فقط.' : 'All-chats memory is live. Open a conversation to add memory only for this chat.')} 
        </div>
        {isRefreshing && <span className="shrink-0 text-[11px] text-blue-300">{labels.syncing}</span>}
      </div>

      {editorOpen && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(12,15,20,0.96)_0%,rgba(30,41,59,0.96)_100%)] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
          <div className="mb-2 text-sm font-medium text-slate-100">
            {editingId ? labels.editMemory : labels.newMemory}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="helpful-memory-category" className="mb-1 block text-[11px] text-slate-400">{language === 'ar' ? 'النوع' : 'Category'}</label>
              <select
                id="helpful-memory-category"
                value={draft.category}
                onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value as HelpfulMemoryCategory }))}
                className="h-9 w-full rounded-xl border border-white/10 bg-black/30 px-2 text-sm text-slate-100 outline-none"
              >
                <option value="preference">{categoryLabel('preference')}</option>
                <option value="project">{categoryLabel('project')}</option>
                <option value="goal">{categoryLabel('goal')}</option>
                <option value="saved_context">{categoryLabel('saved_context')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="helpful-memory-scope" className="mb-1 block text-[11px] text-slate-400">{language === 'ar' ? 'النطاق' : 'Scope'}</label>
              <select
                id="helpful-memory-scope"
                value={draft.scope}
                onChange={(e) => setDraft((prev) => ({ ...prev, scope: e.target.value as HelpfulMemoryScope }))}
                className="h-9 w-full rounded-xl border border-white/10 bg-black/30 px-2 text-sm text-slate-100 outline-none"
              >
                <option value="all_chats">{labels.allChats}</option>
                <option value="this_chat">{labels.thisChat}</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-[11px] text-slate-400">{language === 'ar' ? 'المحتوى' : 'Memory'}</label>
            <Textarea
              value={draft.memoryText}
              onChange={(e) => setDraft((prev) => ({ ...prev, memoryText: e.target.value }))}
              placeholder={language === 'ar' ? 'مثال: كل خميس أحتاج مساعدة في كتابة بطاقة زهور.' : 'Example: Every Thursday I may want help writing a flower card.'}
              className="min-h-[92px] rounded-xl border border-white/10 bg-black/30 text-sm text-slate-100"
            />
            {draft.scope === 'this_chat' && !currentConversationId && (
              <div className="mt-2 text-xs text-amber-200">{labels.noChat}</div>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || (draft.scope === 'this_chat' && !currentConversationId)}
              className="h-8 rounded-xl bg-blue-500 px-3 text-xs text-white hover:bg-blue-600"
            >
              <Save className="mr-1 h-3.5 w-3.5" />
              {isSaving ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : labels.save}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetEditor}
              className="h-8 rounded-xl border-white/10 bg-transparent px-3 text-xs text-slate-200 hover:bg-white/10"
            >
              {labels.cancel}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-3">
        {isLoading ? (
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-6 text-center text-sm text-slate-400">
            {language === 'ar' ? 'جاري تحميل Helpful Memory...' : 'Loading Helpful Memory...'}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{labels.worksEverywhere}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{labels.worksEverywhereHint}</div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleStartAdd('all_chats')}
                  className="h-8 rounded-xl bg-blue-500 px-3 text-xs text-white hover:bg-blue-600"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {labels.addEverywhere}
                </Button>
              </div>
              {allChatsItems.length > 0 ? allChatsItems.map(renderMemoryCard) : (
                <div className="rounded-xl border border-dashed border-white/15 bg-black/15 px-3 py-5 text-center text-sm text-slate-400">
                  {labels.emptyAllChats}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{labels.onlyThisChat}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{labels.onlyThisChatHint}</div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleStartAdd('this_chat')}
                  disabled={!currentConversationId}
                  className="h-8 rounded-xl bg-purple-500 px-3 text-xs text-white hover:bg-purple-600 disabled:opacity-50"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {labels.addHere}
                </Button>
              </div>
              {!currentConversationId ? (
                <div className="rounded-xl border border-dashed border-white/15 bg-black/15 px-3 py-5 text-center text-sm text-slate-400">
                  {labels.noChat}
                </div>
              ) : thisChatItems.length > 0 ? thisChatItems.map(renderMemoryCard) : (
                <div className="rounded-xl border border-dashed border-white/15 bg-black/15 px-3 py-5 text-center text-sm text-slate-400">
                  {labels.emptyThisChat}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
