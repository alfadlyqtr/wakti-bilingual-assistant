import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarIcon, X, Plus, Trash2, Copy, ExternalLink, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRService, TRTask } from '@/services/trService';
import { toast } from 'sonner';
import { SubtaskManager } from '@/components/tr/SubtaskManager';

// PHASE 2 FIX: Updated schema to make due_date truly optional
const taskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  due_date: z.string().optional().nullable(), // PHASE 2 FIX: Made nullable
  due_time: z.string().optional().nullable(), // PHASE 2 FIX: Made nullable
  priority: z.enum(['normal', 'high', 'urgent']),
  task_type: z.enum(['one-time', 'repeated']),
  is_shared: z.boolean().default(false),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  task?: TRTask | null;
  onTaskSaved: () => void;
}

export function TaskForm({ isOpen, onClose, task, onTaskSaved }: TaskFormProps) {
  const { language } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  type SubtaskDraft = { title: string; due_date?: string | null; due_time?: string | null };
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [openDueIndex, setOpenDueIndex] = useState<number | null>(null);
  const [bulkInput, setBulkInput] = useState('');

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      due_date: null, // PHASE 2 FIX: Default to null
      due_time: null, // PHASE 2 FIX: Default to null
      priority: 'normal',
      task_type: 'one-time',
      is_shared: false,
    },
  });

  const watchedDueDate = watch('due_date');
  const watchedIsShared = watch('is_shared');

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description || '',
        due_date: task.due_date || null, // PHASE 2 FIX: Handle null dates
        due_time: task.due_time || null, // PHASE 2 FIX: Handle null times
        priority: task.priority,
        task_type: task.task_type,
        is_shared: task.is_shared,
      });
    } else {
      reset({
        title: '',
        description: '',
        due_date: null, // PHASE 2 FIX: Default to null
        due_time: null, // PHASE 2 FIX: Default to null
        priority: 'normal',
        task_type: 'one-time',
        is_shared: false,
      });
      setSubtasks([]);
    }
  }, [task, reset]);

  useEffect(() => {
    if (!isOpen) {
      reset();
      setSubtasks([]);
      setNewSubtask('');
    }
  }, [isOpen, reset]);

  const onSubmit = async (data: TaskFormData) => {
    console.log('TaskForm.onSubmit: Starting form submission');
    console.log('TaskForm.onSubmit: Form data:', data);
    
    setIsLoading(true);
    try {
      // PHASE 2 FIX: Prepare data for service - handle null values properly
      const taskData = {
        title: data.title, // Required field
        description: data.description || undefined,
        due_date: data.due_date || undefined, // PHASE 2 FIX: Convert null to undefined
        due_time: data.due_time || undefined, // PHASE 2 FIX: Convert null to undefined
        priority: data.priority,
        task_type: data.task_type,
        is_shared: data.is_shared,
      };

      if (task) {
        console.log('TaskForm.onSubmit: Updating existing task');
        await TRService.updateTask(task.id, taskData);
        toast.success(t('taskUpdatedSuccessfully', language));
      } else {
        console.log('TaskForm.onSubmit: Creating new task');
        const newTask = await TRService.createTask(taskData);
        console.log('TaskForm.onSubmit: Task created:', newTask);
        
        // Create subtasks if any
        if (subtasks.length > 0) {
          console.log('TaskForm.onSubmit: Creating subtasks:', subtasks);
          for (let i = 0; i < subtasks.length; i++) {
            await TRService.createSubtask({
              task_id: newTask.id,
              title: subtasks[i].title,
              completed: false,
              order_index: i,
              due_date: subtasks[i].due_date || null,
              due_time: subtasks[i].due_time || null,
            });
          }
        }
        
        toast.success(t('taskCreatedSuccessfully', language));
      }
      
      onTaskSaved();
      onClose();
    } catch (error) {
      console.error('TaskForm.onSubmit: Error saving task:', error);
      toast.error(task ? t('failedToUpdateTask', language) : t('failedToCreateTask', language));
    } finally {
      setIsLoading(false);
    }
  };

  const addSubtask = () => {
    if (newSubtask.trim()) {
      setSubtasks([...subtasks, { title: newSubtask.trim(), due_date: null, due_time: null }]);
      setNewSubtask('');
    }
  };

  // Parse helper: split by commas/newlines/bullets, trim, dedupe, drop empties
  const parseItems = (text: string): string[] => {
    const cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/[•·►→\-]\s+/g, '') // remove common bullet prefixes
      .replace(/\u2022|\u25CF/g, '');
    const parts = cleaned
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    // dedupe preserving order
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of parts) {
      if (!seen.has(p)) { seen.add(p); out.push(p); }
    }
    return out;
  };

  // Merge helper with limit
  const mergeSubtasks = (items: string[]) => {
    if (items.length === 0) return;
    const existingTitles = new Set(subtasks.map(s => s.title));
    const next: SubtaskDraft[] = [...subtasks];
    for (const it of items) {
      if (!existingTitles.has(it)) {
        next.push({ title: it, due_date: null, due_time: null });
        existingTitles.add(it);
      }
      if (next.length >= 100) break; // safety limit
    }
    setSubtasks(next);
  };

  const handleBulkCreate = () => {
    const items = parseItems(bulkInput).slice(0, 100);
    mergeSubtasks(items);
    setBulkInput('');
  };

  const handleSubtaskPaste: React.ClipboardEventHandler<HTMLInputElement> = (e) => {
    const text = e.clipboardData.getData('text');
    const items = parseItems(text);
    if (items.length > 1) {
      e.preventDefault();
      mergeSubtasks(items);
      setNewSubtask('');
    }
  };

  const removeSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const setDraftDueDate = (index: number, date: Date | null) => {
    const next = [...subtasks];
    next[index] = { ...next[index], due_date: date ? format(date, 'yyyy-MM-dd') : null };
    setSubtasks(next);
  };

  const setDraftDueTime = (index: number, value: string) => {
    const next = [...subtasks];
    next[index] = { ...next[index], due_time: value || null };
    setSubtasks(next);
  };

  const copyShareLink = async () => {
    if (task?.share_link) {
      const shareUrl = `${window.location.origin}/shared-task/${task.share_link}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success(t('linkCopied', language));
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        toast.error('Error copying link');
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {task ? t('editTask', language) : t('createTask', language)}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('title', language)} *</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder={t('enterTaskTitle', language)}
              className={errors.title ? 'border-destructive' : ''}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('description', language)}</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder={t('enterTaskDescription', language)}
              rows={3}
            />
          </div>

          {/* Due Date - PHASE 2 FIX: Truly optional */}
          <div className="space-y-2">
            <Label htmlFor="due_date">{t('dueDate', language)} {language === 'ar' ? '(اختياري)' : '(optional)'}</Label>
            <Controller
              name="due_date"
              control={control}
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? (
                        format(new Date(field.value), "PPP")
                      ) : (
                        <span>{t('selectDate', language)}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(date) => {
                        // PHASE 2 FIX: Handle null dates properly
                        field.onChange(date ? format(date, 'yyyy-MM-dd') : null);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
          </div>

          {/* Due Time - Only show if date is selected */}
          {watchedDueDate && (
            <div className="space-y-2">
              <Label htmlFor="due_time">{t('dueTime', language)}</Label>
              <Input
                id="due_time"
                type="time"
                {...register('due_time')}
              />
            </div>
          )}

          {/* Priority */}
          <div className="space-y-2">
            <Label>{t('priority', language)}</Label>
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectPriority', language)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">{t('normal', language)}</SelectItem>
                    <SelectItem value="high">{t('high', language)}</SelectItem>
                    <SelectItem value="urgent">{t('urgent', language)}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Task Type */}
          <div className="space-y-2">
            <Label>{t('taskType', language)}</Label>
            <Controller
              name="task_type"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectTaskType', language)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one-time">{t('oneTime', language)}</SelectItem>
                    <SelectItem value="repeated">{t('repeated', language)}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Subtasks (only for new tasks) */}
          {!task && (
            <div className="space-y-2">
              <Label>{t('subtasks', language)}</Label>
              <div className="space-y-2">
                {subtasks.map((subtask, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input value={subtask.title} readOnly className="flex-1" />
                    {/* tiny due pill if set */}
                    {subtask.due_date && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full border text-muted-foreground whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(subtask.due_date), 'MMM d')}{subtask.due_time ? ` ${subtask.due_time}` : ''}
                        </span>
                      </span>
                    )}
                    {/* due editor */}
                    <Popover open={openDueIndex === index} onOpenChange={(open) => setOpenDueIndex(open ? index : null)}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <CalendarIcon className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3" align="end">
                        <div className="space-y-2">
                          <div className="text-[11px] text-muted-foreground">{language === 'ar' ? 'تاريخ ووقت المهمة الفرعية' : 'Subtask due date & time'}</div>
                          <Calendar
                            mode="single"
                            selected={subtask.due_date ? new Date(subtask.due_date) : undefined}
                            onSelect={(date) => setDraftDueDate(index, date || null)}
                            initialFocus
                          />
                          <div className="flex items-center gap-2">
                            <Input
                              value={subtask.due_time || ''}
                              placeholder="HH:mm"
                              type="time"
                              className="h-8 text-[12px]"
                              onChange={(e) => setDraftDueTime(index, e.target.value)}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 text-[12px]"
                              onClick={() => { setDraftDueDate(index, null); setDraftDueTime(index, ''); setOpenDueIndex(null); }}
                            >
                              {language === 'ar' ? 'مسح' : 'Clear'}
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeSubtask(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    placeholder={t('addSubtask', language)}
                    onPaste={handleSubtaskPaste}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const items = parseItems(newSubtask);
                        if (items.length > 1) {
                          mergeSubtasks(items);
                          setNewSubtask('');
                        } else {
                          addSubtask();
                        }
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addSubtask}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Bulk Subtasks */}
                <div className="mt-3 rounded-lg border bg-muted/10 p-3">
                  <Label className="text-sm">
                    {language === 'ar' ? 'إضافة مجمّعة' : 'Bulk Subtasks'}
                  </Label>
                  <Textarea
                    className="mt-2"
                    rows={3}
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    placeholder={language === 'ar' ? 'ألصق أو اكتب عناصر مفصولة بفواصل أو أسطر جديدة' : 'Paste or type items separated by commas or new lines'}
                  />
                  {/* Preview */}
                  {bulkInput.trim() && (
                    <div className="mt-2">
                      <div className="text-xs text-muted-foreground mb-1">
                        {(() => {
                          const count = parseItems(bulkInput).length;
                          return language === 'ar' ? `${count} جاهزة` : `${count} ready`;
                        })()}
                        {parseItems(bulkInput).length > 100 && (
                          <span className="ml-2 text-destructive">{language === 'ar' ? 'تم تحديد الحد الأقصى 100' : 'Max 100 will be added'}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {parseItems(bulkInput).slice(0, 30).map((it, idx) => (
                          <span key={idx} className="px-2 py-0.5 text-xs rounded-full border bg-white/60 dark:bg-white/5">
                            {it}
                          </span>
                        ))}
                        {parseItems(bulkInput).length > 30 && (
                          <span className="text-xs text-muted-foreground">…</span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="mt-2 flex justify-end">
                    <Button type="button" size="sm" onClick={handleBulkCreate} disabled={!bulkInput.trim()}>
                      {language === 'ar' ? 'إنشاء المهام الفرعية' : 'Create Subtasks'}
                    </Button>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {language === 'ar' ? 'تلميح: اللصق يحوِّل العناصر تلقائيًا إلى بطاقات.' : 'Tip: Pasting a list auto-splits into chips.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Subtasks (edit existing task) */}
          {task && (
            <div className="space-y-2">
              <SubtaskManager taskId={task.id} onSubtasksChange={() => {}} readOnly={false} />
            </div>
          )}

          {/* Enhanced Sharing Section */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">
                  {language === 'ar' ? 'مشاركة خارجية' : 'External Sharing'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {language === 'ar' 
                    ? 'مشاركة المهمة عبر رابط خارجي فقط. لن تظهر المهمة للمستخدمين الآخرين في التطبيق.'
                    : 'Share task via external link only. Task will not be visible to other app users.'
                  }
                </p>
              </div>
              <Controller
                name="is_shared"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            {/* Show share link for existing shared tasks */}
            {task?.is_shared && task?.share_link && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'رابط المشاركة:' : 'Share Link:'}
                </Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={`${window.location.origin}/shared-task/${task.share_link}`}
                    readOnly 
                    className="text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyShareLink}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/shared-task/${task.share_link}`, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* Warning for new shared tasks */}
            {watchedIsShared && !task && (
              <div className="p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded text-xs">
                <p className="text-blue-800 dark:text-blue-200">
                  {language === 'ar'
                    ? '⚠️ سيتم إنشاء رابط مشاركة خارجي بعد حفظ المهمة.'
                    : '⚠️ External share link will be generated after saving the task.'
                  }
                </p>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              {t('cancel', language)}
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading 
                ? (task ? t('updating', language) : t('creating', language))
                : (task ? t('update', language) : t('create', language))
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
