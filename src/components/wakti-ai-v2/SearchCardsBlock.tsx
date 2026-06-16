import React from 'react';
import { Link2, Globe, Newspaper, Trophy, Sparkles, ExternalLink, Zap, TrendingUp } from 'lucide-react';
import { resolveGroundedBrowsingData } from './GroundedPlacesBlock';

type MessageLike = {
  content?: string;
  browsingData?: any;
  metadata?: any;
};

type SearchCardItem = {
  title: string;
  summary: string;
  url?: string;
  sourceLabel?: string;
  badge?: string;
  index?: number;
};

type SearchCardsBlockProps = {
  message: MessageLike | null | undefined;
  language: string;
  introText?: string;
};

type SearchType = 'sports' | 'news' | 'url' | 'general' | 'places' | 'research';

const TYPE_CONFIG: Record<SearchType, {
  Icon: React.ElementType;
  accentColor: string;
  headerBadgeBg: string;
  headerBadgeText: string;
  cardAccentBar: string;
  cardBg: string;
  cardBorder: string;
  badgeBg: string;
  badgeText: string;
  openBtnBg: string;
  openBtnText: string;
  openBtnBorder: string;
  label: { en: string; ar: string };
  sub: { en: string; ar: string };
}> = {
  sports: {
    Icon: Trophy,
    accentColor: 'text-amber-500',
    headerBadgeBg: 'bg-amber-500/15',
    headerBadgeText: 'text-amber-600 dark:text-amber-400',
    cardAccentBar: 'bg-amber-500',
    cardBg: 'bg-amber-500/5 dark:bg-amber-500/8',
    cardBorder: 'border-amber-500/20',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-600 dark:text-amber-400',
    openBtnBg: 'bg-amber-500/15 hover:bg-amber-500/25',
    openBtnText: 'text-amber-600 dark:text-amber-400',
    openBtnBorder: 'border-amber-500/30',
    label: { en: 'Sports', ar: 'رياضة' },
    sub: { en: 'Scores & results', ar: 'مباريات ونتائج' },
  },
  news: {
    Icon: Newspaper,
    accentColor: 'text-blue-500',
    headerBadgeBg: 'bg-blue-500/15',
    headerBadgeText: 'text-blue-600 dark:text-blue-400',
    cardAccentBar: 'bg-blue-500',
    cardBg: 'bg-blue-500/5 dark:bg-blue-500/8',
    cardBorder: 'border-blue-500/20',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-600 dark:text-blue-400',
    openBtnBg: 'bg-blue-500/15 hover:bg-blue-500/25',
    openBtnText: 'text-blue-600 dark:text-blue-400',
    openBtnBorder: 'border-blue-500/30',
    label: { en: 'News', ar: 'أخبار' },
    sub: { en: 'Live updates', ar: 'آخر التحديثات' },
  },
  url: {
    Icon: Link2,
    accentColor: 'text-violet-500',
    headerBadgeBg: 'bg-violet-500/15',
    headerBadgeText: 'text-violet-600 dark:text-violet-400',
    cardAccentBar: 'bg-violet-500',
    cardBg: 'bg-violet-500/5 dark:bg-violet-500/8',
    cardBorder: 'border-violet-500/20',
    badgeBg: 'bg-violet-500/15',
    badgeText: 'text-violet-600 dark:text-violet-400',
    openBtnBg: 'bg-violet-500/15 hover:bg-violet-500/25',
    openBtnText: 'text-violet-600 dark:text-violet-400',
    openBtnBorder: 'border-violet-500/30',
    label: { en: 'Page', ar: 'صفحة' },
    sub: { en: 'URL analysis', ar: 'تحليل الرابط' },
  },
  research: {
    Icon: Sparkles,
    accentColor: 'text-fuchsia-500',
    headerBadgeBg: 'bg-fuchsia-500/15',
    headerBadgeText: 'text-fuchsia-600 dark:text-fuchsia-400',
    cardAccentBar: 'bg-fuchsia-500',
    cardBg: 'bg-fuchsia-500/5 dark:bg-fuchsia-500/8',
    cardBorder: 'border-fuchsia-500/20',
    badgeBg: 'bg-fuchsia-500/15',
    badgeText: 'text-fuchsia-600 dark:text-fuchsia-400',
    openBtnBg: 'bg-fuchsia-500/15 hover:bg-fuchsia-500/25',
    openBtnText: 'text-fuchsia-600 dark:text-fuchsia-400',
    openBtnBorder: 'border-fuchsia-500/30',
    label: { en: 'Research', ar: 'بحث عميق' },
    sub: { en: 'Deep analysis', ar: 'تحليل أعمق' },
  },
  general: {
    Icon: Sparkles,
    accentColor: 'text-emerald-500',
    headerBadgeBg: 'bg-emerald-500/15',
    headerBadgeText: 'text-emerald-600 dark:text-emerald-400',
    cardAccentBar: 'bg-emerald-500',
    cardBg: 'bg-emerald-500/5 dark:bg-emerald-500/8',
    cardBorder: 'border-emerald-500/20',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
    openBtnBg: 'bg-emerald-500/15 hover:bg-emerald-500/25',
    openBtnText: 'text-emerald-600 dark:text-emerald-400',
    openBtnBorder: 'border-emerald-500/30',
    label: { en: 'Search', ar: 'بحث' },
    sub: { en: 'Smart search', ar: 'بحث ذكي' },
  },
  places: {
    Icon: Globe,
    accentColor: 'text-cyan-500',
    headerBadgeBg: 'bg-cyan-500/15',
    headerBadgeText: 'text-cyan-600 dark:text-cyan-400',
    cardAccentBar: 'bg-cyan-500',
    cardBg: 'bg-cyan-500/5 dark:bg-cyan-500/8',
    cardBorder: 'border-cyan-500/20',
    badgeBg: 'bg-cyan-500/15',
    badgeText: 'text-cyan-600 dark:text-cyan-400',
    openBtnBg: 'bg-cyan-500/15 hover:bg-cyan-500/25',
    openBtnText: 'text-cyan-600 dark:text-cyan-400',
    openBtnBorder: 'border-cyan-500/30',
    label: { en: 'Places', ar: 'أماكن' },
    sub: { en: 'Place search', ar: 'بحث أماكن' },
  },
};

function cleanSearchText(value?: string) {
  return typeof value === 'string'
    ? value
        .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:)[^)]+)\)/gi, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^\s*(?:[-*•]|\d+\.)\s+/gm, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
}

function truncate(value: string, max = 180) {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function getHostLabel(url?: string) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function getFaviconUrl(url?: string) {
  const host = getHostLabel(url);
  if (!host) return '';
  return `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
}

function normalizeSearchType(raw?: string): SearchType {
  if (raw === 'places') return 'places';
  if (raw === 'business') return 'places';
  if (raw === 'news') return 'news';
  if (raw === 'sports') return 'sports';
  if (raw === 'url') return 'url';
  if (raw === 'research') return 'research';
  return 'general';
}

function extractSummary(content: string) {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((part) => cleanSearchText(part))
    .filter((part) => part && !/^sources?\s*:/i.test(part));
  const first = paragraphs.find((part) => part.length > 30) || paragraphs[0] || '';
  return truncate(first, 240);
}

function extractBulletCards(content: string): SearchCardItem[] {
  const lines = content.split('\n');
  const cards: SearchCardItem[] = [];
  let current: { title: string; lines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const summary = truncate(cleanSearchText(current.lines.join(' ')), 160);
    if (current.title || summary) {
      cards.push({
        title: truncate(current.title || summary || 'Result', 100),
        summary: summary || current.title || '',
      });
    }
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^sources?\s*:/i.test(line)) continue;
    const bulletMatch = line.match(/^(?:[-*•]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      flush();
      const cleaned = cleanSearchText(bulletMatch[1]);
      const divider = cleaned.match(/^([^:–—-]{3,100})\s*[:–—-]\s*(.+)$/);
      current = {
        title: divider?.[1]?.trim() || truncate(cleaned, 100),
        lines: divider?.[2] ? [divider[2]] : [],
      };
      continue;
    }
    if (current) current.lines.push(line);
  }

  flush();
  return cards.slice(0, 6);
}

function buildCards(message: MessageLike | null | undefined, language: string) {
  const resolvedBrowsingData = resolveGroundedBrowsingData(message);
  const searchType = normalizeSearchType(
    typeof resolvedBrowsingData?.cardType === 'string'
      ? resolvedBrowsingData.cardType
      : (typeof resolvedBrowsingData?.searchType === 'string' ? resolvedBrowsingData.searchType : undefined)
  );
  const rawContent = typeof message?.content === 'string' ? message.content : '';
  const content = rawContent.replace(/^\s*Sources?:[\s\S]*$/im, '').trim();
  const summary = typeof resolvedBrowsingData?.summary === 'string' && resolvedBrowsingData.summary.trim()
    ? cleanSearchText(resolvedBrowsingData.summary)
    : extractSummary(content);
  const sources: any[] = Array.isArray(resolvedBrowsingData?.sources) ? resolvedBrowsingData.sources : [];
  const bulletCards = extractBulletCards(content);
  const structuredCards: SearchCardItem[] = Array.isArray(resolvedBrowsingData?.cards)
    ? resolvedBrowsingData.cards
        .map((card: any) => ({
          title: cleanSearchText(typeof card?.title === 'string' ? card.title : ''),
          summary: truncate(cleanSearchText(typeof card?.summary === 'string' ? card.summary : ''), 160),
          url: typeof card?.url === 'string' ? card.url : undefined,
          sourceLabel: cleanSearchText(typeof card?.sourceLabel === 'string' ? card.sourceLabel : ''),
          badge: cleanSearchText(typeof card?.badge === 'string' ? card.badge : ''),
        }))
        .filter((card: SearchCardItem) => card.title || card.summary)
    : [];

  if (structuredCards.length > 0) {
    return {
      searchType,
      summary,
      sources,
      cards: structuredCards,
    };
  }

  const sourceCards: SearchCardItem[] = sources.slice(0, 6).map((source: any, index: number) => {
    const sourceUrl = typeof source?.url === 'string' ? source.url : '';
    const sourceLabel = getHostLabel(sourceUrl) || (language === 'ar' ? 'مصدر' : 'Source');
    const aiTitle = bulletCards[index]?.title || '';
    const aiSummary = bulletCards[index]?.summary || (index === 0 ? summary : '') || '';
    const rawSourceTitle = cleanSearchText(typeof source?.title === 'string' ? source.title : '');
    return {
      title: aiTitle || rawSourceTitle || `${language === 'ar' ? 'مصدر' : 'Source'} ${index + 1}`,
      summary: truncate(aiSummary, 160),
      url: sourceUrl || undefined,
      sourceLabel,
    };
  });

  if (searchType === 'url') {
    const primarySource = sources[0];
    const primaryUrl = typeof primarySource?.url === 'string' ? primarySource.url : '';
    const primaryTitle = cleanSearchText(typeof primarySource?.title === 'string' ? primarySource.title : '') || getHostLabel(primaryUrl) || (language === 'ar' ? 'ملخص الصفحة' : 'Page summary');
    const detailCards = (bulletCards.length > 0 ? bulletCards : sourceCards).slice(0, 4).map((card, index) => ({
      ...card,
      badge: index === 0 ? (language === 'ar' ? 'أهم نقطة' : 'Key point') : (language === 'ar' ? 'تفصيل' : 'Detail'),
      url: card.url || primaryUrl || undefined,
      sourceLabel: card.sourceLabel || getHostLabel(primaryUrl),
    }));
    return {
      searchType,
      summary,
      sources,
      cards: [
        {
          title: primaryTitle,
          summary: summary || (language === 'ar' ? 'تم تحليل الرابط.' : 'The page was analyzed.'),
          url: primaryUrl || undefined,
          sourceLabel: getHostLabel(primaryUrl),
          badge: language === 'ar' ? 'ملخص الرابط' : 'URL summary',
        },
        ...detailCards,
      ].slice(0, 5),
    };
  }

  if (searchType === 'news' || searchType === 'sports' || searchType === 'research') {
    return {
      searchType,
      summary,
      sources,
      cards: [],
    };
  }

  if (searchType === 'general') {
    return {
      searchType,
      summary,
      sources,
      cards: [],
    };
  }

  const generalCards = (bulletCards.length > 0 ? bulletCards : sourceCards).slice(0, 6).map((card, index) => ({
    ...card,
    badge: index === 0 ? (language === 'ar' ? 'الخلاصة' : 'Top insight') : (language === 'ar' ? 'نتيجة' : 'Result'),
  }));

  return {
    searchType,
    summary,
    sources,
    cards: generalCards.length > 0 ? generalCards : [{
      title: language === 'ar' ? 'نتيجة البحث' : 'Search result',
      summary: summary || '',
      badge: language === 'ar' ? 'ملخص' : 'Summary',
    }],
  };
}

function SourceChip({ source, index }: { source: any; index: number }) {
  const url = typeof source?.url === 'string' ? source.url : '';
  const rawTitle = typeof source?.title === 'string' ? source.title.trim() : '';
  const hostLabel = getHostLabel(url);
  const label = (rawTitle && rawTitle !== hostLabel) ? truncate(rawTitle, 24) : (hostLabel || rawTitle || `Source ${index + 1}`);
  const favicon = getFaviconUrl(url);

  return (
    <a
      href={url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/40 dark:bg-white/5 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors shrink-0"
    >
      <span className="text-[10px] font-bold text-muted-foreground/60 tabular-nums">{index + 1}</span>
      {favicon ? (
        <img src={favicon} alt="" className="h-3.5 w-3.5 rounded-sm object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <Globe className="h-3 w-3" />
      )}
      <span className="max-w-[80px] truncate">{label}</span>
    </a>
  );
}

function SearchCard({ card, searchType, language }: { card: SearchCardItem; searchType: SearchType; language: string }) {
  const cfg = TYPE_CONFIG[searchType] || TYPE_CONFIG.general;

  return (
    <div className={`relative flex overflow-hidden rounded-xl border ${cfg.cardBorder} ${cfg.cardBg} transition-all duration-200 hover:shadow-md active:scale-[0.99]`}>
      <div className={`w-1 shrink-0 rounded-l-xl ${cfg.cardAccentBar}`} />
      <div className="flex flex-1 flex-col gap-2 p-3 min-w-0">
        {card.badge ? (
          <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.badgeBg} ${cfg.badgeText}`}>
            {searchType === 'sports' ? <Zap className="h-2.5 w-2.5" /> : searchType === 'news' ? <TrendingUp className="h-2.5 w-2.5" /> : null}
            {card.badge}
          </span>
        ) : null}

        <p className="text-sm font-semibold leading-snug text-foreground line-clamp-3">
          {card.title}
        </p>

        {card.summary ? (
          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
            {card.summary}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {card.sourceLabel ? (
            <div className="flex items-center gap-1 min-w-0">
              {card.url ? (
                <img
                  src={getFaviconUrl(card.url)}
                  alt=""
                  className="h-3 w-3 rounded-sm object-contain opacity-70"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : <Globe className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
              <span className="text-[10px] text-muted-foreground truncate">{card.sourceLabel}</span>
            </div>
          ) : <span />}

          {card.url ? (
            <a
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${cfg.openBtnBg} ${cfg.openBtnText} ${cfg.openBtnBorder}`}
            >
              <ExternalLink className="h-3 w-3" />
              <span>{language === 'ar' ? 'فتح' : 'Open'}</span>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SearchCardsBlock({ message, language, introText }: SearchCardsBlockProps) {
  const { searchType, summary, sources, cards } = buildCards(message, language);
  const cfg = TYPE_CONFIG[searchType] || TYPE_CONFIG.general;
  const { Icon } = cfg;
  const visibleIntro = cleanSearchText(introText || '');
  const visibleSources = Array.isArray(sources) ? sources.slice(0, 8) : [];

  return (
    <div className="space-y-3">

      {/* ── Type header strip ── */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className={`flex items-center gap-1.5 rounded-full border ${cfg.cardBorder} ${cfg.cardBg} px-3 py-1.5`}>
          <Icon className={`h-3.5 w-3.5 ${cfg.accentColor}`} />
          <span className={`text-[11px] font-bold uppercase tracking-wider ${cfg.accentColor}`}>
            {language === 'ar' ? cfg.label.ar : cfg.label.en}
          </span>
        </div>
        <span className={`text-[11px] font-medium ${cfg.headerBadgeText} ${cfg.headerBadgeBg} rounded-full px-2.5 py-1`}>
          {language === 'ar' ? cfg.sub.ar : cfg.sub.en}
        </span>
        {visibleSources.length > 0 ? (
          <span className="text-[10px] text-muted-foreground/60 font-medium">
            {visibleSources.length} {language === 'ar' ? 'مصادر' : 'sources'}
          </span>
        ) : null}
      </div>

      {/* ── Source chips strip ── */}
      {visibleSources.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {visibleSources.map((source, i) => (
            <SourceChip key={i} source={source} index={i} />
          ))}
        </div>
      ) : null}

      {/* ── Intro / summary ── */}
      {(visibleIntro || summary) ? (
        <p className="text-sm leading-relaxed text-foreground/85 px-0.5">
          {visibleIntro || summary}
        </p>
      ) : null}

      {/* ── Result cards grid ── */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {cards.map((card, index) => (
          <SearchCard
            key={`${card.title}-${index}`}
            card={card}
            searchType={searchType}
            language={language}
          />
        ))}
      </div>
    </div>
  );
}
