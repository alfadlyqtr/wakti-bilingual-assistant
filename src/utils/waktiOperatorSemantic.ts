import { callEdgeFunctionWithRetry } from '@/integrations/supabase/edgeFunctions';
import { buildWaktiCapabilityKnowledgeManifest } from '@/utils/waktiCapabilityContracts';
import type { WaktiCapabilityId } from '@/utils/waktiCapabilities';
import { isWaktiExecutionAction } from '@/utils/waktiExecutionSchemas';

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
  actionId: string | null;
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
    if (result.actionId !== null && typeof result.actionId !== 'string') return null;
    const actionId = isWaktiExecutionAction(result.capabilityId, result.actionId) ? result.actionId : null;
    const normalizedResult = { ...result, actionId };
    if (!previousMusic) return normalizedResult;
    const isMusicFollowUp = normalizedResult.intent === 'confirm' || normalizedResult.intent === 'cancel';
    return {
      ...normalizedResult,
      capability: isMusicFollowUp ? 'music' : normalizedResult.capability,
      capabilityId: isMusicFollowUp ? 'music_studio' : normalizedResult.capabilityId,
      actionId: isMusicFollowUp && normalizedResult.intent === 'confirm' ? 'generate_music_track' : normalizedResult.actionId,
      title: normalizedResult.title || previousMusic.title || null,
      topic: normalizedResult.topic || previousMusic.topic || null,
      lyrics: normalizedResult.lyrics || previousMusic.lyrics || null,
      style: normalizedResult.style || previousMusic.style || null,
      mode: normalizedResult.mode || previousMusic.mode || null,
      vocalType: normalizedResult.vocalType || previousMusic.vocalType || null,
    };
  } catch (error) {
    console.warn('Wakti Operator semantic analysis unavailable:', error);
    return null;
  }
}
