
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, Search, Plus, Mic, Languages } from "lucide-react";
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
  translation_count: number;
  translation_extra: number;
}

export default function AdminQuotas() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [quotaType, setQuotaType] = useState<'voice' | 'translation'>('voice');
  const [quotaAmount, setQuotaAmount] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGifting, setIsGifting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      
      // Get all users first
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, email, display_name')
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

      // Get current month translation quotas
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      const { data: translationQuotas, error: translationError } = await supabase
        .from('user_voice_translation_quotas')
        .select('user_id, translation_count, extra_translations')
        .eq('monthly_date', currentMonth);

      if (translationError) {
        console.error('❌ Error loading translation quotas:', translationError);
      }

      // Create maps for easier lookup
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

      const translationMap = new Map(
        translationQuotas?.map(quota => [
          quota.user_id, 
          { count: quota.translation_count, extra: quota.extra_translations }
        ]) || []
      );

      // Combine all data
      const formattedUsers: User[] = usersData.map(user => {
        const voiceUsage = voiceUsageMap.get(user.id);
        const translationUsage = translationMap.get(user.id);

        return {
          id: user.id,
          email: user.email || "No email",
          full_name: user.display_name || "No name",
          voice_characters_used: voiceUsage?.used || 0,
          voice_characters_limit: voiceUsage?.limit || 5000,
          voice_extra_characters: voiceUsage?.extra || 0,
          translation_count: translationUsage?.count || 0,
          translation_extra: translationUsage?.extra || 0,
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

  const filterUsers = () => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredUsers(filtered);
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
      // Get current admin session to get admin ID
      const adminSession = localStorage.getItem('admin_session');
      if (!adminSession) {
        toast.error('Admin session not found');
        return;
      }

      const session = JSON.parse(adminSession);
      const adminId = session.admin_id;

      if (quotaType === 'voice') {
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
      } else {
        const { data, error } = await supabase.rpc('admin_gift_translation_credits', {
          p_user_id: selectedUser.id,
          p_translations: amount,
          p_admin_id: adminId
        });

        if (error) throw error;

        // Update local state
        setUsers(prev => prev.map(user => 
          user.id === selectedUser.id 
            ? { ...user, translation_extra: data[0]?.new_extra_translations || user.translation_extra }
            : user
        ));

        toast.success(`Gifted ${amount} translation credits to ${selectedUser.email}`);
      }

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
    <div className="bg-gradient-background text-foreground min-h-screen overflow-y-auto">
      <AdminHeader
        title="Quota Management"
        subtitle="Gift voice credits and translation quotas"
        icon={<Gift className="h-6 w-6 sm:h-8 sm:w-8 text-accent-purple" />}
      />

      <div className="p-3 sm:p-6 pb-24 space-y-4 sm:space-y-6">
        {/* Gift Quota Form */}
        <Card className="enhanced-card">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-enhanced-heading flex items-center text-sm sm:text-base">
              <Gift className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent-purple" />
              Gift Quota Credits
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Add additional voice or translation credits to user accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <Label className="text-xs sm:text-sm font-medium">Quota Type</Label>
                  <Select value={quotaType} onValueChange={(value: 'voice' | 'translation') => setQuotaType(value)}>
                    <SelectTrigger className="h-9 sm:h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="voice">
                        <div className="flex items-center">
                          <Mic className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                          <span className="text-xs sm:text-sm">Voice Characters</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="translation">
                        <div className="flex items-center">
                          <Languages className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                          <span className="text-xs sm:text-sm">Translation Credits</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-xs sm:text-sm font-medium">Amount</Label>
                  <Input
                    type="number"
                    placeholder={quotaType === 'voice' ? "Voice characters" : "Translation credits"}
                    value={quotaAmount}
                    onChange={(e) => setQuotaAmount(e.target.value)}
                    className="input-enhanced h-9 sm:h-10 text-xs sm:text-sm"
                  />
                </div>
                
                <div>
                  <Label className="text-xs sm:text-sm font-medium">Selected User</Label>
                  <div className="text-xs sm:text-sm p-2 bg-gradient-secondary/10 rounded-md min-h-[36px] sm:min-h-[40px] flex items-center">
                    {selectedUser ? selectedUser.email : "No user selected"}
                  </div>
                </div>
              </div>
              
              <Button
                onClick={giftQuota}
                disabled={!selectedUser || !quotaAmount || isGifting}
                className="btn-enhanced w-full sm:w-auto h-9 sm:h-10 text-xs sm:text-sm"
              >
                {isGifting ? 'Gifting...' : (
                  <>
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    Gift {quotaType === 'voice' ? 'Voice Characters' : 'Translation Credits'}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 sm:pl-10 input-enhanced h-9 sm:h-10 text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* Users List */}
        <div className="grid gap-2 sm:gap-4">
          {filteredUsers.map((user) => (
            <Card 
              key={user.id} 
              className={`enhanced-card cursor-pointer transition-all ${
                selectedUser?.id === user.id ? 'ring-2 ring-accent-purple' : ''
              }`}
              onClick={() => setSelectedUser(user)}
            >
              <CardContent className="p-3 sm:p-6">
                <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
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
                  </div>

                  <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:space-x-6">
                    {/* Voice Quota */}
                    <div className="flex items-center justify-between sm:justify-start sm:flex-col sm:text-center space-x-2 sm:space-x-0">
                      <div className="flex items-center space-x-2 mb-0 sm:mb-1">
                        <Mic className="h-3 w-3 sm:h-4 sm:w-4 text-accent-blue" />
                        <span className="text-xs sm:text-sm font-medium">Voice</span>
                      </div>
                      <div className="space-y-1">
                        <Badge variant="outline" className="text-xs">
                          {user.voice_characters_used.toLocaleString()} / {user.voice_characters_limit.toLocaleString()}
                        </Badge>
                        {user.voice_extra_characters > 0 && (
                          <Badge variant="secondary" className="text-xs ml-1 sm:ml-0">
                            +{user.voice_extra_characters.toLocaleString()} extra
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Translation Quota */}
                    <div className="flex items-center justify-between sm:justify-start sm:flex-col sm:text-center space-x-2 sm:space-x-0">
                      <div className="flex items-center space-x-2 mb-0 sm:mb-1">
                        <Languages className="h-3 w-3 sm:h-4 sm:w-4 text-accent-green" />
                        <span className="text-xs sm:text-sm font-medium">Translation</span>
                      </div>
                      <div className="space-y-1">
                        <Badge variant="outline" className="text-xs">
                          {user.translation_count} / 10
                        </Badge>
                        {user.translation_extra > 0 && (
                          <Badge variant="secondary" className="text-xs ml-1 sm:ml-0">
                            +{user.translation_extra} extra
                          </Badge>
                        )}
                      </div>
                    </div>

                    {selectedUser?.id === user.id && (
                      <Badge className="bg-accent-purple self-start sm:self-center text-xs">Selected</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <Card className="enhanced-card">
            <CardContent className="p-6 sm:p-12 text-center">
              <Gift className="h-6 w-6 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-sm sm:text-lg font-medium text-enhanced-heading mb-2">No users found</h3>
              <p className="text-muted-foreground text-xs sm:text-base">Try adjusting your search criteria.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Admin Mobile Navigation */}
      <AdminMobileNav />
    </div>
  );
}
