
import { supabase } from "@/integrations/supabase/client";

export interface VisitorIdentity {
  name: string;
  fingerprint: string;
  sessionId: string;
  lastActiveAt: string;
}

export class VisitorIdentityService {
  private static generateFingerprint(): string {
    // Create a basic fingerprint from available browser data
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx!.textBaseline = 'top';
    ctx!.font = '14px Arial';
    ctx!.fillText('Browser fingerprint', 2, 2);
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
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
      lastActiveAt: new Date().toISOString()
    };

    // Store in localStorage for this browser
    localStorage.setItem(`visitor_identity_${taskId}`, JSON.stringify(identity));
    
    return identity;
  }

  static async getStoredIdentity(taskId: string): Promise<VisitorIdentity | null> {
    try {
      const stored = localStorage.getItem(`visitor_identity_${taskId}`);
      if (!stored) return null;
      
      const identity = JSON.parse(stored) as VisitorIdentity;
      
      // Check if identity is still valid (within 24 hours)
      const lastActive = new Date(identity.lastActiveAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        localStorage.removeItem(`visitor_identity_${taskId}`);
        return null;
      }
      
      return identity;
    } catch (error) {
      console.error('Error retrieving stored identity:', error);
      return null;
    }
  }

  static async updateLastActive(taskId: string, identity: VisitorIdentity): Promise<void> {
    identity.lastActiveAt = new Date().toISOString();
    localStorage.setItem(`visitor_identity_${taskId}`, JSON.stringify(identity));
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
        .select('session_id')
        .eq('task_id', taskId)
        .eq('viewer_name', name)
        .eq('is_active', true);

      if (error) throw error;
      
      // If there are active sessions with this name from different devices/browsers
      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking name conflict:', error);
      return false;
    }
  }
}
