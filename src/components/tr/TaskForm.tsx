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
import { CalendarIcon, X, Plus, Trash2, Copy, ExternalLink, Clock, Sparkles, ImagePlus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRService, TRTask } from '@/services/trService';
import { toast } from 'sonner';
import { SubtaskManager } from '@/components/tr/SubtaskManager';
import { supabase } from '@/integrations/supabase/client';

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
  const [generatorPrompt, setGeneratorPrompt] = useState('');
  const [isGeneratingTask, setIsGeneratingTask] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const generateFileInputRef = React.useRef<HTMLInputElement>(null);

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

  // AI Tidy - extract subtasks from messy text
  const handleAITidy = async () => {
    if (!bulkInput.trim()) {
      toast.error(language === 'ar' ? 'الرجاء إدخال نص أولاً' : 'Please enter some text first');
      return;
    }
    
    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-subtasks', {
        body: { mode: 'text', text: bulkInput }
      });
      
      if (error) throw error;
      
      if (data?.subtasks?.length > 0) {
        setBulkInput(data.subtasks.join('\n'));
        toast.success(
          language === 'ar' 
            ? `تم استخراج ${data.subtasks.length} مهمة فرعية ✨` 
            : `Extracted ${data.subtasks.length} subtasks ✨`
        );
      } else {
        toast.info(language === 'ar' ? 'لم يتم العثور على مهام فرعية' : 'No subtasks found');
      }
    } catch (error) {
      console.error('AI Tidy error:', error);
      toast.error(language === 'ar' ? 'فشل في استخراج المهام' : 'Failed to extract subtasks');
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle image upload for OCR extraction
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(language === 'ar' ? 'الرجاء اختيار صورة' : 'Please select an image');
      return;
    }
    
    // Validate file size (max 4MB)
    if (file.size > 4 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'الصورة كبيرة جداً (الحد الأقصى 4MB)' : 'Image too large (max 4MB)');
      return;
    }
    
    setIsExtracting(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        
        const { data, error } = await supabase.functions.invoke('generate-subtasks', {
          body: { mode: 'image', imageBase64: base64 }
        });
        
        if (error) throw error;
        
        if (data?.subtasks?.length > 0) {
          setBulkInput(data.subtasks.join('\n'));
          toast.success(
            language === 'ar' 
              ? `تم استخراج ${data.subtasks.length} مهمة من الصورة ✨` 
              : `Extracted ${data.subtasks.length} subtasks from image ✨`
          );
        } else {
          toast.info(language === 'ar' ? 'لم يتم العثور على مهام في الصورة' : 'No subtasks found in image');
        }
        
        setIsExtracting(false);
      };
      reader.onerror = () => {
        toast.error(language === 'ar' ? 'فشل في قراءة الصورة' : 'Failed to read image');
        setIsExtracting(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error(language === 'ar' ? 'فشل في استخراج المهام من الصورة' : 'Failed to extract from image');
      setIsExtracting(false);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // AI Generate full task (title, description, due, priority, subtasks)
  const handleGenerateTask = async (mode: 'text' | 'image' = 'text', imageBase64?: string) => {
    if (mode === 'text') {
      const idea = generatorPrompt.trim();
      if (!idea) {
        toast.error(language === 'ar' ? 'اكتب فكرة للمهمة أولاً' : 'Please enter an idea for the task first');
        return;
      }
    }

    setIsGeneratingTask(true);
    try {
      const body: any = { language };
      if (mode === 'text') {
        body.prompt = generatorPrompt.trim();
      } else if (mode === 'image' && imageBase64) {
        body.imageBase64 = imageBase64;
      }

      const { data, error } = await supabase.functions.invoke('generate-task', { body });

      if (error) throw error;

      const taskData = data?.task;
      if (!taskData) {
        throw new Error('No task returned from AI');
      }

      // Fill main fields
      if (taskData.title) setValue('title', taskData.title);
      if (taskData.description) setValue('description', taskData.description);
      setValue('priority', taskData.priority ?? 'normal');

      // Optional due date / time
      setValue('due_date', taskData.due_date ?? null);
      setValue('due_time', taskData.due_time ?? null);

      // Subtasks
      const aiSubtasks: string[] = Array.isArray(taskData.subtasks)
        ? taskData.subtasks.filter((s: unknown) => typeof s === 'string' && s.trim().length > 0).map((s: string) => s.trim())
        : [];

      if (aiSubtasks.length > 0) {
        // Replace existing subtasks with AI ones
        const drafts: SubtaskDraft[] = aiSubtasks.map((title) => ({ title, due_date: null, due_time: null }));
        setSubtasks(drafts);
        setBulkInput(''); // Clear bulk input to avoid duplicate display
      }

      toast.success(
        language === 'ar'
          ? mode === 'image' 
            ? 'تم إنشاء مهمة من الصورة بالذكاء الاصطناعي ✨'
            : 'تم إنشاء مهمة كاملة بالذكاء الاصطناعي ✨'
          : mode === 'image'
            ? 'Generated task from image with AI ✨'
            : 'Generated a full task with AI ✨'
      );
    } catch (error) {
      console.error('Generate Task AI error:', error);
      toast.error(
        language === 'ar'
          ? 'فشل في إنشاء المهمة بالذكاء الاصطناعي'
          : 'Failed to generate task with AI'
      );
    } finally {
      setIsGeneratingTask(false);
    }
  };

  // Handle image upload for Generate Task
  const handleGenerateImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(language === 'ar' ? 'الرجاء اختيار صورة' : 'Please select an image');
      return;
    }
    
    // Validate file size (max 4MB)
    if (file.size > 4 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'الصورة كبيرة جداً (الحد الأقصى 4MB)' : 'Image too large (max 4MB)');
      return;
    }
    
    setIsGeneratingTask(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        
        // Call generate-task with image
        await handleGenerateTask('image', base64);
      };
      reader.onerror = () => {
        toast.error(language === 'ar' ? 'فشل في قراءة الصورة' : 'Failed to read image');
        setIsGeneratingTask(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Generate Task image upload error:', error);
      toast.error(language === 'ar' ? 'فشل في استخراج المهام من الصورة' : 'Failed to extract from image');
      setIsGeneratingTask(false);
    }
    
    // Reset file input
    if (generateFileInputRef.current) {
      generateFileInputRef.current.value = '';
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
          {/* AI Generate Task - Premium UI */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-fuchsia-500/10 p-4 border border-violet-500/20 shadow-sm">
            {/* Decorative glow */}
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-violet-500/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-8 -left-8 w-20 h-20 bg-fuchsia-500/15 rounded-full blur-2xl" />
            
            {/* Header */}
            <div className="relative flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                  {language === 'ar' ? 'مولّد المهام الذكي' : 'AI Task Generator'}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {language === 'ar' ? 'اكتب فكرة أو ارفع صورة' : 'Type an idea or upload an image'}
                </p>
              </div>
            </div>

            {/* Input area */}
            <div className="relative">
              <Textarea
                id="task_idea"
                value={generatorPrompt}
                onChange={(e) => setGeneratorPrompt(e.target.value)}
                placeholder={
                  language === 'ar'
                    ? 'مثال: تنظيم حفلة خطوبة الشهر القادم...'
                    : 'Example: Plan engagement party for next month...'
                }
                rows={2}
                className="text-sm resize-none bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border-violet-200 dark:border-violet-500/30 focus:border-violet-400 focus:ring-violet-400/20 rounded-xl"
                disabled={isGeneratingTask}
              />
              {/* Hidden file input */}
              <input
                ref={generateFileInputRef}
                type="file"
                accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.tiff"
                className="hidden"
                onChange={handleGenerateImageUpload}
                aria-label="Upload image"
              />
            </div>

            {/* Action buttons row */}
            <div className="relative flex items-center justify-between mt-3 gap-2">
              {/* Image upload button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 px-4 gap-2 rounded-xl border-violet-300 dark:border-violet-500/40 bg-white/60 dark:bg-gray-900/60 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:border-violet-400 text-violet-700 dark:text-violet-300 transition-all shadow-sm"
                onClick={() => generateFileInputRef.current?.click()}
                disabled={isGeneratingTask || isLoading}
              >
                {isGeneratingTask ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                <span className="text-xs font-semibold">
                  {language === 'ar' ? 'رفع صورة' : 'Upload Image'}
                </span>
              </Button>

              {/* Generate button */}
              <Button
                type="button"
                size="sm"
                className="h-10 px-5 gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 transition-all font-semibold"
                onClick={() => handleGenerateTask('text')}
                disabled={isGeneratingTask || isLoading || !generatorPrompt.trim()}
              >
                {isGeneratingTask ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">
                      {language === 'ar' ? 'جاري الإنشاء...' : 'Generating...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs">
                      {language === 'ar' ? 'إنشاء المهمة' : 'Generate'}
                    </span>
                  </>
                )}
              </Button>
            </div>
          </div>

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

          {/* Due Time - Always visible, optional */}
          <div className="space-y-2">
            <Label htmlFor="due_time">{t('dueTime', language)} {language === 'ar' ? '(اختياري)' : '(optional)'}</Label>
            <Input
              id="due_time"
              type="time"
              {...register('due_time')}
              className="text-base"
            />
            {/* Quick Time Chips - fewer than reminders */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { label: language === 'ar' ? '+15 د' : '+15m', minutes: 15 },
                { label: language === 'ar' ? '+30 د' : '+30m', minutes: 30 },
                { label: language === 'ar' ? '+1 س' : '+1h', minutes: 60 },
                { label: language === 'ar' ? '+2 س' : '+2h', minutes: 120 },
              ].map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 text-[11px] px-3 rounded-full bg-gradient-to-r from-primary/80 to-primary text-primary-foreground hover:from-primary hover:to-primary shadow-sm"
                  disabled={isLoading}
                  onClick={() => {
                    const currentDate = watch('due_date');
                    const currentTime = watch('due_time');
                    
                    let baseDate: Date;
                    
                    if (currentDate && currentTime) {
                      baseDate = new Date(currentDate);
                      const [hours, minutes] = currentTime.split(':').map(Number);
                      baseDate.setHours(hours, minutes, 0, 0);
                    } else {
                      // Start from now if no date/time set
                      baseDate = new Date();
                      baseDate.setSeconds(0, 0);
                      if (new Date().getSeconds() > 0) {
                        baseDate.setMinutes(baseDate.getMinutes() + 1);
                      }
                    }
                    
                    const targetDate = new Date(baseDate.getTime() + preset.minutes * 60000);
                    const targetTime = `${String(targetDate.getHours()).padStart(2, '0')}:${String(targetDate.getMinutes()).padStart(2, '0')}`;
                    
                    setValue('due_date', format(targetDate, 'yyyy-MM-dd'));
                    setValue('due_time', targetTime);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

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

                {/* Bulk Subtasks - Enhanced UI */}
                <div className="mt-4 relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-cyan-500/10 p-4 border border-emerald-500/20 shadow-sm">
                  {/* Decorative glow */}
                  <div className="absolute -top-10 -right-10 w-20 h-20 bg-emerald-500/15 rounded-full blur-2xl" />
                  <div className="absolute -bottom-6 -left-6 w-16 h-16 bg-cyan-500/10 rounded-full blur-2xl" />
                  
                  {/* Header with title and AI buttons */}
                  <div className="relative flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/20">
                        <Plus className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                          {language === 'ar' ? 'إضافة مجمّعة' : 'Bulk Subtasks'}
                        </h4>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* AI Tidy Button */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs gap-1.5 rounded-lg border-emerald-300 dark:border-emerald-500/40 bg-white/60 dark:bg-gray-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-400 text-emerald-700 dark:text-emerald-300 transition-all"
                        onClick={handleAITidy}
                        disabled={isExtracting || !bulkInput.trim()}
                        title={language === 'ar' ? 'تنظيف واستخراج بالذكاء الاصطناعي' : 'AI Tidy & Extract'}
                      >
                        {isExtracting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        <span>{language === 'ar' ? 'تنظيف' : 'Tidy'}</span>
                      </Button>
                      {/* Upload Image Button */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs gap-1.5 rounded-lg border-emerald-300 dark:border-emerald-500/40 bg-white/60 dark:bg-gray-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-400 text-emerald-700 dark:text-emerald-300 transition-all"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isExtracting}
                        title={language === 'ar' ? 'استخراج من صورة' : 'Extract from image'}
                      >
                        {isExtracting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ImagePlus className="h-3.5 w-3.5" />
                        )}
                        <span>{language === 'ar' ? 'صورة' : 'Image'}</span>
                      </Button>
                      {/* Hidden file input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.tiff"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </div>
                  </div>
                  
                  {/* Textarea with clear button */}
                  <div className="relative">
                    <Textarea
                      rows={3}
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                      placeholder={language === 'ar' ? 'ألصق نص من إيميل، واتساب، أو أي مصدر...' : 'Paste text from email, WhatsApp, or any source...'}
                      disabled={isExtracting}
                      className="text-sm bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border-emerald-200 dark:border-emerald-500/30 focus:border-emerald-400 focus:ring-emerald-400/20 rounded-xl pr-10"
                    />
                    {/* Clear button */}
                    {bulkInput.trim() && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 h-6 w-6 p-0 rounded-full hover:bg-red-100 dark:hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-all"
                        onClick={() => setBulkInput('')}
                        title={language === 'ar' ? 'مسح' : 'Clear'}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Loading indicator */}
                  {isExtracting && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {language === 'ar' ? 'جاري استخراج المهام...' : 'Extracting subtasks...'}
                    </div>
                  )}
                  
                  {/* Preview */}
                  {bulkInput.trim() && !isExtracting && (
                    <div className="mt-3">
                      <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">
                        {(() => {
                          const count = parseItems(bulkInput).length;
                          return language === 'ar' ? `✓ ${count} جاهزة` : `✓ ${count} ready`;
                        })()}
                        {parseItems(bulkInput).length > 100 && (
                          <span className="ml-2 text-red-500">{language === 'ar' ? '(الحد الأقصى 100)' : '(max 100)'}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {parseItems(bulkInput).slice(0, 20).map((it, idx) => (
                          <span key={idx} className="px-2.5 py-1 text-xs rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-white/70 dark:bg-gray-900/50 text-emerald-800 dark:text-emerald-200">
                            {it}
                          </span>
                        ))}
                        {parseItems(bulkInput).length > 20 && (
                          <span className="px-2.5 py-1 text-xs text-muted-foreground">+{parseItems(bulkInput).length - 20} more</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Action buttons */}
                  <div className="relative mt-3 flex justify-end">
                    <Button 
                      type="button" 
                      size="sm" 
                      className="h-9 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-500/25 hover:shadow-emerald-500/35 transition-all font-semibold text-xs"
                      onClick={handleBulkCreate} 
                      disabled={!bulkInput.trim() || isExtracting}
                    >
                      {language === 'ar' ? 'إنشاء المهام الفرعية' : 'Create Subtasks'}
                    </Button>
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
