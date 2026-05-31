import { findBestWaktiCapabilityMatch, type WaktiCapability, type WaktiCapabilityId } from '@/utils/waktiCapabilities';

export type WaktiOperatorIntentKind = 'guidance' | 'navigation' | 'execution' | 'mixed' | 'unknown';

export interface WaktiOperatorIntentAnalysis {
  kind: WaktiOperatorIntentKind;
  capability: WaktiCapability | null;
  capabilityId?: WaktiCapabilityId;
  confidence: 'high' | 'medium' | 'low';
}

function testAny(input: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(input));
}

export function analyzeWaktiOperatorIntent(transcript: string): WaktiOperatorIntentAnalysis {
  const normalized = transcript.trim();
  const lower = normalized.toLowerCase();
  const capabilityMatch = findBestWaktiCapabilityMatch(normalized)?.capability || null;

  const guidanceSignals = [
    /^(how do i|how can i|where do i|what is|what can wakti|can you explain|explain|show me how|help me understand|teach me)/i,
    /\b(how do i|how can i|show me how|walk me through|guide me|steps to|navigation steps|where is)\b/i,
    /^(كيف|اشرح|وريني|دلني|ساعدني أفهم|ساعدني افهم|كيف أ|كيف اسوي|كيف أقدر)/,
    /\b(كيف|اشرح|وريني|دلني|خطوات|طريقة|شرح)\b/,
  ];

  const navigationSignals = [
    /\b(open|take me to|go to|navigate to|bring me to|show me|launch)\b/i,
    /\b(افتح|خذني|ودني|روحني|انتقل|اذهب|روح إلى|روح الي|افتح لي)\b/,
  ];

  const executionSignals = [
    /\b(create|make|generate|send|draft|compose|save|add|set|schedule|remind|write|build|start|read aloud|say this|speak this|convert to speech|translate this|clone my voice|record)\b/i,
    /\b(أنشئ|انشئ|اعمل|سو|سوي|ولّد|ولد|أرسل|ارسل|احفظ|أضف|اضف|ذكرني|رتب|ابدأ|ابدا|اقرأ بصوت|حوّل إلى صوت|حول إلى صوت|ترجم هذا|استنسخ صوتي|سجل|سجّل)\b/,
  ];

  const hasGuidance = testAny(normalized, guidanceSignals) || /\?$/.test(normalized);
  const hasNavigation = testAny(normalized, navigationSignals);
  const hasExecution = testAny(normalized, executionSignals);

  let kind: WaktiOperatorIntentKind = 'unknown';
  if (hasGuidance && (hasNavigation || hasExecution)) kind = 'mixed';
  else if (hasGuidance) kind = 'guidance';
  else if (hasNavigation && hasExecution) kind = 'mixed';
  else if (hasNavigation) kind = 'navigation';
  else if (hasExecution) kind = 'execution';
  else if (capabilityMatch) kind = 'guidance';

  const confidence = capabilityMatch
    ? kind === 'mixed' || kind === 'execution' || kind === 'guidance' || kind === 'navigation'
      ? 'high'
      : 'medium'
    : lower.length > 12
      ? 'medium'
      : 'low';

  return {
    kind,
    capability: capabilityMatch,
    capabilityId: capabilityMatch?.id,
    confidence,
  };
}
