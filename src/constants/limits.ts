// ============================================================================
// APPLICATION LIMITS
// Rate limits, size limits, and quota configurations
// ============================================================================

/**
 * File size limits (in bytes)
 */
export const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024,      // 10 MB
  audio: 25 * 1024 * 1024,      // 25 MB
  video: 100 * 1024 * 1024,     // 100 MB
  document: 20 * 1024 * 1024,   // 20 MB
  avatar: 2 * 1024 * 1024,      // 2 MB
  attachment: 50 * 1024 * 1024, // 50 MB
} as const;

/**
 * Text length limits
 */
export const TEXT_LIMITS = {
  // Input limits
  chatMessage: 10000,
  projectName: 100,
  projectDescription: 500,
  taskTitle: 200,
  taskDescription: 2000,
  eventTitle: 150,
  eventDescription: 1000,
  
  // Display limits
  previewText: 150,
  truncatedMessage: 500,
  
  // AI limits
  aiPrompt: 8000,
  aiContext: 32000,
} as const;

/**
 * List/pagination limits
 */
export const LIST_LIMITS = {
  // Default page sizes
  defaultPageSize: 20,
  maxPageSize: 100,
  
  // Specific limits
  chatHistory: 50,
  recentProjects: 10,
  searchResults: 25,
  notifications: 30,
  contacts: 100,
  tasks: 200,
  
  // Supabase default
  supabaseDefaultLimit: 1000,
} as const;

/**
 * Cache limits
 */
export const CACHE_LIMITS = {
  // Memory cache
  maxMemoryCacheSize: 100,
  memoryCacheTTL: 30 * 60 * 1000, // 30 minutes
  
  // IndexedDB
  maxAIResponses: 500,
  maxProjectFiles: 1000,
  maxConversationContexts: 100,
  
  // React Query
  defaultStaleTime: 60 * 1000, // 1 minute
  defaultCacheTime: 30 * 60 * 1000, // 30 minutes
} as const;

/**
 * Rate limits
 */
export const RATE_LIMITS = {
  // AI requests per minute
  aiChatPerMinute: 20,
  imageGenerationPerMinute: 5,
  
  // API requests
  apiRequestsPerMinute: 100,
  
  // Auth
  loginAttemptsPerHour: 10,
  passwordResetPerHour: 5,
  
  // Messages
  messagesPerMinute: 30,
} as const;

/**
 * Quota limits (for subscription tiers)
 */
export const QUOTA_LIMITS = {
  free: {
    aiChatsPerDay: 10,
    imageGenerationsPerDay: 5,
    projectsMax: 3,
    storageGB: 1,
  },
  pro: {
    aiChatsPerDay: 100,
    imageGenerationsPerDay: 50,
    projectsMax: 20,
    storageGB: 10,
  },
  business: {
    aiChatsPerDay: 500,
    imageGenerationsPerDay: 200,
    projectsMax: 100,
    storageGB: 50,
  },
} as const;

/**
 * Time limits (in milliseconds)
 */
export const TIME_LIMITS = {
  // Session
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  refreshTokenExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
  
  // Message expiry
  messageExpiry: 24 * 60 * 60 * 1000, // 24 hours
  
  // Auto-save
  autoSaveDebounce: 2000, // 2 seconds
  
  // Polling
  notificationPollInterval: 30 * 1000, // 30 seconds
  presencePollInterval: 60 * 1000, // 1 minute
} as const;

/**
 * Retry limits
 */
export const RETRY_LIMITS = {
  maxApiRetries: 3,
  maxUploadRetries: 5,
  maxAIRetries: 2,
  retryBaseDelay: 1000, // 1 second
} as const;
