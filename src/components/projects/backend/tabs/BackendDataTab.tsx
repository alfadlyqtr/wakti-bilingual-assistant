import React, { useState } from 'react';
import { Database, Plus, Edit2, Trash2, Download, ChevronDown, FolderOpen, Table } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CollectionItem {
  id: string;
  collection_name: string;
  data: Record<string, any>;
  created_at: string | null;
  updated_at: string | null;
}

interface CollectionSchema {
  collection_name: string;
  display_name: string | null;
  schema: Record<string, { type: string; required?: boolean }>;
}

interface BackendDataTabProps {
  collections: Record<string, CollectionItem[]>;
  schemas: Record<string, CollectionSchema>;
  projectId: string;
  isRTL: boolean;
  onAdd: (collectionName: string, data: Record<string, any>) => void;
  onEdit: (item: CollectionItem, data: Record<string, any>) => void;
  onDelete: (id: string, collectionName: string) => void;
  onExport: (collectionName: string, items: CollectionItem[], format: 'csv' | 'json') => void;
}

export function BackendDataTab({ 
  collections, 
  schemas, 
  projectId, 
  isRTL, 
  onAdd, 
  onEdit, 
  onDelete,
  onExport 
}: BackendDataTabProps) {
  const collectionNames = Object.keys(collections);
  const [selectedCollection, setSelectedCollection] = useState<string>(collectionNames[0] || '');
  const [editingItem, setEditingItem] = useState<CollectionItem | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const currentItems = collections[selectedCollection] || [];
  const currentSchema = schemas[selectedCollection]?.schema || {};
  const displayName = schemas[selectedCollection]?.display_name || selectedCollection;

  // Infer schema from existing items if no schema defined
  const inferredSchema = React.useMemo(() => {
    if (Object.keys(currentSchema).length > 0) return currentSchema;
    if (currentItems.length === 0) return {};
    
    const firstItem = currentItems[0].data;
    const inferred: Record<string, { type: string }> = {};
    Object.entries(firstItem).forEach(([key, value]) => {
      let type = 'string';
      if (typeof value === 'number') type = 'number';
      else if (typeof value === 'boolean') type = 'boolean';
      else if (Array.isArray(value)) type = 'array';
      inferred[key] = { type };
    });
    return inferred;
  }, [currentSchema, currentItems]);

  const handleOpenAdd = () => {
    setFormData({});
    setEditingItem(null);
    setIsAddMode(true);
  };

  const handleOpenEdit = (item: CollectionItem) => {
    setFormData({ ...item.data });
    setEditingItem(item);
    setIsAddMode(true);
  };

  const handleCloseModal = () => {
    setIsAddMode(false);
    setEditingItem(null);
    setFormData({});
  };

  const handleSave = () => {
    if (editingItem) {
      onEdit(editingItem, formData);
    } else if (selectedCollection) {
      onAdd(selectedCollection, formData);
    }
    handleCloseModal();
  };

  const handleFieldChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const renderFieldInput = (key: string, fieldSchema: { type: string }) => {
    const value = formData[key] ?? '';
    
    switch (fieldSchema.type) {
      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(key, parseFloat(e.target.value) || 0)}
            className="h-10"
          />
        );
      case 'boolean':
        return (
          <div className="flex items-center gap-2 h-10">
            <Switch
              checked={!!value}
              onCheckedChange={(checked) => handleFieldChange(key, checked)}
            />
            <span className="text-sm text-muted-foreground">
              {value ? (isRTL ? 'نعم' : 'Yes') : (isRTL ? 'لا' : 'No')}
            </span>
          </div>
        );
      case 'array':
        return (
          <Textarea
            value={Array.isArray(value) ? value.join('\n') : value}
            onChange={(e) => handleFieldChange(key, e.target.value.split('\n').filter(Boolean))}
            placeholder={isRTL ? 'عنصر واحد في كل سطر' : 'One item per line'}
            rows={3}
          />
        );
      default:
        const isLongText = typeof value === 'string' && value.length > 100;
        if (isLongText) {
          return (
            <Textarea
              value={value}
              onChange={(e) => handleFieldChange(key, e.target.value)}
              rows={3}
            />
          );
        }
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(key, e.target.value)}
            className="h-10"
          />
        );
    }
  };

  if (collectionNames.length === 0) {
    return (
      <div className={cn("text-center py-16", isRTL && "rtl")}>
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center">
          <Database className="h-10 w-10 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground text-sm mb-2">
          {isRTL ? 'لا توجد مجموعات بيانات بعد' : 'No data collections yet'}
        </p>
        <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto">
          {isRTL 
            ? 'ستظهر المجموعات عندما يرسل موقعك بيانات ديناميكية'
            : 'Collections will appear when your site sends dynamic data'
          }
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", isRTL && "rtl")}>
      {/* Collection Selector & Actions */}
      <div className={cn("flex items-center justify-between gap-3 flex-wrap", isRTL && "flex-row-reverse")}>
        <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
          {collectionNames.length > 1 ? (
            <Select value={selectedCollection} onValueChange={setSelectedCollection}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder={isRTL ? 'اختر مجموعة' : 'Select collection'} />
              </SelectTrigger>
              <SelectContent>
                {collectionNames.map(name => (
                  <SelectItem key={name} value={name}>
                    <span className="flex items-center gap-2">
                      <Table className="h-3.5 w-3.5" />
                      {schemas[name]?.display_name || name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
              <Table className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{displayName}</span>
              <span className="text-xs text-muted-foreground">({currentItems.length})</span>
            </div>
          )}
        </div>

        <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport(selectedCollection, currentItems, 'json')}
            disabled={currentItems.length === 0}
            className="h-8"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport(selectedCollection, currentItems, 'csv')}
            disabled={currentItems.length === 0}
            className="h-8"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            CSV
          </Button>
          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="h-8"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {isRTL ? 'إضافة' : 'Add'}
          </Button>
        </div>
      </div>

      {/* Data Table */}
      {currentItems.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border/50 rounded-xl">
          <FolderOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'لا توجد عناصر في هذه المجموعة' : 'No items in this collection'}
          </p>
          <Button
            variant="link"
            size="sm"
            onClick={handleOpenAdd}
            className="mt-2"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {isRTL ? 'إضافة أول عنصر' : 'Add first item'}
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border/50">
                {Object.keys(inferredSchema).slice(0, 4).map(key => (
                  <th key={key} className={cn(
                    "px-4 py-3 font-medium text-muted-foreground",
                    isRTL ? "text-right" : "text-left"
                  )}>
                    {key.replace(/_/g, ' ')}
                  </th>
                ))}
                <th className={cn("px-4 py-3 w-24", isRTL ? "text-left" : "text-right")}>
                  {isRTL ? 'إجراءات' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((item, index) => (
                <tr 
                  key={item.id} 
                  className={cn(
                    "border-b border-border/30 hover:bg-muted/20 transition-colors",
                    index === currentItems.length - 1 && "border-b-0"
                  )}
                >
                  {Object.keys(inferredSchema).slice(0, 4).map(key => (
                    <td key={key} className={cn("px-4 py-3", isRTL && "text-right")}>
                      <span className="line-clamp-2">
                        {typeof item.data[key] === 'boolean' 
                          ? (item.data[key] ? '✓' : '✗')
                          : Array.isArray(item.data[key])
                            ? item.data[key].join(', ')
                            : String(item.data[key] ?? '-')
                        }
                      </span>
                    </td>
                  ))}
                  <td className={cn("px-4 py-3", isRTL ? "text-left" : "text-right")}>
                    <div className={cn("flex items-center gap-1", isRTL ? "justify-start" : "justify-end")}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => handleOpenEdit(item)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg text-destructive hover:text-destructive"
                        onClick={() => onDelete(item.id, selectedCollection)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isAddMode} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-lg" title={editingItem ? (isRTL ? 'تعديل العنصر' : 'Edit Item') : (isRTL ? 'إضافة عنصر' : 'Add Item')}>
          <DialogHeader>
            <DialogTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              {editingItem ? <Edit2 className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
              {editingItem 
                ? (isRTL ? 'تعديل العنصر' : 'Edit Item')
                : (isRTL ? 'إضافة عنصر جديد' : 'Add New Item')
              }
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {Object.keys(inferredSchema).length > 0 ? (
              Object.entries(inferredSchema).map(([key, fieldSchema]) => (
                <div key={key} className="space-y-2">
                  <Label className="text-sm font-medium capitalize">
                    {key.replace(/_/g, ' ')}
                  </Label>
                  {renderFieldInput(key, fieldSchema)}
                </div>
              ))
            ) : (
              <div className="space-y-2">
                <Label>{isRTL ? 'بيانات JSON' : 'JSON Data'}</Label>
                <Textarea
                  value={JSON.stringify(formData, null, 2)}
                  onChange={(e) => {
                    try {
                      setFormData(JSON.parse(e.target.value));
                    } catch {}
                  }}
                  rows={6}
                  placeholder='{"key": "value"}'
                  className="font-mono text-xs"
                />
              </div>
            )}
          </div>

          <DialogFooter className={cn("gap-2", isRTL && "flex-row-reverse")}>
            <Button variant="outline" onClick={handleCloseModal}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSave}>
              {editingItem 
                ? (isRTL ? 'حفظ التغييرات' : 'Save Changes')
                : (isRTL ? 'إضافة' : 'Add')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
