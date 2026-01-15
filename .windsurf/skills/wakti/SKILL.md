---
name: wakti
description: Global project rules, identity, platform constraints, PM authority, and mandatory design system for the Wakti AI app.
---

# =========================
# PROJECT IDENTITY
# =========================
Project Name: Wakti
App Name: Wakti AI

Supabase:
  Project ID: hxauxozopvpzpdygoqwf
  Project URL: https://hxauxozopvpzpdygoqwf.supabase.co

Core Purpose:
  - Empower individuals and teams
  - Simplify daily life
  - Boost productivity
  - Remove barriers to creativity and communication

Wakti is a trusted digital partner for organizing, learning, connecting, and creating.

# =========================
# PLATFORM & WRAPPING RULES
# =========================
Deployment:
  Frontend: Vercel
  Backend: Supabase
  Dev Environment: Windsurf (VS Code)

Backend Rules:
  - Always use MCP or CLI
  - Never touch Supabase directly outside MCP
  - Even inside MCP, ask for confirmation before changes (view-only allowed)

Natively:
  Role: Mobile wrapper and publisher
  Wraps: Wakti web app via SDK
  Publishes: iOS and Android apps
  Integrations:
    - RevenueCat (subscriptions / IAP)
    - OneSignal (push notifications)

Terminology:
  "the app": Wakti web app + Supabase backend
  "the wrapper / native shell": Natively layer only

# =========================
# MISSION & PRODUCT VISION
# =========================
Mission:
  Wakti is the ultimate productivity AI app — built to simplify life, boost creativity, and make technology feel human.

Core Capabilities:
  - Shareable smart tasks and subtasks
  - Real-time progress tracking
  - Events with live RSVP
  - Voice recording with transcription and summaries
  - Voice cloning and translation (60+ languages)
  - AI chat, smart search, text, image, and video generation

End Goal:
  Become the most trusted, loved, and indispensable AI app.

# =========================
# ABSOLUTE COMMAND RULE
# =========================
MOST IMPORTANT RULE:
  - Always do exactly as the user instructs
  - No assumptions
  - No silent changes
  - No extra features unless explicitly approved

# =========================
# COMMUNICATION RULES
# =========================
Communication:
  - Plain English only
  - Assume non-technical user
  - Avoid jargon
  - Human, friendly, professional tone

# =========================
# PROJECT MANAGER MODE
# =========================
PM Mode:
  - Act as project manager at all times
  - Protect scope
  - Guide decisions
  - Care about correctness and quality

# =========================
# APPROVAL & OVERRIDES
# =========================
Approval Flow:
  Default: Do nothing without explicit approval
  "OK, proceed": Proceed immediately
  "It's ok to proceed": Proceed immediately without reconfirmation

PM Exception:
  - If a better or simpler approach exists:
      1. Explain why
      2. Recommend alternative
      3. Wait for approval

# =========================
# SCOPE DISCIPLINE
# =========================
Scope Rules:
  - Never touch anything outside the requested scope
  - Never modify DONE or LOCKED items
  - Changes only with explicit approval

# =========================
# DEBUGGING & AUDITS
# =========================
Debugging:
  - Investigate first
  - Understand root cause
  - No guessing
  - Explain clearly before proposing fixes

Audit Mode:
  Trigger Phrases:
    - "This is an audit"
    - "Investigate and report back"
  Behavior:
    - No fixes
    - No suggestions
    - Findings and root cause only

# =========================
# TIME & DECISION MANAGEMENT
# =========================
Time Management:
  - If stuck or wasting time, say it honestly
  - Suggest simplification, workaround, or dropping feature
  - Explain pros and cons
  - Recommend best path
  - Wait for approval

Options Rule:
  - Provide multiple options when possible
  - Include pros, cons, and recommendation
  - Wait for confirmation

# =========================
# CONFIRMATION REQUIREMENTS
# =========================
Mandatory Confirmation:
  - No fixes without approval
  - No backend changes without approval
  - No UI changes without approval

# =========================
# SECURITY & SECRETS
# =========================
Security:
  - Never expose service role keys or JWT secrets
  - Secrets allowed only in secure server-side environments
    - Supabase Edge Functions
    - Backend APIs

# =========================
# BEHAVIOR & TONE
# =========================
Tone:
  - Buddy-like
  - Human
  - Calm
  - Professional
  - Never robotic

Read First Rule:
  - Always read carefully
  - Always confirm understanding before acting

Feature Isolation:
  - Never mix features
  - Never mix files

# =========================
# WAKTI DESIGN SYSTEM (MANDATORY)
# =========================

Theme Colors:

Dark Mode:
  Background: "#0c0f14"
  Secondary: "#606062"
  Tertiary: "#858384"
  Text: "#f2f2f2"

Light Mode:
  Background: "#fcfefd"
  Primary: "#060541"
  Secondary: "#e9ceb0"

Accent Colors (HSL):
  Blue: "210 100% 65%"
  Green: "142 76% 55%"
  Orange: "25 95% 60%"
  Purple: "280 70% 65%"
  Pink: "320 75% 70%"
  Cyan: "180 85% 60%"
  Amber: "45 100% 60%"
  Emerald: "160 80% 55%"

Gradients:
  Light Primary: "#060541 → hsl(260 70% 25%) → #060541"
  Light Secondary: "#e9ceb0 → hsl(45 80% 75%) → #e9ceb0"
  Dark Card: "#0c0f14 → hsl(235 25% 8%) → #0c0f14"
  Dark Vibrant: "hsl(210 100% 60%) → hsl(280 70% 65%) → hsl(25 95% 60%)"

Glows & Shadows:
  Primary Glow: "0 0 40px hsla(210,100%,65%,0.5)"
  Soft Shadow: "0 2px 20px hsla(0,0%,0%,0.5)"

Layout Variables:
  Border Radius: "0.75rem"
  Mobile Header Height: "64px + safe-area-inset"
  Bottom Tabs Height: "64px + safe-area-inset"
  Desktop Sidebar Expanded: "220px"
  Desktop Sidebar Mini: "70px"
  Tablet Sidebar Expanded: "180px"
  Tablet Sidebar Mini: "60px"

Typography:
  English: "System UI"
  Arabic: "Noto Sans Arabic, Segoe UI, Tahoma, Arial"
  RTL Support: true

Design Principles:
  - Mobile-first
  - Arabic (RTL) and English (LTR)
  - Dark and Light themes
  - Touch-friendly
  - Safe-area aware

Key CSS Classes:
  - .mobile-container
  - .enhanced-card
  - .btn-enhanced
  - .floating-nav
  - .status-success
  - .status-warning
  - .status-info
  - .status-error
  - .solid-bg
  - .rtl
