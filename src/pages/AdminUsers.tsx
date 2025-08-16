import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminMobileNav } from '@/components/admin/AdminMobileNav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, RefreshCw, Search, Shield, Users } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  display_name: string;
  is_suspended: boolean;
  is_logged_in: boolean;
  email_confirmed: boolean;
  suspended_at?: string;
  suspension_reason?: string;
  subscription_status?: string;
  created_at: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          display_name,
          is_suspended,
          email_confirmed,
          suspended_at,
          suspension_reason,
          subscription_status,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[AdminUsers] Database error:', error);
        toast.error(`Database error: ${error.message}`);
        return;
      }

      if (!data || data.length === 0) {
        console.warn('[AdminUsers] No users found in database');
        toast.info('No users found in the database');
        setUsers([]);
        return;
      }
      
      const processedUsers = data.map(user => ({
        ...user,
        email: user.email || '',
        full_name: user.display_name || 'Unknown User',
        display_name: user.display_name || 'Unknown User',
        is_logged_in: user.is_logged_in ?? false,
        email_confirmed: user.email_confirmed ?? false,
        is_suspended: user.is_suspended ?? false
      }));
      
      setUsers(processedUsers);
      toast.success(`Loaded ${processedUsers.length} users successfully`);
    } catch (error) {
      console.error('[AdminUsers] Exception:', error);
      toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuspendUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_suspended: !selectedUser.is_suspended,
          suspended_at: !selectedUser.is_suspended ? new Date().toISOString() : null,
          suspension_reason: !selectedUser.is_suspended ? 'Admin action' : null
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success(`User ${selectedUser.is_suspended ? 'unsuspended' : 'suspended'} successfully`);
      setShowSuspendConfirm(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user status');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: '[DELETED USER]',
          email: null
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success('User deleted successfully');
      setShowDeleteConfirm(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterStatus === "all") return matchesSearch;
    if (filterStatus === "active") return matchesSearch && !user.is_suspended;
    if (filterStatus === "suspended") return matchesSearch && user.is_suspended;
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader 
        title="User Management"
        icon={<Users className="h-5 w-5" />}
      >
        <Button onClick={loadUsers} variant="outline" size="sm" className="text-xs">
          <RefreshCw className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </AdminHeader>

      <div className="p-4 space-y-6">
        {/* User Statistics */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">📊 User Statistics</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Total Users</span>
              </div>
              <span className="text-lg font-bold text-blue-500">{users.length}</span>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Active Users</span>
              </div>
              <span className="text-lg font-bold text-green-500">{users.filter(u => !u.is_suspended).length}</span>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">Suspended Users</span>
              </div>
              <span className="text-lg font-bold text-red-500">{users.filter(u => u.is_suspended).length}</span>
            </div>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="w-full lg:w-48">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="active">Active Users</SelectItem>
                <SelectItem value="suspended">Suspended Users</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* User Cards */}
        <div className="grid gap-4">
          {isLoading ? (
            <div className="text-center py-8">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8">No users found</div>
          ) : (
            filteredUsers.map((user) => (
              <Card key={user.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{user.display_name}</h3>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Status: {user.is_suspended ? 'Suspended' : 'Active'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setShowSuspendConfirm(true);
                      }}
                    >
                      {user.is_suspended ? 'Unsuspend' : 'Suspend'}
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Suspend Confirmation Dialog */}
      <Dialog open={showSuspendConfirm} onOpenChange={setShowSuspendConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser?.is_suspended ? 'Unsuspend' : 'Suspend'} User</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to {selectedUser?.is_suspended ? 'unsuspend' : 'suspend'} {selectedUser?.display_name}?</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => {
              setShowSuspendConfirm(false);
              setSelectedUser(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSuspendUser}>
              {selectedUser?.is_suspended ? 'Unsuspend' : 'Suspend'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete {selectedUser?.display_name}? This action cannot be undone.</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => {
              setShowDeleteConfirm(false);
              setSelectedUser(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AdminMobileNav />
    </div>
  );
}
