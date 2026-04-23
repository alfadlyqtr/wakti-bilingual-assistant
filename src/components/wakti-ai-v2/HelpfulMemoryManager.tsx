import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Check, ChevronDown, ChevronUp, Download, Pause, Pencil, Plus, RotateCcw, Save, Sparkles, Trash2, UserCog, X } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { onEvent } from '@/utils/eventBus';
import {
  HelpfulMemoryLayer,
  HelpfulMemoryRecord,
  HelpfulMemoryService,
} from '@/services/HelpfulMemoryService';
import { HelpfulMemoryProfileForm } from './HelpfulMemoryProfileForm';

interface HelpfulMemoryManagerProps {
  currentConversationId: string | null;
}

type MemoryTab = 'always_use' | 'routine' | 'project' | 'candidate';

const emptyDraft = {
  memoryText: '',
  layer: 'always_use' as HelpfulMemoryLayer,
};

export function HelpfulMemoryManager({ currentConversationId: _currentConversationId }: HelpfulMemoryManagerProps) {
  const { language, theme } = useTheme();
  const { showError, showSuccess } = useToastHelper();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [helpfulMemoryEnabled, setHelpfulMemoryEnabled] = useState(true);
  const [capturePaused, setCapturePaused] = useState(false);
  const [items, setItems] = useState<HelpfulMemoryRecord[]>([]);
  const [activeTab, setActiveTab] = useState<MemoryTab>('always_use');
  const [editorOpen, setEditorOpen] = useState(false);
  const [profileFormOpen, setProfileFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const loadInFlightRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);
  const prevCountsRef = useRef<{ total: number; candidate: number }>({ total: 0, candidate: 0 });
  const showErrorRef = useRef(showError);
  const showSuccessRef = useRef(showSuccess);
  useEffect(() => { showErrorRef.current = showError; }, [showError]);
  useEffect(() => { showSuccessRef.current = showSuccess; }, [showSuccess]);
  const isDark = theme === 'dark';

  const labels = useMemo(() => ({
    title: language === 'ar' ? 'الذاكرة المفيدة' : 'Helpful Memory',
    subtitle: language === 'ar'
      ? 'وقتي يتذكر ما يساعدك فعلاً. يمكنك الاطلاع، التعديل، أو الحذف في أي وقت.'
      : 'Wakti remembers what actually helps you. You can view, edit, or delete anytime.',
    on: language === 'ar' ? 'مفعل' : 'On',
    off: language === 'ar' ? 'متوقف' : 'Off',
    addButton: language === 'ar' ? 'إضافة ذاكرة' : 'Add memory',
    editMemory: language === 'ar' ? 'تعديل الذاكرة' : 'Edit memory',
    newMemory: language === 'ar' ? 'ذاكرة جديدة' : 'New memory',
    save: language === 'ar' ? 'حفظ' : 'Save',
    cancel: language === 'ar' ? 'إلغاء' : 'Cancel',
    edit: language === 'ar' ? 'تعديل' : 'Edit',
    delete: language === 'ar' ? 'حذف' : 'Delete',
    remember: language === 'ar' ? 'تذكر هذا' : 'Remember this',
    dismiss: language === 'ar' ? 'لا، شكراً' : 'No thanks',
    memoryPaused: language === 'ar' ? 'الذاكرة المفيدة متوقفة حالياً. لن يستخدم وقتي أي ذاكرة ولن يحفظ جديدة حتى تعيد تشغيلها.' : 'Helpful Memory is paused. Wakti will not use or save memory until you turn it back on.',
    memorySaved: language === 'ar' ? 'تم حفظ الذاكرة' : 'Memory saved',
    memoryUpdated: language === 'ar' ? 'تم تحديث الذاكرة' : 'Memory updated',
    memoryForgotten: language === 'ar' ? 'تم نسيان الذاكرة' : 'Memory forgotten',
    newSuggestion: language === 'ar' ? 'اقتراح ذاكرة جديد للمراجعة' : 'New memory suggestion to review',
    placeholder: language === 'ar'
      ? 'مثال: كل خميس أشتري زهور لزوجتي.'
      : 'Example: Every Thursday I buy flowers for my wife.',
    empty: language === 'ar' ? 'لا شيء محفوظ هنا بعد.' : 'Nothing saved here yet.',
    emptyCandidates: language === 'ar' ? 'لا توجد اقتراحات للمراجعة.' : 'No suggestions to review.',
    whereLives: language === 'ar' ? 'أين يعيش' : 'Where it lives',
    memoryLabel: language === 'ar' ? 'المحتوى' : 'Memory',
    saving: language === 'ar' ? 'جاري الحفظ...' : 'Saving...',
    loading: language === 'ar' ? 'جاري تحميل الذاكرة المفيدة...' : 'Loading Helpful Memory...',
    saveOn: language === 'ar' ? 'تم تشغيل الذاكرة المفيدة' : 'Helpful Memory turned on',
    saveOff: language === 'ar' ? 'تم إيقاف الذاكرة المفيدة' : 'Helpful Memory turned off',
    saveFailed: language === 'ar' ? 'تعذر حفظ الذاكرة' : 'Failed to save memory',
    deleteFailed: language === 'ar' ? 'تعذر حذف الذاكرة' : 'Failed to delete memory',
    settingFailed: language === 'ar' ? 'تعذر حفظ الإعداد' : 'Failed to save setting',
    layer: {
      always_use: language === 'ar' ? 'عني' : 'About me',
      routine: language === 'ar' ? 'روتيني' : 'Routines',
      project: language === 'ar' ? 'مشاريعي' : 'Projects',
      candidate: language === 'ar' ? 'اقتراحات' : 'Suggestions',
    } as Record<HelpfulMemoryLayer, string>,
    sourceAuto: language === 'ar' ? 'حفظ تلقائي' : 'Auto-saved',
    sourceUser: language === 'ar' ? 'أضفتها أنت' : 'You added',
    sourceConfirmed: language === 'ar' ? 'أكدتها أنت' : 'Confirmed',
    sensitive: language === 'ar' ? 'شخصي' : 'Personal',
    syncing: language === 'ar' ? 'جاري التحديث...' : 'Syncing...',
    candidateHint: language === 'ar'
      ? 'وقتي التقط هذه الأشياء وينتظر موافقتك قبل استخدامها.'
      : 'Wakti picked these up and is waiting for your OK before using them.',
    quickSetupTitle: language === 'ar' ? 'ابدأ بالإعداد السريع' : 'Start with Quick Setup',
    quickSetupBody: language === 'ar'
      ? 'املأ أهم الأشياء عنك خلال ثوانٍ. هذا يساعد وقتي يفهمك بشكل أفضل بدون إغراق الذاكرة.'
      : 'Fill the most useful basics in seconds. This helps Wakti understand you better without flooding memory.',
    quickSetupAction: language === 'ar' ? 'فتح الإعداد السريع' : 'Open Quick Setup',
    addManually: language === 'ar' ? 'أضف يدوياً' : 'Add manually',
    collapsed: language === 'ar' ? 'عرض' : 'Show',
    expanded: language === 'ar' ? 'إخفاء' : 'Hide',
    tapToExpand: language === 'ar' ? 'اضغط لعرض التفاصيل' : 'Tap to view details',
  }), [language]);

  const layerLabel = useCallback((layer: HelpfulMemoryLayer) => labels.layer[layer], [labels]);

  const grouped = useMemo(() => {
    const all: Record<MemoryTab, HelpfulMemoryRecord[]> = {
      always_use: [],
      routine: [],
      project: [],
      candidate: [],
    };
    for (const item of items) {
      if (item.layer === 'candidate') all.candidate.push(item);
      else if (item.layer === 'routine') all.routine.push(item);
      else if (item.layer === 'project') all.project.push(item);
      else all.always_use.push(item);
    }
    return all;
  }, [items]);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (loadInFlightRef.current) return;
    const silent = options?.silent === true;
    loadInFlightRef.current = true;
    if (silent) setIsRefreshing(true);
    else if (!hasLoadedOnceRef.current) setIsLoading(true);
    try {
      const [settings, memories] = await Promise.all([
        HelpfulMemoryService.getSettings(),
        HelpfulMemoryService.listMemories()
      ]);
      setHelpfulMemoryEnabled(settings.helpfulMemoryEnabled);
      setCapturePaused(settings.capturePaused);
      setItems(memories);
      // Capture chip: announce new auto-captures or candidates between silent refreshes.
      if (silent && hasLoadedOnceRef.current) {
        const prev = prevCountsRef.current;
        const nextCandidate = memories.filter((m) => m.layer === 'candidate').length;
        const nextTotal = memories.length;
        if (nextCandidate > prev.candidate) {
          showSuccessRef.current(language === 'ar' ? 'اقتراح ذاكرة جديد للمراجعة' : 'New memory suggestion to review');
        } else if (nextTotal > prev.total) {
          showSuccessRef.current(language === 'ar' ? 'تم حفظ الذاكرة' : 'Memory saved');
        }
      }
      prevCountsRef.current = {
        total: memories.length,
        candidate: memories.filter((m) => m.layer === 'candidate').length,
      };
      hasLoadedOnceRef.current = true;
    } catch (error) {
      console.error('Helpful memory load failed', error);
      if (!silent) {
        showErrorRef.current(language === 'ar' ? 'تعذر تحميل Helpful Memory' : 'Failed to load Helpful Memory');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      loadInFlightRef.current = false;
    }
  }, [language]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    return onEvent('wakti-ai-stream-finished', () => {
      loadData({ silent: true }).catch(() => {});
    });
  }, [loadData]);

  // Open Quick Setup when triggered externally (e.g. from Helpful Memory onboarding popup).
  useEffect(() => {
    return onEvent('wakti-open-memory-panel', (detail) => {
      if (detail && (detail as any).openQuickSetup) {
        setActiveTab('always_use');
        setProfileFormOpen(true);
      }
    });
  }, []);

  const resetEditor = useCallback(() => {
    setEditorOpen(false);
    setEditingId(null);
    setDraft(emptyDraft);
  }, []);

  const handleToggle = async (next: boolean) => {
    setHelpfulMemoryEnabled(next);
    try {
      await HelpfulMemoryService.updateSettings({ helpfulMemoryEnabled: next });
      showSuccess(next ? labels.saveOn : labels.saveOff);
    } catch (error) {
      console.error('Helpful memory settings save failed', error);
      setHelpfulMemoryEnabled(!next);
      showError(labels.settingFailed);
    }
  };

  const handleCapturePauseToggle = async (paused: boolean) => {
    setCapturePaused(paused);
    try {
      await HelpfulMemoryService.updateSettings({ capturePaused: paused });
      showSuccess(paused
        ? (language === 'ar' ? 'تم إيقاف التقاط الذاكرة الجديدة' : 'Paused capturing new memories')
        : (language === 'ar' ? 'تم استئناف التقاط الذاكرة' : 'Resumed capturing memories'));
    } catch (error) {
      console.error('Capture pause toggle failed', error);
      setCapturePaused(!paused);
      showError(labels.settingFailed);
    }
  };

  const handleProfileSaved = async () => {
    await loadData({ silent: true });
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStartAdd = () => {
    setEditingId(null);
    setDraft({
      ...emptyDraft,
      layer: activeTab === 'candidate' ? 'always_use' : (activeTab as HelpfulMemoryLayer),
    });
    setEditorOpen(true);
  };

  const handleStartEdit = (item: HelpfulMemoryRecord) => {
    setEditingId(item.id);
    setDraft({
      memoryText: item.memoryText,
      layer: item.layer === 'candidate' ? 'always_use' : item.layer,
    });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editingId) {
        await HelpfulMemoryService.updateMemory(editingId, {
          memoryText: draft.memoryText,
          layer: draft.layer,
        });
        showSuccess(labels.memoryUpdated);
      } else {
        await HelpfulMemoryService.saveMemory({
          memoryText: draft.memoryText,
          layer: draft.layer,
        });
        showSuccess(labels.memorySaved);
      }
      resetEditor();
      await loadData({ silent: true });
    } catch (error: any) {
      console.error('Helpful memory save failed', error);
      showError(error?.message || labels.saveFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await HelpfulMemoryService.deleteMemory(id);
      showSuccess(labels.memoryForgotten);
      await loadData({ silent: true });
    } catch (error) {
      console.error('Helpful memory delete failed', error);
      showError(labels.deleteFailed);
    }
  };

  const handleApproveCandidate = async (item: HelpfulMemoryRecord) => {
    try {
      const target: HelpfulMemoryLayer = /every\s|weekly|monday|tuesday|wednesday|thursday|friday|saturday|sunday|كل\s/i.test(item.memoryText)
        ? 'routine'
        : /project|building|working on|مشروع/i.test(item.memoryText)
          ? 'project'
          : 'always_use';
      await HelpfulMemoryService.approveCandidate(item.id, target);
      showSuccess(labels.memorySaved);
      await loadData({ silent: true });
    } catch (error) {
      console.error('Approve candidate failed', error);
      showError(labels.saveFailed);
    }
  };

  const handleDismissCandidate = async (item: HelpfulMemoryRecord) => {
    try {
      await HelpfulMemoryService.dismissCandidate(item.id);
      showSuccess(labels.memoryForgotten);
      await loadData({ silent: true });
    } catch (error) {
      console.error('Dismiss candidate failed', error);
      showError(labels.deleteFailed);
    }
  };

  const handleExport = async () => {
    try {
      const payload = await HelpfulMemoryService.exportAll();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `wakti-helpful-memory-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      showSuccess(language === 'ar' ? 'تم تصدير الذاكرة' : 'Memory exported');
    } catch (error) {
      console.error('Export failed', error);
      showError(language === 'ar' ? 'تعذر التصدير' : 'Export failed');
    }
  };

  const handleReset = async () => {
    const confirmMsg = language === 'ar'
      ? 'سيتم حذف كل الذاكرة المحفوظة. هل أنت متأكد؟'
      : 'This will delete all saved memory. Are you sure?';
    if (!window.confirm(confirmMsg)) return;
    try {
      const count = await HelpfulMemoryService.resetAll();
      showSuccess(language === 'ar' ? `تم حذف ${count} عنصر` : `Deleted ${count} item${count === 1 ? '' : 's'}`);
      await loadData({ silent: true });
    } catch (error) {
      console.error('Reset failed', error);
      showError(language === 'ar' ? 'تعذر الحذف' : 'Reset failed');
    }
  };

  const renderCard = (item: HelpfulMemoryRecord) => {
    const isCandidate = item.layer === 'candidate';
    const isExpanded = !!expandedItems[item.id] || isCandidate;
    const cardShell = isDark
      ? 'border-white/10 bg-[linear-gradient(135deg,rgba(12,15,20,0.92)_0%,rgba(30,41,59,0.92)_100%)] shadow-[0_6px_24px_rgba(0,0,0,0.28)]'
      : 'border-[hsl(36_67%_81%/.65)] bg-[linear-gradient(135deg,rgba(252,254,253,0.98)_0%,rgba(245,241,235,0.98)_55%,rgba(252,254,253,0.98)_100%)] shadow-[0_10px_26px_rgba(6,5,65,0.08)]';
    const badgeClass = isDark
      ? 'border-transparent bg-white/10 text-[10px] text-slate-200 hover:bg-white/10'
      : 'border-transparent bg-[rgba(6,5,65,0.08)] text-[10px] text-[hsl(243_84%_14%)] hover:bg-[rgba(6,5,65,0.08)]';
    const summaryText = item.memoryText.length > 100 ? `${item.memoryText.slice(0, 100).trim()}…` : item.memoryText;
    return (
      <div key={item.id} className={`rounded-2xl border p-3 transition-colors ${cardShell}`}>
        <button
          type="button"
          onClick={() => toggleExpanded(item.id)}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className={`text-sm leading-relaxed ${isDark ? 'text-slate-100' : 'text-[hsl(243_84%_14%)]'}`}>
              {isExpanded ? item.memoryText : summaryText}
            </div>
            {!isExpanded && (
              <div className={`mt-1 text-[11px] ${isDark ? 'text-slate-400' : 'text-[hsl(243_20%_34%)]'}`}>
                {labels.tapToExpand}
              </div>
            )}
          </div>
          <div className={`mt-0.5 flex items-center gap-1 text-[11px] ${isDark ? 'text-slate-300' : 'text-[hsl(243_60%_24%)]'}`}>
            <span>{isExpanded ? labels.expanded : labels.collapsed}</span>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge className={badgeClass}>
            {layerLabel(item.layer)}
          </Badge>
          <Badge className={badgeClass}>
            {item.source === 'auto_saved' ? labels.sourceAuto : item.source === 'user_confirmed' ? labels.sourceConfirmed : labels.sourceUser}
          </Badge>
          {item.sensitivity === 'careful' && (
            <Badge className={isDark ? 'border-transparent bg-amber-400/15 text-[10px] text-amber-100 hover:bg-amber-400/15' : 'border-transparent bg-[rgba(245,158,11,0.16)] text-[10px] text-[hsl(25_95%_35%)] hover:bg-[rgba(245,158,11,0.16)]'}>
              {labels.sensitive}
            </Badge>
          )}
        </div>
        {isExpanded && isCandidate ? (
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => handleApproveCandidate(item)}
              className="h-8 rounded-xl bg-emerald-500 px-3 text-xs text-white hover:bg-emerald-600"
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              {labels.remember}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleDismissCandidate(item)}
              className="h-8 rounded-xl border-white/10 bg-transparent px-3 text-xs text-slate-200 hover:bg-white/10"
            >
              <X className="mr-1 h-3.5 w-3.5" />
              {labels.dismiss}
            </Button>
          </div>
        ) : isExpanded ? (
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleStartEdit(item)}
              className="h-8 rounded-xl border-white/10 bg-transparent px-3 text-xs text-slate-200 hover:bg-white/10"
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              {labels.edit}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleDelete(item.id)}
              className="h-8 rounded-xl border-red-400/20 bg-transparent px-3 text-xs text-red-200 hover:bg-red-500/10"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              {labels.delete}
            </Button>
          </div>
        ) : null}
      </div>
    );
  };

  const tabs: MemoryTab[] = ['always_use', 'routine', 'project', 'candidate'];
  const activeItems = grouped[activeTab];
  const panelShell = isDark
    ? 'border-white/10 bg-white/5'
    : 'border-[rgba(233,206,176,0.95)] bg-[linear-gradient(135deg,rgba(252,254,253,0.98)_0%,rgba(247,244,238,0.98)_50%,rgba(252,254,253,0.98)_100%)] shadow-[0_16px_40px_rgba(6,5,65,0.08)]';
  const mutedText = isDark ? 'text-slate-300' : 'text-[hsl(243_20%_34%)]';
  const headingText = isDark ? 'text-slate-100' : 'text-[hsl(243_84%_14%)]';
  const subtleShell = isDark ? 'border-white/10 bg-black/20' : 'border-[rgba(6,5,65,0.08)] bg-[rgba(6,5,65,0.04)]';
  const tabShell = isDark ? 'border-white/10 bg-black/15' : 'border-[rgba(6,5,65,0.08)] bg-[rgba(6,5,65,0.05)]';

  return (
    <div className={`mt-2 rounded-2xl border p-3 text-foreground ${panelShell}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`flex items-center gap-2 text-sm font-semibold ${headingText}`}>
            <Brain className={`h-4 w-4 ${isDark ? 'text-blue-300' : 'text-[hsl(243_84%_14%)]'}`} />
            <span>{labels.title}</span>
          </div>
          <p className={`mt-1 text-xs leading-relaxed ${mutedText}`}>{labels.subtitle}</p>
        </div>
        <div className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${subtleShell}`}>
          <span className={`text-xs ${mutedText}`}>{helpfulMemoryEnabled ? labels.on : labels.off}</span>
          <Switch checked={helpfulMemoryEnabled} onCheckedChange={handleToggle} />
        </div>
      </div>

      {!helpfulMemoryEnabled && (
        <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          {labels.memoryPaused}
        </div>
      )}

      {helpfulMemoryEnabled && (
        <div className={`mt-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${subtleShell}`}>
          <div className="flex items-center gap-2">
            <Pause className={`h-3.5 w-3.5 ${mutedText}`} />
            <div>
              <div className={`text-xs font-medium ${headingText}`}>
                {language === 'ar' ? 'إيقاف التقاط الجديد' : 'Pause capturing new memories'}
              </div>
              <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-[hsl(243_15%_42%)]'}`}>
                {language === 'ar'
                  ? 'وقتي يستخدم الذاكرة الموجودة فقط. لا يلتقط شيئاً جديداً.'
                  : 'Wakti uses existing memory only. Nothing new is captured.'}
              </div>
            </div>
          </div>
          <Switch checked={capturePaused} onCheckedChange={handleCapturePauseToggle} />
        </div>
      )}

      {capturePaused && helpfulMemoryEnabled && (
        <div className="mt-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-100">
          {language === 'ar'
            ? 'التقاط الذاكرة متوقف. يمكنك دائماً إضافة الذاكرة يدوياً من هنا.'
            : 'Capture is paused. You can still add memory manually here.'}
        </div>
      )}

      {helpfulMemoryEnabled && activeTab !== 'candidate' && (
        <div className={`mt-3 rounded-2xl border p-3 ${isDark ? 'border-blue-400/20 bg-[linear-gradient(135deg,rgba(37,99,235,0.16)_0%,rgba(147,51,234,0.14)_100%)]' : 'border-[rgba(6,5,65,0.10)] bg-[linear-gradient(135deg,rgba(6,5,65,0.06)_0%,rgba(233,206,176,0.45)_100%)]'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={`text-sm font-semibold ${headingText}`}>{labels.quickSetupTitle}</div>
              <p className={`mt-1 text-[12px] leading-relaxed ${mutedText}`}>{labels.quickSetupBody}</p>
            </div>
            <Sparkles className={`mt-0.5 h-4 w-4 shrink-0 ${isDark ? 'text-blue-300' : 'text-[hsl(243_84%_14%)]'}`} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => setProfileFormOpen((v) => !v)}
              className={`h-8 rounded-xl px-3 text-xs text-white ${isDark ? 'bg-[linear-gradient(135deg,hsl(210,100%,65%)_0%,hsl(260,80%,65%)_50%,hsl(280,70%,65%)_100%)] shadow-[0_4px_16px_hsla(260,80%,65%,0.45)] hover:brightness-110' : 'bg-[linear-gradient(135deg,#060541_0%,hsl(260_70%_25%)_50%,#060541_100%)] shadow-[0_10px_24px_rgba(6,5,65,0.18)] hover:brightness-110'}`}
            >
              <UserCog className="mr-1 h-3.5 w-3.5" />
              {labels.quickSetupAction}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleStartAdd}
              className={`h-8 rounded-xl px-3 text-xs ${isDark ? 'border-white/10 bg-transparent text-slate-200 hover:bg-white/10' : 'border-[rgba(6,5,65,0.12)] bg-white/70 text-[hsl(243_84%_14%)] hover:bg-white'}`}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {labels.addManually}
            </Button>
          </div>
        </div>
      )}

      <div className={`mt-3 flex flex-wrap gap-1 rounded-xl border p-1 ${tabShell}`}>
        {tabs.map((tab) => {
          const count = grouped[tab].length;
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[22%] rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'bg-blue-500 text-white'
                  : isDark
                    ? 'text-slate-200 hover:bg-white/5'
                    : 'text-[hsl(243_84%_14%)] hover:bg-[rgba(6,5,65,0.06)]'
              }`}
            >
              {layerLabel(tab as HelpfulMemoryLayer)}
              {count > 0 && (
                <span className={`ml-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] ${
                  isActive ? 'bg-white/25' : tab === 'candidate' ? 'bg-amber-400/30 text-amber-100' : 'bg-white/10'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab !== 'candidate' && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="text-[11px] text-blue-300">{isRefreshing ? labels.syncing : '\u00A0'}</div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleStartAdd}
              className={`h-8 rounded-xl px-3 text-xs text-white ${isDark ? 'bg-blue-500 hover:bg-blue-600' : 'bg-[linear-gradient(135deg,#060541_0%,hsl(260_70%_25%)_50%,#060541_100%)] hover:brightness-110'}`}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {labels.addButton}
            </Button>
          </div>
        </div>
      )}

      {profileFormOpen && (
        <HelpfulMemoryProfileForm
          onSaved={handleProfileSaved}
          onClose={() => setProfileFormOpen(false)}
        />
      )}

      {activeTab === 'candidate' && grouped.candidate.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-100">
          {labels.candidateHint}
        </div>
      )}

      {editorOpen && activeTab !== 'candidate' && (
        <div className={`mt-3 rounded-2xl border p-3 ${isDark ? 'border-white/10 bg-[linear-gradient(135deg,rgba(12,15,20,0.96)_0%,rgba(30,41,59,0.96)_100%)] shadow-[0_8px_32px_rgba(0,0,0,0.35)]' : 'border-[rgba(6,5,65,0.08)] bg-[linear-gradient(135deg,rgba(252,254,253,0.99)_0%,rgba(246,241,233,0.99)_100%)] shadow-[0_16px_36px_rgba(6,5,65,0.08)]'}`}>
          <div className={`mb-2 text-sm font-medium ${headingText}`}>
            {editingId ? labels.editMemory : labels.newMemory}
          </div>
          <div>
            <label className={`mb-1 block text-[11px] ${isDark ? 'text-slate-400' : 'text-[hsl(243_20%_34%)]'}`}>{labels.memoryLabel}</label>
            <Textarea
              value={draft.memoryText}
              onChange={(e) => setDraft((prev) => ({ ...prev, memoryText: e.target.value }))}
              placeholder={labels.placeholder}
              className={`min-h-[92px] rounded-xl border text-sm ${isDark ? 'border-white/10 bg-black/30 text-slate-100' : 'border-[rgba(6,5,65,0.12)] bg-white/90 text-[hsl(243_84%_14%)]'}`}
            />
          </div>
          <div className="mt-3">
            <label className={`mb-1 block text-[11px] ${isDark ? 'text-slate-400' : 'text-[hsl(243_20%_34%)]'}`}>{labels.whereLives}</label>
            <div className={`flex flex-wrap gap-1 rounded-xl border p-1 ${isDark ? 'border-white/10 bg-black/30' : 'border-[rgba(6,5,65,0.10)] bg-[rgba(6,5,65,0.04)]'}`}>
              {(['always_use', 'routine', 'project'] as HelpfulMemoryLayer[]).map((layer) => (
                <button
                  key={layer}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, layer }))}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    draft.layer === layer ? 'bg-blue-500 text-white' : isDark ? 'text-slate-200 hover:bg-white/5' : 'text-[hsl(243_84%_14%)] hover:bg-[rgba(6,5,65,0.06)]'
                  }`}
                >
                  {layerLabel(layer)}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !draft.memoryText.trim()}
              className="h-8 rounded-xl bg-blue-500 px-3 text-xs text-white hover:bg-blue-600"
            >
              <Save className="mr-1 h-3.5 w-3.5" />
              {isSaving ? labels.saving : labels.save}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetEditor}
              className={`h-8 rounded-xl px-3 text-xs ${isDark ? 'border-white/10 bg-transparent text-slate-200 hover:bg-white/10' : 'border-[rgba(6,5,65,0.12)] bg-white/70 text-[hsl(243_84%_14%)] hover:bg-white'}`}
            >
              {labels.cancel}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {isLoading ? (
          <div className={`rounded-xl border px-3 py-6 text-center text-sm ${isDark ? 'border-white/10 bg-black/20 text-slate-400' : 'border-[rgba(6,5,65,0.08)] bg-white/80 text-[hsl(243_20%_34%)]'}`}>
            {labels.loading}
          </div>
        ) : activeItems.length > 0 ? (
          activeItems.map(renderCard)
        ) : activeTab === 'candidate' ? (
          <div className={`rounded-xl border border-dashed px-3 py-5 text-center text-sm ${isDark ? 'border-white/15 bg-black/15 text-slate-400' : 'border-[rgba(6,5,65,0.18)] bg-white/75 text-[hsl(243_20%_34%)]'}`}>
            {labels.emptyCandidates}
          </div>
        ) : (
          <div className={`rounded-2xl border px-4 py-5 text-center ${isDark ? 'border-white/10 bg-[linear-gradient(135deg,rgba(12,15,20,0.85)_0%,rgba(30,41,59,0.85)_100%)] shadow-[0_6px_24px_rgba(0,0,0,0.28)]' : 'border-[rgba(233,206,176,0.9)] bg-[linear-gradient(135deg,rgba(252,254,253,0.98)_0%,rgba(242,236,226,0.98)_100%)] shadow-[0_16px_34px_rgba(6,5,65,0.08)]'}`}>
            <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${isDark ? 'bg-[linear-gradient(135deg,hsl(210,100%,65%)_0%,hsl(280,70%,65%)_100%)] shadow-[0_0_25px_hsla(210,100%,65%,0.55)]' : 'bg-[linear-gradient(135deg,#060541_0%,hsl(260_70%_25%)_50%,#060541_100%)] shadow-[0_10px_28px_rgba(6,5,65,0.20)]'}`}>
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div className={`text-sm font-semibold ${headingText}`}>
              {language === 'ar' ? 'لا ذاكرة هنا بعد' : 'Nothing saved here yet'}
            </div>
            <p className={`mx-auto mt-1 max-w-[280px] text-[12px] leading-relaxed ${mutedText}`}>
              {language === 'ar'
                ? 'أضف بعض الأساسيات بنفسك أو جرّب الإعداد السريع — يستغرق 10 ثوانٍ ويجعل وقتي أكثر فائدة من أول رسالة.'
                : 'Add a few basics yourself or try Quick Setup — takes 10 seconds and makes Wakti more helpful from the very first message.'}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setProfileFormOpen(true)}
                className={`h-8 rounded-xl px-3 text-xs text-white ${isDark ? 'bg-[linear-gradient(135deg,hsl(210,100%,65%)_0%,hsl(260,80%,65%)_50%,hsl(280,70%,65%)_100%)] shadow-[0_4px_16px_hsla(260,80%,65%,0.45)] hover:brightness-110' : 'bg-[linear-gradient(135deg,#060541_0%,hsl(260_70%_25%)_50%,#060541_100%)] shadow-[0_10px_24px_rgba(6,5,65,0.18)] hover:brightness-110'}`}
              >
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                {language === 'ar' ? 'إعداد سريع' : 'Quick Setup'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleStartAdd}
                className={`h-8 rounded-xl px-3 text-xs ${isDark ? 'border-white/15 bg-transparent text-slate-200 hover:bg-white/10' : 'border-[rgba(6,5,65,0.12)] bg-white/70 text-[hsl(243_84%_14%)] hover:bg-white'}`}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                {labels.addButton}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className={`mt-4 flex items-center justify-between gap-2 border-t pt-3 ${isDark ? 'border-white/10' : 'border-[rgba(6,5,65,0.10)]'}`}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleExport}
          className={`h-8 rounded-xl px-3 text-xs ${isDark ? 'border-white/10 bg-transparent text-slate-200 hover:bg-white/10' : 'border-[rgba(6,5,65,0.12)] bg-white/70 text-[hsl(243_84%_14%)] hover:bg-white'}`}
        >
          <Download className="mr-1 h-3.5 w-3.5" />
          {language === 'ar' ? 'تصدير' : 'Export'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleReset}
          className={`h-8 rounded-xl px-3 text-xs ${isDark ? 'border-red-400/30 bg-transparent text-red-200 hover:bg-red-500/10' : 'border-red-300/60 bg-white/70 text-red-700 hover:bg-red-50'}`}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          {language === 'ar' ? 'حذف الكل' : 'Reset all'}
        </Button>
      </div>
    </div>
  );
}
