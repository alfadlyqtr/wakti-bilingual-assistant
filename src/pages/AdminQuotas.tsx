
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, Search, Plus, Mic, Filter, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";

interface User {
  id: string;
  email: string;
  full_name: string;
  voice_characters_used: number;
  voice_characters_limit: number;
  voice_extra_characters: number;
  is_subscribed: boolean;
  subscription_status: string;
}

export default function AdminQuotas() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [displayedUsers, setDisplayedUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'high_usage' | 'subscribed' | 'unsubscribed'>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [quotaAmount, setQuotaAmount] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGifting, setIsGifting] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterAndDisplayUsers();
  }, [users, searchTerm, filterType, showAllUsers]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      
      // Get all users with their subscription status
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, email, display_name, is_subscribed, subscription_status')
        .neq('display_name', '[DELETED USER]')
        .order('email');

      if (usersError) {
        console.error('❌ Error loading users:', usersError);
        throw usersError;
      }

      if (!usersData || usersData.length === 0) {
        console.log('No users found');
        setUsers([]);
        return;
      }

      console.log('✅ Users loaded:', usersData.length);

      // Get voice usage data for all users
      const { data: voiceUsageData, error: voiceError } = await supabase
        .from('user_voice_usage')
        .select('user_id, characters_used, characters_limit, extra_characters');

      if (voiceError) {
        console.error('❌ Error loading voice usage:', voiceError);
      }

      // Create voice usage map
      const voiceUsageMap = new Map(
        voiceUsageData?.map(usage => [
          usage.user_id, 
          { 
            used: usage.characters_used, 
            limit: usage.characters_limit, 
            extra: usage.extra_characters 
          }
        ]) || []
      );

      // Combine all data
      const formattedUsers: User[] = usersData.map(user => {
        const voiceUsage = voiceUsageMap.get(user.id);

        return {
          id: user.id,
          email: user.email || "No email",
          full_name: user.display_name || "No name",
          voice_characters_used: voiceUsage?.used || 0,
          voice_characters_limit: voiceUsage?.limit || 5000,
          voice_extra_characters: voiceUsage?.extra || 0,
          is_subscribed: user.is_subscribed || false,
          subscription_status: user.subscription_status || 'inactive',
        };
      });

      console.log('✅ Combined user data successfully:', formattedUsers.length);
      setUsers(formattedUsers);
    } catch (err) {
      console.error('❌ Error loading users:', err);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndDisplayUsers = () => {
    let filtered = users;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    switch (filterType) {
      case 'high_usage':
        filtered = filtered.filter(user => 
          (user.voice_characters_used / user.voice_characters_limit) > 0.8
        );
        break;
      case 'subscribed':
        filtered = filtered.filter(user => user.is_subscribed);
        break;
      case 'unsubscribed':
        filtered = filtered.filter(user => !user.is_subscribed);
        break;
    }

    // Sort by usage (highest first)
    filtered.sort((a, b) => 
      (b.voice_characters_used + b.voice_extra_characters) - 
      (a.voice_characters_used + a.voice_extra_characters)
    );

    // Show top 5 by default, or all if requested
    const toDisplay = showAllUsers ? filtered : filtered.slice(0, 5);
    setDisplayedUsers(toDisplay);
  };

  const giftQuota = async () => {
    if (!selectedUser || !quotaAmount) {
      toast.error('Please select a user and enter quota amount');
      return;
    }

    const amount = parseInt(quotaAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid quota amount');
      return;
    }

    setIsGifting(true);

    try {
      const adminSession = localStorage.getItem('admin_session');
      if (!adminSession) {
        toast.error('Admin session not found');
        return;
      }

      const session = JSON.parse(adminSession);
      const adminId = session.admin_id;

      const { data, error } = await supabase.rpc('admin_gift_voice_credits', {
        p_user_id: selectedUser.id,
        p_characters: amount,
        p_admin_id: adminId
      });

      if (error) throw error;

      // Update local state
      setUsers(prev => prev.map(user => 
        user.id === selectedUser.id 
          ? { ...user, voice_extra_characters: data[0]?.new_extra_characters || user.voice_extra_characters }
          : user
      ));

      toast.success(`Gifted ${amount} voice characters to ${selectedUser.email}`);
      setSelectedUser(null);
      setQuotaAmount("");
    } catch (err) {
      console.error('Error gifting quota:', err);
      toast.error('Failed to gift quota');
    } finally {
      setIsGifting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-background text-foreground flex items-center justify-center min-h-screen">
        <div className="text-foreground">Loading quota management...</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-background text-foreground min-h-screen flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <AdminHeader
          title="Voice Quota Management"
          subtitle="Gift voice credits to users"
          icon={<Gift className="h-6 w-6 sm:h-8 sm:w-8 text-accent-purple" />}
        />
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 pb-32 pt-4">
        <div className="space-y-4 sm:space-y-6 max-w-full">
          {/* Search and Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 sm:pl-10 input-enhanced h-9 sm:h-10 text-xs sm:text-sm"
              />
            </div>
            
            <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
              <SelectTrigger className="h-9 sm:h-10">
                <SelectValue placeholder="Filter users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center">
                    <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    <span className="text-xs sm:text-sm">All Users</span>
                  </div>
                </SelectItem>
                <SelectItem value="high_usage">
                  <div className="flex items-center">
                    <Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    <span className="text-xs sm:text-sm">High Usage (80%+)</span>
                  </div>
                </SelectItem>
                <SelectItem value="subscribed">
                  <div className="flex items-center">
                    <Gift className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    <span className="text-xs sm:text-sm">Subscribed</span>
                  </div>
                </SelectItem>
                <SelectItem value="unsubscribed">
                  <div className="flex items-center">
                    <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    <span className="text-xs sm:text-sm">Unsubscribed</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={() => setShowAllUsers(!showAllUsers)}
              variant="outline"
              className="h-9 sm:h-10 text-xs sm:text-sm"
            >
              {showAllUsers ? `Show Top 5` : `Show All (${users.length})`}
            </Button>
          </div>

          {/* Users List */}
          <div className="grid gap-2 sm:gap-4">
            {displayedUsers.map((user) => (
              <Card 
                key={user.id} 
                className={`enhanced-card cursor-pointer transition-all ${
                  selectedUser?.id === user.id ? 'ring-2 ring-accent-purple' : ''
                }`}
                onClick={() => setSelectedUser(user)}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="space-y-3">
                    {/* User Info Row */}
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-medium text-xs sm:text-sm">
                          {(user.full_name || user.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-enhanced-heading text-sm sm:text-base truncate">
                          {user.full_name || "No name"}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {selectedUser?.id === user.id && (
                          <Badge className="bg-accent-purple text-xs flex-shrink-0">Selected</Badge>
                        )}
                        <Badge 
                          variant={user.is_subscribed ? "default" : "secondary"}
                          className="text-xs flex-shrink-0"
                        >
                          {user.is_subscribed ? "Subscribed" : "Free"}
                        </Badge>
                      </div>
                    </div>

                    {/* Voice Quota Display */}
                    <div className="pt-2 border-t border-border/50">
                      <div className="flex items-center space-x-2 mb-2">
                        <Mic className="h-3 w-3 text-accent-blue flex-shrink-0" />
                        <span className="text-xs font-medium">Voice Usage</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-accent-blue transition-all duration-300"
                            style={{ 
                              width: `${Math.min((user.voice_characters_used / user.voice_characters_limit) * 100, 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Badge variant="outline" className="text-xs justify-center">
                          {user.voice_characters_used.toLocaleString()} / {user.voice_characters_limit.toLocaleString()}
                        </Badge>
                        {user.voice_extra_characters > 0 && (
                          <Badge variant="secondary" className="text-xs justify-center">
                            +{user.voice_extra_characters.toLocaleString()} extra
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {displayedUsers.length === 0 && (
            <Card className="enhanced-card">
              <CardContent className="p-6 sm:p-12 text-center">
                <Gift className="h-6 w-6 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-sm sm:text-lg font-medium text-enhanced-heading mb-2">No users found</h3>
                <p className="text-muted-foreground text-xs sm:text-base">Try adjusting your search criteria.</p>
              </CardContent>
            </Card>
          )}

          {/* Gift Quota Form - Repositioned and Enhanced */}
          {selectedUser && (
            <Card className="enhanced-card border-accent-purple/50 bg-gradient-to-r from-accent-purple/5 to-accent-blue/5">
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-enhanced-heading flex items-center text-sm sm:text-base">
                  <Gift className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent-purple" />
                  Gift Voice Credits
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Selected: <strong>{selectedUser.email}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label className="text-xs sm:text-sm font-medium">Amount (Characters)</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 5000"
                      value={quotaAmount}
                      onChange={(e) => setQuotaAmount(e.target.value)}
                      className="input-enhanced h-9 sm:h-10 text-xs sm:text-sm"
                    />
                  </div>
                  
                  <div className="flex items-end">
                    <Button
                      onClick={giftQuota}
                      disabled={!quotaAmount || isGifting}
                      className="btn-enhanced w-full h-9 sm:h-10 text-xs sm:text-sm"
                    >
                      {isGifting ? 'Gifting...' : (
                        <>
                          <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                          Gift Credits
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Fixed Footer/Navigation */}
      <div className="flex-shrink-0">
        <AdminMobileNav />
      </div>
    </div>
  );
}
