import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, Check, Loader2, Type } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, nextDay, parse as dateParse } from 'date-fns';
import { CALENDAR_ADD_ENTRY_SCHEMA } from '@/schemas/calendarAddEntrySchema';
import {
  detectTRIntent,
  validateTaskDraft,
  validateReminderDraft,
  mapTaskDraftToPayload,
  mapReminderDraftToPayload,
  mapSubtaskDraftToPayload,
  buildClarificationMessage,
  type TaskDraft,
  type ReminderDraft,
  type VoiceIntent,
} from '@/schemas/tasksDraftMapper';
import { TRService } from '@/services/trService';

// ─── Types ──────────────────────────────────────────────────────────────────

type VoiceState = 'idle' | 'connecting' | 'greeting' | 'listening' | 'thinking' | 'confirming' | 'done' | 'error';

/** What the voice input was detected as */
type DetectedMode = 'calendar' | 'task' | 'reminder' | 'unrecognized';

/** Action intents that operate on existing items (not create) */
type ActionIntent = 'complete_task' | 'snooze_reminder' | 'reschedule_task' | 'reschedule_reminder';

interface ExtractedEntry {
  title: string;
  date: string; // yyyy-MM-dd
  time?: string; // HH:mm
  description?: string;
  clarificationQuestion?: string;
  needsDateConfirm?: boolean;
  needsTimeConfirm?: boolean;
  /** Which mode was detected from the transcript */
  mode?: DetectedMode;
  /** Task-specific: priority */
  priority?: 'normal' | 'high' | 'urgent';
  /** Task-specific: subtask titles extracted from transcript */
  subtasks?: string[];
  /** Action intent (operate on existing item, not create) */
  actionIntent?: ActionIntent;
  /** The target item ID found by fuzzy match */
  targetItemId?: string;
  /** The matched item title (for display) */
  targetItemTitle?: string;
  /** Snooze minutes (for snooze_reminder) */
  snoozeMinutes?: number;
}

interface VoiceAssistantProps {
  onSaveEntry: (entry: { title: string; date: string; time?: string; description?: string }) => void;
}

// ─── Date parsing helper ────────────────────────────────────────────────────

function parseDateFromText(text: string): { date: string | null; isConfident: boolean } {
  const lower = text.toLowerCase().trim();
  const today = new Date();

  // "today"
  if (lower.includes('today') || lower.includes('اليوم')) {
    return { date: format(today, 'yyyy-MM-dd'), isConfident: true };
  }

  // "tonight" / "this evening" (treat as today)
  if (
    lower.includes('tonight') ||
    lower.includes('this evening') ||
    lower.includes('this night') ||
    lower.includes('الليلة') ||
    lower.includes('ليله') ||
    lower.includes('مساء')
  ) {
    return { date: format(today, 'yyyy-MM-dd'), isConfident: true };
  }

  // "tomorrow"
  if (lower.includes('tomorrow') || lower.includes('غدا') || lower.includes('غداً') || lower.includes('بكرة') || lower.includes('بكره')) {
    return { date: format(addDays(today, 1), 'yyyy-MM-dd'), isConfident: true };
  }

  // "day after tomorrow"
  if (lower.includes('day after tomorrow') || lower.includes('بعد غد') || lower.includes('بعد بكرة') || lower.includes('بعد بكره')) {
    return { date: format(addDays(today, 2), 'yyyy-MM-dd'), isConfident: true };
  }

  // "next monday", "next tuesday", etc.
  const dayNames: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    الأحد: 0, الاثنين: 1, الثلاثاء: 2, الأربعاء: 3, الخميس: 4, الجمعة: 5, السبت: 6,
  };

  for (const [name, dayIndex] of Object.entries(dayNames)) {
    if (lower.includes(name)) {
      const next = nextDay(today, dayIndex);
      return { date: format(next, 'yyyy-MM-dd'), isConfident: true };
    }
  }

  // Try to find a date pattern like "February 10" or "10 February" or "2026-02-10"
  const isoMatch = lower.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return {
      date: `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`,
      isConfident: true,
    };
  }

  const monthNames: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    يناير: 1, فبراير: 2, مارس: 3, أبريل: 4, مايو: 5, يونيو: 6,
    يوليو: 7, أغسطس: 8, سبتمبر: 9, أكتوبر: 10, نوفمبر: 11, ديسمبر: 12,
  };

  for (const [mName, mNum] of Object.entries(monthNames)) {
    const re1 = new RegExp(`${mName}\\s+(\\d{1,2})`, 'i');
    const re2 = new RegExp(`(\\d{1,2})\\s+${mName}`, 'i');
    const m1 = lower.match(re1);
    const m2 = lower.match(re2);
    const dayNum = m1 ? parseInt(m1[1]) : m2 ? parseInt(m2[1]) : null;
    if (dayNum && dayNum >= 1 && dayNum <= 31) {
      const year = today.getFullYear();
      return {
        date: `${year}-${String(mNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`,
        isConfident: true,
      };
    }
  }

  // Not found
  return { date: null, isConfident: false };
}

// ─── Extract structured data from transcript ────────────────────────────────

function extractRelativeMinutes(textLower: string): number | null {
  const numeric = textLower.match(/\b(?:in|after|at)\s+(\d{1,3})\s*(?:minute|minutes|min|mins)\b/);
  if (numeric) return Math.max(1, Math.min(24 * 60, parseInt(numeric[1], 10)));

  const word = textLower.match(/\b(?:in|after|at)\s+(one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty)\s+minutes?\b/);
  if (word) {
    const map: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
      fifteen: 15,
      twenty: 20,
    };
    return map[word[1]] ?? null;
  }

  const arNumeric = textLower.match(/\bبعد\s+(\d{1,3})\s*دقائق?\b/);
  if (arNumeric) return Math.max(1, Math.min(24 * 60, parseInt(arNumeric[1], 10)));

  const arWord = textLower.match(/\bبعد\s+(خمس|عشرة|عشر|ربع ساعة|نص ساعة)\s*(?:دقائق?)?\b/);
  if (arWord) {
    const val = arWord[1];
    if (val === 'خمس') return 5;
    if (val === 'عشر' || val === 'عشرة') return 10;
    if (val === 'ربع ساعة') return 15;
    if (val === 'نص ساعة') return 30;
  }

  return null;
}

function extractTimeFromText(text: string): { time: string | null; isConfident: boolean } {
  const lower = text.toLowerCase();

  // Relative time (used primarily for reminders): "in 5 minutes" / "بعد 5 دقائق"
  // We parse this here so the confirmation UI can still show the time.
  const relMinutes = extractRelativeMinutes(lower);
  if (relMinutes) {
    const now = new Date();
    const future = new Date(now.getTime() + relMinutes * 60 * 1000);
    return { time: `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`, isConfident: true };
  }

  // 24h: 21:30 / 9:05
  const hhmm = lower.match(/\b(\d{1,2})\s*:\s*(\d{2})\b/);
  if (hhmm) {
    const h = Math.max(0, Math.min(23, parseInt(hhmm[1], 10)));
    const m = Math.max(0, Math.min(59, parseInt(hhmm[2], 10)));
    return { time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, isConfident: true };
  }

  // 9 pm / 9 p.m. / 9pm
  const ampm = lower.match(/\b(\d{1,2})(?:\s*[:.]\s*(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|am|pm)\b/);
  if (ampm) {
    let h = Math.max(1, Math.min(12, parseInt(ampm[1], 10)));
    const m = ampm[2] ? Math.max(0, Math.min(59, parseInt(ampm[2], 10))) : 0;
    const mer = ampm[3].replace(/\./g, '');
    if (mer === 'pm' && h !== 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    return { time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, isConfident: true };
  }

  // Arabic: "9 مساء" / "9 م" / "9 صباحا" / "9 ص"
  const ar = lower.match(/\b(\d{1,2})(?:\s*[:.]\s*(\d{2}))?\s*(ص|صباح|صباحاً|صباحا|م|مساء|مساءً|مساءا)\b/);
  if (ar) {
    let h = Math.max(1, Math.min(12, parseInt(ar[1], 10)));
    const m = ar[2] ? Math.max(0, Math.min(59, parseInt(ar[2], 10))) : 0;
    const mer = ar[3];
    const isPm = mer.includes('م') || mer.includes('مساء');
    const isAm = mer.includes('ص') || mer.includes('صباح');
    if (isPm && h !== 12) h += 12;
    if (isAm && h === 12) h = 0;
    return { time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, isConfident: true };
  }

  return { time: null, isConfident: false };
}

function pickPrimaryClause(transcript: string): string {
  const raw = (transcript || '').trim();
  if (!raw) return '';

  const pieces = raw
    .split(/[\n\r]+/)
    .flatMap((line) => line.split(/[.?!؛;]+/))
    .flatMap((part) => part.split(/\s*,\s*/))
    .map((s) => s.trim())
    .filter(Boolean);

  if (pieces.length <= 1) return raw;

  const keywords = [
    'appointment', 'meeting', 'call', 'dinner', 'doctor', 'with', 'calendar', 'remind',
    'موعد', 'اجتماع', 'مكالمة', 'عشاء', 'طبيب', 'مع', 'تقويم', 'ذكر',
  ];

  const scored = pieces.map((p) => {
    const lower = p.toLowerCase();
    const score = keywords.reduce((acc, k) => (lower.includes(k) ? acc + 1 : acc), 0);
    return { p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  if (scored[0]?.score > 0) return scored[0].p;
  return pieces[0];
}

// ─── Priority extraction helper ──────────────────────────────────────────────

function extractPriorityFromText(text: string): 'normal' | 'high' | 'urgent' {
  const lower = text.toLowerCase();
  const urgentWords = ['urgent', 'asap', 'emergency', 'critical', 'عاجل', 'فوري', 'طارئ'];
  const highWords = ['important', 'high priority', 'مهم', 'أولوية عالية'];
  for (const w of urgentWords) { if (lower.includes(w)) return 'urgent'; }
  for (const w of highWords) { if (lower.includes(w)) return 'high'; }
  return 'normal';
}

// ─── Clean title helper (shared between calendar & task) ─────────────────────

function cleanTitle(rawTitle: string, transcript: string): string {
  // First: strip command phrases from the FULL transcript, then use that as
  // the base title. This handles cases like "Set a reminder, call wife in two
  // minutes" where pickPrimaryClause splits on comma and loses the command part.
  let fullCleaned = transcript.trim();
  const commandPatterns = [
    /^(create|add|make|set|new|put)\s+(a\s+)?(calendar\s+)?(entry|event|appointment|reminder|task|subtask|todo)\s*(to|for|about)?[,.]?\s*/i,
    /^calendar\s+entry[,.]?\s*/i,
    /^(أضف|أنشئ|سجل|اعمل)\s+(موعد|حدث|تذكير|مهمة)?\s*(لـ?|عن|أن)?[,.]?\s*/i,
    /^(create|add|new|set)\s+(a\s+)?(task|reminder|todo)\s*(to|for|about)?[,.]?\s*/i,
    /^(remind\s+me\s+(to|about)?)[,.]?\s*/i,
    /^(ذكرني\s*(بـ?|أن|إني)?)[,.]?\s*/i,
    /^(set\s+(the\s+|a\s+)?reminder\s*(to|for)?)[,.]?\s*/i,
    /^(I'll remind you\s+(to)?)[,.]?\s*/i,
    /^(i\s+need\s+to)[,.]?\s*/i,
    /^(i\s+want\s+to)[,.]?\s*/i,
    /^(please\s+)?(remind|remember)\s+(me\s+)?(to|about)?[,.]?\s*/i,
    /^(don'?t\s+let\s+me\s+forget\s+(to)?)[,.]?\s*/i,
  ];
  for (const pattern of commandPatterns) {
    fullCleaned = fullCleaned.replace(pattern, '');
  }
  // Use the cleaned full transcript as the title base (better than rawTitle
  // which may be a fragment from pickPrimaryClause that lost context)
  let title = fullCleaned.trim() || rawTitle.trim();

  // Run command patterns again on the title in case rawTitle was used as fallback
  for (const pattern of commandPatterns) {
    title = title.replace(pattern, '');
  }

  // Remove relative time phrases from title ANYWHERE: "in 5 minutes" / "after 10 min" / "بعد 5 دقائق"
  title = title.replace(/\b(in|after)\s+\d{1,3}\s*(minute|minutes|min|mins)\b/gi, '');
  title = title.replace(/\b(in|after|at)\s+(one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty)\s+minutes?\b/gi, '');
  title = title.replace(/\bبعد\s+\d{1,3}\s*دقائق?\b/gi, '');
  title = title.replace(/\bبعد\s+(خمس|عشر|عشرة|ربع ساعة|نص ساعة)\s*(?:دقائق?)?\b/gi, '');
  // If the user said "... at 5 minutes" (common speech mistake), strip it wherever it appears.
  title = title.replace(/\b(?:at)\s+\d{1,3}\s*(?:minute|minutes|min|mins)\b/gi, '');
  title = title.replace(/\b(?:at)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty)\s+minutes?\b/gi, '');

  // Remove time patterns
  const timePatterns = [
    /\b\d{1,2}\s*(:|\.)\s*\d{2}\s*(am|pm|a\.m\.|p\.m\.)?[,.]?\s*/gi,
    /\b\d{1,2}\s*(am|pm|a\.m\.|p\.m\.)[,.]?\s*/gi,
    /\b(at|@)\s*\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?[,.]?\s*/gi,
    /\btoday\s+\d{1,2}\s*(am|pm|a\.m\.|p\.m\.)?[,.]?\s*/gi,
    /\btomorrow\s+\d{1,2}\s*(am|pm|a\.m\.|p\.m\.)?[,.]?\s*/gi,
  ];
  for (const pattern of timePatterns) {
    title = title.replace(pattern, '');
  }

  // Remove common date phrases from the title
  const datePatterns = [
    /\b(today|tomorrow|day after tomorrow)[,.]?\s*/gi,
    /\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)[,.]?\s*/gi,
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}[,.]?\s*/gi,
    /\b\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)[,.]?\s*/gi,
    /\b\d{4}-\d{1,2}-\d{1,2}[,.]?\s*/g,
    /\b(اليوم|غدا|غداً|بكرة|بكره|بعد غد|بعد بكرة|بعد بكره)[,.]?\s*/g,
    /\b(الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت)[,.]?\s*/g,
  ];
  for (const pattern of datePatterns) {
    title = title.replace(pattern, '');
  }

  // Remove priority keywords from title
  title = title.replace(/\b(urgent|asap|emergency|critical|important|high priority)\b/gi, '');
  title = title.replace(/\b(عاجل|فوري|طارئ|مهم|أولوية عالية)\b/g, '');

  // Remove filler words
  title = title.replace(/\b(on|at|for|في|يوم|will|add|the|a|an)\b/gi, '');
  
  // Remove dangling leading prepositions/connectors left after stripping
  title = title.replace(/^\s*(to|for|about|that|which|and|or|من|عن|أن|إن)\s+/i, '');
  
  // Clean up extra spaces and punctuation
  title = title.replace(/^[,.:;\s]+/, '').replace(/[,.:;\s]+$/, '').replace(/\s+/g, ' ').trim();

  // If title is empty after cleanup, use original
  if (!title || title.length < 2) {
    title = transcript.trim();
  }

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);
  return title;
}

// ─── Smart task extraction: title + subtasks from natural language ────────────

function extractTaskDetails(transcript: string): { title: string; subtasks: string[] } {
  const lower = transcript.toLowerCase();

  // Step 1: Strip command prefixes and date/time phrases to get the "body"
  let body = transcript;
  // Remove "create a task for tomorrow at 9am" type prefixes
  body = body.replace(/^(create|add|make|new)\s+(a\s+)?(task|todo)\s*/i, '');
  // Remove date/time phrases
  body = body.replace(/\b(for\s+)?(today|tomorrow|day after tomorrow)\b/gi, '');
  body = body.replace(/\b(at|@)\s*\d{1,2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?|am|pm)?\b/gi, '');
  body = body.replace(/\b\d{1,2}\s*(a\.?m\.?|p\.?m\.?|am|pm)\b/gi, '');
  body = body.replace(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, '');
  body = body.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/gi, '');
  body = body.replace(/\b\d{4}-\d{1,2}-\d{1,2}\b/g, '');
  // Arabic date/time
  body = body.replace(/\b(أنشئ|أضف|اعمل)\s+(مهمة)?\s*/g, '');
  body = body.replace(/\b(اليوم|غدا|غداً|بكرة|بكره|بعد غد)\b/g, '');
  body = body.replace(/\b(الساعة)\s*\d{1,2}/g, '');
  // Priority words
  body = body.replace(/\b(urgent|asap|emergency|critical|important|high priority)\b/gi, '');
  body = body.replace(/\b(عاجل|فوري|طارئ|مهم)\b/g, '');
  body = body.trim();

  // Step 2: Detect subtask items using "buy/get/need X, Y, Z and W" patterns
  const subtasks: string[] = [];

  // English patterns: "buy eggs, rice, milk and water" / "need to buy eggs, rice, milk and water"
  const buyPatterns = [
    /\b(?:buy|get|pick up|purchase|grab|need to buy|need to get|i need to buy)\s+(.+)/i,
    /\b(?:اشتري|اشتر|شراء|أحتاج|محتاج)\s+(.+)/i,
  ];

  let listPart = '';
  for (const pattern of buyPatterns) {
    const match = body.match(pattern);
    if (match) {
      listPart = match[1].trim();
      // Remove the list part from body so it doesn't pollute the title
      body = body.replace(match[0], '').trim();
      break;
    }
  }

  // If no "buy X" pattern, try generic list after "and I need" / "I also need" / colon
  if (!listPart) {
    const genericListPatterns = [
      /\b(?:and\s+)?(?:i\s+)?(?:need|want)\s+(?:to\s+)?(?:buy|get)?\s*:?\s*(.+)/i,
      /\b(?:و?أحتاج|ومحتاج)\s+(.+)/i,
    ];
    for (const pattern of genericListPatterns) {
      const match = body.match(pattern);
      if (match) {
        listPart = match[1].trim();
        body = body.replace(match[0], '').trim();
        break;
      }
    }
  }

  // Parse the list part into individual items
  if (listPart) {
    // Remove trailing punctuation
    listPart = listPart.replace(/[.!?]+$/, '').trim();
    // Split by comma, "and", "و", or "&"
    const items = listPart
      .split(/\s*(?:,\s*(?:and\s+)?|,?\s+and\s+|,?\s+و\s*|&\s*)\s*/i)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length < 100);
    subtasks.push(...items);
  }

  // Step 3: Extract a clean title from the remaining body
  // Remove connectors left over
  body = body.replace(/\b(and\s+)?i\s+need\s+to\b/gi, '');
  body = body.replace(/\b(and|و)\s*$/gi, '');
  body = body.replace(/\bi\s+need\s+to\s+(go\s+)?/gi, '');
  body = body.replace(/\b(i\s+want\s+to\s+(go\s+)?)/gi, '');
  // Clean up
  body = body.replace(/^[,.:;\s]+/, '').replace(/[,.:;\s]+$/, '').replace(/\s+/g, ' ').trim();

  // Extract activity: look for "shopping at X", "go to X", "visit X" etc.
  let title = body;
  const activityMatch = body.match(/\b(shopping|go\s+shopping|visit|go\s+to|meeting|workout|gym|work|study|clean|cook)\s*(at|in|to)?\s*(the\s+)?(.+)/i);
  if (activityMatch) {
    const activity = activityMatch[1].trim();
    const location = activityMatch[4]?.trim() || '';
    title = location ? `${activity} at ${location}` : activity;
  }

  // Arabic activity patterns
  const arActivityMatch = body.match(/\b(تسوق|زيارة|اذهب|روح)\s*(في|إلى|عند)?\s*(.+)/i);
  if (arActivityMatch && !activityMatch) {
    const activity = arActivityMatch[1].trim();
    const location = arActivityMatch[3]?.trim() || '';
    title = location ? `${activity} ${arActivityMatch[2] || 'في'} ${location}` : activity;
  }

  // If title is still too long or empty, take first meaningful chunk
  if (title.length > 60) {
    title = title.substring(0, 60).replace(/\s+\S*$/, '');
  }
  if (!title || title.length < 2) {
    title = 'New Task';
  }

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Capitalize each subtask
  const cleanSubtasks = subtasks.map(s => s.charAt(0).toUpperCase() + s.slice(1));

  return { title, subtasks: cleanSubtasks };
}

// ─── Fuzzy title matching for action intents ─────────────────────────────────

function fuzzyMatch(needle: string, haystack: string): number {
  const a = needle.toLowerCase().trim();
  const b = haystack.toLowerCase().trim();
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.8;
  // Simple word overlap score
  const aWords = a.split(/\s+/);
  const bWords = b.split(/\s+/);
  const overlap = aWords.filter(w => bWords.some(bw => bw.includes(w) || w.includes(bw))).length;
  return overlap / Math.max(aWords.length, bWords.length);
}

function extractTargetName(transcript: string, actionKeywords: string[]): string {
  let cleaned = transcript.trim();
  // Strip action keywords from the transcript to get the target item name
  for (const kw of actionKeywords) {
    cleaned = cleaned.replace(new RegExp(kw, 'gi'), '');
  }
  // Strip date/time phrases
  cleaned = cleaned.replace(/\b(today|tomorrow|day after tomorrow)\b/gi, '');
  cleaned = cleaned.replace(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, '');
  cleaned = cleaned.replace(/\b(at|@)\s*\d{1,2}(:\d{2})?\s*(am|pm|a\.?m\.?|p\.?m\.?)?\b/gi, '');
  cleaned = cleaned.replace(/\b\d{1,2}\s*(am|pm|a\.?m\.?|p\.?m\.?)\b/gi, '');
  cleaned = cleaned.replace(/\b(in|after)\s+\d{1,3}\s*(minute|minutes|min|mins)\b/gi, '');
  cleaned = cleaned.replace(/\b(in|after)\s+(one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty)\s+minutes?\b/gi, '');
  cleaned = cleaned.replace(/\bبعد\s+\d{1,3}\s*دقائق?\b/gi, '');
  cleaned = cleaned.replace(/\b(اليوم|غدا|غداً|بكرة|بكره|بعد غد)\b/g, '');
  // Strip filler
  cleaned = cleaned.replace(/\b(the|my|a|an|to|for|about)\b/gi, '');
  cleaned = cleaned.replace(/^[,.:;\s'"]+/, '').replace(/[,.:;\s'"]+$/, '').replace(/\s+/g, ' ').trim();
  return cleaned;
}

function extractSnoozeMinutes(transcript: string): number {
  const lower = transcript.toLowerCase();
  // "snooze 10 minutes" / "snooze for 5 min"
  const numMatch = lower.match(/\b(\d{1,3})\s*(minute|minutes|min|mins)\b/);
  if (numMatch) return Math.max(1, Math.min(24 * 60, parseInt(numMatch[1], 10)));
  // "snooze for five minutes"
  const wordMap: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30 };
  const wordMatch = lower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty)\s*(minute|minutes|min|mins)\b/);
  if (wordMatch && wordMap[wordMatch[1]]) return wordMap[wordMatch[1]];
  // Default snooze: 10 minutes
  return 10;
}

// ─── Main extraction: detects mode (calendar / task / reminder) ──────────────

const ACTION_INTENTS: ActionIntent[] = ['complete_task', 'snooze_reminder', 'reschedule_task', 'reschedule_reminder'];

function isActionIntent(intent: string | null): intent is ActionIntent {
  return intent !== null && ACTION_INTENTS.includes(intent as ActionIntent);
}

function extractEntryFromTranscript(transcript: string): ExtractedEntry {
  // Detect task/reminder intent using the schema mapper
  const trIntent = detectTRIntent(transcript);

  // ── Action intents (operate on existing items) ──
  if (isActionIntent(trIntent)) {
    const actionKeywords: Record<ActionIntent, string[]> = {
      complete_task: ['complete task', 'mark done', 'finish task', 'task done', 'mark complete', 'أكمل المهمة', 'علّم مكتملة', 'أنهِ المهمة', 'المهمة تمت'],
      snooze_reminder: ['snooze reminder', 'snooze my reminder', 'delay reminder', 'postpone reminder', 'snooze', 'أجّل التذكير', 'أخّر التذكير', 'سنوز', 'تأجيل التذكير'],
      reschedule_task: ['reschedule task', 'move task', 'change task date', 'postpone task', 'delay task', 'أعد جدولة المهمة', 'انقل المهمة', 'غيّر موعد المهمة', 'أجّل المهمة'],
      reschedule_reminder: ['reschedule reminder', 'move reminder', 'change reminder', 'change reminder time', 'move my reminder', 'أعد جدولة التذكير', 'انقل التذكير', 'غيّر موعد التذكير'],
    };

    const targetName = extractTargetName(transcript, actionKeywords[trIntent]);
    const mode: DetectedMode = (trIntent === 'complete_task' || trIntent === 'reschedule_task') ? 'task' : 'reminder';

    // For reschedule intents, extract the new date/time
    const { date } = parseDateFromText(transcript);
    const { time } = extractTimeFromText(transcript);
    const effectiveDate = date || format(new Date(), 'yyyy-MM-dd');

    const snoozeMinutes = trIntent === 'snooze_reminder' ? extractSnoozeMinutes(transcript) : undefined;

    return {
      title: targetName || '(searching...)',
      date: effectiveDate,
      time: time || undefined,
      mode,
      actionIntent: trIntent,
      snoozeMinutes,
      needsDateConfirm: (trIntent === 'reschedule_task' || trIntent === 'reschedule_reminder') && !date,
      needsTimeConfirm: trIntent === 'reschedule_reminder' && !time,
      clarificationQuestion:
        (trIntent === 'reschedule_task' || trIntent === 'reschedule_reminder') && !date
          ? 'When should this be rescheduled to?'
          : undefined,
    };
  }

  // ── Guard: detect questions / non-actionable speech ──
  // If no intent was matched, check if this is a question or general query
  // that should NOT be treated as a calendar entry.
  if (!trIntent) {
    const lower = transcript.toLowerCase().trim();
    const isQuestion =
      /^(do i|can i|what|when|where|how|why|who|which|is there|are there|have i|did i|will i|could|should|would)\b/i.test(lower) ||
      /\?$/.test(lower.trim()) ||
      /^(هل|ما|ماذا|متى|أين|كيف|لماذا|من|أي|عندي|هل عندي|كم)\b/.test(lower);

    // Also check: does it contain ANY calendar/task/reminder creation keywords?
    const hasCreateKeywords =
      /\b(appointment|meeting|event|call|doctor|dentist|lunch|dinner|breakfast|gym|class|flight|trip|party|birthday|wedding|interview|deadline)\b/i.test(lower) ||
      /\b(موعد|اجتماع|حدث|مكالمة|طبيب|غداء|عشاء|فطور|رحلة|حفلة|عيد ميلاد|مقابلة)\b/.test(lower);

    if (isQuestion && !hasCreateKeywords) {
      return {
        title: transcript.trim(),
        date: format(new Date(), 'yyyy-MM-dd'),
        mode: 'unrecognized',
      };
    }
  }

  // ── Create intents (original flow) ──
  let mode: DetectedMode = 'calendar';
  if (trIntent === 'create_task' || trIntent === 'add_subtask' || trIntent === 'share_task') {
    mode = 'task';
  } else if (trIntent === 'schedule_reminder') {
    mode = 'reminder';
  }

  const { date, isConfident: isDateConfident } = parseDateFromText(transcript);
  const { time, isConfident: isTimeConfident } = extractTimeFromText(transcript);

  // If we detected a reminder and a relative-time phrase was used, compute the exact scheduled date/time.
  // (This also handles crossing midnight.)
  const lower = transcript.toLowerCase();
  const relMinutes = extractRelativeMinutes(lower);
  const relFuture = (mode === 'reminder' && relMinutes)
    ? new Date(Date.now() + relMinutes * 60 * 1000)
    : null;
  const effectiveDate = relFuture
    ? format(relFuture, 'yyyy-MM-dd')
    : (date || format(new Date(), 'yyyy-MM-dd'));
  const effectiveDateConfident = relFuture ? true : isDateConfident;

  // For tasks: use smart extraction that pulls out title + subtasks
  // For calendar/reminder: use the existing clause-based extraction
  let title: string;
  let subtasks: string[] | undefined;

  if (mode === 'task') {
    const taskDetails = extractTaskDetails(transcript);
    title = taskDetails.title;
    subtasks = taskDetails.subtasks.length > 0 ? taskDetails.subtasks : undefined;
  } else {
    const primaryClause = pickPrimaryClause(transcript);
    title = cleanTitle(primaryClause, transcript);
  }

  const missingDate = !effectiveDate || !effectiveDateConfident;
  const missingTime = !time || !isTimeConfident;

  let clarificationQuestion: string | undefined = undefined;

  if (mode === 'reminder') {
    if (missingDate && missingTime) {
      clarificationQuestion = 'Please confirm the date and time for this reminder.';
    } else if (missingDate) {
      clarificationQuestion = 'When should I remind you? Please confirm the date.';
    } else if (missingTime) {
      clarificationQuestion = 'What time should I remind you?';
    }
  } else if (mode === 'task') {
    if (missingDate) {
      clarificationQuestion = 'When is this task due? Please confirm the date.';
    }
  } else {
    if (missingDate && missingTime) {
      clarificationQuestion = 'Please confirm the date and time.';
    } else if (missingDate) {
      clarificationQuestion = 'Please confirm the date.';
    } else if (missingTime) {
      clarificationQuestion = 'Please confirm the time.';
    }
  }

  const priority = (mode === 'task') ? extractPriorityFromText(transcript) : undefined;

  return {
    title,
    date: effectiveDate,
    time: time || undefined,
    clarificationQuestion,
    needsDateConfirm: missingDate,
    needsTimeConfirm: (mode === 'reminder') ? missingTime : (mode === 'calendar' ? missingTime : false),
    mode,
    priority,
    subtasks,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ onSaveEntry }) => {
  const { language, theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  const t = (en: string, ar: string) => language === 'ar' ? ar : en;

  // UI state
  const [isOpen, setIsOpen] = useState(false);
  const [voiceState, _setVoiceState] = useState<VoiceState>('idle');
  const setVoiceState = useCallback((s: VoiceState) => { voiceStateRef.current = s; _setVoiceState(s); }, []);
  const [transcript, setTranscript] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  const [extractedEntry, setExtractedEntry] = useState<ExtractedEntry | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [typeMode, setTypeMode] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // WebRTC refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intentionalSpeechRef = useRef(false);
  const allowRemoteAudioRef = useRef(false);
  const greetingDoneRef = useRef(false);
  const tzRef = useRef<string>('');
  const localNowIsoRef = useRef<string>('');
  const micBtnRef = useRef<HTMLButtonElement | null>(null);
  const holdPointerIdRef = useRef<number | null>(null);
  const holdCanceledRef = useRef(false);
  const holdActiveRef = useRef(false);
  const didCommitRef = useRef(false);
  const isSavingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const initializingRef = useRef(false);
  const displayNameRef = useRef('');
  const dcReadyRef = useRef(false);
  const voiceStateRef = useRef<VoiceState>('idle');
  const audioContextRef = useRef<AudioContext | null>(null);
  const waitingForGreetingEndRef = useRef(false);

  const setRemoteAudioMuted = useCallback((muted: boolean) => {
    allowRemoteAudioRef.current = !muted;
    if (audioRef.current) {
      audioRef.current.muted = muted;
      audioRef.current.volume = muted ? 0 : 1;
    }
  }, []);

  // ─── Unlock Audio (iOS requires user gesture) ────────────────────────────

  const unlockAudio = useCallback(async () => {
    if (audioUnlocked) return;
    
    try {
      // Create/resume AudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    } catch (e) {
      console.warn('[VoiceAssistant] Failed to resume AudioContext:', e);
    }

    try {
      if (audioRef.current) {
        audioRef.current.muted = false;
        audioRef.current.volume = 1;
        // Play a silent sound to unlock audio
        await audioRef.current.play().catch(() => {});
      }
      setAudioUnlocked(true);
      console.log('[VoiceAssistant] Audio unlocked');
    } catch (e) {
      console.warn('[VoiceAssistant] Audio play blocked:', e);
    }
  }, [audioUnlocked]);

  // ─── Cleanup ────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (dcRef.current) { try { dcRef.current.close(); } catch {} dcRef.current = null; }
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
    intentionalSpeechRef.current = false;
    greetingDoneRef.current = false;
    initializingRef.current = false;
    dcReadyRef.current = false;
    setVoiceState('idle');
    setTranscript('');
    setAiTranscript('');
    setExtractedEntry(null);
    setErrorMsg('');
    setTypeMode(false);
    setTypedText('');
  }, []);

  useEffect(() => { return () => cleanup(); }, [cleanup]);

  // ─── Handle Realtime events ─────────────────────────────────────────────

  const handleRealtimeEvent = useCallback((msg: any) => {
    // Log ALL incoming messages for debugging
    if (msg.type !== 'input_audio_buffer.speech_started' && msg.type !== 'input_audio_buffer.speech_stopped') {
      console.log('[VoiceAssistant] Realtime event:', msg.type, msg);
    }
    
    switch (msg.type) {
      case 'conversation.item.input_audio_transcription.completed': {
        const text = msg.transcript?.trim() || '';
        // Cancel any AI auto-response
        try {
          if (dcRef.current?.readyState === 'open') {
            dcRef.current.send(JSON.stringify({ type: 'response.cancel' }));
          }
        } catch {}

        // Ignore very short transcriptions (likely garbage/noise)
        if (text.length < 5) {
          console.log('[VoiceAssistant] Ignoring short transcription:', text);
          return;
        }

        // Don't overwrite a longer transcript with a shorter one
        if (extractedEntry && text.length < 10) {
          console.log('[VoiceAssistant] Ignoring short follow-up transcription:', text);
          return;
        }

        console.log('[VoiceAssistant] User said:', text);
        setTranscript(text);
        setVoiceState('thinking');

        // Extract entry from transcript
        const entry = extractEntryFromTranscript(text);

        // ── Handle unrecognized speech (questions, general queries) ──
        if (entry.mode === 'unrecognized') {
          setTranscript(text);
          setExtractedEntry(null);
          const helpMsg = language === 'ar'
            ? 'عذراً، أقدر أساعدك بإنشاء مهام وتذكيرات ومواعيد، أو إكمال مهمة وتأجيل تذكير. جرّب قول: أنشئ مهمة أو ذكرني.'
            : "Sorry, I can help you create tasks, reminders, and calendar entries, or complete a task and snooze a reminder. Try saying: create a task, or remind me.";
          if (dcRef.current?.readyState === 'open') {
            intentionalSpeechRef.current = true;
            setAiTranscript('');
            setRemoteAudioMuted(false);
            try { dcRef.current.send(JSON.stringify({ type: 'response.cancel' })); } catch {}
            dcRef.current.send(JSON.stringify({
              type: 'session.update',
              session: {
                modalities: ['text', 'audio'],
                instructions: `Say EXACTLY this and nothing else: "${helpMsg}"`
              }
            }));
            dcRef.current.send(JSON.stringify({ type: 'response.create' }));
          }
          // Show briefly then go back to idle after the AI finishes speaking
          setTimeout(() => {
            if (voiceStateRef.current === 'thinking') {
              setVoiceState('idle');
            }
          }, 5000);
          break;
        }

        // ── Resolve action intents: fetch items and fuzzy-match ──
        const resolveAndConfirm = async (resolvedEntry: ExtractedEntry) => {
          if (resolvedEntry.actionIntent) {
            try {
              const isTaskAction = resolvedEntry.actionIntent === 'complete_task' || resolvedEntry.actionIntent === 'reschedule_task';
              const items = isTaskAction
                ? await TRService.getTasks()
                : await TRService.getReminders();

              // For complete_task, only match incomplete tasks
              const candidates = isTaskAction
                ? (items as any[]).filter((t: any) => !t.completed)
                : items;

              if (candidates.length > 0 && resolvedEntry.title && resolvedEntry.title !== '(searching...)') {
                // Fuzzy match
                let bestScore = 0;
                let bestItem: any = null;
                for (const item of candidates) {
                  const score = fuzzyMatch(resolvedEntry.title, item.title);
                  if (score > bestScore) {
                    bestScore = score;
                    bestItem = item;
                  }
                }
                if (bestItem && bestScore >= 0.3) {
                  resolvedEntry.targetItemId = bestItem.id;
                  resolvedEntry.targetItemTitle = bestItem.title;
                  resolvedEntry.title = bestItem.title;
                } else {
                  // No good match — pick the most recent item as fallback
                  const fallback = candidates[0];
                  resolvedEntry.targetItemId = fallback.id;
                  resolvedEntry.targetItemTitle = fallback.title;
                  resolvedEntry.title = fallback.title;
                }
              } else if (candidates.length > 0) {
                // No target name spoken — use most recent
                const fallback = candidates[0];
                resolvedEntry.targetItemId = fallback.id;
                resolvedEntry.targetItemTitle = fallback.title;
                resolvedEntry.title = fallback.title;
              } else {
                resolvedEntry.clarificationQuestion = isTaskAction
                  ? 'No open tasks found.'
                  : 'No reminders found.';
              }
            } catch (err) {
              console.error('[VoiceAssistant] Failed to fetch items for action:', err);
              resolvedEntry.clarificationQuestion = 'Could not load your items. Please try again.';
            }
          }

          setExtractedEntry(resolvedEntry);

          // Build confirmation message
          let confirmMsg: string;
          if (resolvedEntry.actionIntent) {
            const itemName = resolvedEntry.targetItemTitle || resolvedEntry.title;
            const actionLabels: Record<ActionIntent, { en: string; ar: string }> = {
              complete_task: { en: `Mark "${itemName}" as done?`, ar: `علّم "${itemName}" مكتملة؟` },
              snooze_reminder: { en: `Snooze "${itemName}" for ${resolvedEntry.snoozeMinutes || 10} minutes?`, ar: `أجّل "${itemName}" ${resolvedEntry.snoozeMinutes || 10} دقائق؟` },
              reschedule_task: { en: `Reschedule "${itemName}"?`, ar: `أعد جدولة "${itemName}"؟` },
              reschedule_reminder: { en: `Reschedule "${itemName}"?`, ar: `أعد جدولة "${itemName}"؟` },
            };
            const label = actionLabels[resolvedEntry.actionIntent];
            confirmMsg = language === 'ar' ? label.ar : label.en;
          } else {
            const needsClarification = Boolean(resolvedEntry.clarificationQuestion);
            const modeLabel = resolvedEntry.mode === 'task' ? (language === 'ar' ? 'مهمة' : 'task')
              : resolvedEntry.mode === 'reminder' ? (language === 'ar' ? 'تذكير' : 'reminder')
              : (language === 'ar' ? 'إدخال تقويم' : 'calendar entry');
            const isTR = resolvedEntry.mode === 'task' || resolvedEntry.mode === 'reminder';
            confirmMsg = needsClarification
              ? (language === 'ar'
                  ? `تمام — ${modeLabel} بس محتاج أتأكد. افتح التأكيد وعدّل التاريخ/الوقت.`
                  : `Got it — creating a ${modeLabel}. I just need to confirm some details.`)
              : isTR
                ? (language === 'ar'
                    ? 'تمام. راجع التفاصيل واضغط تأكيد.'
                    : 'Okay. Please review and confirm.')
                : (language === 'ar'
                    ? `فهمت ${modeLabel}: ${resolvedEntry.title}`
                    : `Got it, ${modeLabel}: ${resolvedEntry.title}`);
          }

          // Voice confirmation
          if (dcRef.current?.readyState === 'open') {
            intentionalSpeechRef.current = true;
            setAiTranscript('');
            setRemoteAudioMuted(false);
            try { dcRef.current.send(JSON.stringify({ type: 'response.cancel' })); } catch {}
            dcRef.current.send(JSON.stringify({
              type: 'session.update',
              session: {
                modalities: ['text', 'audio'],
                instructions: `Say EXACTLY this and nothing else: "${confirmMsg}"`
              }
            }));
            dcRef.current.send(JSON.stringify({ type: 'response.create' }));
          }

          setVoiceState('confirming');
        };

        resolveAndConfirm(entry);
        break;
      }

      case 'response.audio_transcript.delta': {
        if (intentionalSpeechRef.current && msg.delta) {
          setAiTranscript(prev => prev + msg.delta);
        }
        break;
      }

      case 'response.audio.done': {
        console.log('[VoiceAssistant] Server audio generation done');
        break;
      }

      case 'output_audio_buffer.stopped': {
        // This fires when the AI audio actually finishes playing on the client
        console.log('[VoiceAssistant] Audio playback stopped (client)');

        // Always re-mute remote audio and clear intentional speech flag
        intentionalSpeechRef.current = false;
        setRemoteAudioMuted(true);

        if (waitingForGreetingEndRef.current) {
          waitingForGreetingEndRef.current = false;
          greetingDoneRef.current = true;
          setTimeout(() => {
            setVoiceState('idle');
            setAiTranscript('');
          }, 300);
        }
        break;
      }

      case 'response.done': {
        const wasIntentionalSpeech = intentionalSpeechRef.current;
        
        // For greeting: mark waiting and set a fallback timer
        if (!greetingDoneRef.current && wasIntentionalSpeech) {
          waitingForGreetingEndRef.current = true;
          // Fallback: if output_audio_buffer.stopped never fires, transition after 4s
          setTimeout(() => {
            if (waitingForGreetingEndRef.current) {
              console.log('[VoiceAssistant] Fallback: greeting audio timeout, transitioning to idle');
              waitingForGreetingEndRef.current = false;
              greetingDoneRef.current = true;
              intentionalSpeechRef.current = false;
              setRemoteAudioMuted(true);
              setVoiceState('idle');
              setAiTranscript('');
            }
          }, 4000);
        }

        if (wasIntentionalSpeech) {
          // DO NOT mute here — the audio is still playing on the client.
          // output_audio_buffer.stopped will mute when playback actually ends.
          // Just add a safety fallback in case that event never fires.
          console.log('[VoiceAssistant] response.done for intentional speech — letting audio finish playing');
          setTimeout(() => {
            // If output_audio_buffer.stopped hasn't fired after 5s, force mute
            if (allowRemoteAudioRef.current) {
              console.log('[VoiceAssistant] Fallback: force-muting after intentional speech timeout');
              intentionalSpeechRef.current = false;
              setRemoteAudioMuted(true);
            }
          }, 5000);
        } else {
          // Non-intentional response (chatbot auto-reply) — kill it immediately
          console.log('[VoiceAssistant] response.done for NON-intentional speech — muting immediately');
          intentionalSpeechRef.current = false;
          setRemoteAudioMuted(true);
        }

        // After ANY response completes, silence the AI model to prevent future chatbot behavior.
        try {
          if (dcRef.current?.readyState === 'open') {
            dcRef.current.send(JSON.stringify({ type: 'response.cancel' }));
            dcRef.current.send(JSON.stringify({
              type: 'session.update',
              session: {
                instructions: 'Do NOT speak. Do NOT respond. Only transcribe audio input silently. Say absolutely nothing.',
                modalities: ['text'],
              }
            }));
          }
        } catch {}
        break;
      }

      case 'error':
        if (!msg.error?.message?.includes('buffer too small') && !msg.error?.message?.includes('response.cancel')) {
          console.error('[VoiceAssistant] Realtime error:', JSON.stringify(msg.error, null, 2));
        }
        break;

      default:
        break;
    }
  }, []);

  // ─── Initialize connection ──────────────────────────────────────────────

  const initializeConnection = useCallback(async () => {
    if (initializingRef.current) return;
    initializingRef.current = true;
    setVoiceState('connecting');
    setErrorMsg('');

    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Mute mic initially - only enable when user holds the button
      stream.getAudioTracks().forEach(track => track.enabled = false);
      console.log('[VoiceAssistant] Mic muted initially');

      // Capture device-local context for better time/date understanding
      try {
        tzRef.current = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      } catch { tzRef.current = ''; }
      localNowIsoRef.current = new Date().toISOString();

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (audioRef.current && event.streams[0]) {
          audioRef.current.srcObject = event.streams[0];
          // Hard default: remote audio is muted unless we explicitly allow it.
          audioRef.current.muted = true;
          audioRef.current.volume = 0;
          audioRef.current.play().catch(() => {});
        }
      };

      const dc = pc.createDataChannel('oai-events', { ordered: true });
      dcRef.current = dc;

      dc.onopen = () => {
        console.log('[VoiceAssistant] Data channel open');
        dcReadyRef.current = true;

        const tzLine = tzRef.current ? `User timezone: ${tzRef.current}.` : '';
        const nowLine = localNowIsoRef.current ? `User local now (ISO): ${localNowIsoRef.current}.` : '';

        const instructions = t(
          `You are a voice-controlled assistant for the Wakti app. You are NOT a chatbot. You do NOT have conversations. You NEVER offer help or ask follow-up questions on your own. You ONLY speak when given an explicit instruction that starts with "Say EXACTLY this". If you receive any audio input, do NOT respond to it — just transcribe it silently. NEVER generate any response unless explicitly instructed. ${tzLine} ${nowLine}`,
          `أنت مساعد صوتي لتطبيق وقتي. أنت لست روبوت محادثة. لا تتحدث أبدًا من تلقاء نفسك. لا تعرض المساعدة. لا تسأل أسئلة. تحدث فقط عندما يُطلب منك بالضبط "قل بالضبط هذا". إذا استلمت أي صوت، لا ترد عليه — فقط انسخه بصمت. ${tzLine} ${nowLine}`
        );

        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions,
            voice: 'shimmer',
            input_audio_transcription: language === 'ar'
              ? { model: 'whisper-1', language: 'ar' }
              : { model: 'whisper-1' },
            turn_detection: null,
          }
        }));

        // Mute mic initially — user must hold to speak
        if (streamRef.current) {
          streamRef.current.getAudioTracks().forEach(t => t.enabled = false);
        }

        // Greeting will be sent after we get display_name from edge function
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleRealtimeEvent(msg);
        } catch {}
      };

      dc.onerror = () => {
        setVoiceState('error');
        setErrorMsg(t('Connection error', 'خطأ في الاتصال'));
      };

      dc.onclose = () => {
        if (voiceState !== 'done') {
          setVoiceState('idle');
        }
      };

      await pc.setLocalDescription();
      const offer = pc.localDescription;
      if (!offer) throw new Error('Failed to create SDP offer');

      console.log('[VoiceAssistant] Calling edge function...');
      const response = await supabase.functions.invoke('voice-assistant-session', {
        body: {
          sdp_offer: offer.sdp,
          timezone: tzRef.current || undefined,
          local_now: localNowIsoRef.current || undefined,
        },
      });
      console.log('[VoiceAssistant] Edge function response:', response.error ? 'ERROR' : 'OK', response.data ? 'has data' : 'no data');

      if (response.error || !response.data?.sdp_answer) {
        console.error('[VoiceAssistant] Edge function failed:', response.error);
        throw new Error(response.error?.message || 'Failed to get SDP answer');
      }

      // Guard: never use email as display name
      let fetchedName = response.data.display_name || '';
      console.log('[VoiceAssistant] Edge function returned display_name:', fetchedName);
      if (fetchedName.includes('@')) {
        console.log('[VoiceAssistant] Email detected in display_name, discarding');
        fetchedName = '';
      }
      displayNameRef.current = fetchedName;
      if (fetchedName) setDisplayName(fetchedName);

      console.log('[VoiceAssistant] Setting remote description...');
      await pc.setRemoteDescription({ type: 'answer', sdp: response.data.sdp_answer });
      console.log('[VoiceAssistant] Remote description set, waiting for data channel...');

      // Wait for data channel to open, then go straight to idle (no voice greeting for speed)
      let dcRetries = 0;
      const waitForDataChannel = () => {
        dcRetries++;
        if (dcRetries <= 30) {
          console.log('[VoiceAssistant] Waiting for data channel, attempt', dcRetries, 'state:', dcRef.current?.readyState);
        }
        if (!dcRef.current || dcRef.current.readyState !== 'open') {
          if (dcRetries > 50) { // 10 seconds max
            console.error('[VoiceAssistant] Data channel never opened after 10s');
            setVoiceState('error');
            setErrorMsg('Connection timeout');
            initializingRef.current = false;
            return;
          }
          setTimeout(waitForDataChannel, 200);
          return;
        }
        
        // Data channel is open - speak greeting with voice
        console.log('[VoiceAssistant] Data channel open, speaking greeting');
        initializingRef.current = false;
        
        const name = displayNameRef.current;
        const greeting = name
          ? t(`Hey ${name}! What can I do for you?`, `أهلاً ${name}! كيف أقدر أساعدك؟`)
          : t(`Hey! What can I do for you?`, `أهلاً! كيف أقدر أساعدك؟`);
        
        setAiTranscript('');
        setVoiceState('greeting');
        intentionalSpeechRef.current = true;

        // Allow audio playback ONLY for our intentional greeting line
        setRemoteAudioMuted(false);
        
        // Send voice greeting via OpenAI Realtime
        dcRef.current!.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: t(
              `Say EXACTLY this and nothing else: "${greeting}"`,
              `قل بالضبط هذا ولا شيء آخر: "${greeting}"`
            )
          }
        }));
        dcRef.current!.send(JSON.stringify({ type: 'response.create' }));
      };
      waitForDataChannel();

    } catch (err: any) {
      console.error('[VoiceAssistant] Connection failed:', err);
      setVoiceState('error');
      setErrorMsg(t('Failed to connect. Please try again.', 'فشل الاتصال. حاول مرة أخرى.'));
      initializingRef.current = false;
    }
  }, [language, t, handleRealtimeEvent, voiceState]);

  // ─── Open / Close ───────────────────────────────────────────────────────

  const handleOpen = useCallback(() => {
    // Unlock audio (iOS requires user gesture) - don't await, just fire
    unlockAudio().catch(() => {});
    setIsOpen(true);
    initializeConnection();
  }, [initializeConnection, unlockAudio]);

  const handleClose = useCallback(() => {
    cleanup();
    setIsOpen(false);
  }, [cleanup]);

  // ─── Hold-to-talk: press = start, release = stop ──────────────────────

  const startListening = useCallback(() => {
    const s = voiceStateRef.current;
    console.log('[VoiceAssistant] startListening called, current state:', s);
    if (s !== 'idle' && s !== 'confirming') {
      console.log('[VoiceAssistant] startListening blocked, state is not idle/confirming');
      return;
    }

    holdCanceledRef.current = false;
    holdActiveRef.current = true;
    didCommitRef.current = false;

    if (streamRef.current) {
      const tracks = streamRef.current.getAudioTracks();
      tracks.forEach(t => t.enabled = true);
      console.log('[VoiceAssistant] Mic unmuted, tracks:', tracks.length, 'enabled:', tracks.map(t => t.enabled));
    } else {
      console.log('[VoiceAssistant] WARNING: No stream ref!');
    }
    setTranscript('');
    setExtractedEntry(null);
    setVoiceState('listening');
  }, [setRemoteAudioMuted, setVoiceState]);

  const cancelListening = useCallback(() => {
    holdCanceledRef.current = true;
    holdActiveRef.current = false;

    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => t.enabled = false);
    }

    setTranscript('');
    setExtractedEntry(null);
    setVoiceState('idle');
  }, [setVoiceState]);

  const stopListening = useCallback(() => {
    if (voiceStateRef.current !== 'listening') return;
    if (holdCanceledRef.current) return;
    if (didCommitRef.current) return;
    console.log('[VoiceAssistant] stopListening called');

    holdActiveRef.current = false;

    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => t.enabled = false);
      console.log('[VoiceAssistant] Mic muted');
    }

    // Immediately move to thinking for smoother UX and to prevent re-entry
    setVoiceState('thinking');

    // CRITICAL: Pre-silence the AI BEFORE committing the audio buffer.
    // Without this, OpenAI auto-generates a spoken response to the user's
    // audio (chatbot behavior). We only want transcription, not conversation.
    if (dcRef.current?.readyState === 'open') {
      // Hard gate: ensure remote audio playback is muted during user speech + transcription
      setRemoteAudioMuted(true);

      // Kill any in-flight response first
      try { dcRef.current.send(JSON.stringify({ type: 'response.cancel' })); } catch {}

      // Tell the AI to shut up — transcribe only
      dcRef.current.send(JSON.stringify({
        type: 'session.update',
        session: {
          instructions: 'Do NOT speak. Do NOT respond. Do NOT generate any audio output. Only transcribe the audio input silently. Say absolutely nothing. You are NOT a chatbot. You are NOT a conversational assistant. NEVER reply to user audio.',
          modalities: ['text'],
        }
      }));

      didCommitRef.current = true;
      console.log('[VoiceAssistant] Pre-silenced AI, committing audio buffer...');
      dcRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    }

    // If no transcription comes in 4 seconds, go back to idle
    setTimeout(() => {
      if (voiceStateRef.current === 'thinking') {
        console.log('[VoiceAssistant] No transcription received, going back to idle');
        setVoiceState('idle');
      }
    }, 4000);
  }, [setVoiceState]);

  const handleHoldStart = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (holdPointerIdRef.current !== null) return;
    holdPointerIdRef.current = e.pointerId;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    startListening();
  }, [startListening]);

  const handleHoldMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (holdPointerIdRef.current !== e.pointerId) return;
    if (!holdActiveRef.current) return;
    if (!micBtnRef.current) return;

    const rect = micBtnRef.current.getBoundingClientRect();
    const margin = 40; // generous margin so small finger movements don't cancel
    const outside = e.clientX < rect.left - margin || e.clientX > rect.right + margin || e.clientY < rect.top - margin || e.clientY > rect.bottom + margin;
    if (outside && !holdCanceledRef.current) {
      cancelListening();
    }
  }, [cancelListening]);

  const handleHoldEnd = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (holdPointerIdRef.current !== e.pointerId) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    holdPointerIdRef.current = null;
    if (holdCanceledRef.current) return;
    stopListening();
  }, [stopListening]);

  const handleHoldCancel = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (holdPointerIdRef.current !== e.pointerId) return;
    holdPointerIdRef.current = null;
    cancelListening();
  }, [cancelListening]);

  // ─── Document-level safety net for mobile pointer release ──────────────
  // If the DOM element swaps mid-hold (React re-render), the button's own
  // pointerup may never fire. This catches that case.
  useEffect(() => {
    const onDocPointerUp = (e: PointerEvent) => {
      if (holdPointerIdRef.current === null) return;
      if (e.pointerId !== holdPointerIdRef.current) return;
      console.log('[VoiceAssistant] Document-level pointerup safety net fired');
      holdPointerIdRef.current = null;
      if (holdCanceledRef.current) return;
      stopListening();
    };
    const onDocPointerCancel = (e: PointerEvent) => {
      if (holdPointerIdRef.current === null) return;
      if (e.pointerId !== holdPointerIdRef.current) return;
      console.log('[VoiceAssistant] Document-level pointercancel safety net fired');
      holdPointerIdRef.current = null;
      cancelListening();
    };
    document.addEventListener('pointerup', onDocPointerUp, true);
    document.addEventListener('pointercancel', onDocPointerCancel, true);
    return () => {
      document.removeEventListener('pointerup', onDocPointerUp, true);
      document.removeEventListener('pointercancel', onDocPointerCancel, true);
    };
  }, [stopListening, cancelListening]);

  // Legacy toggle for retry button in confirming state
  const retryListening = useCallback(() => {
    setTranscript('');
    setExtractedEntry(null);
    setVoiceState('idle');
  }, [setVoiceState]);

  // ─── Confirm & Save ─────────────────────────────────────────────────────

  const handleConfirm = useCallback(async () => {
    if (!extractedEntry) return;
    if (extractedEntry.clarificationQuestion) return;
    if (isSavingRef.current) return;

    const mode = extractedEntry.mode || 'calendar';
    const actionIntent = extractedEntry.actionIntent;
    console.log(`[VoiceAssistant] ${actionIntent ? 'Executing action' : 'Saving'} ${actionIntent || mode}:`, extractedEntry);

    try {
      isSavingRef.current = true;
      setIsSaving(true);

      // ── Action intents (operate on existing items) ──
      if (actionIntent && extractedEntry.targetItemId) {
        const itemId = extractedEntry.targetItemId;
        let successMsg = '';

        switch (actionIntent) {
          case 'complete_task':
            await TRService.updateTask(itemId, { completed: true, completed_at: new Date().toISOString() });
            successMsg = language === 'ar' ? 'تم! المهمة مكتملة.' : 'Done! Task completed.';
            console.log('[VoiceAssistant] Task completed:', itemId);
            break;

          case 'snooze_reminder':
            await TRService.snoozeReminder(itemId, extractedEntry.snoozeMinutes || 10);
            successMsg = language === 'ar'
              ? `تم تأجيل التذكير ${extractedEntry.snoozeMinutes || 10} دقائق.`
              : `Reminder snoozed for ${extractedEntry.snoozeMinutes || 10} minutes.`;
            console.log('[VoiceAssistant] Reminder snoozed:', itemId);
            break;

          case 'reschedule_task':
            await TRService.updateTask(itemId, {
              due_date: extractedEntry.date,
              ...(extractedEntry.time ? { due_time: extractedEntry.time } : {}),
            });
            successMsg = language === 'ar' ? 'تم إعادة جدولة المهمة.' : 'Task rescheduled.';
            console.log('[VoiceAssistant] Task rescheduled:', itemId);
            break;

          case 'reschedule_reminder':
            await TRService.updateReminder(itemId, {
              due_date: extractedEntry.date,
              ...(extractedEntry.time ? { due_time: extractedEntry.time } : {}),
            });
            successMsg = language === 'ar' ? 'تم إعادة جدولة التذكير.' : 'Reminder rescheduled.';
            console.log('[VoiceAssistant] Reminder rescheduled:', itemId);
            break;
        }

        // Speak success
        try {
          if (dcRef.current?.readyState === 'open' && successMsg) {
            intentionalSpeechRef.current = true;
            dcRef.current.send(JSON.stringify({
              type: 'session.update',
              session: { instructions: `Say EXACTLY this and nothing else: "${successMsg}"` },
            }));
            dcRef.current.send(JSON.stringify({ type: 'response.create' }));
          }
        } catch {}

        setVoiceState('done');
        setTimeout(() => { handleClose(); }, 1400);
        isSavingRef.current = false;
        setIsSaving(false);
        return;
      }

      // ── Create intents (original flow) ──
      if (mode === 'task') {
        const payload = mapTaskDraftToPayload({
          title: extractedEntry.title,
          description: extractedEntry.description,
          due_day: extractedEntry.date,
          due_time: extractedEntry.time,
          priority: extractedEntry.priority || 'normal',
        });
        const createdTask = await TRService.createTask(payload);
        console.log('[VoiceAssistant] Task created via TRService:', createdTask.id);

        // Create subtasks if any were extracted
        if (extractedEntry.subtasks && extractedEntry.subtasks.length > 0) {
          for (let i = 0; i < extractedEntry.subtasks.length; i++) {
            const subPayload = mapSubtaskDraftToPayload(
              { title: extractedEntry.subtasks[i] },
              createdTask.id,
              i,
            );
            await TRService.createSubtask(subPayload);
          }
          console.log(`[VoiceAssistant] Created ${extractedEntry.subtasks.length} subtasks`);
        }
        // Speak short success (cost-saving)
        try {
          if (dcRef.current?.readyState === 'open') {
            const msg = language === 'ar'
              ? 'تم إنشاء المهمة. تفضل شوفها.'
              : 'Task created. Please have a look.';
            intentionalSpeechRef.current = true;
            dcRef.current.send(JSON.stringify({
              type: 'session.update',
              session: { instructions: `Say EXACTLY this and nothing else: "${msg}"` },
            }));
            dcRef.current.send(JSON.stringify({ type: 'response.create' }));
          }
        } catch {}
      } else if (mode === 'reminder') {
        const payload = mapReminderDraftToPayload({
          title: extractedEntry.title,
          description: extractedEntry.description,
          due_day: extractedEntry.date,
          due_time: extractedEntry.time,
        });
        await TRService.createReminder(payload);
        console.log('[VoiceAssistant] Reminder created via TRService');

        // Speak short success (cost-saving)
        try {
          if (dcRef.current?.readyState === 'open') {
            const msg = language === 'ar'
              ? 'تم إنشاء التذكير. تفضل شوفه.'
              : 'Reminder created. Please have a look.';
            intentionalSpeechRef.current = true;
            dcRef.current.send(JSON.stringify({
              type: 'session.update',
              session: { instructions: `Say EXACTLY this and nothing else: "${msg}"` },
            }));
            dcRef.current.send(JSON.stringify({ type: 'response.create' }));
          }
        } catch {}
      } else {
        // Calendar entry — use existing onSaveEntry callback
        onSaveEntry({
          title: extractedEntry.title,
          date: extractedEntry.date,
          time: extractedEntry.time,
          description: extractedEntry.description,
        });
        console.log('[VoiceAssistant] Calendar entry saved');
      }

      setVoiceState('done');
      const closeDelay = (mode === 'task' || mode === 'reminder') ? 1400 : 800;
      setTimeout(() => { handleClose(); }, closeDelay);
    } catch (err: any) {
      console.error('[VoiceAssistant] Failed to save:', err);
      setErrorMsg(err?.message || 'Failed to save');
      setVoiceState('error');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [extractedEntry, onSaveEntry, handleClose]);

  // ─── Type mode submit ───────────────────────────────────────────────────

  const handleTypeSubmit = useCallback(() => {
    if (!typedText.trim()) return;
    const entry = extractEntryFromTranscript(typedText.trim());
    setExtractedEntry(entry);
    setTranscript(typedText.trim());
    setVoiceState('confirming');
    setTypeMode(false);
    setTypedText('');
  }, [typedText]);

  // ─── Format date for display ────────────────────────────────────────────

  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = dateParse(dateStr, 'yyyy-MM-dd', new Date());
      return format(d, 'EEEE, MMMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  // ─── State label ────────────────────────────────────────────────────────

  const stateLabel = () => {
    switch (voiceState) {
      case 'connecting': return t('Connecting...', 'جارٍ الاتصال...');
      case 'greeting': return t('Speaking...', 'يتحدث...');
      case 'listening': return t('Listening...', 'أستمع...');
      case 'thinking': return t('Processing...', 'جارٍ المعالجة...');
      case 'confirming': return t('Confirm', 'تأكيد');
      case 'done': return t('Saved!', 'تم الحفظ!');
      case 'error': return t('Error', 'خطأ');
      default: return '';
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Hidden audio element for AI speech */}
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        style={{ display: 'none' }}
        onEnded={() => {
          console.log('[VoiceAssistant] Audio element playback ended');
          if (waitingForGreetingEndRef.current) {
            waitingForGreetingEndRef.current = false;
            greetingDoneRef.current = true;
            intentionalSpeechRef.current = false;
            setTimeout(() => {
              setVoiceState('idle');
              setAiTranscript('');
            }, 300);
          }
        }}
      />

      {/* Inline mic button — meant to sit in the header */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          aria-label={t('Voice assistant', 'المساعد الصوتي')}
          className="rounded-full flex items-center justify-center h-9 w-9 transition-transform active:scale-90"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, hsl(210, 100%, 65%) 0%, hsl(280, 70%, 65%) 100%)'
              : 'linear-gradient(135deg, #060541 0%, hsl(260, 70%, 25%) 100%)',
            boxShadow: isDark
              ? '0 0 12px hsla(210, 100%, 65%, 0.4)'
              : '0 2px 8px hsla(243, 84%, 14%, 0.25)',
          }}
        >
          <Mic className="h-4 w-4 text-white" />
        </button>
      )}

      {/* Voice Modal — portaled to body so it renders above header */}
      {portalTarget
        ? createPortal(
            <AnimatePresence>
              {isOpen && (
                <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 z-50"
              style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
            />

            {/* Modal centering wrapper */}
            <div
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onContextMenu={(e) => e.preventDefault()}
              className="flex flex-col overflow-hidden select-none pointer-events-auto"
              style={{
                width: '92vw',
                maxWidth: '420px',
                height: '55vh',
                maxHeight: '500px',
                borderRadius: '1.5rem',
                background: isDark
                  ? 'linear-gradient(135deg, rgba(12,15,20,0.45) 0%, rgba(30,33,45,0.50) 100%)'
                  : 'linear-gradient(135deg, rgba(252,254,253,0.45) 0%, rgba(240,242,248,0.50) 100%)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                WebkitTouchCallout: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'manipulation',
                border: isDark
                  ? '1px solid rgba(255,255,255,0.08)'
                  : '1px solid rgba(6,5,65,0.1)',
                boxShadow: isDark
                  ? '0 0 40px hsla(210, 100%, 65%, 0.15), 0 8px 32px hsla(0, 0%, 0%, 0.6)'
                  : '0 8px 40px hsla(243, 84%, 14%, 0.15)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                    {t('Wakti Voice', 'صوت وقتي')}
                  </span>
                  {voiceState !== 'idle' && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(6,5,65,0.08)',
                        color: isDark ? 'hsl(210, 100%, 65%)' : '#060541',
                      }}
                    >
                      {stateLabel()}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleClose}
                  aria-label={t('Close', 'إغلاق')}
                  className="p-1.5 rounded-full transition-colors"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(6,5,65,0.06)',
                  }}
                >
                  <X className="h-4 w-4" style={{ color: isDark ? '#858384' : '#606062' }} />
                </button>
              </div>

              {/* Content area */}
              <div className="flex-1 flex flex-col items-center justify-center px-5 overflow-y-auto gap-4">

                {/* AI transcript (greeting) */}
                {(voiceState === 'greeting' || voiceState === 'connecting') && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                  >
                    {voiceState === 'connecting' && (
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" style={{ color: isDark ? 'hsl(210,100%,65%)' : '#060541' }} />
                    )}
                    <p className="text-base" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                      {aiTranscript || (voiceState === 'connecting' ? t('Connecting...', 'جارٍ الاتصال...') : '')}
                    </p>
                  </motion.div>
                )}

                {/* Idle + Listening — single persistent mic button (never unmounts mid-hold) */}
                {(voiceState === 'idle' || voiceState === 'listening') && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <div className="relative">
                      {/* Pulse ring — only visible while listening */}
                      <AnimatePresence>
                        {voiceState === 'listening' && (
                          <motion.div
                            key="pulse"
                            initial={{ opacity: 0 }}
                            animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.1, 0.4] }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="absolute inset-0 rounded-full pointer-events-none"
                            style={{
                              background: isDark
                                ? 'radial-gradient(circle, hsla(210,100%,65%,0.3) 0%, transparent 70%)'
                                : 'radial-gradient(circle, hsla(243,84%,14%,0.2) 0%, transparent 70%)',
                              width: '120px',
                              height: '120px',
                              top: '-20px',
                              left: '-20px',
                            }}
                          />
                        )}
                      </AnimatePresence>
                      <motion.button
                        ref={micBtnRef}
                        onPointerDown={(e) => { handleHoldStart(e); }}
                        onPointerMove={(e) => { handleHoldMove(e); }}
                        onPointerUp={(e) => { handleHoldEnd(e); }}
                        onPointerCancel={(e) => { handleHoldCancel(e); }}
                        onContextMenu={(e) => e.preventDefault()}
                        aria-label={voiceState === 'listening' ? t('Release to stop', 'ارفع إصبعك للتوقف') : t('Hold to speak', 'اضغط مع الاستمرار للتحدث')}
                        className="relative z-10 rounded-full h-20 w-20 flex items-center justify-center select-none"
                        style={{
                          background: isDark
                            ? 'linear-gradient(135deg, hsl(210,100%,65%) 0%, hsl(280,70%,65%) 100%)'
                            : 'linear-gradient(135deg, #060541 0%, hsl(260,70%,25%) 100%)',
                          boxShadow: isDark
                            ? (voiceState === 'listening'
                              ? '0 0 30px hsla(210,100%,65%,0.5)'
                              : '0 0 20px hsla(210,100%,65%,0.3)')
                            : (voiceState === 'listening'
                              ? '0 4px 20px hsla(243,84%,14%,0.3)'
                              : '0 4px 16px hsla(243,84%,14%,0.2)'),
                          WebkitTouchCallout: 'none',
                          WebkitUserSelect: 'none',
                          touchAction: 'none',
                        }}
                      >
                        <Mic className="h-8 w-8 text-white" />
                      </motion.button>
                    </div>
                    <p className="text-sm" style={{ color: isDark ? '#858384' : '#606062' }}>
                      {voiceState === 'listening'
                        ? t('Listening... speak now', 'أستمع... تحدث الآن')
                        : t('Hold mic to speak', 'اضغط مع الاستمرار للتحدث')}
                    </p>
                    {voiceState === 'listening' && transcript && (
                      <p className="text-sm text-center mt-2" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                        "{transcript}"
                      </p>
                    )}
                    
                    {/* Example hints — only in idle */}
                    {voiceState === 'idle' && (
                    <div 
                      className="mt-2 px-4 py-2 rounded-lg text-center space-y-2"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(6,5,65,0.04)',
                        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(6,5,65,0.08)',
                      }}
                    >
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: isDark ? '#858384' : '#606062' }}>
                          {t('📅 Calendar', '📅 تقويم')}
                        </p>
                        <p className="text-xs italic" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                          {t('"Doctor appointment tomorrow at 10am"', '"موعد الطبيب غداً الساعة 10 صباحاً"')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: isDark ? '#858384' : '#606062' }}>
                          {t('✅ Task', '✅ مهمة')}
                        </p>
                        <p className="text-xs italic" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                          {t('"Create task buy groceries tomorrow"', '"أنشئ مهمة شراء البقالة غداً"')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: isDark ? '#858384' : '#606062' }}>
                          {t('🔔 Reminder', '🔔 تذكير')}
                        </p>
                        <p className="text-xs italic" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                          {t('"Remind me to call mom at 5pm"', '"ذكرني أتصل بأمي الساعة 5 مساءً"')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: isDark ? '#858384' : '#606062' }}>
                          {t('⚡ Quick Actions', '⚡ إجراءات سريعة')}
                        </p>
                        <p className="text-xs italic" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                          {t('"Mark buy groceries done" · "Snooze reminder 10 min" · "Move task to tomorrow"', '"علّم شراء البقالة مكتملة" · "أجّل التذكير 10 دقائق" · "انقل المهمة لبكرة"')}
                        </p>
                      </div>
                    </div>
                    )}
                  </motion.div>
                )}

                {/* Thinking */}
                {voiceState === 'thinking' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: isDark ? 'hsl(210,100%,65%)' : '#060541' }} />
                    <p className="text-sm" style={{ color: isDark ? '#858384' : '#606062' }}>
                      {t('Processing...', 'جارٍ المعالجة...')}
                    </p>
                  </motion.div>
                )}

                {/* Confirming — show extracted entry */}
                {voiceState === 'confirming' && extractedEntry && (() => {
                  const entryMode = extractedEntry.mode || 'calendar';
                  const actionIntent = extractedEntry.actionIntent;
                  const isAction = Boolean(actionIntent);

                  const modeBadge = actionIntent === 'complete_task'
                    ? { label: t('Complete Task', 'إكمال مهمة'), color: isDark ? 'hsl(142,76%,55%)' : 'hsl(142,76%,40%)' }
                    : actionIntent === 'snooze_reminder'
                      ? { label: t('Snooze Reminder', 'تأجيل تذكير'), color: isDark ? 'hsl(25,95%,60%)' : 'hsl(25,95%,45%)' }
                      : actionIntent === 'reschedule_task'
                        ? { label: t('Reschedule Task', 'إعادة جدولة مهمة'), color: isDark ? 'hsl(210,100%,65%)' : '#060541' }
                        : actionIntent === 'reschedule_reminder'
                          ? { label: t('Reschedule Reminder', 'إعادة جدولة تذكير'), color: isDark ? 'hsl(25,95%,60%)' : 'hsl(25,95%,45%)' }
                          : entryMode === 'task'
                            ? { label: t('Task', 'مهمة'), color: isDark ? 'hsl(210,100%,65%)' : '#060541' }
                            : entryMode === 'reminder'
                              ? { label: t('Reminder', 'تذكير'), color: isDark ? 'hsl(25,95%,60%)' : 'hsl(25,95%,45%)' }
                              : { label: t('Calendar', 'تقويم'), color: isDark ? 'hsl(142,76%,55%)' : 'hsl(142,76%,40%)' };

                  const recalcClarification = (next: ExtractedEntry) => {
                    const nDate = Boolean(next.needsDateConfirm);
                    const nTime = Boolean(next.needsTimeConfirm);
                    const m = next.mode || 'calendar';
                    let q: string | undefined;
                    if (m === 'reminder') {
                      if (nDate && nTime) q = 'Please confirm the date and time for this reminder.';
                      else if (nDate) q = 'When should I remind you? Please confirm the date.';
                      else if (nTime) q = 'What time should I remind you?';
                    } else if (m === 'task') {
                      if (nDate) q = 'When is this task due? Please confirm the date.';
                    } else {
                      if (nDate && nTime) q = 'Please confirm the date and time.';
                      else if (nDate) q = 'Please confirm the date.';
                      else if (nTime) q = 'Please confirm the time.';
                    }
                    return q;
                  };

                  return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full h-full flex flex-col min-h-0"
                  >
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
                      <p className="text-xs text-center mb-2" style={{ color: isDark ? '#858384' : '#606062' }}>
                        {t('You said:', 'قلت:')} "{transcript}"
                      </p>

                      {/* Mode badge */}
                      <div className="flex justify-center">
                        <span
                          className="text-xs font-semibold px-3 py-1 rounded-full"
                          style={{
                            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(6,5,65,0.06)',
                            color: modeBadge.color,
                          }}
                        >
                          {modeBadge.label}
                        </span>
                      </div>

                      {extractedEntry.clarificationQuestion && (
                        <p className="text-sm text-center" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                          {t(
                            extractedEntry.clarificationQuestion,
                            'ممكن تتأكد لي من التاريخ/الوقت؟'
                          )}
                        </p>
                      )}

                      {/* Preview card */}
                      <div
                        className="rounded-xl p-4 space-y-2"
                        style={{
                          background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(6,5,65,0.04)',
                          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(6,5,65,0.08)',
                        }}
                      >

                      {/* ── Action intent: complete_task — just show matched title ── */}
                      {actionIntent === 'complete_task' && (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium" style={{ color: isDark ? '#858384' : '#606062' }}>
                              {t('Task', 'المهمة')}
                            </span>
                          </div>
                          <p className="text-base font-semibold px-1" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                            {extractedEntry.targetItemTitle || extractedEntry.title}
                          </p>
                        </>
                      )}

                      {/* ── Action intent: snooze_reminder — show title + snooze minutes ── */}
                      {actionIntent === 'snooze_reminder' && (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium" style={{ color: isDark ? '#858384' : '#606062' }}>
                              {t('Reminder', 'التذكير')}
                            </span>
                          </div>
                          <p className="text-base font-semibold px-1" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                            {extractedEntry.targetItemTitle || extractedEntry.title}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs font-medium" style={{ color: isDark ? '#858384' : '#606062' }}>
                              {t('Snooze for', 'تأجيل لمدة')}
                            </span>
                          </div>
                          <div className="flex gap-2 mt-1">
                            {[5, 10, 15, 30].map((mins) => {
                              const selected = (extractedEntry.snoozeMinutes || 10) === mins;
                              return (
                                <button
                                  key={mins}
                                  onClick={() => setExtractedEntry({ ...extractedEntry, snoozeMinutes: mins })}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                                  style={{
                                    background: selected
                                      ? (isDark ? 'hsl(25,95%,60%)' : 'hsl(25,95%,45%)')
                                      : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(6,5,65,0.04)'),
                                    color: selected ? '#fff' : (isDark ? '#858384' : '#606062'),
                                    border: selected ? 'none' : (isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(6,5,65,0.1)'),
                                  }}
                                >
                                  {mins} {t('min', 'د')}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}

                      {/* ── Action intent: reschedule — show title + date/time ── */}
                      {(actionIntent === 'reschedule_task' || actionIntent === 'reschedule_reminder') && (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium" style={{ color: isDark ? '#858384' : '#606062' }}>
                              {actionIntent === 'reschedule_task' ? t('Task', 'المهمة') : t('Reminder', 'التذكير')}
                            </span>
                          </div>
                          <p className="text-base font-semibold px-1" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                            {extractedEntry.targetItemTitle || extractedEntry.title}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs font-medium" style={{ color: isDark ? '#858384' : '#606062' }}>
                              {t('New Date', 'التاريخ الجديد')}
                            </span>
                          </div>
                          <input
                            type="date"
                            value={extractedEntry.date}
                            onChange={(e) => {
                              const val = e.target.value;
                              const next = { ...extractedEntry, date: val || extractedEntry.date, needsDateConfirm: false };
                              setExtractedEntry({ ...next, clarificationQuestion: recalcClarification(next) });
                            }}
                            aria-label={t('New Date', 'التاريخ الجديد')}
                            className="w-full text-sm bg-transparent border-b border-dashed focus:outline-none focus:border-solid px-1 py-0.5"
                            style={{ color: isDark ? '#f2f2f2' : '#060541', borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(6,5,65,0.2)', colorScheme: isDark ? 'dark' : 'light' }}
                          />
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs font-medium" style={{ color: isDark ? '#858384' : '#606062' }}>
                              {t('New Time', 'الوقت الجديد')}
                            </span>
                          </div>
                          <input
                            type="time"
                            value={extractedEntry.time || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const next = { ...extractedEntry, time: val || undefined, needsTimeConfirm: !(val || '').trim() };
                              setExtractedEntry({ ...next, clarificationQuestion: recalcClarification(next) });
                            }}
                            aria-label={t('New Time', 'الوقت الجديد')}
                            className="w-full text-sm bg-transparent border-b border-dashed focus:outline-none focus:border-solid px-1 py-0.5"
                            style={{ color: isDark ? '#f2f2f2' : '#060541', borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(6,5,65,0.2)', colorScheme: isDark ? 'dark' : 'light' }}
                          />
                        </>
                      )}

                      {/* ── Create intents: full form (title, date, time, priority, subtasks) ── */}
                      {!isAction && (
                        <>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: isDark ? '#858384' : '#606062' }}>
                          {t('Title', 'العنوان')}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={extractedEntry.title}
                        onChange={(e) => setExtractedEntry({ ...extractedEntry, title: e.target.value })}
                        placeholder={t('Enter title', 'أدخل العنوان')}
                        aria-label={t('Title', 'العنوان')}
                        className="w-full text-base font-semibold bg-transparent border-b border-dashed focus:outline-none focus:border-solid px-1 py-0.5"
                        style={{ 
                          color: isDark ? '#f2f2f2' : '#060541',
                          borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(6,5,65,0.2)',
                        }}
                      />

                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs font-medium" style={{ color: isDark ? '#858384' : '#606062' }}>
                          {t('Date', 'التاريخ')}
                        </span>
                      </div>
                      <input
                        type="date"
                        value={extractedEntry.date}
                        onChange={(e) => {
                          const val = e.target.value;
                          const next = {
                            ...extractedEntry,
                            date: val || extractedEntry.date,
                            needsDateConfirm: false,
                          };
                          setExtractedEntry({ ...next, clarificationQuestion: recalcClarification(next) });
                        }}
                        aria-label={t('Date', 'التاريخ')}
                        className="w-full text-sm bg-transparent border-b border-dashed focus:outline-none focus:border-solid px-1 py-0.5"
                        style={{
                          color: isDark ? '#f2f2f2' : '#060541',
                          borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(6,5,65,0.2)',
                          colorScheme: isDark ? 'dark' : 'light',
                        }}
                      />

                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs font-medium" style={{ color: isDark ? '#858384' : '#606062' }}>
                          {t('Time', 'الوقت')}
                        </span>
                      </div>
                      <input
                        type="time"
                        value={extractedEntry.time || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const next = {
                            ...extractedEntry,
                            time: val || undefined,
                            needsTimeConfirm: !(val || '').trim(),
                          };
                          setExtractedEntry({ ...next, clarificationQuestion: recalcClarification(next) });
                        }}
                        aria-label={t('Time', 'الوقت')}
                        className="w-full text-sm bg-transparent border-b border-dashed focus:outline-none focus:border-solid px-1 py-0.5"
                        style={{
                          color: isDark ? '#f2f2f2' : '#060541',
                          borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(6,5,65,0.2)',
                          colorScheme: isDark ? 'dark' : 'light',
                        }}
                      />

                      {/* Priority selector — only for tasks */}
                      {entryMode === 'task' && (
                        <>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs font-medium" style={{ color: isDark ? '#858384' : '#606062' }}>
                              {t('Priority', 'الأولوية')}
                            </span>
                          </div>
                          <div className="flex gap-2 mt-1">
                            {(['normal', 'high', 'urgent'] as const).map((p) => {
                              const selected = (extractedEntry.priority || 'normal') === p;
                              const pLabel = p === 'normal' ? t('Normal', 'عادي') : p === 'high' ? t('High', 'عالي') : t('Urgent', 'عاجل');
                              return (
                                <button
                                  key={p}
                                  onClick={() => setExtractedEntry({ ...extractedEntry, priority: p })}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                                  style={{
                                    background: selected
                                      ? (p === 'urgent' ? 'hsl(0,70%,55%)' : p === 'high' ? 'hsl(25,95%,55%)' : isDark ? 'hsl(210,100%,65%)' : '#060541')
                                      : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(6,5,65,0.04)'),
                                    color: selected ? '#fff' : (isDark ? '#858384' : '#606062'),
                                    border: selected ? 'none' : (isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(6,5,65,0.1)'),
                                  }}
                                >
                                  {pLabel}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}

                      {/* Subtasks list — only for tasks with extracted subtasks */}
                      {entryMode === 'task' && extractedEntry.subtasks && extractedEntry.subtasks.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 mt-3">
                            <span className="text-xs font-medium" style={{ color: isDark ? '#858384' : '#606062' }}>
                              {t(`Subtasks (${extractedEntry.subtasks.length})`, `المهام الفرعية (${extractedEntry.subtasks.length})`)}
                            </span>
                          </div>
                          <div className="space-y-1.5 mt-1">
                            {extractedEntry.subtasks.map((sub, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                                style={{
                                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(6,5,65,0.03)',
                                }}
                              >
                                <span className="text-xs" style={{ color: isDark ? 'hsl(210,100%,65%)' : '#060541' }}>
                                  {idx + 1}.
                                </span>
                                <span className="flex-1 text-sm" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                                  {sub}
                                </span>
                                <button
                                  onClick={() => {
                                    const updated = extractedEntry.subtasks!.filter((_, i) => i !== idx);
                                    setExtractedEntry({ ...extractedEntry, subtasks: updated.length > 0 ? updated : undefined });
                                  }}
                                  className="p-0.5 rounded-full transition-colors"
                                  style={{ color: isDark ? '#858384' : '#606062' }}
                                  aria-label={t('Remove subtask', 'إزالة المهمة الفرعية')}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {extractedEntry.description && (
                        <>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs font-medium" style={{ color: isDark ? '#858384' : '#606062' }}>
                              {t('Description', 'الوصف')}
                            </span>
                          </div>
                          <p className="text-sm" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                            {extractedEntry.description}
                          </p>
                        </>
                      )}
                        </>
                      )}
                      </div>
                    </div>

                    {/* Confirm / Retry buttons (sticky footer) */}
                    <div className="flex gap-3 pt-3">
                      <button
                        onClick={retryListening}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                        style={{
                          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(6,5,65,0.06)',
                          color: isDark ? '#f2f2f2' : '#060541',
                        }}
                      >
                        {t('Try again', 'حاول مرة أخرى')}
                      </button>
                      <button
                        onClick={handleConfirm}
                        disabled={Boolean(extractedEntry.clarificationQuestion) || isSaving}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
                        style={{
                          background: isDark
                            ? 'linear-gradient(135deg, hsl(142,76%,55%) 0%, hsl(160,80%,45%) 100%)'
                            : 'linear-gradient(135deg, hsl(142,76%,40%) 0%, hsl(160,80%,35%) 100%)',
                          opacity: (extractedEntry.clarificationQuestion || isSaving) ? 0.6 : 1,
                        }}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <Check className="h-4 w-4" />
                          {actionIntent === 'complete_task' ? t('Complete', 'إكمال')
                            : actionIntent === 'snooze_reminder' ? t('Snooze', 'تأجيل')
                            : actionIntent === 'reschedule_task' || actionIntent === 'reschedule_reminder' ? t('Reschedule', 'إعادة جدولة')
                            : entryMode === 'task' ? t('Create Task', 'إنشاء مهمة')
                            : entryMode === 'reminder' ? t('Create Reminder', 'إنشاء تذكير')
                            : t('Confirm & Save', 'تأكيد وحفظ')}
                        </span>
                      </button>
                    </div>
                  </motion.div>
                  );
                })()}

                {/* Done */}
                {voiceState === 'done' && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div
                      className="h-16 w-16 rounded-full flex items-center justify-center"
                      style={{
                        background: isDark
                          ? 'linear-gradient(135deg, hsl(142,76%,55%) 0%, hsl(160,80%,45%) 100%)'
                          : 'linear-gradient(135deg, hsl(142,76%,40%) 0%, hsl(160,80%,35%) 100%)',
                      }}
                    >
                      <Check className="h-8 w-8 text-white" />
                    </div>
                    <p className="text-base font-semibold" style={{ color: isDark ? '#f2f2f2' : '#060541' }}>
                      {t('Saved!', 'تم الحفظ!')}
                    </p>
                  </motion.div>
                )}

                {/* Error */}
                {voiceState === 'error' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <p className="text-sm text-red-500">{errorMsg}</p>
                    <button
                      onClick={() => {
                        cleanup();
                        initializeConnection();
                      }}
                      className="px-4 py-2 rounded-xl text-sm font-medium"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(6,5,65,0.06)',
                        color: isDark ? '#f2f2f2' : '#060541',
                      }}
                    >
                      {t('Try again', 'حاول مرة أخرى')}
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Bottom controls */}
              <div className="px-5 pb-5 pt-2 flex flex-col gap-2">
                {/* Type instead */}
                {(voiceState === 'listening' || voiceState === 'idle') && !typeMode && (
                  <button
                    onClick={() => setTypeMode(true)}
                    className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl transition-colors"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(6,5,65,0.04)',
                      color: isDark ? '#858384' : '#606062',
                    }}
                  >
                    <Type className="h-3.5 w-3.5" />
                    {t('Type instead', 'اكتب بدلاً من ذلك')}
                  </button>
                )}

                {/* Type input */}
                {typeMode && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={typedText}
                      onChange={(e) => setTypedText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleTypeSubmit()}
                      placeholder={t('e.g. Doctor tomorrow', 'مثال: دكتور غداً')}
                      autoFocus
                      className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(6,5,65,0.06)',
                        color: isDark ? '#f2f2f2' : '#060541',
                        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(6,5,65,0.1)',
                      }}
                    />
                    <button
                      onClick={handleTypeSubmit}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-white"
                      style={{
                        background: isDark
                          ? 'linear-gradient(135deg, hsl(210,100%,65%) 0%, hsl(280,70%,65%) 100%)'
                          : 'linear-gradient(135deg, #060541 0%, hsl(260,70%,25%) 100%)',
                      }}
                    >
                      {t('Go', 'تم')}
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
            </div>
          </>
        )}
              </AnimatePresence>,
            portalTarget
          )
        : null}
    </>
  );
};

export default VoiceAssistant;
