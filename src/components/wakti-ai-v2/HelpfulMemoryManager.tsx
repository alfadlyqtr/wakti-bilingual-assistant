import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Check, Download, Pause, Pencil, Plus, RotateCcw, Save, Trash2, UserCog, X } from 'lucide-react';
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
  const { language } = useTheme();
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
  const loadInFlightRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);
  const prevCountsRef = useRef<{ total: number; candidate: number }>({ total: 0, candidate: 0 });
  const showErrorRef = useRef(showError);
  const showSuccessRef = useRef(showSuccess);
  useEffect(() => { showErrorRef.current = showError; }, [showError]);
  useEffect(() => { showSuccessRef.current = showSuccess; }, [showSuccess]);

  const labels = useMemo(() => ({
    title: 'Helpful Memory',
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
    memoryPaused: language === 'ar' ? 'Helpful Memory متوقف حالياً. لن يستخدم وقتي أي ذاكرة ولن يحفظ جديدة حتى تعيده للتشغيل.' : 'Helpful Memory is paused. Wakti will not use or save memory until you turn it back on.',
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
    loading: language === 'ar' ? 'جاري تحميل Helpful Memory...' : 'Loading Helpful Memory...',
    saveOn: language === 'ar' ? 'تم تشغيل Helpful Memory' : 'Helpful Memory turned on',
    saveOff: language === 'ar' ? 'تم إيقاف Helpful Memory' : 'Helpful Memory turned off',
    saveFailed: language === 'ar' ? 'تعذر حفظ الذاكرة' : 'Failed to save memory',
    deleteFailed: language === 'ar' ? 'تعذر حذف الذاكرة' : 'Failed to delete memory',
    settingFailed: language === 'ar' ? 'تعذر حفظ الإعداد' : 'Failed to save setting',
    layer: {
      always_use: language === 'ar' ? 'عني' : 'About me',
      routine: language === 'ar' ? 'روتيني' : 'Routines',
      project: language === 'ar' ? 'مشاريعي' : 'Projects',
      candidate: language === 'ar' ? 'للمراجعة' : 'Candidates',
    } as Record<HelpfulMemoryLayer, string>,
    sourceAuto: language === 'ar' ? 'حفظ تلقائي' : 'Auto-saved',
    sourceUser: language === 'ar' ? 'أضفتها أنت' : 'You added',
    sourceConfirmed: language === 'ar' ? 'أكدتها أنت' : 'Confirmed',
    sensitive: language === 'ar' ? 'شخصي' : 'Personal',
    syncing: language === 'ar' ? 'جاري التحديث...' : 'Syncing...',
    candidateHint: language === 'ar'
      ? 'وقتي التقط هذه الأشياء وينتظر موافقتك قبل استخدامها.'
      : 'Wakti picked these up and is waiting for your OK before using them.',
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
    return (
      <div key={item.id} className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(12,15,20,0.92)_0%,rgba(30,41,59,0.92)_100%)] p-3 shadow-[0_6px_24px_rgba(0,0,0,0.28)]">
        <div className="text-sm leading-relaxed text-slate-100">{item.memoryText}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge className="border-transparent bg-white/10 text-[10px] text-slate-200 hover:bg-white/10">
            {layerLabel(item.layer)}
          </Badge>
          <Badge className="border-transparent bg-white/10 text-[10px] text-slate-200 hover:bg-white/10">
            {item.source === 'auto_saved' ? labels.sourceAuto : item.source === 'user_confirmed' ? labels.sourceConfirmed : labels.sourceUser}
          </Badge>
          {item.sensitivity === 'careful' && (
            <Badge className="border-transparent bg-amber-400/15 text-[10px] text-amber-100 hover:bg-amber-400/15">
              {labels.sensitive}
            </Badge>
          )}
        </div>
        {isCandidate ? (
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
        ) : (
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
        )}
      </div>
    );
  };

  const tabs: MemoryTab[] = ['always_use', 'routine', 'project', 'candidate'];
  const activeItems = grouped[activeTab];

  return (
    <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-foreground">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Brain className="h-4 w-4 text-blue-300" />
            <span>{labels.title}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">{labels.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2 py-1.5">
          <span className="text-xs text-slate-300">{helpfulMemoryEnabled ? labels.on : labels.off}</span>
          <Switch checked={helpfulMemoryEnabled} onCheckedChange={handleToggle} />
        </div>
      </div>

      {!helpfulMemoryEnabled && (
        <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          {labels.memoryPaused}
        </div>
      )}

      {helpfulMemoryEnabled && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <div className="flex items-center gap-2">
            <Pause className="h-3.5 w-3.5 text-slate-300" />
            <div>
              <div className="text-xs font-medium text-slate-100">
                {language === 'ar' ? 'إيقاف التقاط الجديد' : 'Pause capturing new memories'}
              </div>
              <div className="text-[10px] text-slate-400">
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

      <div className="mt-3 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/15 p-1">
        {tabs.map((tab) => {
          const count = grouped[tab].length;
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[22%] rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                isActive ? 'bg-blue-500 text-white' : 'text-slate-200 hover:bg-white/5'
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
              variant="outline"
              onClick={() => setProfileFormOpen((v) => !v)}
              className="h-8 rounded-xl border-white/10 bg-transparent px-3 text-xs text-slate-200 hover:bg-white/10"
            >
              <UserCog className="mr-1 h-3.5 w-3.5" />
              {language === 'ar' ? 'إعداد سريع' : 'Quick setup'}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleStartAdd}
              className="h-8 rounded-xl bg-blue-500 px-3 text-xs text-white hover:bg-blue-600"
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
        <div className="mt-3 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(12,15,20,0.96)_0%,rgba(30,41,59,0.96)_100%)] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
          <div className="mb-2 text-sm font-medium text-slate-100">
            {editingId ? labels.editMemory : labels.newMemory}
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-400">{labels.memoryLabel}</label>
            <Textarea
              value={draft.memoryText}
              onChange={(e) => setDraft((prev) => ({ ...prev, memoryText: e.target.value }))}
              placeholder={labels.placeholder}
              className="min-h-[92px] rounded-xl border border-white/10 bg-black/30 text-sm text-slate-100"
            />
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-[11px] text-slate-400">{labels.whereLives}</label>
            <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
              {(['always_use', 'routine', 'project'] as HelpfulMemoryLayer[]).map((layer) => (
                <button
                  key={layer}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, layer }))}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    draft.layer === layer ? 'bg-blue-500 text-white' : 'text-slate-200 hover:bg-white/5'
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
              className="h-8 rounded-xl border-white/10 bg-transparent px-3 text-xs text-slate-200 hover:bg-white/10"
            >
              {labels.cancel}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {isLoading ? (
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-6 text-center text-sm text-slate-400">
            {labels.loading}
          </div>
        ) : activeItems.length > 0 ? (
          activeItems.map(renderCard)
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 bg-black/15 px-3 py-5 text-center text-sm text-slate-400">
            {activeTab === 'candidate' ? labels.emptyCandidates : labels.empty}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleExport}
          className="h-8 rounded-xl border-white/10 bg-transparent px-3 text-xs text-slate-200 hover:bg-white/10"
        >
          <Download className="mr-1 h-3.5 w-3.5" />
          {language === 'ar' ? 'تصدير' : 'Export'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleReset}
          className="h-8 rounded-xl border-red-400/30 bg-transparent px-3 text-xs text-red-200 hover:bg-red-500/10"
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          {language === 'ar' ? 'حذف الكل' : 'Reset all'}
        </Button>
      </div>
    </div>
  );
}
