
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, ArrowLeft, Search, Filter, MoreHorizontal, Users, UserCheck, UserX, Mail, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
  is_logged_in: boolean;
  email_confirmed: boolean;
  subscription_status?: string;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, filterStatus]);

  const loadUsers = async () => {
    try {
      // Use explicit query structure to avoid relationship issues
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          display_name,
          avatar_url,
          created_at,
          is_logged_in,
          email_confirmed
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get subscription data separately and merge
      const userIds = data.map(user => user.id);
      const { data: subscriptionsData } = await supabase
        .from('subscriptions')
        .select('user_id, status')
        .in('user_id', userIds)
        .eq('status', 'active');

      const subscriptionMap = new Map(
        subscriptionsData?.map(sub => [sub.user_id, sub.status]) || []
      );

      const usersWithSubscriptions = data.map(user => ({
        ...user,
        full_name: user.display_name || user.email,
        subscription_status: subscriptionMap.get(user.id) || 'none'
      }));

      setUsers(usersWithSubscriptions);
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
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== "all") {
      if (filterStatus === "online") {
        filtered = filtered.filter(user => user.is_logged_in);
      } else if (filterStatus === "subscribed") {
        filtered = filtered.filter(user => user.subscription_status === 'active');
      } else if (filterStatus === "unconfirmed") {
        filtered = filtered.filter(user => !user.email_confirmed);
      }
    }

    setFilteredUsers(filtered);
  };

  const handleUserAction = (userId: string, action: string) => {
    toast.info(`${action} action for user ${userId}`);
    // Implement actual user actions here
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-foreground">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-nav backdrop-blur-xl border-b border-border/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admindash')}
              className="rounded-full hover:bg-accent/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Users className="h-8 w-8 text-accent-blue" />
            <div>
              <h1 className="text-xl font-bold text-enhanced-heading">User Management</h1>
              <p className="text-sm text-muted-foreground">{filteredUsers.length} users found</p>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
                   filterStatus === "subscribed" ? "Subscribed" : "Unconfirmed"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterStatus("all")}>All Users</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("online")}>Online Users</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("subscribed")}>Subscribed Users</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("unconfirmed")}>Unconfirmed Email</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Users List */}
        <div className="grid gap-4">
          {filteredUsers.map((user) => (
            <Card key={user.id} className="enhanced-card">
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
                          {(user.full_name || user.email).charAt(0).toUpperCase()}
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
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant={user.is_logged_in ? "default" : "secondary"}>
                          {user.is_logged_in ? "Online" : "Offline"}
                        </Badge>
                        <Badge 
                          variant={user.subscription_status === 'active' ? "default" : "outline"}
                          className={user.subscription_status === 'active' ? 'bg-accent-green' : ''}
                        >
                          {user.subscription_status === 'active' ? "Subscribed" : "Free"}
                        </Badge>
                        <Badge 
                          variant={user.email_confirmed ? "default" : "destructive"}
                          className={user.email_confirmed ? 'bg-accent-green' : 'bg-accent-orange'}
                        >
                          {user.email_confirmed ? "Verified" : "Unverified"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="text-right text-sm text-muted-foreground">
                      <p>Joined {new Date(user.created_at).toLocaleDateString()}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleUserAction(user.id, "View Profile")}>
                          <UserCheck className="h-4 w-4 mr-2" />
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUserAction(user.id, "Send Message")}>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Message
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUserAction(user.id, "Suspend User")}>
                          <UserX className="h-4 w-4 mr-2" />
                          Suspend User
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
    </div>
  );
}
