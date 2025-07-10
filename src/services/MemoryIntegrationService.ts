
import { supabase } from '@/integrations/supabase/client';

export interface UserMemoryContext {
  id?: string;
  user_id: string;
  interaction_count: number;
  last_interaction: Date;
  relationship_style: string;
  communication_style: string;
  current_projects?: string;
  working_patterns?: string;
  recent_achievements?: string;
  conversation_themes?: string[];
  user_expertise?: string[];
  preferred_help_style?: string;
  ai_nickname?: string;
  preferred_tone?: string;
  reply_style?: string;
  custom_instructions?: string;
  preferred_nickname?: string;
  created_at: Date;
  updated_at: Date;
}

class MemoryIntegrationServiceClass {
  // Get user's memory context from database
  async getUserMemoryContext(userId: string): Promise<UserMemoryContext | null> {
    try {
      const { data, error } = await supabase
        .from('user_memory_context')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user memory context:', error);
        return null;
      }

      if (data) {
        return {
          ...data,
          last_interaction: new Date(data.last_interaction),
          created_at: new Date(data.created_at),
          updated_at: new Date(data.updated_at)
        };
      }

      return null;
    } catch (error) {
      console.error('getUserMemoryContext error:', error);
      return null;
    }
  }

  // Get personalization settings from existing system
  getPersonalTouchSettings() {
    try {
      const stored = localStorage.getItem('wakti_personal_touch');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  // Build integrated context for AI requests
  buildIntegratedContext(memoryContext: UserMemoryContext | null, personalTouch: any) {
    const context: any = {};

    // From memory system
    if (memoryContext) {
      context.interactionCount = memoryContext.interaction_count;
      context.relationshipStyle = memoryContext.relationship_style;
      context.communicationStyle = memoryContext.communication_style;
      context.currentProjects = memoryContext.current_projects;
      context.workingPatterns = memoryContext.working_patterns;
      context.recentAchievements = memoryContext.recent_achievements;
      context.userExpertise = memoryContext.user_expertise;
      context.preferredHelpStyle = memoryContext.preferred_help_style;
    }

    // From personalization system (overrides memory if present)
    if (personalTouch) {
      if (personalTouch.nickname) {
        context.preferredNickname = personalTouch.nickname;
      }
      if (personalTouch.aiNickname) {
        context.aiNickname = personalTouch.aiNickname;
      }
      if (personalTouch.tone) {
        context.preferredTone = personalTouch.tone;
      }
      if (personalTouch.style) {
        context.replyStyle = personalTouch.style;
      }
      if (personalTouch.instruction) {
        context.customInstructions = personalTouch.instruction;
      }
    }

    return context;
  }

  // Check if memory integration is available for user
  async isMemoryAvailable(userId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id === userId;
    } catch {
      return false;
    }
  }

  // Clear memory context (for settings reset)
  async clearMemoryContext(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_memory_context')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error clearing memory context:', error);
        return false;
      }

      console.log('✅ Memory context cleared for user');
      return true;
    } catch (error) {
      console.error('clearMemoryContext error:', error);
      return false;
    }
  }

  // Get memory statistics
  async getMemoryStats(userId: string) {
    try {
      const memoryContext = await this.getUserMemoryContext(userId);
      
      if (!memoryContext) {
        return {
          hasMemory: false,
          interactionCount: 0,
          lastInteraction: null,
          relationshipStyle: 'neutral'
        };
      }

      return {
        hasMemory: true,
        interactionCount: memoryContext.interaction_count,
        lastInteraction: memoryContext.last_interaction,
        relationshipStyle: memoryContext.relationship_style,
        communicationStyle: memoryContext.communication_style,
        hasProjects: !!memoryContext.current_projects,
        hasAchievements: !!memoryContext.recent_achievements,
        expertiseAreas: memoryContext.user_expertise?.length || 0
      };
    } catch (error) {
      console.error('getMemoryStats error:', error);
      return {
        hasMemory: false,
        interactionCount: 0,
        lastInteraction: null,
        relationshipStyle: 'neutral'
      };
    }
  }
}

// Export singleton instance
export const MemoryIntegrationService = new MemoryIntegrationServiceClass();
export { MemoryIntegrationServiceClass };
