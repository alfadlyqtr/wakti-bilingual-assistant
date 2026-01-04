import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-supabase-authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

function parseLang(s: any) { const v = (s || '').toString().toLowerCase(); return v.startsWith('ar') ? 'ar' : 'en'; }
function todayLocalYYYYMMDD(tz?: string) { try { const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }); return fmt.format(new Date()); } catch { const d = new Date(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${d.getFullYear()}-${mm}-${dd}`; } }
function daysAgoYYYYMMDD(days: number, tz?: string) { const base = new Date(); base.setDate(base.getDate()-days); try { const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }); return fmt.format(base); } catch { const mm = String(base.getMonth()+1).padStart(2,'0'); const dd = String(base.getDate()).padStart(2,'0'); return `${base.getFullYear()}-${mm}-${dd}`; } }
const monthFmt = new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'});
const timeFmt = new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'});

// Icons map (exact from app)
const MOOD_ICON: Record<string,string> = { awful:"😤", bad:"😟", meh:"😐", good:"😊", rad:"😄" };
const TAG_ICON: Record<string,string> = {
  family:"👨‍👩‍👧", friends:"👥", care:"❤️", exercise:"🏋️", sport:"🏆", relax:"😌", movies:"📽️", gaming:"🎮", reading:"📚", cleaning:"✨", sleep:"🌙", eat_healthy:"🥗", shopping:"🛒", study:"📊", work:"💼", music:"🎵", meditation:"🧘", nature:"🌲", travel:"✈️", cooking:"🍳", walk:"🚶", socialize:"💬", coffee:"☕", love:"❤️", romance:"💕", spouse:"💑", prayer:"🙏", writing:"✍️", horse_riding:"🐴", fishing:"🎣", wife:"👰"
};
const iconizeTag = (t:string)=> `${TAG_ICON[t]||''}${TAG_ICON[t]? ' ':''}${t}`.trim();

function aggregate(entries: { mood_value: number | null; tags: string[] }[]) {
  const moodCounts: Record<string, number> = {"1":0,"2":0,"3":0,"4":0,"5":0};
  const tagCounts: Record<string, number> = {};
  for (const e of entries) { const m = Number(e.mood_value); if (m>=1 && m<=5) moodCounts[String(m)]++; const tags = Array.isArray(e.tags)?e.tags:[]; for (const t of tags) tagCounts[t]=(tagCounts[t]||0)+1; }
  const mostCommonTags = Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>({tag:k,count:v, icon: TAG_ICON[k]||''}));
  return { moodCounts, tagCounts, mostCommonTags };
}
function computeStreak(dates: string[], today: string) { const set=new Set(dates); let streak=0; let cursor=new Date(today+'T00:00:00Z'); while(streak<365){ const y=cursor.getUTCFullYear(); const m=String(cursor.getUTCMonth()+1).padStart(2,'0'); const d=String(cursor.getUTCDate()).padStart(2,'0'); const key=`${y}-${m}-${d}`; if(!set.has(key)) break; streak++; cursor.setUTCDate(cursor.getUTCDate()-1);} return streak; }

const MOOD_SYNONYMS: Record<string, number[]> = { happy:[4,5], joy:[4,5], joyful:[4,5], positive:[4,5], calm:[4,5], good:[4], great:[5], awesome:[5], energized:[5], neutral:[3], meh:[3], tired:[2,3], stressed:[1,2,3], anxious:[1,2], worried:[1,2], sad:[1,2], unhappy:[1,2], angry:[1,2], upset:[1,2], awful:[1], bad:[2], "سعيد":[4,5], "سعيدة":[4,5], "فرح":[4,5], "إيجابي":[4,5], "مرتاح":[4,5], "جيد":[4], "ممتاز":[5], "هادئ":[4,5], "عادي":[3], "تعبان":[2,3], "قلق":[1,2], "حزين":[1,2], "زعلان":[1,2], "غاضب":[1,2], "سيئ":[2], "سيء":[2], "فظيع":[1] };
function inferMoodSetFromQuestion(q: string): number[] | undefined { const t=(q||'').toLowerCase(); for (const k of Object.keys(MOOD_SYNONYMS)) { if (t.includes(k)) return MOOD_SYNONYMS[k]; } return undefined; }

function inferIntent(q: string): string {
  const t=(q||'').toLowerCase();
  if(/gratitude|grateful|thank|thanks|thankful|امتنان|شكر|شكرا/.test(t)) return 'gratitude';
  if(/tag|وسم|activity|نشاط/.test(t)) return 'top_tags';
  if(/morning|صباح/.test(t)) return 'mornings';
  if(/evening|night|مساء|ليل/.test(t)) return 'evenings';
  if(/note|ملاحظة/.test(t)) return 'notes';
  if(/streak|سلسلة/.test(t)) return 'streak';
  if(/trend|اتجاه/.test(t)) return 'trend';
  if(/count|عدد/.test(t)) return 'count';
  if(/mood|مزاج/.test(t)) return 'moods';
  return 'summary';
}

// Utility: co-occurring tag pairs same-day with dates
function sameDayPairs(days: {date:string; tags:string[]}[]) {
  const map = new Map<string, {count:number, dates:Set<string>}>();
  for (const d of days) {
    const unique = Array.from(new Set(d.tags));
    for (let i=0;i<unique.length;i++) for (let j=i+1;j<unique.length;j++){
      const a = unique[i], b = unique[j];
      const key = a<b? `${a}|${b}` : `${b}|${a}`;
      const rec = map.get(key) || {count:0, dates:new Set<string>()};
      rec.count++; rec.dates.add(monthFmt.format(new Date(d.date)));
      map.set(key, rec);
    }
  }
  return Array.from(map.entries()).sort((a,b)=>b[1].count-a[1].count).slice(0,10).map(([k,v])=>({ tags: k.split('|').map(iconizeTag), count: v.count, dates: Array.from(v.dates) }));
}

// Utility: sequences within N hours (A -> B) with examples
function sequencesWithinHours(events: {ts:number; tags:string[]}[], hours=2) {
  const out = new Map<string, {count:number, examples:string[]}>();
  for (let i=0;i<events.length;i++){
    for (let j=i+1;j<events.length;j++){
      const dtMs = events[j].ts - events[i].ts; const dt = dtMs/3600000;
      if (dt<0) continue; if (dt>hours) break;
      const A = Array.from(new Set(events[i].tags));
      const B = Array.from(new Set(events[j].tags));
      for (const a of A) for (const b of B){ if(a===b) continue; const key=`${a}>${b}`;
        const rec = out.get(key) || {count:0, examples:[]};
        rec.count++;
        const d1 = new Date(events[i].ts); const d2 = new Date(events[j].ts);
        const ex = `${monthFmt.format(d1)}: ${timeFmt.format(d1)} → ${timeFmt.format(d2)}`;
        if (rec.examples.length<3) rec.examples.push(ex);
        out.set(key, rec);
      }
    }
  }
  return Array.from(out.entries()).sort((a,b)=>b[1].count-a[1].count).slice(0,10).map(([k,v])=>({ first: iconizeTag(k.split('>')[0]), second: iconizeTag(k.split('>')[1]), count: v.count, examples: v.examples }));
}

function topN(obj: Record<string, number>, n=10){ return Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k,v])=>({ key: iconizeTag(k), count:v })); }

function moodIconByValue(v:number){ return v===1?MOOD_ICON.awful: v===2?MOOD_ICON.bad: v===3?MOOD_ICON.meh: v===4?MOOD_ICON.good: MOOD_ICON.rad; }

function trimToLimit(text:string, maxChars=500){ if (!text) return text; let s=text.trim(); if (s.length<=maxChars) return s; // trim to last period under limit
  const cut = s.slice(0, maxChars);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (lastStop>40? cut.slice(0,lastStop+1): cut).trim(); }

serve(async (req)=>{
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const body = await req.json().catch(()=>({}));
    const { question = '', language, user_timezone = 'UTC', timeframe, mood_set, intent, tips } = body as any;
    const lang = parseLang(language || req.headers.get('Accept-Language') || 'en');
    if (!question || String(question).trim().length===0) return new Response(JSON.stringify({ error:'missing_question' }), { status:400, headers:{...corsHeaders,'Content-Type':'application/json'} });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') } } });
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user; if(!user) return new Response(JSON.stringify({ error:'unauthorized' }), { status:401, headers:{...corsHeaders,'Content-Type':'application/json'} });

    const qLower = String(question).toLowerCase();
    const isYesterday = /(yesterday|الأمس|أمس)/i.test(qLower);
    const inferredDays = /(today|اليوم)/i.test(qLower) ? 1 : isYesterday ? 2 : /(week|7\s*days|أسبوع)/i.test(qLower) ? 7 : /(month|30\s*days|شهر)/i.test(qLower) ? 30 : 7;
    const windowDays = Number(timeframe) || inferredDays;
    const resolved_intent = String(intent || inferIntent(question));
    const resolved_mood_set = (Array.isArray(mood_set) && mood_set.length) ? mood_set : (inferMoodSetFromQuestion(question) || []);

    const today = todayLocalYYYYMMDD(user_timezone);
    const yesterday = daysAgoYYYYMMDD(1, user_timezone);
    const since7 = daysAgoYYYYMMDD(7, user_timezone);
    const since30 = daysAgoYYYYMMDD(30, user_timezone);
    const since90 = daysAgoYYYYMMDD(90, user_timezone);
    const since = daysAgoYYYYMMDD(windowDays, user_timezone);

    // Load days and checkins for 90d window (expanded to catch older entries)
    const { data: daysRows } = await supabase
      .from('journal_days')
      .select('date, mood_value, tags, note, morning_reflection, evening_reflection, gratitude_1, gratitude_2, gratitude_3')
      .eq('user_id', user.id)
      .gte('date', since90)
      .lte('date', today)
      .order('date', { ascending: false });

    // Also fetch the absolute LAST entry regardless of date window
    const { data: lastEntryRows } = await supabase
      .from('journal_days')
      .select('date, mood_value, tags, note, morning_reflection, evening_reflection')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(1);

    const { data: checksRows } = await supabase
      .from('journal_checkins')
      .select('id, date, occurred_at, mood_value, tags, note')
      .eq('user_id', user.id)
      .gte('date', since90)
      .lte('date', today)
      .order('occurred_at', { ascending: true });

    // Also fetch the absolute LAST checkin regardless of date window
    const { data: lastCheckinRows } = await supabase
      .from('journal_checkins')
      .select('id, date, occurred_at, mood_value, tags, note')
      .eq('user_id', user.id)
      .order('occurred_at', { ascending: false })
      .limit(1);

    const uniqueChecksMap = new Map<string, any>();
    for (const c of (checksRows||[])) { if (!uniqueChecksMap.has(c.id)) uniqueChecksMap.set(c.id, c); }
    const uniqueChecks = Array.from(uniqueChecksMap.values());

    const inWindowDays = (daysRows||[]).filter(d=>d.date>=since && d.date<=today);
    const inWindowChecks = uniqueChecks.filter(c=>c.date>=since && c.date<=today);

    // Specific logic for 'yesterday' to ensure we describe that day correctly if it exists
    let yesterdayData: any = null;
    if (isYesterday) {
      yesterdayData = (daysRows || []).find(d => d.date === yesterday) || null;
    }

    const entries = inWindowDays.map(d => ({ mood_value: d.mood_value, tags: (d as any).tags || [] }))
      .concat(inWindowChecks.map(c => ({ mood_value: c.mood_value, tags: (c as any).tags || [] })));

    // Check if user has any journal data at all
    const totalEntries = (daysRows||[]).length + uniqueChecks.length;
    const hasNoData = totalEntries === 0;

    const agg = aggregate(entries);

    // Build patterns
    const dayTagDocs = (daysRows||[]).map(d=>({date:d.date, tags: (d as any).tags || []}));
    const events = uniqueChecks.map(c=>({ ts: new Date(c.occurred_at || `${c.date}T12:00:00Z`).getTime(), tags: (c as any).tags || [], mood: Number(c.mood_value)||null }));

    // 7d and 30d aggregates for deltas
    const agg7 = aggregate((daysRows||[]).filter(d=>d.date>=since7).map(d=>({mood_value:d.mood_value, tags:(d as any).tags||[]})).concat(uniqueChecks.filter(c=>c.date>=since7).map(c=>({mood_value:c.mood_value, tags:(c as any).tags||[]}))));
    const agg30 = aggregate((daysRows||[]).map(d=>({mood_value:d.mood_value, tags:(d as any).tags||[]})).concat(uniqueChecks.map(c=>({mood_value:c.mood_value, tags:(c as any).tags||[]}))));

    const tagDelta: { tag:string; delta:number; c7:number; c30:number }[] = [];
    const tagSet = new Set([...Object.keys(agg7.tagCounts), ...Object.keys(agg30.tagCounts)]);
    for (const t of tagSet){ const c7 = agg7.tagCounts[t]||0; const c30 = agg30.tagCounts[t]||0; const delta = c7 - Math.round(c30/4); tagDelta.push({ tag: iconizeTag(t), delta, c7, c30 }); }
    tagDelta.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));

    const absences = Array.from(Object.keys(agg30.tagCounts)).filter(t => (agg30.tagCounts[t]||0)>0 && (agg7.tagCounts[t]||0)===0).slice(0,10).map(t=>({ tag: iconizeTag(t), last_seen: (()=>{
      // find last date in 30d that had tag t
      for (const d of (daysRows||[])) if (((d as any).tags||[]).includes(t)) return monthFmt.format(new Date(d.date));
      for (let i=uniqueChecks.length-1;i>=0;i--) if (((uniqueChecks[i] as any).tags||[]).includes(t)) return monthFmt.format(new Date(uniqueChecks[i].date));
      return undefined; })() }));

    const posSet = new Set([4,5]); const negSet = new Set([1,2]);
    const anchorsMap = new Map<string, number>();
    const triggersMap = new Map<string, number>();
    for (const ev of events){ const tags = Array.from(new Set(ev.tags)); if (posSet.has(Number(ev.mood||0))) for (const t of tags) anchorsMap.set(iconizeTag(t),(anchorsMap.get(iconizeTag(t))||0)+1); }
    // triggers: tag A preceding a negative mood within 2h
    for (let i=0;i<events.length;i++){
      if (!negSet.has(Number(events[i].mood||0))) continue; const tneg = events[i].ts;
      for (let j=i-1;j>=0;j--){ const dt=(tneg-events[j].ts)/3600000; if (dt>2) break; if (dt>=0){ for (const t of new Set(events[j].tags)) triggersMap.set(iconizeTag(t),(triggersMap.get(iconizeTag(t))||0)+1); } }
    }

    // contradictions: gratitude present + stress/work tags same day
    const stressful = new Set(["work","stress","anxious","angry","tired","bad","awful"]);
    const contradictions: { date:string; gratitude:string[]; conflicting_tags:string[] }[] = [];
    for (const d of (daysRows||[])){
      const g = [d.gratitude_1, d.gratitude_2, d.gratitude_3].map(x=>`${x||''}`.trim()).filter(Boolean);
      const tags = ((d as any).tags||[]) as string[];
      if (g.length && tags.some(t=>stressful.has(t))) {
        contradictions.push({ date: monthFmt.format(new Date(d.date)), gratitude: g, conflicting_tags: tags.filter(t=>stressful.has(t)).map(iconizeTag) });
      }
    }

    // Build LAST ENTRY context - always include this so AI can reference it
    const moodNameMap: Record<number, string> = { 1: 'awful', 2: 'bad', 3: 'meh', 4: 'good', 5: 'rad' };
    const lastDay = (lastEntryRows && lastEntryRows.length > 0) ? lastEntryRows[0] : null;
    const lastCheckin = (lastCheckinRows && lastCheckinRows.length > 0) ? lastCheckinRows[0] : null;
    // Determine which is more recent
    let lastEntry: { date: string; mood: string; mood_value: number; note: string | null; tags: string[]; type: 'day' | 'checkin'; days_ago: number } | null = null;
    if (lastDay || lastCheckin) {
      const dayDate = lastDay ? new Date(lastDay.date + 'T12:00:00Z') : null;
      const checkinDate = lastCheckin ? new Date(lastCheckin.occurred_at || lastCheckin.date + 'T12:00:00Z') : null;
      const todayDate = new Date(today + 'T12:00:00Z');
      
      if (lastDay && dayDate && (!checkinDate || dayDate >= checkinDate)) {
        const daysAgo = Math.floor((todayDate.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));
        lastEntry = {
          date: monthFmt.format(dayDate),
          mood: moodNameMap[lastDay.mood_value] || 'unknown',
          mood_value: lastDay.mood_value,
          note: lastDay.note || lastDay.evening_reflection || lastDay.morning_reflection || null,
          tags: lastDay.tags || [],
          type: 'day',
          days_ago: daysAgo
        };
      } else if (lastCheckin && checkinDate) {
        const daysAgo = Math.floor((todayDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24));
        lastEntry = {
          date: monthFmt.format(checkinDate),
          mood: moodNameMap[lastCheckin.mood_value] || 'unknown',
          mood_value: lastCheckin.mood_value,
          note: lastCheckin.note || null,
          tags: lastCheckin.tags || [],
          type: 'checkin',
          days_ago: daysAgo
        };
      }
    }

    // Build stats for resolved_intent
    const baseStats: Record<string, unknown> = { 
      timeframe_days: windowDays, 
      mood_icons: MOOD_ICON, 
      tag_icons: TAG_ICON,
      last_entry: lastEntry 
    };
    if (resolved_intent === 'top_tags') {
      baseStats.most_common_tags = agg.mostCommonTags;
    } else if (resolved_intent === 'moods' || resolved_intent === 'count' || resolved_intent === 'trend' || resolved_intent === 'summary') {
      baseStats.mood_counts = agg.moodCounts;
      let bestK: 1|2|3|4|5 = 3; let bestV = -1; ([5,4,3,2,1] as (1|2|3|4|5)[]).forEach(k=>{ const v=(agg.moodCounts[String(k)]||0); if(v>bestV){bestV=v; bestK=k;} });
      baseStats.top_mood = { value: bestK, count: Math.max(0,bestV), icon: moodIconByValue(bestK) };
    } else if (resolved_intent === 'streak') {
      const { data: cal } = await supabase.from('journal_calendar_view').select('date').eq('user_id', user.id).gte('date', daysAgoYYYYMMDD(60, user_timezone)).lte('date', today);
      baseStats.streak_days = computeStreak((cal||[]).map(r=>r.date), today);
    } else if (resolved_intent === 'notes' || resolved_intent === 'mornings' || resolved_intent === 'evenings') {
      const textItems: { date: string; type: string; text: string }[] = [];
      for (const d of inWindowDays) {
        if (resolved_intent === 'notes' && d.note) textItems.push({ date: monthFmt.format(new Date(d.date)), type:'note', text: d.note });
        if (resolved_intent === 'mornings' && d.morning_reflection) textItems.push({ date: monthFmt.format(new Date(d.date)), type:'morning', text: d.morning_reflection });
        if (resolved_intent === 'evenings' && d.evening_reflection) textItems.push({ date: monthFmt.format(new Date(d.date)), type:'evening', text: d.evening_reflection });
      }
      baseStats.text_items = textItems.slice(0, 30);
    } else if (resolved_intent === 'gratitude') {
      const items: { date: string; text: string }[] = [];
      for (const d of inWindowDays) {
        const add = (v?: string | null) => { const t=(v||'').toString().trim(); if (t) items.push({ date: monthFmt.format(new Date(d.date)), text: t }); };
        add(d.gratitude_1); add(d.gratitude_2); add(d.gratitude_3);
      }
      const seen = new Map<string, number>();
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g,' ').trim();
      for (const it of items) { const k = norm(it.text); seen.set(k, (seen.get(k)||0)+1); }
      const top = Array.from(seen.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([text,count])=>({ text, count }));
      baseStats.gratitude_items = items.slice(0, 30);
      baseStats.top_gratitude = top;
    }

    // Add multi-scale patterns
    baseStats.patterns = {
      same_day_pairs: sameDayPairs(dayTagDocs),
      timing_sequences: sequencesWithinHours(events, 2),
      deltas_7v30: tagDelta.slice(0,10),
      absences_7v30: absences,
      anchors: topN(Object.fromEntries(anchorsMap), 10),
      triggers: topN(Object.fromEntries(triggersMap), 10),
      contradictions: contradictions.slice(0,5),
    };

    // Tips (brief)
    let tipsText: string | undefined;
    const m = agg.moodCounts; const pos = (m['4']||0)+(m['5']||0); const neg=(m['1']||0)+(m['2']||0); const neu=(m['3']||0);
    const topTag = agg.mostCommonTags[0]?.tag;
    const tipsLines: string[] = [];
    if (resolved_intent === 'gratitude') {
      tipsLines.push(lang==='ar' ? 'كل مساء هذا الأسبوع، اكتب سطر امتنان قصير.' : 'Each evening this week, jot one short gratitude line.');
    } else {
      if (pos>neg) tipsLines.push(lang==='ar'?'ميل إيجابي — واصل ما يفيدك.':'Positive tilt — keep what helps.');
      else if (neg>pos) tipsLines.push(lang==='ar'?'ميل منخفض — خذ دقيقة تهدئة (تنفس/مشي).':'Low tilt — take a 1‑minute reset (breath/walk).');
      else if (neu>=Math.max(pos,neg)) tipsLines.push(lang==='ar'?'أيام عادية كثيرة — أضف عادة صغيرة رافعة.':'Lots of neutral days — add one tiny lift.');
      if (topTag) tipsLines.push(lang==='ar'?`وسم بارز: ${iconizeTag(topTag)}. استخدمه كمحفز اليوم.`:`Standout tag: ${iconizeTag(topTag)}. Use it as today’s trigger.`);
    }
    tipsText = (tips===false) ? undefined : tipsLines.join(' ');

    // Persona prompts (EN/AR) + voice rules - optimized for GPT-4o-mini speed
    // Include data availability context so AI doesn't hallucinate
    let dataContext = '';
    if (hasNoData) {
      dataContext = lang==='ar' 
        ? 'المستخدم ليس لديه أي إدخالات في اليوميات. أجب بصدق أنه لا توجد بيانات للتحليل.' 
        : 'User has NO journal entries at all. Be honest that there is no data to analyze.';
    } else {
      let contextParts = [];

      if (lastEntry) {
        contextParts.push(lang==='ar'
          ? `آخر إدخال للمستخدم كان في ${lastEntry.date} (قبل ${lastEntry.days_ago} يوم). المزاج: ${MOOD_ICON[lastEntry.mood] || lastEntry.mood}. ${lastEntry.note ? 'الملاحظة: "' + lastEntry.note + '"' : ''} ${lastEntry.tags.length ? 'الوسوم: ' + lastEntry.tags.map(iconizeTag).join(', ') : ''}`
          : `User's LAST entry was on ${lastEntry.date} (${lastEntry.days_ago} days ago). Mood: ${MOOD_ICON[lastEntry.mood] || lastEntry.mood}. ${lastEntry.note ? 'Note: "' + lastEntry.note + '"' : ''} ${lastEntry.tags.length ? 'Tags: ' + lastEntry.tags.map(iconizeTag).join(', ') : ''}`);
      }

      if (isYesterday) {
        if (yesterdayData) {
          const yMoodValue = yesterdayData.mood_value;
          const yMoodName = moodNameMap[yMoodValue] || 'unknown';
          contextParts.push(lang==='ar'
            ? `بالنسبة لأمس (${yesterday}): المزاج كان ${MOOD_ICON[yMoodName] || yMoodName}. الوسوم: ${(yesterdayData.tags || []).map(iconizeTag).join(', ')}. الملاحظة: "${yesterdayData.note || yesterdayData.evening_reflection || yesterdayData.morning_reflection || ''}"`
            : `For YESTERDAY (${yesterday}): Mood was ${MOOD_ICON[yMoodName] || yMoodName}. Tags: ${(yesterdayData.tags || []).map(iconizeTag).join(', ')}. Note: "${yesterdayData.note || yesterdayData.evening_reflection || yesterdayData.morning_reflection || ''}"`);
        } else {
          contextParts.push(lang==='ar'
            ? `لم يسجل المستخدم أي إدخال يوم أمس (${yesterday}).`
            : `User did NOT log anything yesterday (${yesterday}).`);
        }
      }

      dataContext = contextParts.join(' ');

      if (entries.length === 0 && !isYesterday) {
        dataContext += lang==='ar' 
          ? ` لكن لا توجد إدخالات في آخر ${windowDays} يوم.`
          : ` However, no entries in the last ${windowDays} days.`;
      }
    }
    
    const system_en = `You are a trusted best friend who gives quick, warm insights about someone's journal. Write 40–60 words max. Use inline icons. Start with "I notice...", "Look at this...", or "Every time...". Be specific with dates/times. MANDATORY: If the user asks about world topics, you MUST say "If you want to chat about other topics, use Wakti AI." but ONLY for off-topic questions. BANNED: It appears that, This suggests, Consider, I would recommend, Your data shows, Based on your patterns, level. No corporate/therapy jargon. CRITICAL: If there is no data, say so honestly - never make up or assume information.${dataContext ? ' ' + dataContext : ''}`;
    const system_ar = `أنت صديق مقرّب يعطي رؤى سريعة ودافئة عن يوميات شخص. اكتب 40–60 كلمة كحد أقصى. استخدم الرموز. ابدأ بـ "ألاحظ..." أو "انظر لهذا...". كن محددًا بالتواريخ. إلزامي: إذا سأل المستخدم عن مواضيع عامة، يجب أن تقول "إذا كنت تريد الدردشة في مواضيع أخرى، استخدم وقطي AI." فقط للأسئلة خارج نطاق اليوميات. الممنوع: يبدو أن، يوحي ذلك، فكّر في، أوصي بـ، تُظهر بياناتك. مهم جداً: إذا لم تكن هناك بيانات، قل ذلك بصدق - لا تختلق معلومات.${dataContext ? ' ' + dataContext : ''}`;

    // LLM - GPT-4o-mini for speed
    let summary: string | undefined;
    if (OPENAI_API_KEY) {
      const messages = [
        { role:'system', content: (lang==='ar'?system_ar:system_en) },
        { role:'user', content: JSON.stringify({ question, intent: resolved_intent, window_days: windowDays, stats: baseStats }) }
      ];
      try {
        const llm = await fetch('https://api.openai.com/v1/chat/completions', { 
          method:'POST', 
          headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${OPENAI_API_KEY}` }, 
          body: JSON.stringify({ model:'gpt-4o-mini', temperature:0.4, max_tokens:150, messages }) 
        });
        if (llm.ok) { const j = await llm.json(); summary = j?.choices?.[0]?.message?.content?.toString(); }
      } catch(e){ console.error('[journal-qa] openai_call_failed', e); }
    }

    summary = trimToLimit(summary||'');

    const out = { question:String(question), timeframe_days: windowDays, resolved_intent, stats: baseStats, tips: tipsText, summary };
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[journal-qa] error', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
