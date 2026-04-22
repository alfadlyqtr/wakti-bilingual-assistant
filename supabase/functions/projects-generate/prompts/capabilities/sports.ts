export const SPORTS_CAPABILITY = `
## ⚽ SPORTS / TEAMS / NEWS / STANDINGS / ROSTERS

Use this capability for fan sites, club pages, national team pages, standings tables, player rosters, match summaries, fixture sections, and sports news.

### LIVE-DATA RULES
1. If the request asks for current, latest, live, recent, today, standings, roster, squad, fixtures, or news, treat freshness as required.
2. When Google Search grounding is available, rely on grounded results for current facts.
3. NEVER invent standings positions, win/loss records, upcoming fixtures, transfer rumors, or player rosters.
4. If live/current data cannot be confirmed, the UI must say so clearly with a graceful empty or unavailable state.
5. NEVER present static placeholder sports facts as if they are current.

### NEWS PAGE RULES
1. A news page must support both a list view and an article detail view.
2. Clicking a news card must open a real detail panel, modal, route, or expanded article state.
3. If the site uses backend blog posts, follow the blog capability rules.
4. If the request specifically asks for current sports news, do not hardcode old example articles as if they are live headlines.
5. Show publish date and source context when available.

### STANDINGS RULES
1. Standings tables must only render verified rows.
2. If verified standings are unavailable, render a friendly unavailable state instead of fake rows.
3. Label the competition clearly, for example FIFA, AFC Asian Cup qualifiers, World Cup qualifiers, or another requested competition.
4. Never mix competitions into one table.

### ROSTER RULES
1. Do not output a tiny fake roster unless the request explicitly asks for a mini featured-players section.
2. If a full squad is requested, either render a verified roster or a clearly labeled unavailable state.
3. Never invent player headshots.
4. If verified player images are unavailable, use a neutral placeholder card, initials avatar, silhouette, or team-themed placeholder.
5. Keep player name, position, captain badge, and club/team metadata separate so the UI can degrade gracefully when some fields are missing.

### QATAR NATIONAL TEAM RULES
1. Use Qatar national team identity consistently: maroon and white, Al Annabi / The Maroons when appropriate.
2. Do not invent Qatar squad members, standings, or match results.
3. If the request is about Qatar football, prefer Qatar-specific sports context over generic club-football filler.
4. Avoid random player photos that are not verified to match the roster item.

### UI RULES
1. Sports pages should feel complete even when data is missing: loading, empty, error, and stale-data states are required.
2. If data freshness matters, show a last updated label when possible.
3. Separate featured players, latest news, standings, fixtures, and merchandise into distinct sections with clear headings.
`;
