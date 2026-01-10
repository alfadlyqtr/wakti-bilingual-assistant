import React, { useState } from 'react';
import { Users, Search, Trash2, Ban, Check, Clock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface SiteUser {
  id: string;
  email: string;
  display_name: string | null;
  status: string | null;
  created_at: string;
  last_login: string | null;
}

interface BackendSiteUsersProps {
  users: SiteUser[];
  isRTL: boolean;
  onSuspend: (id: string) => void;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function BackendSiteUsers({ users, isRTL, onSuspend, onActivate, onDelete }: BackendSiteUsersProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return user.email.toLowerCase().includes(searchLower) || 
           (user.display_name?.toLowerCase().includes(searchLower));
  });

  if (users.length === 0) {
    return (
      <div className="p-8 text-center">
        <Users className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          {isRTL ? 'لا يوجد مستخدمين مسجلين' : 'No registered users yet'}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {isRTL ? 'سيظهر هنا المستخدمون المسجلون في موقعك' : 'Users who sign up on your site will appear here'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isRTL ? 'بحث بالإيميل أو الاسم...' : 'Search by email or name...'}
          className="pl-10 h-9 bg-muted/30 dark:bg-white/5 border-border/50"
        />
      </div>

      {/* User List */}
      <div className="space-y-2">
        {filteredUsers.map((user) => {
          const isActive = user.status === 'active';
          
          return (
            <div 
              key={user.id}
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl border transition-colors",
                isActive 
                  ? "border-border/50 dark:border-white/10 bg-card/50 dark:bg-white/5"
                  : "border-red-500/30 bg-red-500/5",
                isRTL && "flex-row-reverse"
              )}
            >
              {/* Avatar */}
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                isActive 
                  ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                  : "bg-red-500/20 text-red-600 dark:text-red-400"
              )}>
                {(user.display_name || user.email)[0].toUpperCase()}
              </div>
              
              {/* Info */}
              <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user.display_name || 'No name'}
                  </p>
                  {!isActive && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-500/20 text-red-600 dark:text-red-400">
                      {isRTL ? 'موقوف' : 'Suspended'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {user.email}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/70">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {isRTL ? 'انضم' : 'Joined'} {format(new Date(user.created_at), 'MMM d, yyyy')}
                  </span>
                  {user.last_login && (
                    <span>
                      {isRTL ? 'آخر دخول' : 'Last login'} {format(new Date(user.last_login), 'MMM d')}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {isActive ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                    onClick={() => onSuspend(user.id)}
                    title={isRTL ? 'إيقاف' : 'Suspend'}
                  >
                    <Ban className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                    onClick={() => onActivate(user.id)}
                    title={isRTL ? 'تفعيل' : 'Activate'}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  onClick={() => onDelete(user.id)}
                  title={isRTL ? 'حذف' : 'Delete'}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
