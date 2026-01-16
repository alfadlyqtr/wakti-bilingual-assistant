// ============================================================================
// SERVICES BARREL EXPORT
// Single entry point for core services
// ============================================================================

// Cache Services
export { AIResponseCache } from './AIResponseCache';
export { IndexedDBCache, cacheAIResponse, getCachedAIResponse, cacheProjectFiles, getCachedProjectFiles, cacheConversationContext, getCachedConversationContext } from './IndexedDBCache';
export { UltraFastMemoryCache } from './UltraFastMemoryCache';

// AI Services
export { WaktiAIV2Service } from './WaktiAIV2Service';
export { StreamingResponseManager } from './StreamingResponseManager';

// Memory Services
export { ChatMemoryService } from './ChatMemoryService';
export { EnhancedFrontendMemory } from './EnhancedFrontendMemory';
export { HybridMemoryService } from './HybridMemoryService';
export { MemoryIntegrationService } from './MemoryIntegrationService';
export { SavedConversationsService } from './SavedConversationsService';

// Personalization Services
export { PersonalizationEnforcer } from './PersonalizationEnforcer';
export { PersonalizationProcessor } from './PersonalizationProcessor';

// Task Services
export { EnhancedTaskCreationService } from './EnhancedTaskCreationService';
export { TRService } from './trService';
export { TRServiceCache } from './trServiceCache';
export { TRSharedService } from './trSharedService';

// Utility Services
export { BackgroundProcessingQueue } from './BackgroundProcessingQueue';
export { FreepikService } from './FreepikService';

// Note: Other services can be imported directly from their files
// e.g., import { getContacts } from '@/services/contactsService'
