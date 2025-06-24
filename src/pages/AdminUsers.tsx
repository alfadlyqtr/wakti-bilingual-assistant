
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Search, Crown, Shield, Clock, Ban, Trash2, Eye, Settings, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserProfileModal } from "@/components/admin/UserProfileModal";
import { UserActionModals } from "@/components/admin/UserActionModals";

interface UserData {
  id: string;
  email?: string;
  display_name?: string;
  created_at: string;
  is_subscribed?: boolean;
  subscription_status?: string;
  plan_name?: string;
  is_suspended?: boolean;
  suspension_reason?: string;
  suspended_at?: string;
  last_login_at?: string;
  is_online?: boolean;
  session_count?: number;
  full_name?: string;
  is_logged_in?: boolean;
  email_confirmed?: boolean;
}

// User interface compatible with modal components
interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  is_logged_in: boolean;
  email_confirmed: boolean;
  avatar_url?: string;
  subscription_status?: string;
  is_suspended?: boolean;
  suspended_at?: string;
  suspension_reason?: string;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal states
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'suspend' | 'delete' | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      
      console.log('Loading users with real session data...');
      
      // Get users with their actual login status from user_sessions
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          display_name,
          created_at,
          is_subscribed,
          subscription_status,
          plan_name,
          is_suspended,
          suspension_reason,
          suspended_at
        `)
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
        throw profilesError;
      }

      // Get session data for each user to show real login status
      const usersWithSessions = await Promise.all(
        (profilesData || []).map(async (profile) => {
          try {
            // Get the user's active sessions
            const { data: sessions, error: sessionError } = await supabase
              .from('user_sessions')
              .select('updated_at, is_active')
              .eq('user_id', profile.id)
              .eq('is_active', true)
              .order('updated_at', { ascending: false });

            if (sessionError) {
              console.warn('Error getting session for user:', profile.id, sessionError);
            }

            // Get all sessions count
            const { count: totalSessions } = await supabase
              .from('user_sessions')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', profile.id);

            // Get last login (most recent session)
            const { data: lastSession } = await supabase
              .from('user_sessions')
              .select('updated_at')
              .eq('user_id', profile.id)
              .order('updated_at', { ascending: false })
              .limit(1)
              .single();

            const activeSessions = sessions || [];
            const isOnline = activeSessions.length > 0;
            const lastLoginAt = lastSession?.updated_at || null;

            return {
              ...profile,
              is_online: isOnline,
              session_count: totalSessions || 0,
              last_login_at: lastLoginAt,
              full_name: profile.display_name,
              is_logged_in: isOnline,
              email_confirmed: true
            };
          } catch (error) {
            console.warn('Error processing user session data:', error);
            return {
              ...profile,
              is_online: false,
              session_count: 0,
              last_login_at: null,
              full_name: profile.display_name,
              is_logged_in: false,
              email_confirmed: true
            };
          }
        })
      );

      console.log('Users loaded with session data:', usersWithSessions.length);
      setUsers(usersWithSessions);
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
        user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredUsers(filtered);
  };

  // Convert UserData to User for modal compatibility
  const convertToUser = (userData: UserData): User => {
    return {
      id: userData.id,
      email: userData.email || '',
      full_name: userData.full_name || userData.display_name || 'Unknown User',
      created_at: userData.created_at,
      is_logged_in: userData.is_logged_in || false,
      email_confirmed: userData.email_confirmed || false,
      subscription_status: userData.subscription_status,
      is_suspended: userData.is_suspended,
      suspended_at: userData.suspended_at,
      suspension_reason: userData.suspension_reason
    };
  };

  // Convert UserData to User for action modals (simpler interface)
  const convertToUserForActions = (userData: UserData) => {
    return {
      id: userData.id,
      email: userData.email || '',
      full_name: userData.full_name || userData.display_name || 'Unknown User',
      is_suspended: userData.is_suspended
    };
  };

  const handleUserAction = (user: UserData, action: 'view' | 'suspend' | 'delete') => {
    setSelectedUser(user);
    
    if (action === 'view') {
      setIsProfileModalOpen(true);
    } else {
      setActionType(action);
      setIsActionModalOpen(true);
    }
  };

  const handleBackToAdmin = () => {
    navigate('/admindash');
  };

  const handleRefresh = async () => {
    toast.info('Refreshing user data...');
    await loadUsers();
    toast.success('User data refreshed successfully');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-foreground">Loading users...</div>
      </div>
    );
  }

  // Calculate stats
  const totalUsers = users.length;
  const subscribedUsers = users.filter(u => u.is_subscribed).length;
  const onlineUsers = users.filter(u => u.is_online).length;
  const suspendedUsers = users.filter(u => u.is_suspended).length;

  return (
    <div className="h-screen bg-gradient-background text-foreground flex flex-col">
      {/* Mobile Responsive Header */}
      <header className="flex-shrink-0 bg-gradient-nav backdrop-blur-xl border-b border-border/50 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToAdmin}
              className="rounded-full hover:bg-accent/10 font-bold text-sm sm:text-lg px-2 sm:px-3"
            >
              AD
            </Button>
            <Users className="h-6 w-6 sm:h-8 sm:w-8 text-accent-blue" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-enhanced-heading">User Management</h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Real-time login status and user control</p>
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="bg-gradient-secondary hover:bg-gradient-primary text-xs sm:text-sm px-2 sm:px-3"
          >
            <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 pb-24">
        {/* Mobile Responsive Search */}
        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email, name, or user ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 input-enhanced text-sm"
            />
          </div>
        </div>

        {/* Mobile Responsive User Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <Card className="enhanced-card">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-enhanced-heading">{totalUsers}</div>
            </CardContent>
          </Card>
          
          <Card className="enhanced-card">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium">Online Now</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-accent-green">{onlineUsers}</div>
            </CardContent>
          </Card>
          
          <Card className="enhanced-card">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium">Subscribed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-accent-cyan">{subscribedUsers}</div>
            </CardContent>
          </Card>
          
          <Card className="enhanced-card">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium">Suspended</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-accent-orange">{suspendedUsers}</div>
            </CardContent>
          </Card>
        </div>

        {/* Users List */}
        <div className="space-y-3 sm:space-y-4">
          {filteredUsers.map((user) => (
            <Card key={user.id} className="enhanced-card">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
                      <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-enhanced-heading text-sm sm:text-base truncate">
                        {user.display_name || "No name"}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{user.email}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {user.is_online ? (
                          <Badge className="bg-accent-green text-white text-xs">
                            Online Now
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Offline
                          </Badge>
                        )}
                        
                        {user.is_subscribed && (
                          <Badge className="bg-accent-purple text-white text-xs">
                            <Crown className="h-3 w-3 mr-1" />
                            {user.plan_name?.includes('Yearly') ? 'Yearly' : 'Subscribed'}
                          </Badge>
                        )}
                        
                        {user.is_suspended && (
                          <Badge className="bg-accent-orange text-white text-xs">
                            <Ban className="h-3 w-3 mr-1" />
                            Suspended
                          </Badge>
                        )}
                        
                        <span className="text-xs text-muted-foreground">
                          Sessions: {user.session_count}
                        </span>
                        
                        {user.last_login_at && (
                          <span className="text-xs text-muted-foreground">
                            Last login: {new Date(user.last_login_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUserAction(user, 'view')}
                      className="text-xs sm:text-sm"
                    >
                      <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      View
                    </Button>
                    
                    {!user.is_suspended && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUserAction(user, 'suspend')}
                        className="text-xs sm:text-sm text-accent-orange border-accent-orange hover:bg-accent-orange hover:text-white"
                      >
                        <Ban className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        Suspend
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUserAction(user, 'delete')}
                      className="text-xs sm:text-sm text-red-500 border-red-500 hover:bg-red-500 hover:text-white"
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
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
            <CardContent className="p-8 sm:p-12 text-center">
              <Users className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-enhanced-heading mb-2">No users found</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "Try adjusting your search criteria." : "No users have signed up yet."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modals */}
      {selectedUser && (
        <>
          <UserProfileModal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
            user={convertToUser(selectedUser)}
            onUserUpdated={loadUsers}
          />
          
          <UserActionModals
            isOpen={isActionModalOpen}
            onClose={() => setIsActionModalOpen(false)}
            user={convertToUserForActions(selectedUser)}
            actionType={actionType}
            onActionCompleted={loadUsers}
          />
        </>
      )}
    </div>
  );
}
