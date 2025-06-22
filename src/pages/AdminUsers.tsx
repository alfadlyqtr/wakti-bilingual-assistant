
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Search, Filter, MoreHorizontal, Users, UserCheck, UserX, Mail, AlertCircle, CheckCircle, Trash2, Eye, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserProfileModal } from "@/components/admin/UserProfileModal";
import { AdminMessageModal } from "@/components/admin/AdminMessageModal";
import { SuspendUserModal, DeleteUserModal } from "@/components/admin/UserActionModals";

interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
  is_logged_in: boolean;
  email_confirmed: boolean;
  subscription_status?: string;
  is_subscribed?: boolean;
  plan_name?: string;
  is_suspended?: boolean;
  suspended_at?: string;
  suspension_reason?: string;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  
  // Modal states
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, filterStatus]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      
      console.log('Loading users from database...');
      
      // Load users from auth.users table via profiles with proper join
      const { data: usersData, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          display_name,
          avatar_url,
          created_at,
          is_logged_in,
          email_confirmed,
          is_suspended,
          suspended_at,
          suspension_reason,
          is_subscribed,
          subscription_status,
          plan_name
        `)
        .is('suspension_reason', null) // Only get users that are NOT deleted
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading users:', error);
        toast.error('Failed to load users');
        return;
      }

      // Process users data
      const processedUsers = usersData?.map(user => ({
        id: user.id,
        email: user.email || "No email",
        full_name: user.display_name || user.email || "No name",
        avatar_url: user.avatar_url,
        created_at: user.created_at,
        is_logged_in: user.is_logged_in || false,
        email_confirmed: user.email_confirmed || false,
        is_suspended: user.is_suspended || false,
        suspended_at: user.suspended_at,
        suspension_reason: user.suspension_reason,
        is_subscribed: user.is_subscribed || false,
        subscription_status: user.subscription_status || 'inactive',
        plan_name: user.plan_name
      })) || [];

      console.log('Processed users:', processedUsers);
      setUsers(processedUsers);

    } catch (err) {
      console.error('Error loading users:', err);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== "all") {
      if (filterStatus === "online") {
        filtered = filtered.filter(user => user.is_logged_in);
      } else if (filterStatus === "subscribed") {
        filtered = filtered.filter(user => user.is_subscribed);
      } else if (filterStatus === "unconfirmed") {
        filtered = filtered.filter(user => !user.email_confirmed);
      } else if (filterStatus === "suspended") {
        filtered = filtered.filter(user => user.is_suspended);
      }
    }

    setFilteredUsers(filtered);
  };

  const getSubscriptionBadge = (user: User) => {
    if (user.is_subscribed && user.subscription_status === 'active') {
      const planType = user.plan_name?.toLowerCase().includes('yearly') || 
                      user.plan_name?.toLowerCase().includes('year') ? ' (Y)' : ' (M)';
      return (
        <Badge 
          variant="default"
          className="bg-accent-green text-white"
        >
          Subscribed{planType}
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        Free
      </Badge>
    );
  };

  const handleManualSubscriptionActivation = async (user: User) => {
    try {
      const { error } = await supabase.rpc('admin_activate_subscription', {
        p_user_id: user.id,
        p_plan_name: 'Monthly',
        p_billing_amount: 60,
        p_billing_currency: 'QAR'
      });

      if (error) {
        console.error('Error activating subscription:', error);
        toast.error('Failed to activate subscription');
        return;
      }

      toast.success(`Subscription activated for ${user.full_name || user.email}`);
      loadUsers(); // Refresh the list
    } catch (error) {
      console.error('Error activating subscription:', error);
      toast.error('Failed to activate subscription');
    }
  };

  const handleUserAction = (user: User, action: string) => {
    setSelectedUser(user);
    
    switch (action) {
      case "View Profile":
        setIsProfileModalOpen(true);
        break;
      case "Send Message":
        setIsMessageModalOpen(true);
        break;
      case "Suspend User":
        setIsSuspendModalOpen(true);
        break;
      case "Delete User":
        setIsDeleteModalOpen(true);
        break;
      case "Activate Subscription":
        handleManualSubscriptionActivation(user);
        break;
    }
  };

  const handleModalSuccess = () => {
    loadUsers(); // Refresh the user list
  };

  const handleBackToAdmin = () => {
    console.log('Navigating to admin dashboard...');
    navigate('/admin-dashboard');
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-foreground">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-background text-foreground flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-nav backdrop-blur-xl border-b border-border/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToAdmin}
              className="rounded-full hover:bg-accent/10 font-bold text-lg"
            >
              AD
            </Button>
            <Users className="h-8 w-8 text-accent-blue" />
            <div>
              <h1 className="text-xl font-bold text-enhanced-heading">User Management</h1>
              <p className="text-sm text-muted-foreground">{filteredUsers.length} users found</p>
            </div>
          </div>
        </div>
      </header>

      {/* Search and Filter */}
      <div className="flex-shrink-0 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 input-enhanced"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center space-x-2">
                <Filter className="h-4 w-4" />
                <span>
                  {filterStatus === "all" ? "All Users" : 
                   filterStatus === "online" ? "Online" : 
                   filterStatus === "subscribed" ? "Subscribed" : 
                   filterStatus === "unconfirmed" ? "Unconfirmed" : "Suspended"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterStatus("all")}>All Users</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("online")}>Online Users</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("subscribed")}>Subscribed Users</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("unconfirmed")}>Unconfirmed Email</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("suspended")}>Suspended Users</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Scrollable Users List */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="grid gap-4">
          {filteredUsers.map((user) => (
            <Card key={user.id} className={`enhanced-card ${user.is_suspended ? 'border-red-200 bg-red-50/50' : ''}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.full_name || user.email}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-medium">
                          {(user.full_name || user.email || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-enhanced-heading">
                          {user.full_name || "No name"}
                        </h3>
                        {user.email_confirmed ? (
                          <CheckCircle className="h-4 w-4 text-accent-green" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-accent-orange" />
                        )}
                        {user.is_suspended && (
                          <Badge variant="destructive" className="text-xs">
                            SUSPENDED
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant={user.is_logged_in ? "default" : "secondary"}>
                          {user.is_logged_in ? "Online" : "Offline"}
                        </Badge>
                        {getSubscriptionBadge(user)}
                        <Badge 
                          variant={user.email_confirmed ? "default" : "destructive"}
                          className={user.email_confirmed ? 'bg-accent-green text-white' : 'bg-accent-orange text-white'}
                        >
                          {user.email_confirmed ? "Verified" : "Unverified"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="text-right text-sm text-muted-foreground">
                      <p>Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleUserAction(user, "View Profile")}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUserAction(user, "Send Message")}>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Message
                        </DropdownMenuItem>
                        {!user.is_subscribed && (
                          <DropdownMenuItem onClick={() => handleUserAction(user, "Activate Subscription")}>
                            <Crown className="h-4 w-4 mr-2" />
                            Activate Subscription
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleUserAction(user, "Suspend User")}>
                          <UserX className="h-4 w-4 mr-2" />
                          {user.is_suspended ? "Unsuspend User" : "Suspend User"}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleUserAction(user, "Delete User")}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
              <p className="text-muted-foreground">Try adjusting your search or filter criteria.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modals */}
      <UserProfileModal
        user={selectedUser}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
      
      <AdminMessageModal
        user={selectedUser}
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
      />
      
      <SuspendUserModal
        user={selectedUser}
        isOpen={isSuspendModalOpen}
        onClose={() => setIsSuspendModalOpen(false)}
        onSuccess={handleModalSuccess}
      />
      
      <DeleteUserModal
        user={selectedUser}
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
