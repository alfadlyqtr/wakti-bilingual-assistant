import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';

export type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
};

interface SearchResultsTableProps {
  results: TavilyResult[];
  updatedAt?: string;
}

function hostFromUrl(url?: string): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Very light cleaner to strip cookie/privacy boilerplate and collapse whitespace
function cleanText(s?: string): string {
  if (!s) return '';
  let t = s
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Remove common boilerplate keywords quickly
  t = t.replace(/(consent|cookie|advertising|privacy|powered by onetrust|accept all|subscribe now|accept cookies)/gi, '').trim();
  return t;
}

// Simple sports parser: derive Winner, Loser, Score, Highlights from title/content
function parseSportsRow(r: TavilyResult): { winner: string; loser: string; score: string; highlights: string } | null {
  const title = cleanText(r.title) || '';
  const content = cleanText(r.content) || '';

  // Prefer parsing from title
  const titleScoreMatch = title.match(/\b(\d+)\s*[-–x:]\s*(\d+)\b/);
  const fallbackScoreMatch = !titleScoreMatch ? content.match(/\b(\d+)\s*[-–x:]\s*(\d+)\b/) : null;
  const scoreMatch = titleScoreMatch || fallbackScoreMatch;
  const score = scoreMatch ? `${scoreMatch[1]}-${scoreMatch[2]}` : '';

  // Extract team names primarily from title
  let teamA = '', teamB = '';
  const vsTitle = title.match(/([^,;\-\|]+?)\s*(?:vs\.?| v | vs | @ | over | beat| beats| defeats| def\.)\s*([^,;\-\|\(\[]+)/i);
  if (vsTitle) {
    teamA = cleanTeam(vsTitle[1]);
    teamB = cleanTeam(vsTitle[2]);
  } else {
    const vsContent = content.match(/([^,;\-\|]+?)\s*(?:vs\.?| v | vs | @ | over | beat| beats| defeats| def\.)\s*([^,;\-\|\(\[]+)/i);
    if (vsContent) {
      teamA = cleanTeam(vsContent[1]);
      teamB = cleanTeam(vsContent[2]);
    }
  }

  // Confidence gate: need a score AND two team-like tokens
  if (!score || !teamA || !teamB) return null;

  // Decide winner/loser
  let winner = '', loser = '';
  const a = parseInt(scoreMatch![1]);
  const b = parseInt(scoreMatch![2]);
  if (!Number.isNaN(a) && !Number.isNaN(b)) {
    if (a > b) { winner = teamA; loser = teamB; }
    else if (b > a) { winner = teamB; loser = teamA; }
  }
  if (!winner) {
    // Use verbal hint if present
    const lower = title.toLowerCase();
    if (/(def\.|defeats|beats|beat|over)/i.test(lower)) { winner = teamA; loser = teamB; }
  }

  // Highlights: first 1–2 sentences, <= 140 chars
  let highlightsSrc = titleScoreMatch ? content : (content || title); // if score already in title, prefer content details
  let highlights = cleanText(highlightsSrc).replace(/[#*_`]+/g, '').trim();
  const sentences = highlights.split(/(?<=[\.\!\?])\s+/).filter(Boolean);
  highlights = [sentences[0], sentences[1]].filter(Boolean).join(' ');
  if (highlights.length > 140) highlights = highlights.slice(0, 140).trimEnd() + '…';

  return { winner, loser, score, highlights: highlights || '—' };
}

function cleanTeam(s?: string): string {
  if (!s) return '';
  return s
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\b(Game\s*Recap|Highlights|Preview|Report|Live\s*Blog)\b/gi, '')
    .replace(/\b(NHL\.com|NBA\.com|MLB\.com|ESPN|TSN|Sportsnet|BBC|Sky\s*Sports)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function SearchResultsTable({ results, updatedAt }: SearchResultsTableProps) {
  const { language } = useTheme();
  const ar = language === 'ar';

  const headers = {
    winner: ar ? 'الفائز' : 'Winner',
    loser: ar ? 'الخاسر' : 'Loser',
    score: ar ? 'النتيجة' : 'Score',
    highlights: ar ? 'أبرز اللحظات' : 'Highlights',
    source: ar ? 'المصدر' : 'Source',
    updated: ar ? 'آخر تحديث' : 'Updated'
  };

  if (!Array.isArray(results) || results.length === 0) return null;

  // Map results to simple sports rows; if none parse, fall back to generic table
  const rows = results
    .map(r => ({ r, parsed: parseSportsRow(r) }))
    .filter(x => !!x.parsed);

  if (rows.length === 0) {
    // Fallback generic minimal table
    return (
      <div className="w-full">
        {updatedAt ? (
          <div className="text-[11px] text-muted-foreground mb-2">{headers.updated}: {updatedAt}</div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0">
              <tr>
                <th className="border border-border px-2 py-1 bg-muted/40 text-left whitespace-nowrap">{ar ? 'العنوان' : 'Title'}</th>
                <th className="border border-border px-2 py-1 bg-muted/40 text-left whitespace-nowrap">{headers.source}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const src = hostFromUrl(r.url);
                const title = r.title || src || '-';
                return (
                  <tr key={i} className={i % 2 === 0 ? 'bg-transparent' : 'bg-muted/20 hover:bg-muted/30'}>
                    <td className="border border-border px-2 py-1 align-top">
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {title}
                        </a>
                      ) : (
                        <span>{title}</span>
                      )}
                    </td>
                    <td className="border border-border px-2 py-1 align-top text-muted-foreground whitespace-nowrap">{src || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {updatedAt ? (
        <div className="text-[11px] text-muted-foreground mb-2">{headers.updated}: {updatedAt}</div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0">
            <tr>
              <th className="border border-border px-2 py-1 bg-muted/40 text-left whitespace-nowrap">{headers.winner}</th>
              <th className="border border-border px-2 py-1 bg-muted/40 text-left whitespace-nowrap">{headers.loser}</th>
              <th className="border border-border px-2 py-1 bg-muted/40 text-center whitespace-nowrap">{headers.score}</th>
              <th className="border border-border px-2 py-1 bg-muted/40 text-left">{headers.highlights}</th>
              <th className="border border-border px-2 py-1 bg-muted/40 text-left whitespace-nowrap">{headers.source}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, parsed }, i) => {
              const src = hostFromUrl(r.url);
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-transparent' : 'bg-muted/20 hover:bg-muted/30'}>
                  <td className="border border-border px-2 py-1 align-top font-medium">{parsed!.winner}</td>
                  <td className="border border-border px-2 py-1 align-top">{parsed!.loser}</td>
                  <td className="border border-border px-2 py-1 align-top text-center whitespace-nowrap">{parsed!.score}</td>
                  <td className="border border-border px-2 py-1 align-top"><span className="line-clamp-2 leading-snug">{parsed!.highlights}</span></td>
                  <td className="border border-border px-2 py-1 align-top text-muted-foreground whitespace-nowrap">
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{src || '-'}</a>
                    ) : (src || '-')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
