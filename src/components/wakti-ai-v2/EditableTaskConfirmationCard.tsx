
import React, { useState } from 'react';
import { Calendar, Clock, CheckCircle, X, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/providers/ThemeProvider';
import { format } from 'date-fns';

interface EditableTaskConfirmationCardProps {
  type: 'task' | 'reminder';
  data: any;
  onConfirm: (editedData: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function EditableTaskConfirmationCard({ 
  type, 
  data, 
  onConfirm, 
  onCancel, 
  isLoading = false 
}: EditableTaskConfirmationCardProps) {
  const { language } = useTheme();
  
  const [editedData, setEditedData] = useState({
    title: data.title || '',
    description: data.description || '',
    subtasks: data.subtasks || [],
    due_date: data.due_date || '',
    due_time: data.due_time || '',
    priority: data.priority || 'normal'
  });

  const handleTitleChange = (value: string) => {
    setEditedData(prev => ({ ...prev, title: value }));
  };

  const handleDescriptionChange = (value: string) => {
    setEditedData(prev => ({ ...prev, description: value }));
  };

  const handleSubtaskChange = (index: number, value: string) => {
    const newSubtasks = [...editedData.subtasks];
    newSubtasks[index] = value;
    setEditedData(prev => ({ ...prev, subtasks: newSubtasks }));
  };

  const addSubtask = () => {
    setEditedData(prev => ({ 
      ...prev, 
      subtasks: [...prev.subtasks, ''] 
    }));
  };

  const removeSubtask = (index: number) => {
    const newSubtasks = editedData.subtasks.filter((_, i) => i !== index);
    setEditedData(prev => ({ ...prev, subtasks: newSubtasks }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedData(prev => ({ ...prev, due_date: e.target.value }));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedData(prev => ({ ...prev, due_time: e.target.value }));
  };

  const handleConfirm = () => {
    // Filter out empty subtasks
    const cleanedData = {
      ...editedData,
      subtasks: editedData.subtasks.filter(task => task.trim() !== '')
    };
    onConfirm(cleanedData);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="font-medium text-sm text-gray-900">
            {type === 'task' 
              ? (language === 'ar' ? 'تعديل وتأكيد المهمة' : 'Edit & Confirm Task')
              : (language === 'ar' ? 'تعديل وتأكيد التذكير' : 'Edit & Confirm Reminder')
            }
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
          disabled={isLoading}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      <div className="space-y-4">
        {/* Editable Title */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            {language === 'ar' ? 'العنوان:' : 'Title:'}
          </label>
          <Input
            value={editedData.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder={language === 'ar' ? 'أدخل عنوان المهمة' : 'Enter task title'}
            className="text-sm"
          />
        </div>

        {/* Editable Description */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            {language === 'ar' ? 'الوصف:' : 'Description:'}
          </label>
          <Input
            value={editedData.description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder={language === 'ar' ? 'وصف اختياري' : 'Optional description'}
            className="text-sm"
          />
        </div>

        {/* Editable Subtasks - Only show for tasks */}
        {type === 'task' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                {language === 'ar' ? 'المهام الفرعية:' : 'Subtasks:'}
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSubtask}
                className="h-6 px-2 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                {language === 'ar' ? 'إضافة' : 'Add'}
              </Button>
            </div>
            <div className="space-y-2">
              {editedData.subtasks.map((subtask: string, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={subtask}
                    onChange={(e) => handleSubtaskChange(index, e.target.value)}
                    placeholder={language === 'ar' ? 'مهمة فرعية' : 'Subtask'}
                    className="text-sm flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSubtask(index)}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Editable Date and Time */}
        <div className="grid grid-cols-2 gap-3">
          {/* Due Date */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              <Calendar className="h-3 w-3 inline mr-1" />
              {language === 'ar' ? 'التاريخ:' : 'Date:'}
            </label>
            <Input
              type="date"
              value={editedData.due_date}
              onChange={handleDateChange}
              className="text-sm"
            />
          </div>

          {/* Due Time */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              <Clock className="h-3 w-3 inline mr-1" />
              {language === 'ar' ? 'الوقت:' : 'Time:'}
            </label>
            <Input
              type="time"
              value={editedData.due_time}
              onChange={handleTimeChange}
              className="text-sm"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !editedData.title.trim()}
            className="flex-1"
            size="sm"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                {language === 'ar' ? 'جاري الإنشاء...' : 'Creating...'}
              </div>
            ) : (
              type === 'task' 
                ? (language === 'ar' ? 'إنشاء المهمة' : 'Create Task')
                : (language === 'ar' ? 'إنشاء التذكير' : 'Create Reminder')
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            size="sm"
          >
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>
  );
}
