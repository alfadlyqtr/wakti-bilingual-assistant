import { QueryClient } from '@tanstack/react-query';

// ============================================================================
// REACT QUERY CONFIGURATION
// Optimized caching settings for different data types
// ============================================================================

/**
 * Stale times for different data categories (in milliseconds)
 */
export const STALE_TIMES = {
  // User data - stale quickly as it may change
  user: 30 * 1000,              // 30 seconds
  
  // Projects list - semi-fresh
  projects: 2 * 60 * 1000,       // 2 minutes
  
  // Project files - can be stale longer
  projectFiles: 5 * 60 * 1000,   // 5 minutes
  
  // Static data - rarely changes
  static: 30 * 60 * 1000,        // 30 minutes
  
  // AI responses - cache aggressively
  aiResponses: 60 * 60 * 1000,   // 1 hour
  
  // Real-time data - always fresh
  realtime: 0,                   // Always refetch
  
  // Settings - rarely changes
  settings: 10 * 60 * 1000,      // 10 minutes
  
  // Contacts list
  contacts: 5 * 60 * 1000,       // 5 minutes
  
  // Messages - need fresh data
  messages: 10 * 1000,           // 10 seconds
  
  // Calendar data
  calendar: 2 * 60 * 1000,       // 2 minutes
  
  // Tasks and reminders
  tasks: 60 * 1000,              // 1 minute
};

/**
 * Cache times (how long to keep data in cache after becoming unused)
 */
export const CACHE_TIMES = {
  short: 5 * 60 * 1000,          // 5 minutes
  medium: 30 * 60 * 1000,        // 30 minutes
  long: 60 * 60 * 1000,          // 1 hour
  persistent: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Retry configuration
 */
export const RETRY_CONFIG = {
  count: 3,
  delay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
};

/**
 * Create optimized query client
 */
export function createOptimizedQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Default stale time - 1 minute
        staleTime: 60 * 1000,
        
        // Keep unused data for 30 minutes
        gcTime: 30 * 60 * 1000,
        
        // Retry failed requests
        retry: RETRY_CONFIG.count,
        retryDelay: RETRY_CONFIG.delay,
        
        // Don't refetch on window focus by default (saves bandwidth)
        refetchOnWindowFocus: false,
        
        // Don't refetch on reconnect by default
        refetchOnReconnect: 'always',
        
        // Keep previous data while fetching new data
        placeholderData: (previousData: unknown) => previousData,
        
        // Network mode - always try to fetch even if offline (uses cache)
        networkMode: 'offlineFirst',
      },
      mutations: {
        // Retry mutations once
        retry: 1,
        
        // Network mode for mutations
        networkMode: 'online',
      },
    },
  });
}

/**
 * Query key factories for consistent key generation
 */
export const queryKeys = {
  // User
  user: () => ['user'] as const,
  userProfile: (userId: string) => ['user', 'profile', userId] as const,
  userSettings: (userId: string) => ['user', 'settings', userId] as const,
  
  // Projects
  projects: () => ['projects'] as const,
  projectList: (userId: string) => ['projects', 'list', userId] as const,
  projectDetail: (projectId: string) => ['projects', 'detail', projectId] as const,
  projectFiles: (projectId: string) => ['projects', 'files', projectId] as const,
  
  // AI
  aiConversations: (userId: string) => ['ai', 'conversations', userId] as const,
  aiConversation: (conversationId: string) => ['ai', 'conversation', conversationId] as const,
  aiMessages: (conversationId: string) => ['ai', 'messages', conversationId] as const,
  
  // Tasks
  tasks: (userId: string) => ['tasks', userId] as const,
  taskDetail: (taskId: string) => ['tasks', 'detail', taskId] as const,
  
  // Calendar
  calendar: (userId: string, month: string) => ['calendar', userId, month] as const,
  events: (userId: string) => ['events', userId] as const,
  
  // Contacts
  contacts: (userId: string) => ['contacts', userId] as const,
  contactDetail: (contactId: string) => ['contacts', 'detail', contactId] as const,
  
  // Messages
  conversations: (userId: string) => ['conversations', userId] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
  
  // Journal
  journal: (userId: string) => ['journal', userId] as const,
  journalDay: (userId: string, date: string) => ['journal', userId, date] as const,
  
  // Admin
  adminUsers: () => ['admin', 'users'] as const,
  adminStats: () => ['admin', 'stats'] as const,
};

/**
 * Prefetch common queries on app load
 */
export async function prefetchCommonQueries(
  queryClient: QueryClient,
  userId: string
): Promise<void> {
  // Prefetch user profile
  await queryClient.prefetchQuery({
    queryKey: queryKeys.userProfile(userId),
    staleTime: STALE_TIMES.user,
  });
  
  // Prefetch projects list
  await queryClient.prefetchQuery({
    queryKey: queryKeys.projectList(userId),
    staleTime: STALE_TIMES.projects,
  });
  
  // Prefetch tasks
  await queryClient.prefetchQuery({
    queryKey: queryKeys.tasks(userId),
    staleTime: STALE_TIMES.tasks,
  });
  
  console.log('📊 Prefetched common queries');
}

/**
 * Invalidate all user-related queries (for logout)
 */
export function invalidateUserQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['user'] });
  queryClient.invalidateQueries({ queryKey: ['projects'] });
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
  queryClient.invalidateQueries({ queryKey: ['calendar'] });
  queryClient.invalidateQueries({ queryKey: ['contacts'] });
  queryClient.invalidateQueries({ queryKey: ['journal'] });
  queryClient.invalidateQueries({ queryKey: ['ai'] });
  console.log('📊 Invalidated all user queries');
}

// Export default optimized client
export const optimizedQueryClient = createOptimizedQueryClient();
