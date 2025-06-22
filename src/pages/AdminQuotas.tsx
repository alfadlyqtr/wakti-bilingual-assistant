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

interface User {
  id: string;
  email: string;
  full_name: string;
  voice_quota_used: number;
  voice_quota_limit: number;
  translation_quota_used: number;
  translation_quota_limit: number;
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
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          voice_quota_used,
          voice_quota_limit,
          translation_quota_used,
          translation_quota_limit
        `)
        .order('email');

      if (error) throw error;
      setUsers(data || []);
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
      const updateField = quotaType === 'voice' ? 'voice_quota_limit' : 'translation_quota_limit';
      const currentLimit = quotaType === 'voice' ? selectedUser.voice_quota_limit : selectedUser.translation_quota_limit;
      const newLimit = (currentLimit || 0) + amount;

      const { error } = await supabase
        .from('profiles')
        .update({ [updateField]: newLimit })
        .eq('id', selectedUser.id);

      if (error) throw error;

      // Update local state
      setUsers(prev => prev.map(user => 
        user.id === selectedUser.id 
          ? { ...user, [updateField]: newLimit }
          : user
      ));

      setSelectedUser(null);
      setQuotaAmount("");
      toast.success(`Gifted ${amount} ${quotaType} credits to ${selectedUser.email}`);
    } catch (err) {
      console.error('Error gifting quota:', err);
      toast.error('Failed to gift quota');
    } finally {
      setIsGifting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-foreground">Loading quota management...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background text-foreground">
      <AdminHeader
        title="Quota Management"
        subtitle="Gift voice credits and translation quotas"
        icon={<Gift className="h-6 w-6 sm:h-8 sm:w-8 text-accent-purple" />}
      />

      <div className="p-3 sm:p-6 overflow-auto">
        {/* Gift Quota Form */}
        <Card className="enhanced-card mb-6 sm:mb-8">
          <CardHeader>
            <CardTitle className="text-enhanced-heading flex items-center">
              <Gift className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent-purple" />
              Gift Quota Credits
            </CardTitle>
            <CardDescription>Add additional voice or translation credits to user accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Quota Type</Label>
                <Select value={quotaType} onValueChange={(value: 'voice' | 'translation') => setQuotaType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="voice">
                      <div className="flex items-center">
                        <Mic className="h-4 w-4 mr-2" />
                        Voice Credits
                      </div>
                    </SelectItem>
                    <SelectItem value="translation">
                      <div className="flex items-center">
                        <Languages className="h-4 w-4 mr-2" />
                        Translation Credits
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Amount</Label>
                <Input
                  type="number"
                  placeholder="Enter quota amount"
                  value={quotaAmount}
                  onChange={(e) => setQuotaAmount(e.target.value)}
                  className="input-enhanced"
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium">Selected User</Label>
                <div className="text-sm p-2 bg-gradient-secondary/10 rounded-md">
                  {selectedUser ? selectedUser.email : "No user selected"}
                </div>
              </div>
            </div>
            
            <Button
              onClick={giftQuota}
              disabled={!selectedUser || !quotaAmount || isGifting}
              className="btn-enhanced"
            >
              {isGifting ? 'Gifting...' : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Gift Quota
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 input-enhanced"
            />
          </div>
        </div>

        {/* Users List */}
        <div className="grid gap-3 sm:gap-4">
          {filteredUsers.map((user) => (
            <Card 
              key={user.id} 
              className={`enhanced-card cursor-pointer transition-all ${
                selectedUser?.id === user.id ? 'ring-2 ring-accent-purple' : ''
              }`}
              onClick={() => setSelectedUser(user)}
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-primary rounded-full flex items-center justify-center">
                      <span className="text-white font-medium">
                        {(user.full_name || user.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-enhanced-heading">
                        {user.full_name || "No name"}
                      </h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 sm:space-x-6">
                    {/* Voice Quota */}
                    <div className="text-center">
                      <div className="flex items-center space-x-2 mb-1">
                        <Mic className="h-4 w-4 text-accent-blue" />
                        <span className="text-sm font-medium">Voice</span>
                      </div>
                      <Badge variant="outline">
                        {user.voice_quota_used || 0} / {user.voice_quota_limit || 0}
                      </Badge>
                    </div>

                    {/* Translation Quota */}
                    <div className="text-center">
                      <div className="flex items-center space-x-2 mb-1">
                        <Languages className="h-4 w-4 text-accent-green" />
                        <span className="text-sm font-medium">Translation</span>
                      </div>
                      <Badge variant="outline">
                        {user.translation_quota_used || 0} / {user.translation_quota_limit || 0}
                      </Badge>
                    </div>

                    {selectedUser?.id === user.id && (
                      <Badge className="bg-accent-purple">Selected</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <Card className="enhanced-card">
            <CardContent className="p-8 sm:p-12 text-center">
              <Gift className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-enhanced-heading mb-2">No users found</h3>
              <p className="text-muted-foreground">Try adjusting your search criteria.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
