// Run from project root: node scripts/patch_music.mjs
import { readFileSync, writeFileSync } from 'fs';

const FILE = 'src/pages/MusicStudio.tsx';
const rawSrc = readFileSync(FILE, 'utf8');
// Normalize CRLF to LF for consistent processing
const src = rawSrc.replace(/\r\n/g, '\n');
const lines = src.split('\n');

function t(line) { return line.trim(); }
function find(predicate, start = 0) {
  for (let i = start; i < lines.length; i++) {
    if (predicate(lines[i])) return i;
  }
  return -1;
}

// Find the ComposeTab return( - the one near line 3270 that has space-y-4 on next line
let returnLineIdx = -1;
for (let i = 3200; i < 3400; i++) {
  if (t(lines[i]) === 'return (' && lines[i+1]?.includes('space-y-4')) {
    returnLineIdx = i; break;
  }
}
if (returnLineIdx < 0) throw new Error('return( not found');

const compDetailLineIdx = find(l => l.trim() === '{composeDetailsVisible && (', returnLineIdx);
if (compDetailLineIdx < 0) throw new Error('composeDetailsVisible line not found');

const styleToggleBtnLineIdx = find(l => l.includes("toggleMainSection('style')"), returnLineIdx);
if (styleToggleBtnLineIdx < 0) throw new Error('style toggle not found');
const styleToggleBtnStart = styleToggleBtnLineIdx - 2;

const musicStyleOpenLineIdx = find(l => l.trim() === '{musicStyleOpen && (', styleToggleBtnStart);
if (musicStyleOpenLineIdx < 0) throw new Error('musicStyleOpen conditional not found');
const musicStyleFragmentLineIdx = musicStyleOpenLineIdx + 1; // the `          <>`

let styleCloseIdx = -1;
for (let i = musicStyleFragmentLineIdx + 1; i < lines.length; i++) {
  if (lines[i].trim() === '</>' && lines[i+1]?.trim() === ')}' && lines[i+2]?.trim() === '</div>') {
    styleCloseIdx = i; break;
  }
}
if (styleCloseIdx < 0) throw new Error('style close not found');

const vocalsBtnLineIdx = find(l => l.includes("toggleMainSection('vocals')"), styleCloseIdx);
if (vocalsBtnLineIdx < 0) throw new Error('vocals toggle not found');
const vocalsCardStartIdx = vocalsBtnLineIdx - 3;
let vocalsCardEndIdx = -1;
for (let i = vocalsBtnLineIdx + 15; i < lines.length; i++) {
  if (lines[i] === '      </div>') { vocalsCardEndIdx = i; break; }
}
if (vocalsCardEndIdx < 0) throw new Error('vocals card end not found');

const lyricsBtnLineIdx = find(l => l.includes("toggleMainSection('lyrics')"), vocalsCardEndIdx);
if (lyricsBtnLineIdx < 0) throw new Error('lyrics toggle not found');
const lyricsCardStartIdx = lyricsBtnLineIdx - 3;
const lyricsOpenLineIdx = find(l => l.trim() === '{lyricsOpen && (', lyricsCardStartIdx);
if (lyricsOpenLineIdx < 0) throw new Error('lyricsOpen not found');
const lyricsContentStartIdx = lyricsOpenLineIdx + 1;

let lyricsOpenCloseIdx = -1;
for (let i = lyricsContentStartIdx + 5; i < lines.length; i++) {
  if (lines[i].trim() === ')}' && lines[i-1]?.includes('</div>') && lines[i+2]?.includes('lastError')) {
    lyricsOpenCloseIdx = i; break;
  }
}
if (lyricsOpenCloseIdx < 0) throw new Error('lyricsOpen close not found');

let lyricsOuterDivEnd = -1;
for (let i = lyricsOpenCloseIdx + 1; i < lines.length; i++) {
  if (lines[i] === '      </div>') { lyricsOuterDivEnd = i; break; }
}
if (lyricsOuterDivEnd < 0) throw new Error('lyrics outer div end not found');

// Verify lastError block location
const lastErrorLineIdx = find(l => l.trim().startsWith('{lastError &&'), lyricsOpenCloseIdx);
if (lastErrorLineIdx < 0) throw new Error('lastError not found');

console.log('All indices found:');
console.log('  returnLineIdx:', returnLineIdx);
console.log('  compDetailLineIdx:', compDetailLineIdx);
console.log('  styleToggleBtnStart:', styleToggleBtnStart);
console.log('  musicStyleOpenLineIdx:', musicStyleOpenLineIdx);
console.log('  styleCloseIdx:', styleCloseIdx);
console.log('  vocalsCardStartIdx:', vocalsCardStartIdx);
console.log('  vocalsCardEndIdx:', vocalsCardEndIdx);
console.log('  lyricsCardStartIdx:', lyricsCardStartIdx);
console.log('  lyricsContentStartIdx:', lyricsContentStartIdx);
console.log('  lyricsOpenCloseIdx:', lyricsOpenCloseIdx);
console.log('  lyricsOuterDivEnd:', lyricsOuterDivEnd);

// ── Now assemble the output ────────────────────────────────────────────────────

// SEGMENT A: everything before return( 
const segA = lines.slice(0, returnLineIdx);

// SEGMENT B: new helpers + Step 1 + Step 2 header (up to and including the `<>` fragment open)
const segB = [
  `  const goToStep = (step) => {`,
  `    setComposeStep(step);`,
  `    if (step === 1) { setTitleOpen(true); }`,
  `    if (step === 2) { setComposeDetailsVisible(true); setMusicStyleOpen(true); setStylesOpen(true); }`,
  `    if (step === 3) { setComposeDetailsVisible(true); setVocalsOpen(true); }`,
  `    if (step === 4) { setComposeDetailsVisible(true); setLyricsOpen(true); }`,
  `  };`,
  ``,
  `  const StepBar = ({ current }: { current: number }) => (`,
  `    <div className="flex items-center gap-1.5 mb-5">`,
  `      {[1,2,3,4].map((s) => (`,
  `        <div key={s} className={\`h-1 flex-1 rounded-full transition-all \${s <= current ? 'bg-[#060541] dark:bg-white/70' : 'bg-[#e4e6ed] dark:bg-white/10'}\`} />`,
  `      ))}`,
  `    </div>`,
  `  );`,
  ``,
  `  const TrackChip = () => (`,
  `    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#f7f8fc] dark:bg-white/[0.04] border border-[#e4e6ed] dark:border-white/5 mb-1">`,
  `      <span className="text-[10px] font-bold uppercase tracking-wider text-[#858384] dark:text-white/40">{isAr ? '\u0627\u0644\u0623\u063a\u0646\u064a\u0629' : 'Track'}</span>`,
  `      <span className="text-sm font-semibold text-[#060541] dark:text-white truncate">{title}</span>`,
  `    </div>`,
  `  );`,
  ``,
  `  const BackBtn = ({ toStep }: { toStep: 1|2|3|4 }) => (`,
  `    <button`,
  `      type="button"`,
  `      onClick={() => goToStep(toStep)}`,
  `      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#606062] dark:text-white/40 hover:text-[#060541] dark:hover:text-white/80 transition-colors mb-3"`,
  `    >`,
  `      <ArrowRight className="h-3.5 w-3.5 rotate-180" />`,
  `      {isAr ? '\u0631\u062c\u0648\u0639' : 'Back'}`,
  `    </button>`,
  `  );`,
  ``,
  `  const cardCls = "rounded-2xl border border-[#d9dde7] dark:border-white/10 bg-white dark:bg-white/[0.02] shadow-[0_10px_30px_rgba(6,5,65,0.08)] dark:shadow-none p-5 sm:p-4";`,
  ``,
  `  return (`,
  `    <div className="space-y-4">`,
  ``,
  `      {/* \u2500\u2500 STEP 1: TITLE \u2500\u2500 */}`,
  `      {composeStep === 1 && (`,
  `        <div className={cardCls}>`,
  `          <StepBar current={1} />`,
  `          <div className="text-center pb-5">`,
  `            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#f7f8fc] dark:bg-white/[0.04] border border-[#e4e6ed] dark:border-white/10 mb-4">`,
  `              <Music className="h-7 w-7 text-[#060541] dark:text-white/60" />`,
  `            </div>`,
  `            <h2 className="text-lg font-bold text-[#060541] dark:text-white mb-1">`,
  `              {isAr ? '\u0645\u0631\u062d\u0628\u0627\u064b \u0628\u0643 \u0641\u064a \u0627\u0633\u062a\u0648\u062f\u064a\u0648 \u0627\u0644\u0645\u0648\u0633\u064a\u0642\u0649' : 'Welcome to Music Studio'}`,
  `            </h2>`,
  `            <p className="text-xs text-[#606062] dark:text-white/50 leading-relaxed">`,
  `              {isAr ? '\u0644\u0646\u0628\u062f\u0623! \u0645\u0627 \u0647\u0648 \u0639\u0646\u0648\u0627\u0646 \u0623\u063a\u0646\u064a\u062a\u0643\u061f' : "Let's start \u2014 what's your track title?"}`,
  `            </p>`,
  `          </div>`,
  `          <div className="space-y-3">`,
  `            <Input`,
  `              value={title}`,
  `              onChange={(e) => setTitle(e.target.value.slice(0, 80))}`,
  `              placeholder={isAr ? '\u0627\u0633\u0645 \u0627\u0644\u0623\u063a\u0646\u064a\u0629...' : 'Track title...'}`,
  `              className="bg-white dark:bg-white/[0.04] border-[#d9dde7] dark:border-white/10 focus:border-sky-400/60 focus:ring-sky-400/20 rounded-2xl h-12 text-[#060541] dark:text-white"`,
  `              maxLength={80}`,
  `            />`,
  `            <div className="flex items-center justify-between">`,
  `              <span className="text-[10px] text-[#858384] dark:text-white/30">{title.length}/80</span>`,
  `              {title.trim().length > 0 && (`,
  `                <button`,
  `                  type="button"`,
  `                  onClick={() => goToStep(2)}`,
  `                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#060541] dark:bg-white/10 hover:opacity-90 text-white active:scale-95 transition-all"`,
  `                >`,
  `                  {isAr ? '\u0627\u0644\u062a\u0627\u0644\u064a' : 'Next'}`,
  `                  <ArrowRight className="h-3.5 w-3.5" />`,
  `                </button>`,
  `              )}`,
  `            </div>`,
  `          </div>`,
  `        </div>`,
  `      )}`,
  ``,
  `      {/* \u2500\u2500 STEP 2: MUSIC STYLE \u2500\u2500 */}`,
  `      {composeStep === 2 && composeDetailsVisible && (`,
  `        <div className={\`\${cardCls} space-y-3\`}>`,
  `          <StepBar current={2} />`,
  `          <BackBtn toStep={1} />`,
  `          <TrackChip />`,
  `          <div className="flex items-center justify-between pb-1">`,
  `            <div className="flex items-center gap-2">`,
  `              <Music className="h-5 w-5 text-sky-400" />`,
  `              <span className="text-sm font-bold text-[#060541] dark:text-white uppercase tracking-wider">{isAr ? '\u0623\u0633\u0644\u0648\u0628 \u0627\u0644\u0645\u0648\u0633\u064a\u0642\u0649' : 'Music Style'}</span>`,
  `            </div>`,
  `            <button`,
  `              type="button"`,
  `              onClick={() => goToStep(3)}`,
  `              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-semibold bg-[#060541] dark:bg-white/10 hover:opacity-90 text-white active:scale-95 transition-all"`,
  `            >`,
  `              {isAr ? '\u0627\u0644\u062a\u0627\u0644\u064a: \u0627\u0644\u0635\u0648\u062a' : 'Next: Vocals'}`,
  `              <ArrowRight className="h-3.5 w-3.5" />`,
  `            </button>`,
  `          </div>`,
  `          <>`,
];

// SEGMENT C: original music style inner content (from musicStyleFragmentLineIdx+1 to styleCloseIdx-1)
// i.e. the content inside {musicStyleOpen && (<> ... </>)} — everything between the <> and </>
const segC = lines.slice(musicStyleFragmentLineIdx + 1, styleCloseIdx);

// SEGMENT D: Step 2 closing + Step 3 VOCALS
const segD = [
  `          </>`,
  `        </div>`,
  `      )}`,
  ``,
  `      {/* \u2500\u2500 STEP 3: VOCALS \u2500\u2500 */}`,
  `      {composeStep === 3 && composeDetailsVisible && (`,
  `        <div className={\`\${cardCls} space-y-3\`}>`,
  `          <StepBar current={3} />`,
  `          <BackBtn toStep={2} />`,
  `          <TrackChip />`,
  `          <div className="flex items-center gap-2 pb-1">`,
  `            <Mic className="h-5 w-5 text-emerald-400" />`,
  `            <span className="text-sm font-bold text-[#060541] dark:text-white uppercase tracking-wider">{isAr ? '\u0627\u0644\u0635\u0648\u062a' : 'Vocals'}</span>`,
  `            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">{isAr ? '\u0627\u062e\u062a\u064a\u0627\u0631\u064a' : 'Optional'}</span>`,
  `          </div>`,
];

// SEGMENT E: original vocals content (the vocalsOpen && ( inner div content)
// vocalsCardStartIdx is the outer <div, we need content from inside the vocalsOpen block
// Find {vocalsOpen && ( line
const vocalsOpenLineIdx = find(l => l.trim() === '{vocalsOpen && (', vocalsCardStartIdx);
const vocalsContentStart = vocalsOpenLineIdx + 1; // <div className="flex flex-wrap gap-2">
// Find vocalsOpen close: `          </div>` then `        )}`
let vocalsOpenCloseIdx = -1;
for (let i = vocalsContentStart + 1; i < vocalsCardEndIdx; i++) {
  if (lines[i].trim() === ')}' && lines[i-1]?.includes('</div>')) {
    vocalsOpenCloseIdx = i; break;
  }
}
const segE = lines.slice(vocalsContentStart, vocalsOpenCloseIdx); // the flex-wrap div with buttons

const segF = [
  `          <div className="flex justify-end pt-2">`,
  `            <button`,
  `              type="button"`,
  `              onClick={() => goToStep(4)}`,
  `              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-semibold bg-[#060541] dark:bg-white/10 hover:opacity-90 text-white active:scale-95 transition-all"`,
  `            >`,
  `              {isAr ? '\u0627\u0644\u062a\u0627\u0644\u064a: \u0627\u0644\u0643\u0644\u0645\u0627\u062a' : 'Next: Lyrics'}`,
  `              <ArrowRight className="h-3.5 w-3.5" />`,
  `            </button>`,
  `          </div>`,
  `        </div>`,
  `      )}`,
  ``,
  `      {/* \u2500\u2500 STEP 4: LYRICS \u2500\u2500 */}`,
  `      {composeStep === 4 && composeDetailsVisible && (`,
  `        <div className={\`\${cardCls} space-y-3\`}>`,
  `          <StepBar current={4} />`,
  `          <BackBtn toStep={3} />`,
  `          <TrackChip />`,
  `          <div className="flex items-center gap-2 pb-1">`,
  `            <span className="text-sm font-bold text-[#060541] dark:text-white uppercase tracking-wider">{isAr ? '\u0627\u0644\u0643\u0644\u0645\u0627\u062a' : 'Lyrics'}</span>`,
  `            <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-300">{isAr ? '\u0645\u0637\u0644\u0648\u0628' : 'Must'}</span>`,
  `          </div>`,
];

// SEGMENT G: original lyrics content (from lyricsContentStartIdx to lyricsOpenCloseIdx-1)
const segG = lines.slice(lyricsContentStartIdx, lyricsOpenCloseIdx);

// SEGMENT H: lastError block (from lyricsOpenCloseIdx+1 to lyricsOuterDivEnd-1) + step 4 close
const segH_lastError = lines.slice(lyricsOpenCloseIdx + 1, lyricsOuterDivEnd);
const segH = [
  ...segH_lastError,
  `        </div>`,
  `      )}`,
];

// SEGMENT I: everything after lyricsOuterDivEnd (the results section + end of component)
const segI = lines.slice(lyricsOuterDivEnd + 1);

// Also need to add composeStep state
const STATE_LINE = `  const [composeDetailsVisible, setComposeDetailsVisible] = useState(false);`;
const stateLineIdx = find(l => l === STATE_LINE);
if (stateLineIdx < 0) throw new Error('state line not found');

// Build final output
const out = [
  ...lines.slice(0, stateLineIdx),
  STATE_LINE,
  `  const [composeStep, setComposeStep] = useState<1|2|3|4>(1);`,
  ...lines.slice(stateLineIdx + 1, returnLineIdx),
  ...segB,
  ...segC,
  ...segD,
  ...segE,
  ...segF,
  ...segG,
  ...segH,
  ...segI,
].join('\n');

writeFileSync(FILE, out, 'utf8');
console.log('SUCCESS: MusicStudio.tsx patched with 4-step Compose UI');
