// ============================================================================
// API CONSTANTS
// Centralized API endpoints and configuration
// ============================================================================

/**
 * Supabase configuration
 */
export const SUPABASE_CONFIG = {
  projectId: 'hxauxozopvpzpdygoqwf',
  url: 'https://hxauxozopvpzpdygoqwf.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU',
} as const;

/**
 * Edge function endpoints
 */
export const EDGE_FUNCTIONS = {
  // AI Functions
  aiChat: 'ai-chat',
  aiChatStreaming: 'ai-chat-streaming',
  projectsGenerate: 'projects-generate',
  generateImage: 'generate-image',
  transcribeAudio: 'transcribe-audio',
  textToSpeech: 'text-to-speech',
  
  // Project Functions
  projectFiles: 'project-files',
  publishProject: 'publish-project',
  
  // Utility Functions
  sendEmail: 'send-email',
  processPayment: 'process-payment',
  webhookHandler: 'webhook-handler',
} as const;

/**
 * External API endpoints
 */
export const EXTERNAL_APIS = {
  freepik: 'https://api.freepik.com',
  openai: 'https://api.openai.com/v1',
  elevenlabs: 'https://api.elevenlabs.io/v1',
  runware: 'https://api.runware.ai/v1',
} as const;

/**
 * API request timeouts (in milliseconds)
 */
export const API_TIMEOUTS = {
  default: 30000,      // 30 seconds
  short: 10000,        // 10 seconds
  long: 60000,         // 1 minute
  aiGeneration: 120000, // 2 minutes
  fileUpload: 300000,  // 5 minutes
} as const;

/**
 * Retry configuration
 */
export const API_RETRY = {
  maxRetries: 3,
  baseDelay: 1000,     // 1 second
  maxDelay: 30000,     // 30 seconds
  backoffMultiplier: 2,
} as const;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Content types
 */
export const CONTENT_TYPES = {
  json: 'application/json',
  formData: 'multipart/form-data',
  text: 'text/plain',
  html: 'text/html',
  xml: 'application/xml',
  octetStream: 'application/octet-stream',
} as const;
