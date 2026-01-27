import { useMemo, useState, useEffect } from "react";
import { Brain, RefreshCw, Search, Filter, Eye, Clock, Zap, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { format, subDays, subMonths, startOfDay, endOfDay } from "date-fns";
import { Grid } from "gridjs-react";
import { h } from "gridjs";
import "gridjs/dist/theme/mermaid.css";

interface AILog {
  id: string;
  created_at: string;
  user_id: string;
  user_email: string;
  user_display_name: string;
  function_name: string;
  model: string;
  status: string;
  error_message: string | null;
  prompt: string | null;
  response: string | null;
  metadata: Record<string, any>;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  duration_ms: number;
  cost_credits: number;
}

interface AIStats {
  total_calls: number;
  success_calls: number;
  error_calls: number;
  success_rate: number;
  total_tokens: number;
  total_cost: number;
  unique_users: number;
}

type DateRangeType = "today" | "7days" | "30days" | "all" | "custom";

export default function AdminAIUsage() {
  const [logs, setLogs] = useState<AILog[]>([]);
  const [stats, setStats] = useState<AIStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // Filters
  const [searchUser, setSearchUser] = useState("");
  const [filterFunction, setFilterFunction] = useState<string>("all");
  const [filterModel, setFilterModel] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRangeType>("7days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  
  // Available options for filters
  const [availableFunctions, setAvailableFunctions] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  
  // Detail modal
  const [selectedLog, setSelectedLog] = useState<AILog | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const LIMIT = 500;

  useEffect(() => {
    loadFilterOptions();
    loadStats();
  }, []);

  useEffect(() => {
    loadLogs(1);
  }, [filterFunction, filterModel, filterStatus, dateRange, customFrom, customTo]);

  const getDateRange = (): { from: string | null; to: string | null } => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return {
          from: startOfDay(now).toISOString(),
          to: endOfDay(now).toISOString()
        };
      case "7days":
        return {
          from: subDays(now, 7).toISOString(),
          to: now.toISOString()
        };
      case "30days":
        return {
          from: subDays(now, 30).toISOString(),
          to: now.toISOString()
        };
      case "custom":
        return {
          from: customFrom ? new Date(customFrom).toISOString() : null,
          to: customTo ? new Date(customTo).toISOString() : null
        };
      default:
        return { from: null, to: null };
    }
  };

  const loadFilterOptions = async () => {
    try {
      // Load available function names
      const { data: functions } = await (supabase as any).rpc('admin_get_ai_function_names');
      if (functions) {
        setAvailableFunctions(functions.map((f: any) => f.function_name));
      }
      
      // Load available models
      const { data: models } = await (supabase as any).rpc('admin_get_ai_models');
      if (models) {
        setAvailableModels(models.map((m: any) => m.model));
      }
    } catch (error) {
      console.error('[AdminAIUsage] Error loading filter options:', error);
    }
  };

  const loadStats = async () => {
    try {
      const { from, to } = getDateRange();
      const { data, error } = await (supabase as any).rpc('admin_get_ai_logs_stats', {
        p_from: from,
        p_to: to
      });
      
      if (error) throw error;
      if (data && data.length > 0) {
        setStats(data[0]);
      }
    } catch (error) {
      console.error('[AdminAIUsage] Error loading stats:', error);
    }
  };

  const loadLogs = async (pageNum: number) => {
    try {
      setIsLoading(true);
      const { from, to } = getDateRange();
      
      const { data, error } = await (supabase as any).rpc('admin_get_ai_logs', {
        p_page: pageNum,
        p_limit: LIMIT,
        p_user_id: null,
        p_function_name: filterFunction === 'all' ? null : filterFunction,
        p_model: filterModel === 'all' ? null : filterModel,
        p_status: filterStatus === 'all' ? null : filterStatus,
        p_from: from,
        p_to: to
      });

      if (error) throw error;

      // Client-side filter by user search
      let filteredData = data || [];
      if (searchUser.trim()) {
        const search = searchUser.toLowerCase();
        filteredData = filteredData.filter((log: AILog) => 
          log.user_email?.toLowerCase().includes(search) ||
          log.user_display_name?.toLowerCase().includes(search)
        );
      }

      if (pageNum === 1) {
        setLogs(filteredData);
      } else {
        setLogs(prev => [...prev, ...filteredData]);
      }
      
      setHasMore(filteredData.length === LIMIT);
      setPage(pageNum);
      
      // Reload stats when filters change
      loadStats();
    } catch (error) {
      console.error('[AdminAIUsage] Error loading logs:', error);
      toast.error('Failed to load AI logs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    loadLogs(1);
  };

  const handleRefresh = () => {
    loadFilterOptions();
    loadLogs(1);
    loadStats();
  };

  const loadMore = () => {
    if (hasMore && !isLoading) {
      loadLogs(page + 1);
    }
  };

  const openDetail = (log: AILog) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const logsById = useMemo(() => {
    const map = new Map<string, AILog>();
    for (const l of logs) map.set(l.id, l);
    return map;
  }, [logs]);

  const gridColumns = useMemo(() => {
    return [
      { name: 'Date', sort: true },
      { name: 'User', sort: true },
      { name: 'Function', sort: true },
      { name: 'Trigger', sort: true },
      { name: 'Model', sort: true },
      { name: 'Status', sort: true },
      { name: 'Tokens', sort: true },
      { name: 'Duration', sort: true },
      {
        name: '',
        sort: false,
        formatter: (_: any, row: any) => {
          const id = row?.cells?.[9]?.data as string | undefined;
          return h(
            'button',
            {
              className: 'px-2 py-1 text-xs rounded-md border border-white/20 bg-white/5 text-white/80 hover:bg-white/10',
              onClick: () => {
                const log = id ? logsById.get(id) : undefined;
                if (log) openDetail(log);
              }
            },
            'View'
          );
        }
      },
      { name: 'ID', hidden: true },
    ];
  }, [logsById]);

  const gridData = useMemo(() => {
    return logs.map((log) => {
      const created = log.created_at ? new Date(log.created_at) : new Date();
      const trigger = (log.metadata as any)?.trigger || '';
      const userLabel = log.user_display_name || log.user_email || log.user_id || '';
      return [
        format(created, 'MMM d, HH:mm'),
        userLabel,
        log.function_name || '',
        trigger,
        log.model || '',
        log.status || '',
        Number.isFinite(log.total_tokens) ? String(log.total_tokens) : '',
        Number.isFinite(log.duration_ms) ? String(log.duration_ms) : '',
        '',
        log.id,
      ];
    });
  }, [logs]);

  const getStatusBadge = (status: string) => {
    if (status === 'success') {
      return <Badge className="bg-green-500/20 text-green-400"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge>;
    }
    return <Badge className="bg-red-500/20 text-red-400"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
  };

  const getFunctionBadge = (fn: string) => {
    const colors: Record<string, string> = {
      'brain_stream': 'bg-purple-500/20 text-purple-400',
      'text2image': 'bg-blue-500/20 text-blue-400',
      'wakti-text2image': 'bg-blue-500/20 text-blue-400',
      'image2image': 'bg-cyan-500/20 text-cyan-400',
      'prompt-amp': 'bg-yellow-500/20 text-yellow-400',
      'music': 'bg-pink-500/20 text-pink-400',
      'voice_tts': 'bg-orange-500/20 text-orange-400',
      'generate-speech': 'bg-orange-500/20 text-orange-400',
      'transcribe-audio': 'bg-teal-500/20 text-teal-400',
      'journal_qa': 'bg-green-500/20 text-green-400',
      'generate-image': 'bg-indigo-500/20 text-indigo-400',
    };
    const color = colors[fn] || 'bg-gray-500/20 text-gray-400';
    return <Badge className={color}>{fn}</Badge>;
  };

  // Color mapping for known keys
  const getColorForKey = (key: string, value: unknown): string => {
    const keyColors: Record<string, string> = {
      'provider': 'text-blue-400',
      'trigger': 'text-purple-400',
      'submode': 'text-yellow-400',
      'mode': 'text-cyan-400',
      'language': 'text-white/70',
      'wolfram_used': 'text-orange-400',
      'quality': 'text-green-400',
      'voice': 'text-pink-400',
      'width': 'text-white/70',
      'height': 'text-white/70',
      'textLength': 'text-white/70',
    };
    
    // Special value-based colors
    if (key === 'provider') {
      const providerColors: Record<string, string> = {
        'gemini': 'text-blue-400',
        'openai': 'text-green-400',
        'claude': 'text-orange-400',
        'deepseek': 'text-cyan-400',
        'runware': 'text-pink-400',
        'elevenlabs': 'text-purple-400',
      };
      return providerColors[String(value)] || 'text-blue-400';
    }
    
    if (key === 'trigger') {
      const triggerColors: Record<string, string> = {
        'chat': 'text-purple-400',
        'search': 'text-blue-400',
        'image': 'text-pink-400',
        'vision': 'text-cyan-400',
        'study': 'text-yellow-400',
      };
      return triggerColors[String(value)] || 'text-purple-400';
    }
    
    return keyColors[key] || 'text-white/70';
  };

  // Format value for display
  const formatMetaValue = (key: string, value: unknown): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toLocaleString();
    if (typeof value === 'object') return JSON.stringify(value);
    
    // Special formatting
    if (key === 'language') {
      if (value === 'ar') return 'Arabic';
      if (value === 'en') return 'English';
    }
    
    return String(value);
  };

  // Format key for display (snake_case to Title Case)
  const formatMetaKey = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
  };

  // Extract ALL metadata fields dynamically
  const getMetadataInfo = (log: AILog) => {
    const meta = log.metadata || {};
    const info: { label: string; value: string; color: string; key: string }[] = [];
    
    // Priority order for common keys (show these first)
    const priorityKeys = ['provider', 'trigger', 'submode', 'mode', 'language', 'wolfram_used', 'quality', 'voice'];
    
    // Get all keys and sort by priority
    const allKeys = Object.keys(meta);
    const sortedKeys = [
      ...priorityKeys.filter(k => allKeys.includes(k)),
      ...allKeys.filter(k => !priorityKeys.includes(k))
    ];
    
    for (const key of sortedKeys) {
      const value = meta[key];
      // Skip null/undefined or empty values
      if (value === null || value === undefined || value === '') continue;
      // Skip complex nested objects in list view (will show in detail)
      if (typeof value === 'object' && !Array.isArray(value)) continue;
      
      info.push({
        key,
        label: formatMetaKey(key),
        value: formatMetaValue(key, value),
        color: getColorForKey(key, value)
      });
    }
    
    return info;
  };

  // Get ALL metadata for detail view (including nested objects)
  const getAllMetadata = (log: AILog) => {
    const meta = log.metadata || {};
    const items: { key: string; label: string; value: string; color: string; isComplex: boolean }[] = [];
    
    const priorityKeys = ['provider', 'trigger', 'submode', 'mode', 'language', 'wolfram_used', 'quality', 'voice'];
    const allKeys = Object.keys(meta);
    const sortedKeys = [
      ...priorityKeys.filter(k => allKeys.includes(k)),
      ...allKeys.filter(k => !priorityKeys.includes(k))
    ];
    
    for (const key of sortedKeys) {
      const value = meta[key];
      if (value === null || value === undefined) continue;
      
      const isComplex = typeof value === 'object';
      items.push({
        key,
        label: formatMetaKey(key),
        value: isComplex ? JSON.stringify(value, null, 2) : formatMetaValue(key, value),
        color: getColorForKey(key, value),
        isComplex
      });
    }
    
    return items;
  };

  return (
    <div className="min-h-screen bg-[#0c0f14] text-white/90">
      <AdminHeader
        title="AI Usage"
        subtitle="Monitor all AI calls and usage"
        icon={<Brain className="h-5 w-5 text-accent-purple" />}
      >
        <Button onClick={handleRefresh} variant="outline" size="sm" className="h-8 px-2 sm:px-3 text-xs bg-white/5 border-white/20 text-white/80 hover:bg-white/10 hover:text-white">
          <RefreshCw className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </AdminHeader>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/70 flex items-center">
                  <Zap className="h-4 w-4 mr-2 text-accent-blue" />
                  Total Calls
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{stats.total_calls.toLocaleString()}</div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/70 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-accent-green" />
                  Success Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent-green">{stats.success_rate}%</div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/70 flex items-center">
                  <Brain className="h-4 w-4 mr-2 text-accent-purple" />
                  Total Tokens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{stats.total_tokens.toLocaleString()}</div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/70 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2 text-accent-orange" />
                  Unique Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{stats.unique_users.toLocaleString()}</div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/70 flex items-center">
                  <Zap className="h-4 w-4 mr-2 text-accent-green" />
                  Total Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent-green">${(stats.total_cost || 0).toFixed(4)}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Filter className="h-5 w-5 mr-2" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {/* User Search */}
              <div className="lg:col-span-2">
                <Label className="text-white/70">Search User</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="Email or name..."
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="bg-white/5 border-white/20 text-white"
                  />
                  <Button onClick={handleSearch} size="sm" variant="outline" className="bg-white/5 border-white/20">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Function Filter */}
              <div>
                <Label className="text-white/70">Function</Label>
                <Select value={filterFunction} onValueChange={setFilterFunction}>
                  <SelectTrigger className="mt-1 bg-white/5 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1d24] border-white/20 text-white z-50">
                    <SelectItem value="all" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">All Functions</SelectItem>
                    {availableFunctions.map(fn => (
                      <SelectItem key={fn} value={fn} className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">{fn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Model Filter */}
              <div>
                <Label className="text-white/70">Model</Label>
                <Select value={filterModel} onValueChange={setFilterModel}>
                  <SelectTrigger className="mt-1 bg-white/5 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1d24] border-white/20 text-white z-50">
                    <SelectItem value="all" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">All Models</SelectItem>
                    {availableModels.map(model => (
                      <SelectItem key={model} value={model} className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">{model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div>
                <Label className="text-white/70">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="mt-1 bg-white/5 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1d24] border-white/20 text-white z-50">
                    <SelectItem value="all" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">All Status</SelectItem>
                    <SelectItem value="success" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Success</SelectItem>
                    <SelectItem value="error" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div>
                <Label className="text-white/70">Date Range</Label>
                <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeType)}>
                  <SelectTrigger className="mt-1 bg-white/5 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1d24] border-white/20 text-white z-50">
                    <SelectItem value="today" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Today</SelectItem>
                    <SelectItem value="7days" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Last 7 Days</SelectItem>
                    <SelectItem value="30days" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Last 30 Days</SelectItem>
                    <SelectItem value="all" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">All Time</SelectItem>
                    <SelectItem value="custom" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Custom Date Range */}
            {dateRange === "custom" && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <Label className="text-white/70">From</Label>
                  <Input
                    type="datetime-local"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="mt-1 bg-white/5 border-white/20 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white/70">To</Label>
                  <Input
                    type="datetime-local"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="mt-1 bg-white/5 border-white/20 text-white"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">AI Logs</CardTitle>
            <CardDescription className="text-white/50">
              {logs.length} logs loaded
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && logs.length === 0 ? (
              <div className="text-center py-8 text-white/50">Loading AI logs...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-white/50">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No AI logs found</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <Grid
                  data={gridData}
                  columns={gridColumns as any}
                  search={true}
                  sort={true}
                  pagination={{ limit: 50 }}
                  className={{
                    table: 'w-full',
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#0c0f14] border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Log Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/50">User</Label>
                  <p className="text-sm">{selectedLog.user_display_name || selectedLog.user_email || 'Unknown'}</p>
                </div>
                <div>
                  <Label className="text-white/50">Date</Label>
                  <p className="text-sm">{format(new Date(selectedLog.created_at), 'PPpp')}</p>
                </div>
                <div>
                  <Label className="text-white/50">Function</Label>
                  <p className="text-sm">{selectedLog.function_name}</p>
                </div>
                <div>
                  <Label className="text-white/50">Model</Label>
                  <p className="text-sm">{selectedLog.model || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-white/50">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                </div>
                <div>
                  <Label className="text-white/50">Duration</Label>
                  <p className="text-sm">{selectedLog.duration_ms}ms</p>
                </div>
              </div>

              {/* Enhanced Metadata Display - ALL fields */}
              {getAllMetadata(selectedLog).length > 0 && (
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <Label className="text-white/50 mb-2 block">All Metadata ({getAllMetadata(selectedLog).length} fields)</Label>
                  
                  {/* Simple fields in grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                    {getAllMetadata(selectedLog).filter(m => !m.isComplex).map((info, idx) => (
                      <div key={idx} className="text-center p-2 bg-white/5 rounded">
                        <p className="text-xs text-white/40">{info.label}</p>
                        <p className={`text-sm font-medium ${info.color} break-all`}>{info.value}</p>
                      </div>
                    ))}
                  </div>
                  
                  {/* Complex/nested fields shown separately */}
                  {getAllMetadata(selectedLog).filter(m => m.isComplex).map((info, idx) => (
                    <div key={idx} className="mt-2">
                      <p className="text-xs text-white/40 mb-1">{info.label}</p>
                      <pre className="p-2 bg-white/5 rounded text-xs text-white/70 whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto">
                        {info.value}
                      </pre>
                    </div>
                  ))}
                </div>
              )}

              {/* Tokens */}
              <div className="grid grid-cols-3 gap-4 p-3 bg-white/5 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-white/50">Input Tokens</p>
                  <p className="text-lg font-bold">{selectedLog.input_tokens.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-white/50">Output Tokens</p>
                  <p className="text-lg font-bold">{selectedLog.output_tokens.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-white/50">Total Tokens</p>
                  <p className="text-lg font-bold">{selectedLog.total_tokens.toLocaleString()}</p>
                </div>
              </div>

              {/* Error Message */}
              {selectedLog.error_message && (
                <div>
                  <Label className="text-red-400">Error Message</Label>
                  <pre className="mt-1 p-3 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-300 whitespace-pre-wrap">
                    {selectedLog.error_message}
                  </pre>
                </div>
              )}

              {/* Prompt */}
              {selectedLog.prompt && (
                <div>
                  <Label className="text-white/50">Prompt</Label>
                  <pre className="mt-1 p-3 bg-white/5 rounded text-xs text-white/80 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {selectedLog.prompt}
                  </pre>
                </div>
              )}

              {/* Response */}
              {selectedLog.response && (
                <div>
                  <Label className="text-white/50">Response</Label>
                  <pre className="mt-1 p-3 bg-white/5 rounded text-xs text-white/80 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {selectedLog.response}
                  </pre>
                </div>
              )}

              {/* Raw Metadata JSON (collapsible for debugging) */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-white/50 text-sm hover:text-white/70 transition-colors">
                    Raw JSON (click to expand)
                  </summary>
                  <pre className="mt-2 p-3 bg-white/5 rounded text-xs text-white/60 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AdminMobileNav />
    </div>
  );
}
