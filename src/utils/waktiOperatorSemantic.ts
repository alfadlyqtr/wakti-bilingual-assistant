import { callEdgeFunctionWithRetry } from '@/integrations/supabase/edgeFunctions';
import { buildWaktiCapabilityKnowledgeManifest } from '@/utils/waktiCapabilityContracts';
import type { WaktiCapabilityId } from '@/utils/waktiCapabilities';

export type WaktiOperatorSemanticIntent =
  | 'conversation'
  | 'guidance'
  | 'prepare'
  | 'generate'
  | 'confirm'
  | 'cancel'
  | 'clarify';

export interface WaktiOperatorSemanticMusicContext {
  title?: string;
  topic?: string;
  lyrics?: string;
  style?: string;
  mode?: 'custom' | 'instrumental';
  vocalType?: 'auto' | 'none' | 'male' | 'female';
}

export interface WaktiOperatorSemanticAnalysis {
  capability: 'music' | 'other' | 'unknown';
  capabilityId: WaktiCapabilityId | null;
  intent: WaktiOperatorSemanticIntent;
  confidence: number;
  title: string | null;
  topic: string | null;
  lyrics: string | null;
  style: string | null;
  mode: 'custom' | 'instrumental' | null;
  vocalType: 'auto' | 'none' | 'male' | 'female' | null;
  response: string | null;
  clarificationQuestion: string | null;
}

export async function analyzeWaktiOperatorSemantics(
  transcript: string,
  language: 'ar' | 'en',
  previousMusic?: WaktiOperatorSemanticMusicContext | null,
): Promise<WaktiOperatorSemanticAnalysis | null> {
  try {
    const result = await callEdgeFunctionWithRetry<WaktiOperatorSemanticAnalysis>('wakti-operator-intent', {
      body: {
        transcript,
        language,
        capabilityManifest: buildWaktiCapabilityKnowledgeManifest(language),
        previousMusic: previousMusic || null,
      },
      headers: { 'Content-Type': 'application/json' },
      maxRetries: 1,
      retryDelay: 300,
    });

    if (!result || typeof result.intent !== 'string' || typeof result.capability !== 'string') return null;
    if (result.capabilityId !== null && typeof result.capabilityId !== 'string') return null;
    if (!previousMusic) return result;
    const isMusicFollowUp = result.intent === 'confirm' || result.intent === 'cancel';
    return {
      ...result,
      capability: isMusicFollowUp ? 'music' : result.capability,
      capabilityId: isMusicFollowUp ? 'music_studio' : result.capabilityId,
      title: result.title || previousMusic.title || null,
      topic: result.topic || previousMusic.topic || null,
      lyrics: result.lyrics || previousMusic.lyrics || null,
      style: result.style || previousMusic.style || null,
      mode: result.mode || previousMusic.mode || null,
      vocalType: result.vocalType || previousMusic.vocalType || null,
    };
  } catch (error) {
    console.warn('Wakti Operator semantic analysis unavailable:', error);
    return null;
  }
}
