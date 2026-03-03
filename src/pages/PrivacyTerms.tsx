import { useTheme } from "@/providers/ThemeProvider";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";
import { MobileHeader } from "@/components/MobileHeader";
import { Footer } from "@/components/Footer";
import { ThemeLanguageToggle } from "@/components/ThemeLanguageToggle";
import EnhancedAudioControls from "@/components/tasjeel/EnhancedAudioControls";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useRef, useState } from "react";

export default function PrivacyTerms() {
  const { language } = useTheme();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Auto-scroll hook with language prop
  const { isAutoScrollActive, userHasScrolled } = useAutoScroll({
    isPlaying,
    currentTime,
    duration,
    containerRef: contentRef,
    language
  });

  const handleBackClick = () => {
    navigate("/");
  };

  const formatText = (text: string) => {
    return text.split('\n').map((line, index) => (
      <div key={index} className="mb-1">
        {line}
      </div>
    ));
  };

  // Audio URLs from Supabase storage
  const englishAudioUrl = "https://hxauxozopvpzpdygoqwf.supabase.co/storage/v1/object/public/admin-uploads/mp3/WAKTI%20Privacy%20Policy%20%26%20Terms%20of%20Use%20english.mp3";
  const arabicAudioUrl = "https://hxauxozopvpzpdygoqwf.supabase.co/storage/v1/object/public/admin-uploads/mp3/praviacy%20and%20terms%20-%20arabic.mp3";

  // Audio control labels
  const audioLabels = {
    play: t("audioPlay", language),
    pause: t("audioPause", language),
    rewind: t("audioRewind", language),
    stop: t("audioStop", language),
    error: t("audioError", language)
  };

  // Audio event handlers
  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleTimeUpdate = (time: number, audioDuration: number) => {
    setCurrentTime(time);
    if (audioDuration && audioDuration !== duration) {
      setDuration(audioDuration);
    }
  };

  const handleLoadedMetadata = (audioDuration: number) => {
    setDuration(audioDuration);
  };

  return (
    <div className="mobile-container">
      <MobileHeader 
        title={t("privacyAndTerms", language)} 
        showBackButton={true}
        onBackClick={handleBackClick}
      >
        <ThemeLanguageToggle />
      </MobileHeader>
      
      <div ref={contentRef} className="flex-1 overflow-y-auto" style={{ scrollBehavior: 'smooth' }}>
        <div className="px-4 py-6 space-y-8">
          {/* Audio Player - Show only relevant language audio */}
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="bg-gradient-card border border-accent/20 rounded-lg p-4 space-y-3 w-full max-w-md relative">
                <h3 className="text-sm font-semibold text-primary text-center">
                  {language === "ar" ? t("arabicAudio", language) : t("englishAudio", language)}
                </h3>
                <EnhancedAudioControls
                  audioUrl={language === "ar" ? arabicAudioUrl : englishAudioUrl}
                  labels={audioLabels}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                />
                
                {/* Auto-scroll indicator */}
                {isAutoScrollActive && (
                  <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                    Auto-scroll
                  </div>
                )}
                
                {userHasScrolled && isPlaying && (
                  <div className="text-xs text-muted-foreground text-center mt-2">
                    Auto-scroll paused - scroll stopped
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-center">
              {t("privacyPolicyHeader", language)}
            </h1>
            <p className="text-sm text-muted-foreground">
              <strong>{t("lastUpdated", language)}:</strong> {t("lastUpdatedDate", language)}
            </p>
            <div className="text-sm leading-relaxed text-muted-foreground border-l-4 border-primary pl-4 bg-muted/30 p-4 rounded-r-lg">
              {t("welcomeText", language)}
            </div>
          </div>

          <div className="space-y-8">
            {/* Section 1 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section1Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section1Text", language)}</p>
                <p className="text-sm leading-relaxed font-medium text-accent-foreground">
                  {t("section1Text2", language)}
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section2Title", language)}
              </h2>
              
              <div className="space-y-4">
                <div className="bg-muted/20 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 text-primary">{t("section2_1Title", language)}</h3>
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section2_1Text", language))}
                  </div>
                </div>

                <div className="bg-muted/20 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 text-primary">{t("section2_2Title", language)}</h3>
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section2_2Text", language))}
                  </div>
                </div>

                <div className="bg-muted/20 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 text-primary">{t("section2_3Title", language)}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{t("section2_3Text", language)}</p>

                  {/* AI Provider Cards */}
                  <div className="grid grid-cols-1 gap-2 mb-4">
                    {[
                      {
                        emoji: "🤖",
                        name: "OpenAI",
                        color: "from-emerald-500/10 to-teal-500/10 border-emerald-500/20",
                        badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                        uses: language === 'ar'
                          ? ["نسخ الصوت والتفريغ", "تحويل النص إلى كلام (TTS)", "توليد الملخصات"]
                          : ["Voice transcription & summaries", "Text-to-speech (TTS)", "Summaries generation"],
                      },
                      {
                        emoji: "⚡",
                        name: "DeepSeek",
                        color: "from-blue-500/10 to-indigo-500/10 border-blue-500/20",
                        badge: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
                        uses: language === 'ar'
                          ? ["تحسين وتوليد النصوص"]
                          : ["Text generation & enhancement"],
                      },
                      {
                        emoji: "✨",
                        name: "Google Gemini",
                        color: "from-amber-500/10 to-orange-500/10 border-amber-500/20",
                        badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                        uses: language === 'ar'
                          ? ["فهم الصور", "توليد الصور", "البحث على الويب", "البرمجة والكود"]
                          : ["Image understanding", "Image generation", "Web search", "Code"],
                      },
                      {
                        emoji: "📄",
                        name: "Claude (Anthropic)",
                        color: "from-purple-500/10 to-violet-500/10 border-purple-500/20",
                        badge: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
                        uses: language === 'ar'
                          ? ["تحليل المستندات", "توليد النصوص"]
                          : ["Document analysis", "Text generation"],
                      },
                      {
                        emoji: "🎨",
                        name: "Runware",
                        color: "from-pink-500/10 to-rose-500/10 border-pink-500/20",
                        badge: "bg-pink-500/15 text-pink-700 dark:text-pink-400",
                        uses: language === 'ar'
                          ? ["توليد الصور بالذكاء الاصطناعي"]
                          : ["AI image generation"],
                      },
                      {
                        emoji: "🎬",
                        name: "Grok (xAI)",
                        color: "from-zinc-500/10 to-slate-500/10 border-zinc-500/20",
                        badge: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400",
                        uses: language === 'ar'
                          ? ["توليد الفيديو بالذكاء الاصطناعي"]
                          : ["AI video generation"],
                      },
                      {
                        emoji: "🎙️",
                        name: "ElevenLabs",
                        color: "from-cyan-500/10 to-sky-500/10 border-cyan-500/20",
                        badge: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
                        uses: language === 'ar'
                          ? ["تحويل النص إلى كلام (TTS) عالي الجودة", "استنساخ الأصوات"]
                          : ["High-quality text-to-speech", "Voice cloning"],
                      },
                    ].map((provider) => (
                      <div
                        key={provider.name}
                        className={`flex items-start gap-3 p-3 rounded-xl border bg-gradient-to-r ${provider.color}`}
                      >
                        <div className="text-2xl shrink-0 mt-0.5">{provider.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="font-bold text-sm text-foreground">{provider.name}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {provider.uses.map((use) => (
                              <span
                                key={use}
                                className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${provider.badge}`}
                              >
                                {use}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 text-sm leading-relaxed border-t border-border/40 pt-3">
                    <p className="text-muted-foreground">{t("section2_3Text2", language)}</p>
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <span>🔒</span>
                      {t("section2_3Text3", language)}
                    </p>
                  </div>
                </div>

                <div className="bg-muted/20 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 text-primary">{t("section2_4Title", language)}</h3>
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section2_4Text", language))}
                  </div>
                </div>

                <div className="bg-muted/20 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 text-primary">{t("section2_5Title", language)}</h3>
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section2_5Text", language))}
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section3Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section3Text", language)}</p>
                <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20">
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section3List", language))}
                  </div>
                </div>
                <div className="bg-red-100 dark:bg-destructive/20 p-3 rounded-lg">
                  <p className="text-sm font-bold text-red-800 dark:text-destructive-foreground">
                    {t("section3Warning", language)}
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section4Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed font-medium">{t("section4Text", language)}</p>
                <div className="bg-muted/20 p-4 rounded-lg">
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section4List", language))}
                  </div>
                </div>
              </div>
            </section>

            {/* Section 5 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section5Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section5Text", language)}</p>
                <p className="text-sm leading-relaxed font-medium">{t("section5Text2", language)}</p>
                <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section5List", language))}
                  </div>
                </div>
              </div>
            </section>

            {/* Section 6 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section6Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section6Text", language)}</p>
                <div className="bg-yellow-50 dark:bg-yellow-950/30 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section6List", language))}
                  </div>
                </div>
                <div className="bg-red-100 dark:bg-destructive/20 p-3 rounded-lg">
                  <p className="text-sm font-bold text-red-800 dark:text-destructive-foreground">
                    {t("section6Warning", language)}
                  </p>
                </div>
              </div>
            </section>

            {/* Section 7 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section7Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section7Text", language)}</p>
                <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20">
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section7List", language))}
                  </div>
                </div>
                <div className="bg-red-100 dark:bg-destructive/20 p-3 rounded-lg">
                  <p className="text-sm font-bold text-red-800 dark:text-destructive-foreground">
                    {t("section7Warning", language)}
                  </p>
                </div>
              </div>
            </section>

            {/* Section 8 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section8Title", language)}
              </h2>
              <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="text-sm leading-relaxed">
                  {formatText(t("section8List", language))}
                </div>
              </div>
            </section>

            {/* Section 9 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section9Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section9Text", language)}</p>
                <div className="bg-muted/20 p-4 rounded-lg">
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section9List", language))}
                  </div>
                </div>
                <div className="bg-red-100 dark:bg-destructive/20 p-3 rounded-lg">
                  <p className="text-sm font-bold text-red-800 dark:text-destructive-foreground">
                    {t("section9Warning", language)}
                  </p>
                </div>
              </div>
            </section>

            {/* Section 10 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section10Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section10Text", language)}</p>
                <div className="bg-muted/20 p-4 rounded-lg">
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section10List", language))}
                  </div>
                </div>
              </div>
            </section>

            {/* Section 11 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section11Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section11Text", language)}</p>
                <div className="bg-muted/20 p-4 rounded-lg">
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section11List", language))}
                  </div>
                </div>
                <div className="bg-red-100 dark:bg-destructive/20 p-3 rounded-lg">
                  <p className="text-sm font-bold text-red-800 dark:text-destructive-foreground">
                    {t("section11Warning", language)}
                  </p>
                </div>
              </div>
            </section>

            {/* Section 12 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section12Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section12Text", language)}</p>
                <div className="bg-muted/20 p-4 rounded-lg">
                  <div className="text-sm leading-relaxed">
                    {formatText(t("section12List", language))}
                  </div>
                </div>
              </div>
            </section>

            {/* Section 13 */}
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-primary border-b pb-2">
                {t("section13Title", language)}
              </h2>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{t("section13Text", language)}</p>
                <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 text-center">
                  <p className="text-lg font-bold text-red-700 dark:text-primary">
                    {t("section13Contact", language)}
                  </p>
                </div>
              </div>
            </section>

            {/* Footer */}
            <section className="border-t pt-6 space-y-4">
              <div className="bg-muted/30 p-6 rounded-lg space-y-4">
                <blockquote className="text-sm leading-relaxed italic border-l-4 border-primary pl-4">
                  {t("footerQuote", language)}
                </blockquote>
                <div className="text-center space-y-2">
                  <p className="font-bold text-red-700 dark:text-primary">
                    {t("footerCopyright", language)}
                  </p>
                  <p className="text-sm font-bold text-red-600 dark:text-accent-foreground">
                    {t("footerWarning", language)}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
