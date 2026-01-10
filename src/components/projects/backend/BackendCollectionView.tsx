import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Download, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface CollectionItem {
  id: string;
  data: Record<string, any>;
  status?: string;
  created_at: string;
}

interface BackendCollectionViewProps {
  collectionName: string;
  displayName?: string;
  items: CollectionItem[];
  schema?: Record<string, any>;
  isRTL: boolean;
  onAdd: () => void;
  onEdit: (item: CollectionItem) => void;
  onDelete: (id: string) => void;
  onExport: (format: 'csv' | 'json') => void;
}

export function BackendCollectionView({ 
  collectionName,
  displayName,
  items, 
  schema,
  isRTL, 
  onAdd, 
  onEdit, 
  onDelete,
  onExport
}: BackendCollectionViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Get column headers from schema or first item
  const getColumns = () => {
    if (schema?.fields) {
      return Object.keys(schema.fields);
    }
    if (items.length > 0) {
      return Object.keys(items[0].data).slice(0, 5);
    }
    return [];
  };

  const columns = getColumns();

  // Filter items
  const filteredItems = items.filter(item => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return Object.values(item.data).some(val => 
      String(val).toLowerCase().includes(searchLower)
    );
  });

  // Paginate
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (items.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-muted/50 dark:bg-white/10 flex items-center justify-center mx-auto mb-3">
          <Plus className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          {isRTL ? 'لا توجد عناصر' : `No ${displayName || collectionName} yet`}
        </p>
        <Button onClick={onAdd} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4 mr-1" />
          {isRTL ? 'إضافة' : 'Add First Item'}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Toolbar */}
      <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isRTL ? 'بحث...' : 'Search...'}
            className="pl-10 h-9 bg-muted/30 dark:bg-white/5 border-border/50"
          />
        </div>
        
        <Button onClick={onAdd} size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-9">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">{isRTL ? 'إضافة' : 'Add'}</span>
        </Button>
        
        <div className="flex items-center gap-1">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9"
            onClick={() => onExport('csv')}
          >
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9"
            onClick={() => onExport('json')}
          >
            JSON
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border/50 dark:border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 dark:bg-white/5">
            <tr>
              {columns.map(col => (
                <th 
                  key={col} 
                  className={cn(
                    "px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                    isRTL ? "text-right" : "text-left"
                  )}
                >
                  {col}
                </th>
              ))}
              <th className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
                {isRTL ? 'إجراءات' : 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 dark:divide-white/10">
            {paginatedItems.map((item) => (
              <tr 
                key={item.id}
                className="hover:bg-muted/20 dark:hover:bg-white/5 transition-colors"
              >
                {columns.map(col => (
                  <td 
                    key={col} 
                    className={cn(
                      "px-4 py-3 text-foreground",
                      isRTL ? "text-right" : "text-left"
                    )}
                  >
                    {typeof item.data[col] === 'object' 
                      ? JSON.stringify(item.data[col]).slice(0, 30) 
                      : String(item.data[col] || '-').slice(0, 50)}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEdit(item)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => onDelete(item.id)}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
          <p className="text-xs text-muted-foreground">
            {isRTL 
              ? `عرض ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredItems.length)} من ${filteredItems.length}`
              : `Showing ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredItems.length)} of ${filteredItems.length}`}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
