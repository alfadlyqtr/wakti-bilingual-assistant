

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Users, Search, Filter, RefreshCw, Eye, UserX, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserProfileModal } from "@/components/admin/UserProfileModal";
import { UserActionModals } from "@/components/admin/UserActionModals";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  display_name: string;
  username?: string;
  created_at: string;
  is_subscribed?: boolean;
  subscription_status?: string;
  plan_name?: string;
  is_suspended?: boolean;
  suspended_at?: string;
  suspension_reason?: string;
  is_logged_in: boolean;
  email_confirmed: boolean;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionType, setActionType] = useState<'suspend' | 'delete' | null>(null);

  useEffect(() => {
    validateAdminSession();
    loadUsers();
  }, []);

  const validateAdminSession = async () => {
    const storedSession = localStorage.getItem('admin_session');
    if (!storedSession) {
      navigate('/mqtr');
      return;
    }

    try {
      const session = JSON.parse(storedSession);
      if (new Date(session.expires_at) < new Date()) {
        localStorage.removeItem('admin_session');
        navigate('/mqtr');
        return;
      }
    } catch (err) {
      navigate('/mqtr');
    }
  };

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('display_name', '[DELETED USER]')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Ensure all required fields have default values
      const processedUsers = (data || []).map(user => ({
        ...user,
        email: user.email || '',
        full_name: user.full_name || user.display_name || 'Unknown User',
        display_name: user.display_name || user.full_name || 'Unknown User',
        is_logged_in: user.is_logged_in ?? false,
        email_confirmed: user.email_confirmed ?? false
      }));
      
      setUsers(processedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserAction = (user: AdminUser, action: 'view' | 'suspend' | 'delete') => {
    setSelectedUser(user);
    
    if (action === 'view') {
      setShowProfileModal(true);
    } else if (action === 'suspend') {
      setShowDeactivateConfirm(true);
    } else if (action === 'delete') {
      setShowDeleteConfirm(true);
    }
  };

  const handleDeactivateUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_suspended: !selectedUser.is_suspended,
          suspended_at: !selectedUser.is_suspended ? new Date().toISOString() : null,
          suspension_reason: !selectedUser.is_suspended ? 'Admin action' : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success(`User ${selectedUser.is_suspended ? 'unsuspended' : 'suspended'} successfully`);
      setShowDeactivateConfirm(false);
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
          email: null,
          full_name: '[DELETED USER]',
          updated_at: new Date().toISOString()
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

  const handleActionCompleted = () => {
    loadUsers();
    setShowActionModal(false);
    setSelectedUser(null);
    setActionType(null);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === "all" || 
      (filterStatus === "subscribed" && user.is_subscribed) ||
      (filterStatus === "suspended" && user.is_suspended) ||
      (filterStatus === "active" && !user.is_suspended);
    
    return matchesSearch && matchesFilter;
  });

  if (isLoading) {
    return (
      <div className="bg-gradient-background min-h-screen p-4 flex items-center justify-center">
        <div className="text-foreground">Loading user management...</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-background min-h-screen text-foreground pb-20">
      {/* Header */}
      <AdminHeader
        title="User Management"
        subtitle={`${users.length} total users registered`}
        icon={<Users className="h-5 w-5 text-accent-blue" />}
      >
        <Button onClick={loadUsers} variant="outline" size="sm" className="text-xs">
          <RefreshCw className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </AdminHeader>

      {/* Main Content */}
      <div className="p-3 sm:p-4 space-y-4 sm:space-y-6">
        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-gradient-card border-border/50 hover:border-accent-blue/30 transition-all duration-300 hover:shadow-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-enhanced-heading flex items-center text-xs sm:text-sm">
                <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-accent-blue" />
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-enhanced-heading">{users.length}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-border/50 hover:border-accent-green/30 transition-all duration-300 hover:shadow-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-enhanced-heading flex items-center text-xs sm:text-sm">
                <Shield className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-accent-green" />
                Active Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-accent-green">
                {users.filter(u => !u.is_suspended).length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-border/50 hover:border-accent-orange/30 transition-all duration-300 hover:shadow-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-enhanced-heading flex items-center text-xs sm:text-sm">
                <UserX className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-accent-orange" />
                Suspended
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-accent-orange">
                {users.filter(u => u.is_suspended).length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-border/50 hover:border-accent-purple/30 transition-all duration-300 hover:shadow-glow">
            <CardHeader className="pb-2">
              <CardTitle className="text-enhanced-heading flex items-center text-xs sm:text-sm">
                <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 text-accent-purple" />
                Subscribers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-accent-purple">
                {users.filter(u => u.is_subscribed).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Search and Filter Controls */}
        <Card className="bg-gradient-card border-border/50 shadow-soft">
          <CardHeader>
            <CardTitle className="text-enhanced-heading text-sm sm:text-base">User Directory</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Search and manage user accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="flex-1">
                <Label htmlFor="search" className="text-xs sm:text-sm">Search Users</Label>
                <Input
                  id="search"
                  placeholder="Search by email, name, or username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-1 text-xs sm:text-sm bg-background/50 border-border/50 focus:border-accent-blue/50"
                />
              </div>
              <div className="w-full sm:w-48">
                <Label className="text-xs sm:text-sm">Filter by Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="mt-1 text-xs sm:text-sm bg-background/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="active">Active Users</SelectItem>
                    <SelectItem value="suspended">Suspended Users</SelectItem>
                    <SelectItem value="subscribed">Subscribers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Enhanced Users List */}
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div key={user.id} className="bg-gradient-card border border-border/30 rounded-xl p-4 hover:border-border/50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-enhanced-heading text-sm sm:text-base truncate">
                          {user.email || 'No email'}
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground truncate">
                          {user.display_name || user.full_name || user.username || 'No name set'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Joined: {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end space-x-2 sm:space-x-3">
                      <div className="flex flex-wrap gap-1">
                        {user.is_subscribed && (
                          <Badge variant="secondary" className="bg-accent-green/20 text-accent-green text-xs border-accent-green/30">
                            Subscriber
                          </Badge>
                        )}
                        {user.is_suspended && (
                          <Badge variant="destructive" className="text-xs">
                            Suspended
                          </Badge>
                        )}
                        {user.is_logged_in && (
                          <Badge variant="outline" className="text-xs border-accent-blue text-accent-blue">
                            Online
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleUserAction(user, 'view')}
                          className="text-xs px-2 sm:px-3 hover:bg-accent-blue/10 hover:border-accent-blue/30"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          <span className="hidden sm:inline">View</span>
                        </Button>
                        
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleUserAction(user, 'suspend')}
                          className={`text-xs px-2 sm:px-3 ${user.is_suspended ? 'text-accent-green hover:bg-accent-green/10 hover:border-accent-green/30' : 'text-accent-orange hover:bg-accent-orange/10 hover:border-accent-orange/30'}`}
                        >
                          <UserX className="h-3 w-3 mr-1" />
                          <span className="hidden sm:inline">
                            {user.is_suspended ? 'Unsuspend' : 'Suspend'}
                          </span>
                        </Button>
                        
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleUserAction(user, 'delete')}
                          className="text-xs px-2 sm:px-3 hover:bg-destructive/90"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          <span className="hidden sm:inline">Delete</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => {
          setShowProfileModal(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
      />

      {/* Deactivate Confirmation Dialog */}
      <Dialog open={showDeactivateConfirm} onOpenChange={setShowDeactivateConfirm}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base">
              {selectedUser?.is_suspended ? 'Unsuspend User' : 'Suspend User'}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Are you sure you want to {selectedUser?.is_suspended ? 'unsuspend' : 'suspend'} {selectedUser?.email}?
              {!selectedUser?.is_suspended && " This will prevent them from accessing the app."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeactivateConfirm(false);
                setSelectedUser(null);
              }}
              size="sm" 
              className="text-xs"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleDeactivateUser}
              className={`text-xs ${selectedUser?.is_suspended ? 'btn-enhanced' : 'bg-accent-orange hover:bg-accent-orange/90'}`}
              size="sm"
            >
              {selectedUser?.is_suspended ? 'Unsuspend' : 'Suspend'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base text-destructive">Delete User</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Are you sure you want to delete {selectedUser?.email}? This action cannot be undone and will permanently remove all user data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeleteConfirm(false);
                setSelectedUser(null);
              }}
              size="sm" 
              className="text-xs"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteUser}
              size="sm"
              className="text-xs"
            >
              Delete User
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Action Modals */}
      <UserActionModals
        isOpen={showActionModal}
        onClose={() => {
          setShowActionModal(false);
          setSelectedUser(null);
          setActionType(null);
        }}
        user={selectedUser}
        actionType={actionType}
        onActionCompleted={handleActionCompleted}
      />

      {/* Admin Mobile Navigation */}
      <AdminMobileNav />
    </div>
  );
}
