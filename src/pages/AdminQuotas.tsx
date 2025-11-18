import { useState, useEffect } from "react";
import { Gift, Search, Plus, Mic, Filter, Users, Music } from "lucide-react";
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
  const [users, setUsers] = useState<User[]>([]);
  const [displayedUsers, setDisplayedUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'high_usage' | 'subscribed' | 'unsubscribed'>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [quotaAmount, setQuotaAmount] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGifting, setIsGifting] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [featureType, setFeatureType] = useState<'voice' | 'music'>('voice');
  const [musicUsageMonth, setMusicUsageMonth] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [musicMonthlyUsage, setMusicMonthlyUsage] = useState<{ generated: number; extra_generations: number; base_limit: number; total_limit: number } | null>(null);
  const [userMusicUsage, setUserMusicUsage] = useState<Record<string, { generated: number; total_limit: number }>>({});

  console.log('--- RENDER CYCLE ---');
  console.log('State [users]:', users);
  console.log('State [displayedUsers]:', displayedUsers);
  const alfadlyUserInUsers = users.find(u => u.email === 'alfadly@tmw.qa');
  if (alfadlyUserInUsers) {
    console.log('RENDER: alfadly@tmw.qa in `users` state:', alfadlyUserInUsers);
  } 
  const alfadlyUserInDisplayed = displayedUsers.find(u => u.email === 'alfadly@tmw.qa');
  if (alfadlyUserInDisplayed) {
    console.log('RENDER: alfadly@tmw.qa in `displayedUsers` state:', alfadlyUserInDisplayed);
  }
  console.log('--- END RENDER CYCLE ---');

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterAndDisplayUsers();
  }, [users, searchTerm, filterType, showAllUsers]);

  useEffect(() => {
    const run = async () => {
      if (featureType === 'music' && selectedUser) {
        try {
          const { data, error } = await (supabase as any).rpc('admin_get_music_generations_monthly', {
            p_user_id: selectedUser.id,
            p_month: musicUsageMonth,
          });
          if (!error) setMusicMonthlyUsage(data as any);
          else setMusicMonthlyUsage({ generated: 0, extra_generations: 0, base_limit: 5, total_limit: 5 });
        } catch {
          setMusicMonthlyUsage({ generated: 0, extra_generations: 0, base_limit: 5, total_limit: 5 });
        }
      } else {
        setMusicMonthlyUsage(null);
      }
    };
    run();
  }, [featureType, selectedUser, musicUsageMonth]);


  const loadUsers = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Loading users and voice usage data...');

      const { data: quotasData, error: quotasError } = await (supabase as any).rpc('admin_get_voice_quotas', {
        p_user_id: null,
      });

      if (quotasError) {
        console.error('❌ Error loading voice quotas:', quotasError);
        throw quotasError;
      }

      if (!quotasData || quotasData.length === 0) {
        console.log('No users found');
        setUsers([]);
        return;
      }

      console.log('✅ Voice quotas loaded:', quotasData.length);

      const formattedUsers: User[] = quotasData.map((row: any) => {
        const userData = {
          id: row.user_id,
          email: row.email || "No email",
          full_name: row.display_name || "No name",
          voice_characters_used: row.used || 0,
          voice_characters_limit: row.base_limit || 0,
          voice_extra_characters: row.gift_extra || 0,
          is_subscribed: !!row.is_subscribed,
          subscription_status: row.subscription_status || 'inactive',
        };
        if (row.email === 'alfadly@tmw.qa') {
          console.log('🎯 alfadly@tmw.qa data via admin_get_voice_quotas:', userData);
        }
        return userData;
      });

      console.log('✅ Combined user data successfully:', formattedUsers.length);
      setUsers(formattedUsers);

      // Load music usage for all users (current month)
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const musicUsageMap: Record<string, { generated: number; total_limit: number }> = {};
      
      for (const user of formattedUsers) {
        try {
          const { data: musicData } = await (supabase as any).rpc('admin_get_music_generations_monthly', {
            p_user_id: user.id,
            p_month: currentMonth,
          });
          if (musicData) {
            musicUsageMap[user.id] = {
              generated: musicData.generated || 0,
              total_limit: musicData.total_limit || 5
            };
          }
        } catch (err) {
          console.error(`Failed to load music usage for ${user.email}:`, err);
          musicUsageMap[user.id] = { generated: 0, total_limit: 5 };
        }
      }
      setUserMusicUsage(musicUsageMap);
    } catch (err) {
      console.error('❌ Error in loadUsers:', err);
      toast.error('Failed to load user quotas');
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
    if (isNaN(amount) || amount === 0) {
      toast.error('Please enter a non-zero quota amount');
      return;
    }

    setIsGifting(true);

    try {
      let error: any = null;
      if (featureType === 'music') {
        const { error: e } = await (supabase as any).rpc('admin_adjust_music_generations', {
          p_user_id: selectedUser.id,
          p_month: musicUsageMonth,
          p_delta: amount,
          p_reason: amount > 0 ? 'Admin gifted music generations' : 'Admin revoked music generations'
        });
        error = e;
      } else {
        const { error: e } = await (supabase as any).rpc('admin_adjust_feature_quota', {
          p_user_id: selectedUser.id,
          p_feature: 'voice',
          p_delta: amount,
          p_reason: amount > 0 ? 'Admin gifted voice characters' : 'Admin revoked voice characters',
        });
        error = e;
      }

      if (error) throw error;

      // Reload users to get updated data from the database
      await loadUsers();
      // Refresh music usage if relevant
      if (featureType === 'music' && selectedUser) {
        try {
          const { data: mu } = await (supabase as any).rpc('admin_get_music_generations_monthly', {
            p_user_id: selectedUser.id,
            p_month: musicUsageMonth,
          });
          setMusicMonthlyUsage(mu as any);
        } catch {}
      }

      if (amount > 0) {
        toast.success(featureType === 'music'
          ? `Gifted ${amount} extra music generations to ${selectedUser.email} (${musicUsageMonth})`
          : `Gifted ${amount} voice characters to ${selectedUser.email}`);
      } else {
        toast.success(featureType === 'music'
          ? `Revoked ${Math.abs(amount)} music generations from ${selectedUser.email} (${musicUsageMonth})`
          : `Revoked ${Math.abs(amount)} voice characters from ${selectedUser.email}`);
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
    <div className="bg-gradient-background text-foreground min-h-screen flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <AdminHeader
          title={featureType === 'music' ? 'Music Allowance Management' : 'Voice Quota Management'}
          subtitle={featureType === 'music' ? 'Gift/Reset music minutes for users' : 'Gift voice credits to users'}
          icon={featureType === 'music' ? <Music className="h-6 w-6 sm:h-8 sm:w-8 text-accent-purple" /> : <Gift className="h-6 w-6 sm:h-8 sm:w-8 text-accent-purple" />}
        />
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 pb-32 pt-4">
        <div className="space-y-4 sm:space-y-6 max-w-full">
          {/* Search and Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 sm:pl-10 input-enhanced h-9 sm:h-10 text-xs sm:text-sm"
              />
            </div>
            
            <Select value={featureType} onValueChange={(v: any) => setFeatureType(v)}>
              <SelectTrigger className="h-9 sm:h-10">
                <SelectValue placeholder="Feature" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="voice">Voice</SelectItem>
                <SelectItem value="music">Music</SelectItem>
              </SelectContent>
            </Select>

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

          {/* Gift Voice Credits Form - MOVED TO TOP */}
          {selectedUser && (
            <Card className="enhanced-card border-accent-purple/50 bg-gradient-to-r from-accent-purple/5 to-accent-blue/5">
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-enhanced-heading flex items-center text-sm sm:text-base">
                  <Gift className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent-purple" />
                  {featureType === 'music' ? 'Manage Music Minutes' : 'Gift Voice Credits'}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Selected: <strong>{selectedUser.email}</strong>
                  {featureType === 'voice' && (
                    <>
                      <br />
                      Current: {selectedUser.voice_characters_used.toLocaleString()} / {(selectedUser.voice_characters_limit + selectedUser.voice_extra_characters).toLocaleString()} characters
                      {selectedUser.voice_extra_characters > 0 && (
                        <span className="text-accent-purple"> (includes {selectedUser.voice_extra_characters.toLocaleString()} gifted)</span>
                      )}
                    </>
                  )}
                  {featureType === 'music' && (
                    <>
                      <br />
                      {musicMonthlyUsage ? (
                        <>{musicMonthlyUsage.generated} out of {musicMonthlyUsage.total_limit} ({musicUsageMonth}){musicMonthlyUsage.extra_generations > 0 && ` • +${musicMonthlyUsage.extra_generations} gifted`}</>
                      ) : (
                        <>This month ({musicUsageMonth}): loading…</>
                      )}
                    </>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {featureType === 'music' && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs sm:text-sm font-medium">Month</Label>
                    <Input type="month" value={musicUsageMonth} onChange={(e) => setMusicUsageMonth(e.target.value)} className="h-9 sm:h-10 text-xs sm:text-sm w-[140px]" />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label className="text-xs sm:text-sm font-medium">Amount ({featureType === 'music' ? 'Generations' : 'Characters'})</Label>
                    <Input
                      type="number"
                      placeholder={featureType === 'music' ? 'e.g., 5' : 'e.g., 5000'}
                      value={quotaAmount}
                      onChange={(e) => setQuotaAmount(e.target.value)}
                      className="input-enhanced h-9 sm:h-10 text-xs sm:text-sm"
                    />
                  </div>
                  
                  <div className="flex items-end gap-2">
                    <Button
                      onClick={giftQuota}
                      disabled={!quotaAmount || isGifting}
                      className="btn-enhanced w-full h-9 sm:h-10 text-xs sm:text-sm"
                    >
                      {isGifting ? 'Applying...' : (
                        <>
                          <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                          {featureType === 'music' ? 'Gift Generations' : 'Gift Credits'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          

          {/* Users List */}
          <div className="grid gap-2 sm:gap-4">
            {displayedUsers.map((user) => {
              const totalLimit = user.voice_characters_limit + user.voice_extra_characters;
              const usagePercentage = totalLimit > 0 ? (user.voice_characters_used / totalLimit) * 100 : 0;
              
              return (
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

                      {/* Voice & Music Quota Display */}
                      <div className="pt-2 border-t border-border/50 space-y-3">
                        {/* Voice Usage */}
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <Mic className="h-3 w-3 text-accent-blue flex-shrink-0" />
                            <span className="text-xs font-medium">Voice Usage</span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-accent-blue transition-all duration-300"
                                style={{ 
                                  width: `${Math.min(usagePercentage, 100)}%` 
                                }}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Badge variant="outline" className="text-xs justify-center">
                              {user.voice_characters_used.toLocaleString()} / {totalLimit.toLocaleString()}
                            </Badge>
                            {user.voice_extra_characters > 0 && (
                              <Badge variant="secondary" className="text-xs justify-center bg-accent-purple/10 text-accent-purple border-accent-purple/20">
                                +{user.voice_extra_characters.toLocaleString()} gifted
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Music Usage */}
                        {(() => {
                          const musicData = userMusicUsage[user.id] || { generated: 0, total_limit: 5 };
                          const musicPercentage = (musicData.generated / musicData.total_limit) * 100;
                          return (
                            <div>
                              <div className="flex items-center space-x-2 mb-2">
                                <Music className="h-3 w-3 text-accent-purple flex-shrink-0" />
                                <span className="text-xs font-medium">Music Usage</span>
                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-accent-purple transition-all duration-300"
                                    style={{ 
                                      width: `${Math.min(musicPercentage, 100)}%` 
                                    }}
                                  />
                                </div>
                              </div>
                              <Badge variant="outline" className="text-xs justify-center">
                                {musicData.generated} / {musicData.total_limit} songs
                              </Badge>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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

        </div>
      </div>

      {/* Fixed Footer/Navigation */}
      <div className="flex-shrink-0">
        <AdminMobileNav />
      </div>
    </div>
  );
}
