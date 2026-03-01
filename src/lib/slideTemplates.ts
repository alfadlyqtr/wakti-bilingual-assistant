/**
 * Hand-crafted HTML slide templates for AI Enhance
 * Each template is a beautiful, production-ready design
 * The edge function injects content into these templates
 */

export interface SlideTemplate {
  id: string;
  name: string;
  nameAr: string;
  keywords: string[]; // Keywords that map to this template
  preview: string; // Emoji or icon for preview
  buildHtml: (data: SlideData) => string;
}

export interface SlideData {
  title: string;
  subtitle?: string;
  bullets: string[];
  imageUrl?: string;
  isRtl: boolean;
}

// Helper to escape HTML
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ============================================================================
// TEMPLATE 1: LUXURY DARK (Gold + Black)
// ============================================================================
const luxuryDark: SlideTemplate = {
  id: 'luxury-dark',
  name: 'Luxury Dark',
  nameAr: 'فاخر داكن',
  keywords: ['luxury', 'dark premium', 'elegant', 'amber gold'],
  preview: '✨',
  buildHtml: ({ title, subtitle, bullets, imageUrl, isRtl }) => `<!DOCTYPE html>
<html lang="${isRtl ? 'ar' : 'en'}" dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;font-family:'Inter',sans-serif}
body{background:linear-gradient(135deg,#0a0a0a 0%,#1a1510 50%,#0a0a0a 100%);color:#f5f0e8;display:flex}
.image-col{width:${imageUrl ? '45%' : '0'};height:100%;position:relative;${imageUrl ? '' : 'display:none'}}
.image-col img{width:100%;height:100%;object-fit:cover}
.image-col::after{content:'';position:absolute;inset:0;background:linear-gradient(${isRtl ? '270deg' : '90deg'},transparent 0%,#0a0a0a 100%)}
.content-col{flex:1;padding:80px 70px;display:flex;flex-direction:column;justify-content:center}
h1{font-family:'Playfair Display',serif;font-size:${imageUrl ? '68px' : '80px'};font-weight:700;background:linear-gradient(135deg,#d4af37 0%,#f5d67a 50%,#d4af37 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1.15;margin-bottom:20px;text-shadow:0 4px 30px rgba(212,175,55,0.3)}
h2{font-size:32px;color:#c9b896;font-weight:400;margin-bottom:50px;opacity:0.9}
.bullets{display:flex;flex-direction:column;gap:18px}
.bullet{background:linear-gradient(135deg,rgba(212,175,55,0.08) 0%,rgba(212,175,55,0.02) 100%);border-${isRtl ? 'right' : 'left'}:4px solid #d4af37;padding:22px 28px;border-radius:0 12px 12px 0;backdrop-filter:blur(10px)}
.bullet::before{content:'◆';color:#d4af37;margin-${isRtl ? 'left' : 'right'}:14px;font-size:12px}
.bullet span{font-size:26px;line-height:1.5;color:#f5f0e8}
.brand{position:absolute;${isRtl ? 'right' : 'left'}:24px;bottom:20px;font-size:16px;opacity:0.5;font-weight:600;color:#d4af37}
</style>
</head>
<body>
${imageUrl ? `<div class="image-col"><img src="${esc(imageUrl)}" alt=""></div>` : ''}
<div class="content-col">
<h1>${esc(title)}</h1>
${subtitle ? `<h2>${esc(subtitle)}</h2>` : ''}
<div class="bullets">
${bullets.map(b => `<div class="bullet"><span>${esc(b)}</span></div>`).join('\n')}
</div>
</div>
<div class="brand">Wakti AI</div>
</body>
</html>`,
};

// ============================================================================
// TEMPLATE 2: CINEMATIC (Deep Blue + White)
// ============================================================================
const cinematic: SlideTemplate = {
  id: 'cinematic',
  name: 'Cinematic',
  nameAr: 'سينمائي',
  keywords: ['cinematic', 'dramatic', 'deep blue', 'bold'],
  preview: '🎬',
  buildHtml: ({ title, subtitle, bullets, imageUrl, isRtl }) => `<!DOCTYPE html>
<html lang="${isRtl ? 'ar' : 'en'}" dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Roboto:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;font-family:'Roboto',sans-serif}
body{background:linear-gradient(180deg,#0a1628 0%,#0d1f3c 50%,#061224 100%);color:#fff;display:flex}
.image-col{width:${imageUrl ? '42%' : '0'};height:100%;position:relative;${imageUrl ? '' : 'display:none'}}
.image-col img{width:100%;height:100%;object-fit:cover}
.image-col::after{content:'';position:absolute;inset:0;background:linear-gradient(${isRtl ? '270deg' : '90deg'},transparent 30%,#0a1628 100%)}
.content-col{flex:1;padding:80px 70px;display:flex;flex-direction:column;justify-content:center}
h1{font-family:'Bebas Neue',sans-serif;font-size:${imageUrl ? '82px' : '96px'};font-weight:400;letter-spacing:3px;color:#fff;line-height:1.1;margin-bottom:16px;text-shadow:0 0 60px rgba(59,130,246,0.5),0 4px 20px rgba(0,0,0,0.8)}
h2{font-size:30px;color:#60a5fa;font-weight:400;margin-bottom:50px;letter-spacing:1px}
.bullets{display:flex;flex-direction:column;gap:16px}
.bullet{background:rgba(59,130,246,0.1);border-${isRtl ? 'right' : 'left'}:5px solid #3b82f6;padding:20px 26px;border-radius:0 8px 8px 0;box-shadow:0 0 30px rgba(59,130,246,0.15)}
.bullet::before{content:'▸';color:#60a5fa;margin-${isRtl ? 'left' : 'right'}:12px;font-size:18px}
.bullet span{font-size:26px;line-height:1.5;color:#e0e7ff}
.brand{position:absolute;${isRtl ? 'right' : 'left'}:24px;bottom:20px;font-size:16px;opacity:0.5;font-weight:600;color:#60a5fa}
</style>
</head>
<body>
${imageUrl ? `<div class="image-col"><img src="${esc(imageUrl)}" alt=""></div>` : ''}
<div class="content-col">
<h1>${esc(title)}</h1>
${subtitle ? `<h2>${esc(subtitle)}</h2>` : ''}
<div class="bullets">
${bullets.map(b => `<div class="bullet"><span>${esc(b)}</span></div>`).join('\n')}
</div>
</div>
<div class="brand">Wakti AI</div>
</body>
</html>`,
};

// ============================================================================
// TEMPLATE 3: GLASSMORPHISM (Frosted Glass + Gradients)
// ============================================================================
const glassmorphism: SlideTemplate = {
  id: 'glassmorphism',
  name: 'Glassmorphism',
  nameAr: 'زجاجي',
  keywords: ['glassmorphism', 'futuristic', 'modern', 'neon'],
  preview: '🔮',
  buildHtml: ({ title, subtitle, bullets, imageUrl, isRtl }) => `<!DOCTYPE html>
<html lang="${isRtl ? 'ar' : 'en'}" dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;font-family:'Space Grotesk',sans-serif}
body{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f0f23 100%);color:#fff;position:relative}
body::before{content:'';position:absolute;width:600px;height:600px;background:radial-gradient(circle,rgba(139,92,246,0.4) 0%,transparent 70%);top:-200px;right:-100px;border-radius:50%}
body::after{content:'';position:absolute;width:500px;height:500px;background:radial-gradient(circle,rgba(6,182,212,0.3) 0%,transparent 70%);bottom:-150px;left:-100px;border-radius:50%}
.container{display:flex;height:100%;position:relative;z-index:1}
.image-col{width:${imageUrl ? '42%' : '0'};height:100%;position:relative;${imageUrl ? '' : 'display:none'}}
.image-col img{width:100%;height:100%;object-fit:cover;border-radius:0 40px 40px 0}
.image-col::after{content:'';position:absolute;inset:0;background:linear-gradient(${isRtl ? '270deg' : '90deg'},transparent 50%,#1a1a2e 100%);border-radius:0 40px 40px 0}
.content-col{flex:1;padding:80px 70px;display:flex;flex-direction:column;justify-content:center}
h1{font-size:${imageUrl ? '64px' : '76px'};font-weight:700;background:linear-gradient(135deg,#a78bfa 0%,#22d3ee 50%,#a78bfa 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1.15;margin-bottom:16px}
h2{font-size:28px;color:#94a3b8;font-weight:500;margin-bottom:45px}
.bullets{display:flex;flex-direction:column;gap:16px}
.bullet{background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);padding:22px 28px;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3)}
.bullet::before{content:'◈';background:linear-gradient(135deg,#a78bfa,#22d3ee);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-${isRtl ? 'left' : 'right'}:14px;font-size:16px}
.bullet span{font-size:25px;line-height:1.5;color:#e2e8f0}
.brand{position:absolute;${isRtl ? 'right' : 'left'}:24px;bottom:20px;font-size:16px;opacity:0.5;font-weight:600;color:#a78bfa;z-index:2}
</style>
</head>
<body>
<div class="container">
${imageUrl ? `<div class="image-col"><img src="${esc(imageUrl)}" alt=""></div>` : ''}
<div class="content-col">
<h1>${esc(title)}</h1>
${subtitle ? `<h2>${esc(subtitle)}</h2>` : ''}
<div class="bullets">
${bullets.map(b => `<div class="bullet"><span>${esc(b)}</span></div>`).join('\n')}
</div>
</div>
</div>
<div class="brand">Wakti AI</div>
</body>
</html>`,
};

// ============================================================================
// TEMPLATE 4: CORPORATE (Clean + Professional)
// ============================================================================
const corporate: SlideTemplate = {
  id: 'corporate',
  name: 'Corporate',
  nameAr: 'احترافي',
  keywords: ['corporate', 'professional', 'clean modern', 'minimal'],
  preview: '💼',
  buildHtml: ({ title, subtitle, bullets, imageUrl, isRtl }) => `<!DOCTYPE html>
<html lang="${isRtl ? 'ar' : 'en'}" dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;font-family:'Plus Jakarta Sans',sans-serif}
body{background:#ffffff;color:#1e293b;display:flex}
.accent-bar{position:absolute;top:0;${isRtl ? 'right' : 'left'}:0;width:8px;height:100%;background:linear-gradient(180deg,#0ea5e9 0%,#0284c7 100%)}
.image-col{width:${imageUrl ? '44%' : '0'};height:100%;position:relative;${imageUrl ? '' : 'display:none'}}
.image-col img{width:100%;height:100%;object-fit:cover}
.content-col{flex:1;padding:80px 70px;display:flex;flex-direction:column;justify-content:center;${isRtl ? 'padding-right:90px' : 'padding-left:90px'}}
h1{font-size:${imageUrl ? '62px' : '72px'};font-weight:700;color:#0f172a;line-height:1.15;margin-bottom:16px}
h2{font-size:28px;color:#64748b;font-weight:500;margin-bottom:50px}
.bullets{display:flex;flex-direction:column;gap:18px}
.bullet{background:#f8fafc;border-${isRtl ? 'right' : 'left'}:4px solid #0ea5e9;padding:22px 28px;border-radius:0 10px 10px 0;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
.bullet::before{content:'●';color:#0ea5e9;margin-${isRtl ? 'left' : 'right'}:14px;font-size:10px}
.bullet span{font-size:25px;line-height:1.5;color:#334155}
.brand{position:absolute;${isRtl ? 'right' : 'left'}:24px;bottom:20px;font-size:16px;opacity:0.5;font-weight:600;color:#0ea5e9}
</style>
</head>
<body>
<div class="accent-bar"></div>
${imageUrl ? `<div class="image-col"><img src="${esc(imageUrl)}" alt=""></div>` : ''}
<div class="content-col">
<h1>${esc(title)}</h1>
${subtitle ? `<h2>${esc(subtitle)}</h2>` : ''}
<div class="bullets">
${bullets.map(b => `<div class="bullet"><span>${esc(b)}</span></div>`).join('\n')}
</div>
</div>
<div class="brand">Wakti AI</div>
</body>
</html>`,
};

// ============================================================================
// TEMPLATE 5: EDITORIAL (Magazine Style)
// ============================================================================
const editorial: SlideTemplate = {
  id: 'editorial',
  name: 'Editorial',
  nameAr: 'مجلة',
  keywords: ['editorial', 'magazine', 'retro', 'warm tones'],
  preview: '📰',
  buildHtml: ({ title, subtitle, bullets, imageUrl, isRtl }) => `<!DOCTYPE html>
<html lang="${isRtl ? 'ar' : 'en'}" dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Source+Sans+3:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;font-family:'Source Sans 3',sans-serif}
body{background:#fef7ed;color:#44403c;display:flex}
.image-col{width:${imageUrl ? '46%' : '0'};height:100%;position:relative;${imageUrl ? '' : 'display:none'}}
.image-col img{width:100%;height:100%;object-fit:cover}
.content-col{flex:1;padding:80px 70px;display:flex;flex-direction:column;justify-content:center}
h1{font-family:'Fraunces',serif;font-size:${imageUrl ? '64px' : '78px'};font-weight:700;color:#7c2d12;line-height:1.12;margin-bottom:18px}
h2{font-size:28px;color:#a16207;font-weight:500;margin-bottom:45px;font-style:italic}
.bullets{display:flex;flex-direction:column;gap:16px}
.bullet{background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);padding:22px 28px;border-radius:8px;box-shadow:0 3px 12px rgba(161,98,7,0.1)}
.bullet::before{content:'❧';color:#b45309;margin-${isRtl ? 'left' : 'right'}:14px;font-size:18px}
.bullet span{font-size:25px;line-height:1.5;color:#78350f}
.brand{position:absolute;${isRtl ? 'right' : 'left'}:24px;bottom:20px;font-size:16px;opacity:0.5;font-weight:600;color:#b45309}
</style>
</head>
<body>
${imageUrl ? `<div class="image-col"><img src="${esc(imageUrl)}" alt=""></div>` : ''}
<div class="content-col">
<h1>${esc(title)}</h1>
${subtitle ? `<h2>${esc(subtitle)}</h2>` : ''}
<div class="bullets">
${bullets.map(b => `<div class="bullet"><span>${esc(b)}</span></div>`).join('\n')}
</div>
</div>
<div class="brand">Wakti AI</div>
</body>
</html>`,
};

// ============================================================================
// TEMPLATE 6: NEON CITY (Cyberpunk)
// ============================================================================
const neonCity: SlideTemplate = {
  id: 'neon-city',
  name: 'Neon City',
  nameAr: 'نيون',
  keywords: ['neon', 'energetic', 'playful', 'cyan teal', 'rose pink'],
  preview: '🌃',
  buildHtml: ({ title, subtitle, bullets, imageUrl, isRtl }) => `<!DOCTYPE html>
<html lang="${isRtl ? 'ar' : 'en'}" dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Exo+2:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;font-family:'Exo 2',sans-serif}
body{background:#0a0a0f;color:#fff;display:flex;position:relative}
body::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(236,72,153,0.1) 0%,transparent 50%,rgba(6,182,212,0.1) 100%)}
.image-col{width:${imageUrl ? '42%' : '0'};height:100%;position:relative;z-index:1;${imageUrl ? '' : 'display:none'}}
.image-col img{width:100%;height:100%;object-fit:cover}
.image-col::after{content:'';position:absolute;inset:0;background:linear-gradient(${isRtl ? '270deg' : '90deg'},transparent 40%,#0a0a0f 100%)}
.content-col{flex:1;padding:80px 70px;display:flex;flex-direction:column;justify-content:center;position:relative;z-index:1}
h1{font-family:'Orbitron',sans-serif;font-size:${imageUrl ? '58px' : '70px'};font-weight:800;background:linear-gradient(90deg,#ec4899 0%,#06b6d4 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1.15;margin-bottom:16px;text-shadow:0 0 60px rgba(236,72,153,0.5)}
h2{font-size:26px;color:#67e8f9;font-weight:500;margin-bottom:45px;text-transform:uppercase;letter-spacing:3px}
.bullets{display:flex;flex-direction:column;gap:14px}
.bullet{background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.3);border-${isRtl ? 'right' : 'left'}:4px solid #06b6d4;padding:20px 26px;border-radius:0 12px 12px 0;box-shadow:0 0 20px rgba(6,182,212,0.15),inset 0 0 20px rgba(6,182,212,0.05)}
.bullet::before{content:'⬡';color:#ec4899;margin-${isRtl ? 'left' : 'right'}:12px;font-size:14px}
.bullet span{font-size:24px;line-height:1.5;color:#e0f2fe}
.brand{position:absolute;${isRtl ? 'right' : 'left'}:24px;bottom:20px;font-size:16px;opacity:0.6;font-weight:600;color:#06b6d4;z-index:2}
</style>
</head>
<body>
${imageUrl ? `<div class="image-col"><img src="${esc(imageUrl)}" alt=""></div>` : ''}
<div class="content-col">
<h1>${esc(title)}</h1>
${subtitle ? `<h2>${esc(subtitle)}</h2>` : ''}
<div class="bullets">
${bullets.map(b => `<div class="bullet"><span>${esc(b)}</span></div>`).join('\n')}
</div>
</div>
<div class="brand">Wakti AI</div>
</body>
</html>`,
};

// ============================================================================
// TEMPLATE 7: EMERALD (Nature/Green)
// ============================================================================
const emerald: SlideTemplate = {
  id: 'emerald',
  name: 'Emerald',
  nameAr: 'زمردي',
  keywords: ['emerald', 'calm', 'serious'],
  preview: '🌿',
  buildHtml: ({ title, subtitle, bullets, imageUrl, isRtl }) => `<!DOCTYPE html>
<html lang="${isRtl ? 'ar' : 'en'}" dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;font-family:'DM Sans',sans-serif}
body{background:linear-gradient(160deg,#022c22 0%,#064e3b 50%,#022c22 100%);color:#ecfdf5;display:flex}
.image-col{width:${imageUrl ? '44%' : '0'};height:100%;position:relative;${imageUrl ? '' : 'display:none'}}
.image-col img{width:100%;height:100%;object-fit:cover}
.image-col::after{content:'';position:absolute;inset:0;background:linear-gradient(${isRtl ? '270deg' : '90deg'},transparent 40%,#022c22 100%)}
.content-col{flex:1;padding:80px 70px;display:flex;flex-direction:column;justify-content:center}
h1{font-family:'DM Serif Display',serif;font-size:${imageUrl ? '66px' : '80px'};font-weight:400;color:#6ee7b7;line-height:1.12;margin-bottom:18px;text-shadow:0 4px 30px rgba(110,231,183,0.3)}
h2{font-size:28px;color:#a7f3d0;font-weight:400;margin-bottom:50px}
.bullets{display:flex;flex-direction:column;gap:16px}
.bullet{background:rgba(110,231,183,0.08);border-${isRtl ? 'right' : 'left'}:5px solid #10b981;padding:22px 28px;border-radius:0 10px 10px 0}
.bullet::before{content:'●';color:#34d399;margin-${isRtl ? 'left' : 'right'}:14px;font-size:12px}
.bullet span{font-size:25px;line-height:1.5;color:#d1fae5}
.brand{position:absolute;${isRtl ? 'right' : 'left'}:24px;bottom:20px;font-size:16px;opacity:0.5;font-weight:600;color:#6ee7b7}
</style>
</head>
<body>
${imageUrl ? `<div class="image-col"><img src="${esc(imageUrl)}" alt=""></div>` : ''}
<div class="content-col">
<h1>${esc(title)}</h1>
${subtitle ? `<h2>${esc(subtitle)}</h2>` : ''}
<div class="bullets">
${bullets.map(b => `<div class="bullet"><span>${esc(b)}</span></div>`).join('\n')}
</div>
</div>
<div class="brand">Wakti AI</div>
</body>
</html>`,
};

// ============================================================================
// TEMPLATE 8: CRIMSON (Bold Red/Dark)
// ============================================================================
const crimson: SlideTemplate = {
  id: 'crimson',
  name: 'Crimson',
  nameAr: 'قرمزي',
  keywords: ['crimson red', 'dramatic', 'bold'],
  preview: '🔴',
  buildHtml: ({ title, subtitle, bullets, imageUrl, isRtl }) => `<!DOCTYPE html>
<html lang="${isRtl ? 'ar' : 'en'}" dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Open+Sans:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;font-family:'Open Sans',sans-serif}
body{background:linear-gradient(135deg,#0f0f0f 0%,#1a0a0a 50%,#0f0f0f 100%);color:#fef2f2;display:flex}
.image-col{width:${imageUrl ? '43%' : '0'};height:100%;position:relative;${imageUrl ? '' : 'display:none'}}
.image-col img{width:100%;height:100%;object-fit:cover}
.image-col::after{content:'';position:absolute;inset:0;background:linear-gradient(${isRtl ? '270deg' : '90deg'},transparent 30%,#0f0f0f 100%)}
.content-col{flex:1;padding:80px 70px;display:flex;flex-direction:column;justify-content:center}
h1{font-family:'Oswald',sans-serif;font-size:${imageUrl ? '70px' : '86px'};font-weight:700;color:#fca5a5;line-height:1.1;margin-bottom:16px;text-transform:uppercase;letter-spacing:2px;text-shadow:0 0 40px rgba(239,68,68,0.4)}
h2{font-size:28px;color:#f87171;font-weight:500;margin-bottom:50px}
.bullets{display:flex;flex-direction:column;gap:16px}
.bullet{background:rgba(239,68,68,0.1);border-${isRtl ? 'right' : 'left'}:5px solid #dc2626;padding:22px 28px;border-radius:0 8px 8px 0}
.bullet::before{content:'▪';color:#ef4444;margin-${isRtl ? 'left' : 'right'}:14px;font-size:16px}
.bullet span{font-size:25px;line-height:1.5;color:#fee2e2}
.brand{position:absolute;${isRtl ? 'right' : 'left'}:24px;bottom:20px;font-size:16px;opacity:0.5;font-weight:600;color:#f87171}
</style>
</head>
<body>
${imageUrl ? `<div class="image-col"><img src="${esc(imageUrl)}" alt=""></div>` : ''}
<div class="content-col">
<h1>${esc(title)}</h1>
${subtitle ? `<h2>${esc(subtitle)}</h2>` : ''}
<div class="bullets">
${bullets.map(b => `<div class="bullet"><span>${esc(b)}</span></div>`).join('\n')}
</div>
</div>
<div class="brand">Wakti AI</div>
</body>
</html>`,
};

// ============================================================================
// TEMPLATE 9: PURPLE HAZE (Violet/Purple)
// ============================================================================
const purpleHaze: SlideTemplate = {
  id: 'purple-haze',
  name: 'Purple Haze',
  nameAr: 'بنفسجي',
  keywords: ['purple', 'elegant'],
  preview: '💜',
  buildHtml: ({ title, subtitle, bullets, imageUrl, isRtl }) => `<!DOCTYPE html>
<html lang="${isRtl ? 'ar' : 'en'}" dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;font-family:'Sora',sans-serif}
body{background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%);color:#f5f3ff;display:flex}
.image-col{width:${imageUrl ? '44%' : '0'};height:100%;position:relative;${imageUrl ? '' : 'display:none'}}
.image-col img{width:100%;height:100%;object-fit:cover}
.image-col::after{content:'';position:absolute;inset:0;background:linear-gradient(${isRtl ? '270deg' : '90deg'},transparent 40%,#1e1b4b 100%)}
.content-col{flex:1;padding:80px 70px;display:flex;flex-direction:column;justify-content:center}
h1{font-size:${imageUrl ? '64px' : '78px'};font-weight:700;background:linear-gradient(135deg,#c4b5fd 0%,#a78bfa 50%,#8b5cf6 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1.15;margin-bottom:18px}
h2{font-size:28px;color:#c4b5fd;font-weight:500;margin-bottom:50px}
.bullets{display:flex;flex-direction:column;gap:16px}
.bullet{background:rgba(167,139,250,0.1);border-${isRtl ? 'right' : 'left'}:5px solid #8b5cf6;padding:22px 28px;border-radius:0 12px 12px 0;box-shadow:0 0 25px rgba(139,92,246,0.15)}
.bullet::before{content:'◆';color:#a78bfa;margin-${isRtl ? 'left' : 'right'}:14px;font-size:12px}
.bullet span{font-size:25px;line-height:1.5;color:#ede9fe}
.brand{position:absolute;${isRtl ? 'right' : 'left'}:24px;bottom:20px;font-size:16px;opacity:0.5;font-weight:600;color:#a78bfa}
</style>
</head>
<body>
${imageUrl ? `<div class="image-col"><img src="${esc(imageUrl)}" alt=""></div>` : ''}
<div class="content-col">
<h1>${esc(title)}</h1>
${subtitle ? `<h2>${esc(subtitle)}</h2>` : ''}
<div class="bullets">
${bullets.map(b => `<div class="bullet"><span>${esc(b)}</span></div>`).join('\n')}
</div>
</div>
<div class="brand">Wakti AI</div>
</body>
</html>`,
};

// ============================================================================
// TEMPLATE 10: MONOCHROME (Black & White)
// ============================================================================
const monochrome: SlideTemplate = {
  id: 'monochrome',
  name: 'Monochrome',
  nameAr: 'أحادي',
  keywords: ['monochrome', 'minimal', 'brutalist'],
  preview: '⬛',
  buildHtml: ({ title, subtitle, bullets, imageUrl, isRtl }) => `<!DOCTYPE html>
<html lang="${isRtl ? 'ar' : 'en'}" dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;font-family:'Inter',sans-serif}
body{background:#0a0a0a;color:#fafafa;display:flex}
.image-col{width:${imageUrl ? '44%' : '0'};height:100%;position:relative;${imageUrl ? '' : 'display:none'}}
.image-col img{width:100%;height:100%;object-fit:cover;filter:grayscale(100%) contrast(1.1)}
.image-col::after{content:'';position:absolute;inset:0;background:linear-gradient(${isRtl ? '270deg' : '90deg'},transparent 50%,#0a0a0a 100%)}
.content-col{flex:1;padding:80px 70px;display:flex;flex-direction:column;justify-content:center}
h1{font-family:'Space Mono',monospace;font-size:${imageUrl ? '58px' : '72px'};font-weight:700;color:#fff;line-height:1.15;margin-bottom:18px;text-transform:uppercase;letter-spacing:-1px}
h2{font-size:26px;color:#a1a1aa;font-weight:400;margin-bottom:50px;font-family:'Space Mono',monospace}
.bullets{display:flex;flex-direction:column;gap:14px}
.bullet{background:#18181b;border-${isRtl ? 'right' : 'left'}:4px solid #fff;padding:22px 28px}
.bullet::before{content:'→';color:#fff;margin-${isRtl ? 'left' : 'right'}:14px;font-family:'Space Mono',monospace}
.bullet span{font-size:24px;line-height:1.5;color:#e4e4e7}
.brand{position:absolute;${isRtl ? 'right' : 'left'}:24px;bottom:20px;font-size:16px;opacity:0.4;font-weight:600;color:#fff;font-family:'Space Mono',monospace}
</style>
</head>
<body>
${imageUrl ? `<div class="image-col"><img src="${esc(imageUrl)}" alt=""></div>` : ''}
<div class="content-col">
<h1>${esc(title)}</h1>
${subtitle ? `<h2>${esc(subtitle)}</h2>` : ''}
<div class="bullets">
${bullets.map(b => `<div class="bullet"><span>${esc(b)}</span></div>`).join('\n')}
</div>
</div>
<div class="brand">Wakti AI</div>
</body>
</html>`,
};

// ============================================================================
// TEMPLATE 11: WAKTI DARK (Brand)
// ============================================================================
const waktiDark: SlideTemplate = {
  id: 'wakti-dark',
  name: 'Wakti Dark',
  nameAr: 'واكتي داكن',
  keywords: ['dark premium'],
  preview: '🌙',
  buildHtml: ({ title, subtitle, bullets, imageUrl, isRtl }) => `<!DOCTYPE html>
<html lang="${isRtl ? 'ar' : 'en'}" dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;font-family:'Inter',sans-serif}
body{background:#0c0f14;color:#f2f2f2;display:flex}
.image-col{width:${imageUrl ? '44%' : '0'};height:100%;position:relative;${imageUrl ? '' : 'display:none'}}
.image-col img{width:100%;height:100%;object-fit:cover}
.image-col::after{content:'';position:absolute;inset:0;background:linear-gradient(${isRtl ? '270deg' : '90deg'},transparent 40%,#0c0f14 100%)}
.content-col{flex:1;padding:80px 70px;display:flex;flex-direction:column;justify-content:center}
h1{font-size:${imageUrl ? '66px' : '80px'};font-weight:700;background:linear-gradient(135deg,hsl(210,100%,70%) 0%,hsl(280,70%,70%) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1.15;margin-bottom:18px}
h2{font-size:28px;color:#858384;font-weight:500;margin-bottom:50px}
.bullets{display:flex;flex-direction:column;gap:16px}
.bullet{background:rgba(133,131,132,0.08);border-${isRtl ? 'right' : 'left'}:4px solid hsl(210,100%,65%);padding:22px 28px;border-radius:0 10px 10px 0;box-shadow:0 0 30px rgba(96,96,98,0.1)}
.bullet::before{content:'●';background:linear-gradient(135deg,hsl(210,100%,65%),hsl(280,70%,65%));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-${isRtl ? 'left' : 'right'}:14px;font-size:12px}
.bullet span{font-size:25px;line-height:1.5;color:#f2f2f2}
.brand{position:absolute;${isRtl ? 'right' : 'left'}:24px;bottom:20px;font-size:16px;opacity:0.5;font-weight:600;background:linear-gradient(135deg,hsl(210,100%,65%),hsl(280,70%,65%));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
</style>
</head>
<body>
${imageUrl ? `<div class="image-col"><img src="${esc(imageUrl)}" alt=""></div>` : ''}
<div class="content-col">
<h1>${esc(title)}</h1>
${subtitle ? `<h2>${esc(subtitle)}</h2>` : ''}
<div class="bullets">
${bullets.map(b => `<div class="bullet"><span>${esc(b)}</span></div>`).join('\n')}
</div>
</div>
<div class="brand">Wakti AI</div>
</body>
</html>`,
};

// ============================================================================
// TEMPLATE 12: WAKTI LIGHT (Brand)
// ============================================================================
const waktiLight: SlideTemplate = {
  id: 'wakti-light',
  name: 'Wakti Light',
  nameAr: 'واكتي فاتح',
  keywords: [],
  preview: '☀️',
  buildHtml: ({ title, subtitle, bullets, imageUrl, isRtl }) => `<!DOCTYPE html>
<html lang="${isRtl ? 'ar' : 'en'}" dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;font-family:'Inter',sans-serif}
body{background:#fcfefd;color:#060541;display:flex}
.image-col{width:${imageUrl ? '44%' : '0'};height:100%;position:relative;${imageUrl ? '' : 'display:none'}}
.image-col img{width:100%;height:100%;object-fit:cover}
.image-col::after{content:'';position:absolute;inset:0;background:linear-gradient(${isRtl ? '270deg' : '90deg'},transparent 50%,#fcfefd 100%)}
.content-col{flex:1;padding:80px 70px;display:flex;flex-direction:column;justify-content:center}
h1{font-size:${imageUrl ? '66px' : '80px'};font-weight:700;color:#060541;line-height:1.15;margin-bottom:18px}
h2{font-size:28px;color:#4a4a6a;font-weight:500;margin-bottom:50px}
.bullets{display:flex;flex-direction:column;gap:16px}
.bullet{background:linear-gradient(135deg,#e9ceb0 0%,#f5e6d3 100%);padding:22px 28px;border-radius:10px;box-shadow:0 3px 12px rgba(6,5,65,0.08)}
.bullet::before{content:'●';color:#060541;margin-${isRtl ? 'left' : 'right'}:14px;font-size:12px}
.bullet span{font-size:25px;line-height:1.5;color:#060541}
.brand{position:absolute;${isRtl ? 'right' : 'left'}:24px;bottom:20px;font-size:16px;opacity:0.5;font-weight:600;color:#060541}
</style>
</head>
<body>
${imageUrl ? `<div class="image-col"><img src="${esc(imageUrl)}" alt=""></div>` : ''}
<div class="content-col">
<h1>${esc(title)}</h1>
${subtitle ? `<h2>${esc(subtitle)}</h2>` : ''}
<div class="bullets">
${bullets.map(b => `<div class="bullet"><span>${esc(b)}</span></div>`).join('\n')}
</div>
</div>
<div class="brand">Wakti AI</div>
</body>
</html>`,
};

// ============================================================================
// EXPORT ALL TEMPLATES
// ============================================================================
export const SLIDE_TEMPLATES: SlideTemplate[] = [
  luxuryDark,
  cinematic,
  glassmorphism,
  corporate,
  editorial,
  neonCity,
  emerald,
  crimson,
  purpleHaze,
  monochrome,
  waktiDark,
  waktiLight,
];

/**
 * Find the best matching template based on keywords
 * Returns the template with the most keyword matches, or a random one if no matches
 */
export function findTemplateByKeywords(keywords: string[]): SlideTemplate {
  if (!keywords || keywords.length === 0) {
    return SLIDE_TEMPLATES[Math.floor(Math.random() * SLIDE_TEMPLATES.length)];
  }

  const lowerKeywords = keywords.map(k => k.toLowerCase());
  let bestMatch: SlideTemplate | null = null;
  let bestScore = 0;

  for (const template of SLIDE_TEMPLATES) {
    let score = 0;
    for (const kw of lowerKeywords) {
      if (template.keywords.some(tk => tk.toLowerCase().includes(kw) || kw.includes(tk.toLowerCase()))) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = template;
    }
  }

  return bestMatch || SLIDE_TEMPLATES[Math.floor(Math.random() * SLIDE_TEMPLATES.length)];
}

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): SlideTemplate | undefined {
  return SLIDE_TEMPLATES.find(t => t.id === id);
}
