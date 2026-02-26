// @ts-nocheck: Deno/Supabase edge runtime
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Slide {
  slideNumber: number;
  title: string;
  subtitle?: string;
  bullets: string[];
  imageUrl?: string;
  role?: string;
}

interface EnhanceRequest {
  slide: Slide;
  theme: string;
  language: string;
  variation?: number; // 0-5 to force specific template, or omit for auto
}

// Generate a hash from the slide content to pick consistent but varied templates
function getTemplateIndex(slide: Slide, theme: string, variation?: number): number {
  if (variation !== undefined && variation >= 0 && variation < 6) {
    return variation;
  }
  const str = `${slide.title}-${slide.bullets?.length || 0}-${theme}-${slide.slideNumber}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Template 1: Modern Split with bold typography
function templateModernSplit(slide: Slide, isRtl: boolean): string {
  const dir = isRtl ? "rtl" : "ltr";
  const textAlign = isRtl ? "right" : "left";
  const bulletsHtml = slide.bullets?.map((b, i) => `
    <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px; animation: fadeInUp 0.5s ${i * 0.1}s both;">
      <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #f59e0b, #ea580c); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; flex-shrink: 0;">${i + 1}</div>
      <div style="color: #e2e8f0; font-size: 22px; line-height: 1.5; padding-top: 2px;">${escapeHtml(b)}</div>
    </div>
  `).join("") || "";
  
  return `
<!DOCTYPE html>
<html>
<head>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', sans-serif; width: 1920px; height: 1080px; overflow: hidden; }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes gradientShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
</style>
</head>
<body>
<div style="width: 1920px; height: 1080px; display: flex; background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); background-size: 200% 200%; animation: gradientShift 8s ease infinite;" dir="${dir}">
  <div style="flex: 1; padding: 80px 60px; display: flex; flex-direction: column; justify-content: center;">
    <h1 style="font-size: 72px; font-weight: 800; color: #ffffff; line-height: 1.1; margin-bottom: 30px; text-align: ${textAlign}; animation: fadeInUp 0.6s both;">${escapeHtml(slide.title)}</h1>
    ${slide.subtitle ? `<p style="font-size: 32px; color: #94a3b8; margin-bottom: 50px; text-align: ${textAlign}; animation: fadeInUp 0.6s 0.1s both;">${escapeHtml(slide.subtitle)}</p>` : ""}
    <div style="margin-top: 20px;">${bulletsHtml}</div>
  </div>
  ${slide.imageUrl ? `
  <div style="flex: 1; position: relative; overflow: hidden;">
    <div style="position: absolute; inset: 0; background: linear-gradient(to ${isRtl ? 'left' : 'right'}, #0f172a, transparent 30%); z-index: 2;"></div>
    <img src="${slide.imageUrl}" style="width: 100%; height: 100%; object-fit: cover; filter: saturate(1.1) contrast(1.05);">
  </div>
  ` : ""}
</div>
</body>
</html>`;
}

// Template 2: Magazine style with large image
function templateMagazine(slide: Slide, isRtl: boolean): string {
  const dir = isRtl ? "rtl" : "ltr";
  const textAlign = isRtl ? "right" : "left";
  const bulletsHtml = slide.bullets?.map((b, i) => `
    <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-left: 4px solid #f59e0b; padding: 20px 24px; margin-bottom: 16px; border-radius: 0 12px 12px 0; animation: slideIn ${0.4 + i * 0.1}s both; ${isRtl ? 'border-left: none; border-right: 4px solid #f59e0b; border-radius: 12px 0 0 12px;' : ''}">
      <p style="color: #f1f5f9; font-size: 24px; line-height: 1.4; margin: 0;">${escapeHtml(b)}</p>
    </div>
  `).join("") || "";
  
  return `
<!DOCTYPE html>
<html>
<head>
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', sans-serif; width: 1920px; height: 1080px; overflow: hidden; }
@keyframes slideIn { from { opacity: 0; transform: translateX(-50px); } to { opacity: 1; transform: translateX(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>
</head>
<body>
<div style="width: 1920px; height: 1080px; position: relative;" dir="${dir}">
  ${slide.imageUrl ? `
  <div style="position: absolute; inset: 0; z-index: 1;">
    <img src="${slide.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;">
    <div style="position: absolute; inset: 0; background: linear-gradient(to ${isRtl ? 'left' : 'right'}, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.1) 100%);"></div>
  </div>
  ` : `<div style="position: absolute; inset: 0; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);"></div>`}
  
  <div style="position: relative; z-index: 10; height: 100%; display: flex; flex-direction: column; justify-content: center; padding: 80px; max-width: 900px;">
    <h1 style="font-family: 'Playfair Display', serif; font-size: 84px; font-weight: 900; color: #ffffff; line-height: 1.05; margin-bottom: 40px; text-align: ${textAlign}; text-shadow: 2px 4px 20px rgba(0,0,0,0.5); animation: fadeIn 0.8s both;">${escapeHtml(slide.title)}</h1>
    ${slide.subtitle ? `<p style="font-size: 28px; color: #fbbf24; font-weight: 500; margin-bottom: 50px; text-align: ${textAlign}; animation: slideIn 0.6s 0.2s both; text-shadow: 1px 2px 10px rgba(0,0,0,0.5);">${escapeHtml(slide.subtitle)}</p>` : ""}
    <div style="margin-top: 20px;">${bulletsHtml}</div>
  </div>
</div>
</body>
</html>`;
}

// Template 3: Bold color blocks with geometric shapes
function templateGeometric(slide: Slide, isRtl: boolean): string {
  const dir = isRtl ? "rtl" : "ltr";
  const textAlign = isRtl ? "right" : "left";
  const bulletsHtml = slide.bullets?.map((b, i) => `
    <li style="color: #1e293b; font-size: 26px; line-height: 1.5; margin-bottom: 20px; position: relative; padding-${isRtl ? 'right' : 'left'}: 36px; list-style: none;">
      <span style="position: absolute; ${isRtl ? 'right' : 'left'}: 0; top: 8px; width: 12px; height: 12px; background: #ea580c; border-radius: 2px; transform: rotate(45deg);"></span>
      ${escapeHtml(b)}
    </li>
  `).join("") || "";
  
  return `
<!DOCTYPE html>
<html>
<head>
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', sans-serif; width: 1920px; height: 1080px; overflow: hidden; }
@keyframes scaleIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>
</head>
<body>
<div style="width: 1920px; height: 1080px; display: flex; position: relative; overflow: hidden;" dir="${dir}">
  <!-- Geometric background elements -->
  <div style="position: absolute; top: -200px; ${isRtl ? 'right' : 'left'}: -200px; width: 600px; height: 600px; background: linear-gradient(135deg, #f59e0b, #ea580c); border-radius: 50%; opacity: 0.3; animation: scaleIn 1s both;"></div>
  <div style="position: absolute; bottom: -300px; ${isRtl ? 'left' : 'right'}: -100px; width: 800px; height: 800px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 50%; opacity: 0.2; animation: scaleIn 1.2s both;"></div>
  
  <!-- Main content area -->
  <div style="flex: 1; padding: 100px; display: flex; flex-direction: column; justify-content: center; background: linear-gradient(135deg, #fef3c7 0%, #fff 50%, #dbeafe 100%); position: relative; z-index: 10;">
    <div style="background: rgba(255,255,255,0.9); padding: 60px; border-radius: 24px; box-shadow: 0 25px 80px rgba(0,0,0,0.15); backdrop-filter: blur(10px);">
      <h1 style="font-family: 'Space Grotesk', sans-serif; font-size: 64px; font-weight: 700; color: #0f172a; line-height: 1.1; margin-bottom: 24px; text-align: ${textAlign};">${escapeHtml(slide.title)}</h1>
      ${slide.subtitle ? `<p style="font-size: 28px; color: #64748b; margin-bottom: 40px; text-align: ${textAlign};">${escapeHtml(slide.subtitle)}</p>` : ""}
      ${slide.bullets?.length ? `<ul style="margin-top: 30px; padding: 0;">${bulletsHtml}</ul>` : ""}
    </div>
  </div>
  
  ${slide.imageUrl ? `
  <div style="width: 45%; position: relative; overflow: hidden;">
    <img src="${slide.imageUrl}" style="width: 100%; height: 100%; object-fit: cover; clip-path: ${isRtl ? 'polygon(15% 0, 100% 0, 100% 100%, 0 100%)' : 'polygon(0 0, 100% 0, 85% 100%, 0 100%)'};">
  </div>
  ` : ""}
</div>
</body>
</html>`;
}

// Template 4: Dark premium with glowing accents
function templateDarkPremium(slide: Slide, isRtl: boolean): string {
  const dir = isRtl ? "rtl" : "ltr";
  const textAlign = isRtl ? "right" : "left";
  const bulletsHtml = slide.bullets?.map((b, i) => `
    <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 28px; animation: glowPulse 2s ${i * 0.3}s infinite;">
      <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #fbbf24, #f59e0b); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 30px rgba(251, 191, 36, 0.4);">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <p style="color: #e2e8f0; font-size: 28px; line-height: 1.4; flex: 1;">${escapeHtml(b)}</p>
    </div>
  `).join("") || "";
  
  return `
<!DOCTYPE html>
<html>
<head>
<style>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Outfit', sans-serif; width: 1920px; height: 1080px; overflow: hidden; }
@keyframes glowPulse { 0%, 100% { box-shadow: 0 0 30px rgba(251, 191, 36, 0.4); } 50% { box-shadow: 0 0 50px rgba(251, 191, 36, 0.7); } }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
</style>
</head>
<body>
<div style="width: 1920px; height: 1080px; background: linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e293b 100%); position: relative; overflow: hidden;" dir="${dir}">
  <!-- Grid pattern overlay -->
  <div style="position: absolute; inset: 0; background-image: radial-gradient(circle at 2px 2px, rgba(251,191,36,0.15) 1px, transparent 0); background-size: 40px 40px;"></div>
  
  <!-- Floating elements -->
  <div style="position: absolute; top: 100px; ${isRtl ? 'right' : 'left'}: 100px; width: 200px; height: 200px; background: linear-gradient(135deg, #f59e0b, #ea580c); border-radius: 50%; opacity: 0.1; filter: blur(60px); animation: float 6s ease-in-out infinite;"></div>
  <div style="position: absolute; bottom: 150px; ${isRtl ? 'left' : 'right'}: 200px; width: 300px; height: 300px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 50%; opacity: 0.08; filter: blur(80px); animation: float 8s ease-in-out infinite 1s;"></div>
  
  <div style="position: relative; z-index: 10; height: 100%; display: flex; padding: 80px; gap: 60px;">
    <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
      <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #f59e0b, #ea580c); border-radius: 50px; margin-bottom: 30px; align-self: ${isRtl ? 'flex-end' : 'flex-start'};">
        <span style="color: #000; font-weight: 600; font-size: 16px; text-transform: uppercase; letter-spacing: 2px;">Slide ${slide.slideNumber}</span>
      </div>
      <h1 style="font-size: 76px; font-weight: 800; color: #ffffff; line-height: 1.05; margin-bottom: 30px; text-align: ${textAlign};">${escapeHtml(slide.title)}</h1>
      ${slide.subtitle ? `<p style="font-size: 32px; color: #94a3b8; margin-bottom: 50px; text-align: ${textAlign};">${escapeHtml(slide.subtitle)}</p>` : ""}
      <div style="margin-top: 20px;">${bulletsHtml}</div>
    </div>
    
    ${slide.imageUrl ? `
    <div style="flex: 0.8; display: flex; align-items: center;">
      <div style="position: relative; width: 100%; height: 70%; border-radius: 24px; overflow: hidden; box-shadow: 0 0 60px rgba(251,191,36,0.2);">
        <img src="${slide.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;">
        <div style="position: absolute; inset: 0; border: 2px solid rgba(251,191,36,0.3); border-radius: 24px;"></div>
      </div>
    </div>
    ` : ""}
  </div>
</div>
</body>
</html>`;
}

// Template 5: Minimalist with accent line
function templateMinimalist(slide: Slide, isRtl: boolean): string {
  const dir = isRtl ? "rtl" : "ltr";
  const textAlign = isRtl ? "right" : "left";
  const bulletsHtml = slide.bullets?.map((b, i) => `
    <div style="font-size: 32px; color: #334155; line-height: 1.6; margin-bottom: 32px; padding-${isRtl ? 'right' : 'left'}: 40px; position: relative; animation: fadeInLeft 0.5s ${i * 0.15}s both;">
      <span style="position: absolute; ${isRtl ? 'right' : 'left'}: 0; top: 16px; width: 20px; height: 3px; background: #0ea5e9;"></span>
      ${escapeHtml(b)}
    </div>
  `).join("") || "";
  
  return `
<!DOCTYPE html>
<html>
<head>
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Plus Jakarta Sans', sans-serif; width: 1920px; height: 1080px; overflow: hidden; }
@keyframes fadeInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
</style>
</head>
<body>
<div style="width: 1920px; height: 1080px; display: flex; background: #f8fafc;" dir="${dir}">
  <div style="flex: 1; padding: 100px; display: flex; flex-direction: column; justify-content: center; position: relative;">
    <div style="position: absolute; top: 0; ${isRtl ? 'right' : 'left'}: 0; width: 8px; height: 100%; background: linear-gradient(to bottom, #0ea5e9, #06b6d4);"></div>
    
    <h1 style="font-size: 72px; font-weight: 800; color: #0f172a; line-height: 1.1; margin-bottom: 24px; text-align: ${textAlign};">${escapeHtml(slide.title)}</h1>
    ${slide.subtitle ? `<p style="font-size: 28px; color: #64748b; font-weight: 500; margin-bottom: 60px; text-align: ${textAlign};">${escapeHtml(slide.subtitle)}</p>` : ""}
    <div style="margin-top: 40px;">${bulletsHtml}</div>
  </div>
  
  ${slide.imageUrl ? `
  <div style="flex: 1; padding: 60px; display: flex; align-items: center; justify-content: center;">
    <div style="width: 100%; height: 80%; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.1);">
      <img src="${slide.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;">
    </div>
  </div>
  ` : ""}
</div>
</body>
</html>`;
}

// Template 6: Vibrant gradient with card layout
function templateVibrantCards(slide: Slide, isRtl: boolean): string {
  const dir = isRtl ? "rtl" : "ltr";
  const textAlign = isRtl ? "right" : "left";
  const bulletsHtml = slide.bullets?.map((b, i) => `
    <div style="background: rgba(255,255,255,0.95); padding: 28px 32px; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); margin-bottom: 20px; transform: rotate(${(i % 2 === 0 ? -1 : 1)}deg); animation: popIn 0.4s ${i * 0.1}s both;">
      <p style="color: #1e293b; font-size: 24px; line-height: 1.5; margin: 0; font-weight: 500;">${escapeHtml(b)}</p>
    </div>
  `).join("") || "";
  
  return `
<!DOCTYPE html>
<html>
<head>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'DM Sans', sans-serif; width: 1920px; height: 1080px; overflow: hidden; }
@keyframes popIn { from { opacity: 0; transform: scale(0.9) rotate(0deg); } to { opacity: 1; transform: scale(1) rotate(var(--rotation, 0deg)); } }
</style>
</head>
<body>
<div style="width: 1920px; height: 1080px; background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); position: relative; overflow: hidden;" dir="${dir}">
  <div style="position: absolute; inset: 0; background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></svg>'); background-size: 200px 200px; opacity: 0.5;"></div>
  
  <div style="position: relative; z-index: 10; height: 100%; display: flex; padding: 80px; gap: 60px;">
    <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
      <h1 style="font-size: 68px; font-weight: 700; color: #ffffff; line-height: 1.15; margin-bottom: 30px; text-align: ${textAlign}; text-shadow: 2px 4px 20px rgba(0,0,0,0.3);">${escapeHtml(slide.title)}</h1>
      ${slide.subtitle ? `<p style="font-size: 28px; color: rgba(255,255,255,0.9); margin-bottom: 40px; text-align: ${textAlign};">${escapeHtml(slide.subtitle)}</p>` : ""}
      <div style="margin-top: 20px;">${bulletsHtml}</div>
    </div>
    
    ${slide.imageUrl ? `
    <div style="flex: 0.7; display: flex; align-items: center; justify-content: center;">
      <div style="width: 100%; height: 60%; border-radius: 30px; overflow: hidden; box-shadow: 0 30px 60px rgba(0,0,0,0.3); border: 4px solid rgba(255,255,255,0.3);">
        <img src="${slide.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;">
      </div>
    </div>
    ` : ""}
  </div>
</div>
</body>
</html>`;
}

// Main handler
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: EnhanceRequest = await req.json();
    const { slide, theme, language, variation } = body;
    
    if (!slide) {
      return new Response(
        JSON.stringify({ success: false, error: "Slide data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isRtl = language === "ar";
    
    // Pick template based on content hash or explicit variation
    const templateIndex = getTemplateIndex(slide, theme, variation) % 6;
    
    let html: string;
    switch (templateIndex) {
      case 0:
        html = templateModernSplit(slide, isRtl);
        break;
      case 1:
        html = templateMagazine(slide, isRtl);
        break;
      case 2:
        html = templateGeometric(slide, isRtl);
        break;
      case 3:
        html = templateDarkPremium(slide, isRtl);
        break;
      case 4:
        html = templateMinimalist(slide, isRtl);
        break;
      case 5:
      default:
        html = templateVibrantCards(slide, isRtl);
        break;
    }

    return new Response(
      JSON.stringify({ success: true, html, template: templateIndex }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error enhancing slide:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message || "Enhancement failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
