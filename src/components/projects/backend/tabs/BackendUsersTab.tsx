import React, { useState } from 'react';
import { Users, Search, UserX, UserCheck, Trash2, Calendar, Clock, Mail, ShieldCheck, ShieldOff, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SiteUser {
  id: string;
  email: string;
  display_name: string | null;
  status: string | null;
  created_at: string | null;
  last_login: string | null;
}

interface BackendUsersTabProps {
  users: SiteUser[];
  isRTL: boolean;
  onSuspend: (id: string) => void;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function BackendUsersTab({ users, isRTL, onSuspend, onActivate, onDelete }: BackendUsersTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      (user.display_name?.toLowerCase().includes(query))
    );
  });

  const activeCount = users.filter(u => u.status === 'active').length;
  const suspendedCount = users.filter(u => u.status === 'suspended').length;

  const getInitials = (user: SiteUser) => {
    if (user.display_name) {
      return user.display_name.charAt(0).toUpperCase();
    }
    return user.email.charAt(0).toUpperCase();
  };

  const handleConfirmDelete = () => {
    if (deleteUserId) {
      onDelete(deleteUserId);
      setDeleteUserId(null);
    }
  };

  if (users.length === 0) {
    return (
      <div className={cn("text-center py-16", isRTL && "rtl")}>
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center">
          <Users className="h-10 w-10 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground text-sm mb-2">
          {isRTL ? 'لا يوجد مستخدمون مسجلون بعد' : 'No registered users yet'}
        </p>
        <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto">
          {isRTL 
            ? 'سيظهر المستخدمون عندما يسجلون في موقعك المنشور'
            : 'Users will appear when they register on your published site'
          }
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", isRTL && "rtl")}>
      {/* Stats & Search */}
      <div className={cn("flex items-center justify-between gap-3 flex-wrap", isRTL && "flex-row-reverse")}>
        {/* Stats */}
        <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-green/10 text-green-600 dark:text-green-400">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-sm font-medium">{activeCount} {isRTL ? 'نشط' : 'active'}</span>
          </div>
          {suspendedCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive">
              <ShieldOff className="h-4 w-4" />
              <span className="text-sm font-medium">{suspendedCount} {isRTL ? 'معلق' : 'suspended'}</span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className={cn(
            "absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground",
            isRTL ? "right-3" : "left-3"
          )} />
          <Input
            placeholder={isRTL ? 'بحث عن مستخدم...' : 'Search users...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn("h-9", isRTL ? "pr-9" : "pl-9")}
          />
        </div>
      </div>

      {/* Users List */}
      {filteredUsers.length === 0 ? (
        <div className="text-center py-12">
          <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'لا توجد نتائج للبحث' : 'No users found'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map((user) => {
            const isActive = user.status === 'active';
            const isSuspended = user.status === 'suspended';

            return (
              <div
                key={user.id}
                className={cn(
                  "group p-4 rounded-xl border transition-all duration-200",
                  isSuspended 
                    ? "bg-destructive/5 border-destructive/20" 
                    : "bg-card border-border/50 hover:border-border",
                  "hover:shadow-md"
                )}
              >
                <div className={cn("flex items-center gap-4", isRTL && "flex-row-reverse")}>
                  {/* Avatar */}
                  <div className={cn(
                    "shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold",
                    isActive 
                      ? "bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20 text-primary" 
                      : "bg-muted/50 text-muted-foreground"
                  )}>
                    {getInitials(user)}
                  </div>

                  {/* Info */}
                  <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
                    <div className={cn("flex items-center gap-2 mb-1", isRTL && "flex-row-reverse")}>
                      <span className="font-semibold text-foreground truncate">
                        {user.display_name || user.email.split('@')[0]}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        isActive 
                          ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                          : "bg-destructive/10 text-destructive"
                      )}>
                        {isActive ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'معلق' : 'Suspended')}
                      </span>
                    </div>
                    
                    <div className={cn("flex items-center gap-1 text-sm text-muted-foreground mb-2", isRTL && "flex-row-reverse")}>
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{user.email}</span>
                    </div>

                    <div className={cn("flex items-center gap-4 text-xs text-muted-foreground", isRTL && "flex-row-reverse")}>
                      <div className={cn("flex items-center gap-1", isRTL && "flex-row-reverse")}>
                        <Calendar className="h-3 w-3" />
                        <span>{isRTL ? 'انضم:' : 'Joined:'}</span>
                        {user.created_at && format(new Date(user.created_at), 'MMM d, yyyy')}
                      </div>
                      {user.last_login && (
                        <div className={cn("flex items-center gap-1", isRTL && "flex-row-reverse")}>
                          <Clock className="h-3 w-3" />
                          <span>{isRTL ? 'آخر دخول:' : 'Last login:'}</span>
                          {format(new Date(user.last_login), 'MMM d, h:mm a')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 rounded-lg shrink-0"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isRTL ? "start" : "end"}>
                      {isActive ? (
                        <DropdownMenuItem 
                          onClick={() => onSuspend(user.id)}
                          className="text-amber-600 dark:text-amber-400"
                        >
                          <ShieldOff className="h-4 w-4 mr-2" />
                          {isRTL ? 'تعليق الحساب' : 'Suspend User'}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem 
                          onClick={() => onActivate(user.id)}
                          className="text-green-600 dark:text-green-400"
                        >
                          <ShieldCheck className="h-4 w-4 mr-2" />
                          {isRTL ? 'تفعيل الحساب' : 'Activate User'}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setDeleteUserId(user.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {isRTL ? 'حذف المستخدم' : 'Delete User'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRTL ? 'حذف المستخدم' : 'Delete User'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL 
                ? 'هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.'
                : 'Are you sure you want to delete this user? This action cannot be undone.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={cn(isRTL && "flex-row-reverse")}>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRTL ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
