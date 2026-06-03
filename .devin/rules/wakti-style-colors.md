---
trigger: always_on
---

📋 WAKTI Style Guide & Design System
🎨 Theme Colors
Dark Mode
Purpose	Hex	HSL
Background	#0c0f14	222 20% 6%
Secondary	#606062	240 1% 38%
Tertiary/Accent	#858384	240 1% 52%
Foreground (text)	#f2f2f2	0 0% 95%
Light Mode
Purpose	Hex	HSL
Background	#fcfefd	180 4% 99%
Primary (text/UI)	#060541	243 84% 14%
Secondary	#e9ceb0	36 67% 81%
🌈 Accent Colors
Name	Light Mode HSL	Dark Mode HSL
Blue	210 100% 75%	210 100% 65%
Green	142 76% 65%	142 76% 55%
Orange	25 95% 70%	25 95% 60%
Purple	280 60% 75%	280 70% 65%
Pink	320 70% 80%	320 75% 70%
Cyan	180 80% 70%	180 85% 60%
Amber	45 100% 70%	45 100% 60%
Emerald	160 75% 65%	160 80% 55%

🌙 Dark Mode (Primary Brand Feel)

These are the core identity colors — modern, calm, premium.

#0C0F14 → Main background (deep dark)

#606062 → Secondary surfaces / cards

#858384 → Text, icons, subtle UI elements

☀️ Light Mode

Clean, warm, and elegant — still very “WAKTI”.

#FCFEFD → Main background (almost white)

#E9CEB0 → Soft accent / highlights

#060541 → Primary brand color (headers, CTAs, emphasis)
✨ Gradients use our colors 
Light Mode Gradients
Primary: linear-gradient(135deg, #060541 0%, hsl(260 70% 25%) 50%, #060541 100%)
Secondary: linear-gradient(135deg, #e9ceb0 0%, hsl(45 80% 75%) 50%, #e9ceb0 100%)
Card: linear-gradient(135deg, #fcfefd 0%, hsl(200 15% 96%) 30%, #fcfefd 100%)
Background: linear-gradient(135deg, #fcfefd 0%, hsl(200 25% 95%) 50%, #fcfefd 100%)
Vibrant: linear-gradient(135deg, hsl(210 100% 88%) 0%, hsl(280 60% 88%) 50%, hsl(25 95% 88%) 100%)
Warm: linear-gradient(135deg, hsl(25 95% 92%) 0%, hsl(45 80% 90%) 50%, hsl(60 70% 88%) 100%)
Cool: linear-gradient(135deg, hsl(210 100% 92%) 0%, hsl(190 80% 90%) 50%, hsl(170 70% 88%) 100%)
Dark Mode Gradients
Primary: linear-gradient(135deg, #f2f2f2 0%, hsl(210 30% 80%) 30%, hsl(260 40% 75%) 70%, hsl(210 20% 85%) 100%)
Card: linear-gradient(135deg, #0c0f14 0%, hsl(235 25% 8%) 30%, hsl(250 20% 10%) 70%, #0c0f14 100%)
Background: linear-gradient(135deg, #0c0f14 0%, hsl(235 25% 7%) 25%, hsl(250 20% 8%) 50%, hsl(260 15% 9%) 75%, #0c0f14 100%)
Vibrant: linear-gradient(135deg, hsl(210 100% 60%) 0%, hsl(280 70% 65%) 50%, hsl(25 95% 60%) 100%)
🌟 Glow Effects & Shadows
Glows (Dark Mode)
Primary Glow: 0 0 40px hsla(210, 100%, 65%, 0.5), 0 0 80px hsla(280, 70%, 65%, 0.3)
Blue Glow: 0 0 25px hsla(210, 100%, 65%, 0.8)
Green Glow: 0 0 25px hsla(142, 76%, 55%, 0.8)
Orange Glow: 0 0 25px hsla(25, 95%, 60%, 0.8)
Purple Glow: 0 0 25px hsla(280, 70%, 65%, 0.8)
Shadows
Colored Shadow (Dark): 0 4px 32px hsla(0, 0%, 0%, 0.7), 0 2px 16px hsla(210, 100%, 65%, 0.3)
Soft Shadow (Dark): 0 2px 20px hsla(0, 0%, 0%, 0.5), 0 1px 8px hsla(240, 20%, 40%, 0.4)
Vibrant Shadow (Dark): 0 8px 40px hsla(210, 100%, 65%, 0.4), 0 4px 20px hsla(280, 70%, 65%, 0.3)
📐 Layout Variables
Variable	Value
Border Radius	0.75rem
Mobile Header Height	64px + safe-area-inset
Bottom Tabs Height	64px + safe-area-inset
Desktop Sidebar (expanded)	220px
Desktop Sidebar (mini)	70px
Tablet Sidebar (expanded)	180px
Tablet Sidebar (mini)	60px
🔤 Typography
English/Default: System UI fonts
Arabic: 'Noto Sans Arabic', 'Segoe UI', 'Tahoma', 'Arial', sans-serif
RTL Support: Full support with direction: rtl and text-align: right
🎯 Design Principles
Mobile-First: All designs optimized for mobile devices
Bilingual: Arabic (RTL) and English (LTR) support
Vibrant & Artistic: Rich gradients and glow effects
Dark/Light Themes: Full theme support with consistent accent colors
Touch-Friendly: Large tap targets, smooth animations (active:scale-95)
Safe Areas: Respects iOS/Android notches and home indicators
📱 Key CSS Classes
.mobile-container - Main mobile wrapper
.enhanced-card - Cards with gradient backgrounds and hover effects
.btn-enhanced - Primary buttons with gradient and glow
.floating-nav - Bottom navigation with blur and vibrant glow
.status-success/warning/info/error - Status indicator colors
.solid-bg - Solid background for headers (no transparency)
.rtl - Right-to-left text direction