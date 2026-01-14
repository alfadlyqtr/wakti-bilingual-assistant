import React, { useState } from 'react';
import { 
  Shield, Search, Users, Settings, Check, X, Crown, User, UserCog,
  MoreHorizontal, RefreshCw, Edit, Trash2, Plus, Key, Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BackendRolesTabProps {
  users: any[];
  projectId: string;
  isRTL: boolean;
  onRefresh: () => void;
}

type RoleType = 'admin' | 'staff' | 'customer';

interface Permission {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
}

const PERMISSIONS: Permission[] = [
  { id: 'view_orders', name: 'View Orders', nameAr: 'عرض الطلبات', description: 'Can view all orders', descriptionAr: 'يمكنه عرض جميع الطلبات' },
  { id: 'manage_orders', name: 'Manage Orders', nameAr: 'إدارة الطلبات', description: 'Can update order status', descriptionAr: 'يمكنه تحديث حالة الطلب' },
  { id: 'view_products', name: 'View Products', nameAr: 'عرض المنتجات', description: 'Can view all products', descriptionAr: 'يمكنه عرض جميع المنتجات' },
  { id: 'manage_products', name: 'Manage Products', nameAr: 'إدارة المنتجات', description: 'Can add/edit/delete products', descriptionAr: 'يمكنه إضافة/تعديل/حذف المنتجات' },
  { id: 'view_bookings', name: 'View Bookings', nameAr: 'عرض الحجوزات', description: 'Can view all bookings', descriptionAr: 'يمكنه عرض جميع الحجوزات' },
  { id: 'manage_bookings', name: 'Manage Bookings', nameAr: 'إدارة الحجوزات', description: 'Can confirm/cancel bookings', descriptionAr: 'يمكنه تأكيد/إلغاء الحجوزات' },
  { id: 'view_users', name: 'View Users', nameAr: 'عرض المستخدمين', description: 'Can view user list', descriptionAr: 'يمكنه عرض قائمة المستخدمين' },
  { id: 'manage_users', name: 'Manage Users', nameAr: 'إدارة المستخدمين', description: 'Can suspend/delete users', descriptionAr: 'يمكنه إيقاف/حذف المستخدمين' },
  { id: 'view_comments', name: 'View Comments', nameAr: 'عرض التعليقات', description: 'Can view all comments', descriptionAr: 'يمكنه عرض جميع التعليقات' },
  { id: 'moderate_comments', name: 'Moderate Comments', nameAr: 'إدارة التعليقات', description: 'Can approve/delete comments', descriptionAr: 'يمكنه الموافقة/حذف التعليقات' },
  { id: 'access_chat', name: 'Access Chat', nameAr: 'الوصول للدردشة', description: 'Can respond to customer chats', descriptionAr: 'يمكنه الرد على دردشات العملاء' },
  { id: 'access_analytics', name: 'Access Analytics', nameAr: 'الوصول للإحصائيات', description: 'Can view site analytics', descriptionAr: 'يمكنه عرض إحصائيات الموقع' },
];

const ROLE_PRESETS: Record<RoleType, string[]> = {
  admin: PERMISSIONS.map(p => p.id), // All permissions
  staff: ['view_orders', 'manage_orders', 'view_products', 'view_bookings', 'manage_bookings', 'view_comments', 'moderate_comments', 'access_chat'],
  customer: [] // No special permissions
};

const ROLE_ICONS: Record<RoleType, any> = {
  admin: Crown,
  staff: UserCog,
  customer: User
};

const ROLE_COLORS: Record<RoleType, string> = {
  admin: 'text-red-500 bg-red-500/20',
  staff: 'text-amber-500 bg-amber-500/20',
  customer: 'text-blue-500 bg-blue-500/20'
};

export function BackendRolesTab({ users, projectId, isRTL, onRefresh }: BackendRolesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const t = (en: string, ar: string) => isRTL ? ar : en;

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = searchQuery === '' || 
      user.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Stats
  const adminCount = users.filter(u => u.role === 'admin').length;
  const staffCount = users.filter(u => u.role === 'staff').length;
  const customerCount = users.filter(u => u.role === 'customer' || !u.role).length;

  const handleChangeRole = async (userId: string, newRole: RoleType) => {
    try {
      const permissions = ROLE_PRESETS[newRole];
      
      const { error } = await supabase
        .from('project_site_users')
        .update({ 
          role: newRole, 
          permissions: permissions,
          updated_at: new Date().toISOString() 
        })
        .eq('id', userId);
      
      if (error) throw error;
      toast.success(t('Role updated', 'تم تحديث الدور'));
      onRefresh();
    } catch (err) {
      toast.error(t('Failed to update role', 'فشل تحديث الدور'));
    }
  };

  const handleOpenPermissions = (user: any) => {
    setSelectedUser(user);
    setSelectedPermissions(user.permissions || ROLE_PRESETS[user.role as RoleType] || []);
    setShowPermissions(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('project_site_users')
        .update({ 
          permissions: selectedPermissions,
          updated_at: new Date().toISOString() 
        })
        .eq('id', selectedUser.id);
      
      if (error) throw error;
      toast.success(t('Permissions saved', 'تم حفظ الصلاحيات'));
      setShowPermissions(false);
      setSelectedUser(null);
      onRefresh();
    } catch (err) {
      toast.error(t('Failed to save permissions', 'فشل حفظ الصلاحيات'));
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permId) 
        ? prev.filter(p => p !== permId)
        : [...prev, permId]
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Shield className="h-5 w-5 text-red-500" />
          {t('Roles & Permissions', 'الأدوار والصلاحيات')}
        </h3>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Role Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="h-4 w-4 text-red-500" />
            <span className="text-xs text-muted-foreground">{t('Admins', 'المديرون')}</span>
          </div>
          <p className="text-lg font-bold text-red-500">{adminCount}</p>
        </div>
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-1">
            <UserCog className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">{t('Staff', 'الموظفون')}</span>
          </div>
          <p className="text-lg font-bold text-amber-500">{staffCount}</p>
        </div>
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">{t('Customers', 'العملاء')}</span>
          </div>
          <p className="text-lg font-bold text-blue-500">{customerCount}</p>
        </div>
      </div>

      {/* Role Descriptions */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
        <h4 className="font-medium text-foreground flex items-center gap-2">
          <Key className="h-4 w-4" />
          {t('Role Definitions', 'تعريفات الأدوار')}
        </h4>
        <div className="grid gap-2">
          {(['admin', 'staff', 'customer'] as RoleType[]).map(role => {
            const RoleIcon = ROLE_ICONS[role];
            return (
              <div key={role} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                <div className={cn("p-1.5 rounded-lg", ROLE_COLORS[role])}>
                  <RoleIcon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm capitalize">{role}</p>
                  <p className="text-xs text-muted-foreground">
                    {role === 'admin' && t('Full access to all features', 'وصول كامل لجميع الميزات')}
                    {role === 'staff' && t('Can manage orders, bookings & content', 'يمكنه إدارة الطلبات والحجوزات والمحتوى')}
                    {role === 'customer' && t('Regular user with no special permissions', 'مستخدم عادي بدون صلاحيات خاصة')}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {ROLE_PRESETS[role].length} {t('permissions', 'صلاحية')}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={t('Search users...', 'بحث في المستخدمين...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white/5 border-white/10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[120px] bg-white/5 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('All Roles', 'كل الأدوار')}</SelectItem>
            <SelectItem value="admin">{t('Admin', 'مدير')}</SelectItem>
            <SelectItem value="staff">{t('Staff', 'موظف')}</SelectItem>
            <SelectItem value="customer">{t('Customer', 'عميل')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users List */}
      {filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-2xl bg-red-500/10 mb-4">
            <Shield className="h-10 w-10 text-red-500" />
          </div>
          <h4 className="font-semibold text-foreground mb-1">{t('No Users', 'لا يوجد مستخدمون')}</h4>
          <p className="text-sm text-muted-foreground max-w-xs">
            {t('Users who sign up on your site will appear here', 'المستخدمون الذين يسجلون على موقعك سيظهرون هنا')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map((user: any) => {
            const role = (user.role || 'customer') as RoleType;
            const RoleIcon = ROLE_ICONS[role];
            
            return (
              <div key={user.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={cn("p-2 rounded-full", ROLE_COLORS[role])}>
                    <RoleIcon className="h-4 w-4" />
                  </div>
                  
                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground truncate">
                        {user.display_name || user.email?.split('@')[0] || t('User', 'مستخدم')}
                      </h4>
                      <Badge variant="outline" className={cn(
                        "text-xs capitalize",
                        role === 'admin' && "border-red-500/30 text-red-500",
                        role === 'staff' && "border-amber-500/30 text-amber-500",
                        role === 'customer' && "border-blue-500/30 text-blue-500"
                      )}>
                        {role}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                  </div>
                  
                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'admin')}>
                        <Crown className="h-4 w-4 mr-2 text-red-500" />
                        {t('Make Admin', 'جعله مديراً')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'staff')}>
                        <UserCog className="h-4 w-4 mr-2 text-amber-500" />
                        {t('Make Staff', 'جعله موظفاً')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleChangeRole(user.id, 'customer')}>
                        <User className="h-4 w-4 mr-2 text-blue-500" />
                        {t('Make Customer', 'جعله عميلاً')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleOpenPermissions(user)}>
                        <Lock className="h-4 w-4 mr-2" />
                        {t('Custom Permissions', 'صلاحيات مخصصة')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Permissions Dialog */}
      <Dialog open={showPermissions} onOpenChange={setShowPermissions}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              {t('Custom Permissions', 'صلاحيات مخصصة')}
            </DialogTitle>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4">
              {/* User Info */}
              <div className="p-3 rounded-lg bg-white/5 flex items-center gap-3">
                <div className={cn("p-2 rounded-full", ROLE_COLORS[selectedUser.role as RoleType || 'customer'])}>
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">{selectedUser.display_name || selectedUser.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedUser.role || 'customer'}</p>
                </div>
              </div>
              
              {/* Permissions List */}
              <div className="space-y-2">
                {PERMISSIONS.map(perm => (
                  <div 
                    key={perm.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{isRTL ? perm.nameAr : perm.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {isRTL ? perm.descriptionAr : perm.description}
                      </p>
                    </div>
                    <Switch 
                      checked={selectedPermissions.includes(perm.id)}
                      onCheckedChange={() => togglePermission(perm.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowPermissions(false)}>
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button 
              onClick={handleSavePermissions}
              disabled={saving}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {t('Save Permissions', 'حفظ الصلاحيات')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
