
import { supabase } from "@/integrations/supabase/client";

export interface VisitorIdentity {
  name: string;
  fingerprint: string;
  sessionId: string;
  taskId: string;
  lastActiveAt: string;
}

export class VisitorIdentityService {
  private static generateFingerprint(): string {
    // Create a more robust browser fingerprint
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Browser fingerprint', 2, 2);
    }
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
      navigator.platform,
      navigator.cookieEnabled.toString()
    ].join('|');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static async createVisitorIdentity(taskId: string, name: string): Promise<VisitorIdentity> {
    const fingerprint = this.generateFingerprint();
    const sessionId = this.generateSessionId();
    
    const identity: VisitorIdentity = {
      name: name.trim(),
      fingerprint,
      sessionId,
      taskId,
      lastActiveAt: new Date().toISOString()
    };

    // Store in database instead of localStorage
    try {
      await supabase
        .from('tr_shared_access')
        .insert({
          task_id: taskId,
          viewer_name: name.trim(),
          session_id: sessionId,
          visitor_ip: fingerprint, // Store fingerprint in visitor_ip field
          is_active: true,
          last_accessed: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error storing visitor identity:', error);
    }
    
    return identity;
  }

  static async getStoredIdentity(taskId: string): Promise<VisitorIdentity | null> {
    try {
      const fingerprint = this.generateFingerprint();
      
      // Look for recent sessions with same fingerprint (last 24 hours)
      const { data, error } = await supabase
        .from('tr_shared_access')
        .select('*')
        .eq('task_id', taskId)
        .eq('visitor_ip', fingerprint)
        .eq('is_active', true)
        .gte('last_accessed', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('last_accessed', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return null;
      }

      const session = data[0];
      return {
        name: session.viewer_name || '',
        fingerprint,
        sessionId: session.session_id || '',
        taskId,
        lastActiveAt: session.last_accessed
      };
    } catch (error) {
      console.error('Error retrieving stored identity:', error);
      return null;
    }
  }

  static async updateLastActive(taskId: string, identity: VisitorIdentity): Promise<void> {
    try {
      await supabase
        .from('tr_shared_access')
        .update({ 
          last_accessed: new Date().toISOString(),
          is_active: true
        })
        .eq('session_id', identity.sessionId);
    } catch (error) {
      console.error('Error updating last active:', error);
    }
  }

  static async getExistingSessions(taskId: string, visitorName: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('tr_shared_access')
        .select('session_id')
        .eq('task_id', taskId)
        .eq('viewer_name', visitorName)
        .eq('is_active', true);

      if (error) throw error;
      return data?.map(d => d.session_id).filter(Boolean) || [];
    } catch (error) {
      console.error('Error fetching existing sessions:', error);
      return [];
    }
  }

  static async checkNameConflict(taskId: string, name: string, currentFingerprint: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('tr_shared_access')
        .select('session_id, visitor_ip')
        .eq('task_id', taskId)
        .eq('viewer_name', name)
        .eq('is_active', true);

      if (error) throw error;
      
      // Check if there are active sessions with this name from different devices/browsers
      return data ? data.some(session => session.visitor_ip !== currentFingerprint) : false;
    } catch (error) {
      console.error('Error checking name conflict:', error);
      return false;
    }
  }

  static async deactivateSession(sessionId: string): Promise<void> {
    try {
      await supabase
        .from('tr_shared_access')
        .update({ is_active: false })
        .eq('session_id', sessionId);
    } catch (error) {
      console.error('Error deactivating session:', error);
    }
  }
}
