
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Shield, Users, Search, Filter, RefreshCw, Eye, UserX, Trash2, AlertTriangle, User, CheckCircle, Clock } from "lucide-react";
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
  const { isAdmin, isLoading: authLoading } = useAdminAuth();
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
    if (!authLoading && !isAdmin) {
      navigate('/mqtr');
      return;
    }
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin, authLoading, navigate]);

  const checkAdminSession = async () => {
    const { validateAdminSession } = await import('@/utils/adminAuth');
    const isValid = await validateAdminSession();
    if (!isValid) {
      navigate('/mqtr');
    }
  };

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      console.log('[AdminUsers] Starting loadUsers...');
      
      // Test admin authentication
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('[AdminUsers] Current auth session:', { 
        user: sessionData?.session?.user?.id, 
        error: sessionError 
      });

      // Test if we can access profiles directly
      console.log('[AdminUsers] Testing direct profile access...');
      const { data: testData, error: testError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .limit(1);
      
      console.log('[AdminUsers] Test query result:', { testData, testError });

      // Main query
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('display_name', '[DELETED USER]')
        .order('created_at', { ascending: false });

      console.log('[AdminUsers] Main query result:', { 
        dataCount: data?.length, 
        error,
        sampleData: data?.slice(0, 2)
      });

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
      
      // Ensure all required fields have default values
      const processedUsers = (data || []).map(user => ({
        ...user,
        email: user.email || '',
        full_name: user.full_name || user.display_name || 'Unknown User',
        display_name: user.display_name || user.full_name || 'Unknown User',
        is_logged_in: user.is_logged_in ?? false,
        email_confirmed: user.email_confirmed ?? false
      }));
      
      console.log('[AdminUsers] Successfully processed users:', processedUsers.length);
      setUsers(processedUsers);
      toast.success(`Loaded ${processedUsers.length} users successfully`);
    } catch (error) {
      console.error('[AdminUsers] Exception in loadUsers:', error);
      toast.error(`Exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  // Show loading while auth is being validated
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0c0f14] text-white/90 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Validating admin access...</p>
        </div>
      </div>
    );
  }

  // Redirect handled by useEffect
  if (!isAdmin) {
    return null;
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === "all" || 
      (filterStatus === "subscribed" && user.is_subscribed) ||
      (filterStatus === "suspended" && user.is_suspended) ||
      (filterStatus === "active" && !user.is_suspended) ||
      (filterStatus === "expired" && user.subscription_status === 'expired');
    
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
      <div className="p-4 space-y-6">
        {/* Line Style Stats */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-enhanced-heading">📊 User Statistics</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 border border-border/30 rounded-lg hover:bg-accent/5 transition-colors">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-accent-blue" />
                <span className="text-sm font-medium">Total Users</span>
              </div>
              <span className="text-lg font-bold text-accent-blue">{users.length}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 border border-border/30 rounded-lg hover:bg-accent/5 transition-colors">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-accent-green" />
                <span className="text-sm font-medium">Active Users</span>
              </div>
              <span className="text-lg font-bold text-accent-green">{users.filter(u => !u.is_suspended).length}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 border border-border/30 rounded-lg hover:bg-accent/5 transition-colors">
              <div className="flex items-center gap-3">
                <UserX className="h-4 w-4 text-accent-orange" />
                <span className="text-sm font-medium">Suspended</span>
              </div>
              <span className="text-lg font-bold text-accent-orange">{users.filter(u => u.is_suspended).length}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 border border-border/30 rounded-lg hover:bg-accent/5 transition-colors">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-accent-purple" />
                <span className="text-sm font-medium">Subscribers</span>
              </div>
              <span className="text-lg font-bold text-accent-purple">{users.filter(u => u.is_subscribed).length}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 border border-border/30 rounded-lg hover:bg-accent/5 transition-colors">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium">Expired</span>
              </div>
              <span className="text-lg font-bold text-destructive">{users.filter(u => u.subscription_status === 'expired').length}</span>
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
              className="pl-10 input-enhanced"
            />
          </div>
          <div className="w-full lg:w-48">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="bg-background/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="active">Active Users</SelectItem>
                <SelectItem value="suspended">Suspended Users</SelectItem>
                <SelectItem value="subscribed">Subscribers</SelectItem>
                <SelectItem value="expired">Expired Users</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Beautiful User Cards - Quota Management Style */}
        <div className="grid gap-4">
          {filteredUsers.map((user) => (
            <Card 
              key={user.id} 
              className={`enhanced-card cursor-pointer transition-all ${
                selectedUser?.id === user.id ? 'ring-2 ring-accent-blue' : ''
              }`}
              onClick={() => setSelectedUser(user)}
            >
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* User Info Row with Avatar */}
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-medium text-sm">
                        {(user.display_name || user.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-enhanced-heading text-base">
                        {user.display_name || user.full_name || "No name"}
                      </h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined: {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {selectedUser?.id === user.id && (
                      <Badge className="bg-accent-blue text-xs flex-shrink-0">Selected</Badge>
                    )}
                  </div>

                  {/* Status Information Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                    {/* User Status */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <User className="h-3 w-3 text-accent-blue flex-shrink-0" />
                        <span className="text-xs font-medium">Status</span>
                      </div>
                      <div className="space-y-1">
                        {user.is_suspended ? (
                          <Badge variant="destructive" className="text-xs w-full justify-center">
                            Suspended
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs w-full justify-center border-accent-green text-accent-green">
                            Active
                          </Badge>
                        )}
                        {user.is_logged_in && (
                          <Badge variant="secondary" className="text-xs w-full justify-center">
                            Online
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Subscription Status */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-3 w-3 text-accent-green flex-shrink-0" />
                        <span className="text-xs font-medium">Subscription</span>
                      </div>
                      <div className="space-y-1">
                        {user.is_subscribed ? (
                          <Badge variant="outline" className="text-xs w-full justify-center border-accent-green text-accent-green">
                            Subscribed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs w-full justify-center">
                            Free User
                          </Badge>
                        )}
                        {user.plan_name && (
                          <Badge variant="secondary" className="text-xs w-full justify-center">
                            {user.plan_name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t border-border/50">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUserAction(user, 'view');
                      }}
                      className="flex-1 text-xs hover:bg-accent-blue/10 hover:border-accent-blue/30"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUserAction(user, 'suspend');
                      }}
                      className={`flex-1 text-xs ${user.is_suspended ? 'text-accent-green hover:bg-accent-green/10 hover:border-accent-green/30' : 'text-accent-orange hover:bg-accent-orange/10 hover:border-accent-orange/30'}`}
                    >
                      <UserX className="h-3 w-3 mr-1" />
                      {user.is_suspended ? 'Unsuspend' : 'Suspend'}
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUserAction(user, 'delete');
                      }}
                      className="flex-1 text-xs hover:bg-destructive/90"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <Card className="enhanced-card">
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-enhanced-heading mb-2">No users found</h3>
              <p className="text-muted-foreground">Try adjusting your search criteria.</p>
            </CardContent>
          </Card>
        )}
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
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.is_suspended ? 'Unsuspend User' : 'Suspend User'}
            </DialogTitle>
            <DialogDescription>
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
            >
              Cancel
            </Button>
            <Button 
              onClick={handleDeactivateUser}
              className={selectedUser?.is_suspended ? 'btn-enhanced' : 'bg-accent-orange hover:bg-accent-orange/90'}
            >
              {selectedUser?.is_suspended ? 'Unsuspend' : 'Suspend'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete User</DialogTitle>
            <DialogDescription>
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
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteUser}
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
