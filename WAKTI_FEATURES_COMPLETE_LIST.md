# 🎯 WAKTI - Complete Features List

**Wakti AI** is the ultimate productivity AI app — built to simplify life, boost creativity, and make technology feel human.

---

## 📱 MAIN PAGES & SECTIONS

### 1. **WAKTI AI V2** (`/wakti-ai-v2`)
The core AI chat and generation engine with multiple modes and capabilities.

#### **Chat Modes (Triggers)**
- **Chat Mode** 💬
  - Regular conversational AI
  - Submode: **Chat** (normal conversation)
  - Submode: **Study** 📚 (educational mode with image analysis)
  - Submode: **Talk** 🎤 (voice-based conversation)
  - Features: Reply to messages, Personal Touch (tone/style customization)

- **Search Mode** 🔍
  - Web search integration
  - YouTube search (prefix with `yt:` or `yt `)
  - Real-time information retrieval
  - Bilingual search support (EN/AR)

- **Image Mode** 🖼️
  - **Text-to-Image (T2I)**: Generate images from text descriptions
    - Quality options: Fast / Best
    - Prompt enhancement with "Amp" button (DeepSeek-powered)
    - Supports Arabic prompts (auto-translates to English)
  
  - **Image-to-Image (I2I)**: Transform existing images
    - Watercolor style conversion
    - Cartoon/Anime transformation
    - Detail enhancement
    - Black & White conversion
    - Brightness adjustment
    - Arabic prompt translation support
    - Quality options: Fast / Best
  
  - **Background Removal**: Remove image backgrounds
    - One-click background removal
    - Prompt enhancement available
  
  - **Draw-After-BG**: Creative canvas mode
    - Draw on images after background removal
    - Interactive canvas drawing
    - Real-time generation

- **Vision Mode** 👁️
  - Analyze uploaded images with AI
  - Multiple image type detection:
    - **IDs**: Document/ID analysis
      - "What info is on this document?"
      - "Extract all the text"
    
    - **Bills**: Financial document analysis
      - "How much did I spend?"
      - "Split this bill"
    
    - **Food**: Nutrition analysis
      - "How many calories?"
      - "What ingredients?"
    
    - **Documents**: Document Q&A
      - "Answer the questions"
      - "Explain this chart/report"
    
    - **Screenshots**: Error diagnosis
      - "What's the error?"
      - "How do I fix this?"
    
    - **Photos**: Photo analysis
      - "Describe the people"
      - "Where was this taken?"
    
    - **General**: Generic image analysis
      - "Describe everything"
      - "What's the main subject?"
  
  - Study Mode with Vision: Analyze educational materials
  - Multi-image support

#### **Smart Text Features**
- **Personal Touch** ✨
  - Tone customization: Funny, Serious, Casual, Encouraging, Neutral
  - Style customization: Short answers, Bullet points, Step-by-step, Detailed
  - Nickname usage in responses
  - Persistent user preferences
  - System prompt enforcement

- **Message Features**
  - Reply to previous messages (WhatsApp-style)
  - Message history with context
  - Conversation archiving
  - Conversation management (load, delete, clear)
  - Streaming responses

- **Input Features**
  - Paste images directly into chat
  - File attachment support
  - Multi-file uploads
  - Quick reply suggestions (context-aware)
  - Auto-expanding textarea
  - Keyboard positioning (iOS-optimized)

#### **Voice Features**
- **Talk Mode** 🎤
  - Voice input/output conversation
  - Voice message recording
  - Text-to-speech responses
  - Voice cloning support
  - TalkBack voice selection (AR/EN, Male/Female)
  - Mini speaker buttons for message playback

---

### 2. **MUSIC STUDIO** (`/music`)
AI-powered music and audio creation platform.

#### **Music Generation**
- **Lyrics Generation** 🎵
  - AI-powered lyric writing
  - Customizable parameters:
    - Title, Styles, Instruments, Mood, Duration, Arrangement
    - Seed lyrics support
  - Line count control
  - Hook customization
  - Bilingual support (EN/AR)
  - Temperature control (0.25 for consistency)

- **Music Composition** 🎼
  - AI music generation
  - Runware API integration
  - Audio quality settings
  - Monthly generation quota (5 per month)
  - Download/Save functionality

#### **Audio Features**
- **Audio Search** 🎧
  - iTunes-based audio search
  - Preview before attachment
  - Autoplay toggle
  - Audio metadata (title, artist, duration)

- **Voice Tools**
  - Voice TTS (Text-to-Speech)
    - 10,000 character monthly quota
    - 2,000 character per-generation limit
    - Multiple voice options
    - Language support (EN/AR)
    - ElevenLabs integration (eleven_multilingual_v2)

- **My Projects**
  - Save generated audio
  - Track saved songs
  - Share functionality
  - Public/Private toggle

#### **Video Maker** (MVP)
- **Video Creation** 🎬
  - Upload 2-10 images (9:16 aspect ratio only)
  - Hard cap: 60 seconds
  - Per-slide text overlays
  - Fade transitions
  - 3 templates:
    - Wakti Dark Glow
    - Warm Minimal
    - Vibrant Gradient
  - FFmpeg.wasm on-device generation
  - MP4 output (no watermark)
  - Download/Share options
  - Save to Wakti with public/private toggle

- **Audio in Videos**
  - Upload MP3 (up to 10MB)
  - Select from saved generated songs
  - Voiceover via Voice Studio
  - One audio track total

---

### 3. **VOICE STUDIO** (`/tools/voice-studio`)
Professional voice cloning and TTS platform.

#### **Voice Cloning** 🎙️
- **Clone Creation**
  - Record voice samples
  - Multi-sample training
  - Voice quality assessment
  - Clone storage and management

- **Voice TTS**
  - Use cloned voices
  - Text-to-speech generation
  - 10,000 character monthly quota
  - 2,000 character per-generation limit
  - Language support (EN/AR)
  - Download generated audio

#### **Voice Features**
- Voice selection (male/female, EN/AR)
- Voice preview
- Audio quality control
- Playback controls (pointer-based for iOS)
- Safe autoplay with tap-to-play fallback

---

### 4. **VOICE TTS** (`/voice-tts`)
Dedicated text-to-speech generation page.

- 10,000 character monthly quota
- 2,000 character per-generation limit
- Multiple voice options
- Language support (EN/AR)
- ElevenLabs integration
- Download functionality
- Quota tracking

---

### 5. **TEXT GENERATOR** (`/tools/text`)
AI-powered text generation and translation tools.

#### **Text Generation Modes**
- **Smart Text** ✍️
  - Content generation
  - Writing assistance
  - Text enhancement
  - Bilingual support (EN/AR)

- **Translation** 🌐
  - Text translation
  - 60+ language support
  - Saved translation history
  - Translation view (`/tools/text/translation/:id`)
  - Bilingual interface

---

### 6. **TASJEEL** (`/tasjeel`)
Audio recording, transcription, and summarization.

#### **Features**
- **Audio Recording** 🎙️
  - Record meetings, lectures, brainstorming
  - Real-time transcription
  - Multiple language support

- **Transcription** 📝
  - Convert audio to text
  - Searchable transcripts
  - Bilingual transcription (EN/AR)

- **Summarization** 📊
  - AI-powered summaries
  - Key points extraction
  - Multiple summary formats

- **Voice Output** 🔊
  - Generate voice from transcripts
  - Voice cloning support
  - Multiple language output

---

### 7. **CALENDAR** (`/calendar`)
Smart calendar and event management.

#### **Features**
- **Event Management** 📅
  - Create events
  - Event scheduling
  - Reminder system
  - Bilingual support

- **Manual Notes** 📝
  - Add notes to specific dates
  - Local date storage (no timezone issues)
  - Calendar overlay display
  - Quick popup access

- **Integration**
  - Journal entries display
  - Event invites (from Maw3d)
  - RSVP tracking

---

### 8. **JOURNAL** (`/journal`)
Daily mood tracking and journaling with AI insights.

#### **Features**
- **Daily Entry** 📔
  - One entry per day
  - Multiple follow-up check-ins
  - Mood scale (1-5) with custom emojis
    - 😤 Awful, 😟 Bad, 😐 Meh, 😊 Good, 😄 Rad

- **Activity Tags** 🏷️
  - Large default tag set
  - Fully customizable per user
  - Tags: family, friends, care, exercise, sport, relax, movies, gaming, reading, cleaning, sleep, eat_healthy, shopping, study, work, music, meditation, nature, travel, cooking, walk, socialize, coffee, love, romance, spouse, prayer, writing, horse_riding, fishing, wife

- **AI Insights** 🧠
  - Journal Q&A with DeepSeek AI
  - Pattern recognition
  - Personalized feedback
  - 60-80 word responses
  - Persona: 50% friend, 25% therapist, 25% coach

- **Calendar Integration** 📅
  - Journal icon on calendar days
  - Quick popup access
  - Timeline view

- **Bilingual Support** 🌐
  - Full EN/AR support
  - Auto-detect from app locale

---

### 9. **MAW3D** (`/maw3d`)
Event management and invitation system.

#### **Features**
- **Event Creation** 🎉
  - Create events
  - Set date/time
  - Add description
  - Manage attendees

- **Invitations** 📧
  - Send event invites
  - Live RSVP tracking
  - Attendee responses
  - Real-time updates

- **Audio Integration** 🎵
  - Attach iTunes audio
  - Autoplay/tap-to-play modes
  - Audio metadata display

- **Event Management** ⚙️
  - Edit events (`/maw3d/edit/:id`)
  - Manage attendees (`/maw3d/manage/:id`)
  - View event details (`/maw3d/:shortId`)
  - Shareable event links

- **Bilingual Support** 🌐
  - Full EN/AR support

---

### 10. **TASKS & REMINDERS** (`/tr` or `/tasks-reminders`)
Smart task management with AI integration.

#### **Features**
- **Task Creation** ✅
  - Create tasks
  - Set reminders
  - Task descriptions
  - Priority levels

- **Smart Tasks** 🤖
  - AI-generated task suggestions
  - Subtasks support
  - Sharable tasks with links
  - Real-time progress tracking

- **Reminders** ⏰
  - Time-based reminders
  - Notification system
  - Recurring reminders
  - Task confirmation

- **Task Confirmation** 🎯
  - AI-powered task confirmation
  - Task/Reminder creation from chat
  - Confirmation dialogs

---

### 11. **MY WARRANTY** (`/my-warranty`)
Warranty document management and AI Q&A.

#### **Features**
- **Document Storage** 📄
  - Upload warranty documents (image/PDF)
  - Snap photos of physical warranties
  - File type support: jpeg, png, webp, heic, pdf
  - 10MB file size limit

- **AI Extraction** 🤖
  - Automatic data extraction
  - Product name, dates, coverage, exclusions
  - Gemini 1.5 Flash AI model
  - JSON structured data

- **Warranty Categories** 🏷️
  - Default categories
  - Custom categories
  - Color coding
  - Item count tracking

- **Status Tracking** 📊
  - Active/Expiring Soon/Expired status
  - Auto-status triggers
  - Progress bars with color coding
  - Expiry date monitoring

- **Ask Wakti** 💬
  - Q&A about specific warranties
  - Intelligent warranty queries
  - Document-based answers

- **Bilingual Support** 🌐
  - Full EN/AR support (ضماناتي in Arabic)

---

### 12. **GAMES** (`/games`)
Interactive multiplayer games.

#### **Letters Game** 🎮
- **Game Creation** (`/games/letters/create`)
  - Create new game
  - Set game parameters
  - Generate game code

- **Game Joining** (`/games/letters/join`)
  - Join with game code
  - Player registration
  - Waiting room

- **Game Play** (`/games/letters/play/:code`)
  - Real-time gameplay
  - DB-driven countdown (default 3s)
  - Phase management (countdown → playing)
  - Synchronized timing
  - Host authoritative control

- **Results** (`/games/letters/results/:code`)
  - Score tracking
  - Winner determination
  - Game statistics

- **Features**
  - Multiplayer support
  - Real-time synchronization
  - Countdown timer
  - Score calculation

---

### 13. **PROJECTS** (`/projects`)
Creative project management and collaboration.

#### **Features**
- **Project Creation** 🎨
  - Create new projects
  - Project details
  - Collaboration settings

- **Project Management** ⚙️
  - Edit projects (`/projects/:id`)
  - View project details
  - Manage collaborators

- **Project Sharing** 🔗
  - Publish projects
  - Shareable links
  - Public preview (`/preview/:subdomain`)
  - Subdomain-based sharing

- **Presentation Mode** 📊
  - Create presentations
  - Share presentations (`/p/:token`)
  - Presentation player
  - Slide navigation

---

### 14. **CONTACTS & CHAT** (`/contacts`)
Direct messaging and contact management.

#### **Features**
- **Contact Management** 👥
  - View contacts
  - Contact details
  - Contact organization

- **Direct Messaging** 💬
  - One-on-one chat (`/contacts/:contactId`)
  - Message history
  - Real-time messaging
  - Voice message support
  - Audio attachment support (audio/mpeg)

- **Chat Features**
  - Message saving
  - Typing indicators
  - Last seen timestamps
  - Message reactions
  - Reply functionality

---

### 15. **FITNESS & HEALTH** (`/fitness`)
Wearables integration and health tracking.

#### **Features**
- **WHOOP Integration** ⌚
  - OAuth connection
  - Fitness data sync
  - Health metrics tracking
  - Callback handling (`/fitness/callback`, `/whoop/callback`)

- **Health Data**
  - Activity tracking
  - Recovery metrics
  - Sleep data
  - Performance insights

---

### 16. **ACCOUNT & SETTINGS**

#### **Account** (`/account`)
- Profile management
- Subscription status
- Account preferences
- Billing information
- Account deletion option

#### **Settings** (`/settings`)
- App preferences
- Language selection (EN/AR)
- Theme settings (Dark/Light)
- Notification preferences
- Privacy settings

#### **Help** (`/help`)
- FAQ
- Feature documentation
- Troubleshooting
- Support resources

---

## 🎨 SMART TEXT FEATURES

### **Prompt Enhancement (Amp)**
- DeepSeek-powered prompt improvement
- Available in all image modes
- One-click enhancement
- Magic wand animation

### **Image Type Detection**
Automatic categorization for smart suggestions:
- IDs (documents)
- Bills (financial)
- Food (nutrition)
- Documents (educational)
- Screenshots (technical)
- Photos (people)
- General (anything else)

### **Quick Reply Suggestions**
Context-aware suggestions based on:
- Image type
- Current mode
- User intent
- Conversation history

---

## 🎤 VOICE FEATURES

### **Voice Input/Output**
- Speech-to-text
- Text-to-speech
- Voice cloning
- Multiple voice options
- Language support (EN/AR)

### **Voice Modes**
- **Talk Mode**: Voice conversation with AI
- **Voice Studio**: Voice cloning and TTS
- **Voice TTS**: Dedicated TTS page
- **Tasjeel**: Audio transcription

### **Voice Settings**
- TalkBack voice selection
- Male/Female options
- Language-specific voices
- Autoplay preferences

---

## 🖼️ IMAGE MODES

### **Text-to-Image (T2I)**
- Prompt-based generation
- Quality options (Fast/Best)
- Prompt enhancement
- Arabic support
- Progress tracking

### **Image-to-Image (I2I)**
- Style transformation
- Detail enhancement
- Color adjustment
- Arabic prompt support
- Quality options

### **Background Removal**
- One-click removal
- Transparent background
- Quality preservation

### **Draw-After-BG**
- Canvas drawing
- Real-time generation
- Creative editing

---

## 🌐 BILINGUAL SUPPORT

### **Languages**
- **English** (EN)
- **Arabic** (AR)
- **60+ languages** (in translation tools)

### **Features**
- Auto-detect from app locale
- Language-specific voices
- RTL support for Arabic
- Bilingual UI throughout
- Language-specific prompts

---

## 📊 QUOTAS & LIMITS

### **Voice TTS**
- Monthly: 10,000 characters
- Per-generation: 2,000 characters

### **Music Generation**
- Monthly: 5 generations

### **Image Generation**
- No hard monthly limit
- Per-request timeout: 180 seconds

### **Video Maker**
- Max duration: 60 seconds
- Max images: 10
- Aspect ratio: 9:16 only
- Audio: 1 track, max 10MB

---

## 🔐 AUTHENTICATION & SECURITY

### **Auth Methods**
- Email/Password
- Magic link
- OAuth (WHOOP)
- Session management

### **Subscription**
- Free tier with grace period (30 minutes)
- Premium subscription
- RevenueCat integration
- OneSignal push notifications

---

## 🎯 KEY INTEGRATIONS

- **Supabase**: Backend, database, auth, storage
- **OpenAI**: GPT-4o-mini for chat, GPT-4o for vision
- **Claude**: Claude 3.5 Sonnet for vision
- **DeepSeek**: Prompt enhancement, translations
- **Gemini**: Warranty AI extraction
- **ElevenLabs**: Voice TTS
- **Runware**: Image generation
- **iTunes**: Audio search
- **WHOOP**: Fitness data
- **RevenueCat**: Subscriptions
- **OneSignal**: Push notifications

---

## 📱 RESPONSIVE DESIGN

- **Mobile-First**: Optimized for mobile devices
- **Tablet Support**: Responsive layouts
- **Desktop**: Full-featured experience
- **PWA**: Progressive Web App support
- **iOS Safe Areas**: Notch and home indicator support

---

## ✨ UX FEATURES

- **Dark/Light Theme**: Full theme support
- **Smooth Animations**: Framer Motion transitions
- **Glass Morphism**: Modern UI effects
- **Gradient Backgrounds**: WAKTI style colors
- **Responsive Spacing**: Adaptive layouts
- **Keyboard Handling**: iOS keyboard positioning
- **Accessibility**: ARIA labels, semantic HTML

---

## 🔄 REAL-TIME FEATURES

- **Streaming Responses**: Real-time AI responses
- **Live Updates**: Conversation synchronization
- **Typing Indicators**: User presence
- **Last Seen**: Activity tracking
- **RSVP Updates**: Event synchronization

---

**Last Updated**: January 9, 2026
**Version**: Complete Feature List v1.0
