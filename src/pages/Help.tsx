
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, 
  LayoutDashboard, Calendar, CalendarClock, ListTodo, Sparkles, Mic, 
  Users, Settings, Lightbulb, Navigation, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function Help() {
  const { language } = useTheme();
  const [openSections, setOpenSections] = useState<string[]>(['dashboard']);

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const sections = [
    {
      id: 'dashboard',
      icon: <LayoutDashboard className="h-5 w-5" />,
      title: t('dashboardTitle', language),
      description: t('dashboardDesc', language),
      colorClass: 'text-primary',
      glowClass: 'hover:shadow-glow',
      content: (
        <div className="space-y-3">
          <div>
            <h4 className="font-medium mb-2 bg-gradient-primary bg-clip-text text-transparent">{t('widgetManagement', language)}</h4>
            <p className="text-sm text-muted-foreground/80 mb-2">{t('widgetManagementDesc', language)}</p>
            <ul className="text-sm space-y-1 ml-4">
              <li>• {t('dailyQuoteWidget', language)}</li>
              <li>• {t('tasksWidget', language)}</li>
              <li>• {t('eventsWidget', language)}</li>
              <li>• {t('maw3dWidget', language)}</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'wakti-ai',
      icon: <Sparkles className="h-5 w-5" />,
      title: t('waktiAiTitle', language),
      description: t('waktiAiDesc', language),
      colorClass: 'nav-icon-ai text-orange-500',
      glowClass: 'hover:shadow-glow-orange',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-1 text-orange-400">{t('chatMode', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('chatModeDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-orange-400">{t('searchMode', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('searchModeDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-orange-400">{language === 'ar' ? 'وضع الصور' : 'Image Mode'}</h4>
            <p className="text-sm text-muted-foreground/80">{language === 'ar' ? 'ارفع الصور لتحليل الذكاء الاصطناعي، استخراج النص، أو الوصف التفصيلي.' : 'Upload images for AI analysis, text extraction, or detailed description.'}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-orange-400">{language === 'ar' ? 'مولد النصوص' : 'Text Generator'}</h4>
            <p className="text-sm text-muted-foreground/80">{language === 'ar' ? 'أنشئ نصوص مخصصة للرسائل، المقالات، أو أي محتوى نصي تحتاجه بمساعدة الذكاء الاصطناعي.' : 'Generate custom texts for messages, articles, or any written content you need with AI assistance.'}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-orange-400">{language === 'ar' ? 'المترجم الصوتي' : 'Voice Translator'}</h4>
            <p className="text-sm text-muted-foreground/80">{language === 'ar' ? 'ترجم النصوص أو الصوت بين اللغات المختلفة مع إمكانية التحويل إلى كلام.' : 'Translate text or voice between different languages with text-to-speech conversion.'}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-orange-400">{language === 'ar' ? 'استنساخ الصوت' : 'Voice Clone'}</h4>
            <p className="text-sm text-muted-foreground/80">{language === 'ar' ? 'أنشئ نسخة صوتية مخصصة من صوتك لاستخدامها في الردود الصوتية والتفاعلات.' : 'Create a personalized voice clone of your voice for use in voice responses and interactions.'}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-orange-400">{t('voiceFeatures', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('voiceFeaturesDesc', language)}</p>
          </div>
        </div>
      )
    },
    {
      id: 'tasjeel',
      icon: <Mic className="h-5 w-5" />,
      title: t('tasjeelTitle', language),
      description: t('tasjeelDesc', language),
      colorClass: 'text-cyan-500',
      glowClass: 'hover:shadow-glow-blue',
      content: (
        <div className="space-y-3">
          <div>
            <h4 className="font-medium mb-2 text-cyan-400">{t('recordingSteps', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>{t('step1Record', language)}</li>
              <li>{t('step2Stop', language)}</li>
              <li>{t('step3Transcribe', language)}</li>
              <li>{t('step4Save', language)}</li>
            </ul>
          </div>
          <p className="text-sm text-muted-foreground/80">{t('autoDeleteFeature', language)}</p>
        </div>
      )
    },
    {
      id: 'maw3d',
      icon: <CalendarClock className="h-5 w-5" />,
      title: t('maw3dTitle', language),
      description: t('maw3dDesc', language),
      colorClass: 'nav-icon-maw3d text-purple-500',
      glowClass: 'hover:shadow-glow-purple',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2 text-purple-400">{t('createEvent', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>{t('eventStep1', language)}</li>
              <li>{t('eventStep2', language)}</li>
              <li>{t('eventStep3', language)}</li>
              <li>{t('eventStep4', language)}</li>
              <li>{t('eventStep5', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2 text-purple-400">{t('manageEvent', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>• {t('checkAttendance', language)}</li>
              <li>• {t('eventCustomization', language)}</li>
              <li>• {t('eventFollowup', language)}</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'tr',
      icon: <ListTodo className="h-5 w-5" />,
      title: t('trTitle', language),
      description: t('trDesc', language),
      colorClass: 'nav-icon-tr text-green-500',
      glowClass: 'hover:shadow-glow-green',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2 text-green-400">{t('createTask', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>{t('taskStep1', language)}</li>
              <li>{t('taskStep2', language)}</li>
              <li>{t('taskStep3', language)}</li>
              <li>{t('taskStep4', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2 text-green-400">{t('shareTask', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>{t('shareStep1', language)}</li>
              <li>{t('shareStep2', language)}</li>
              <li>{t('shareStep3', language)}</li>
            </ul>
            <p className="text-sm text-muted-foreground/80 mt-2">{t('sharedTaskFeatures', language)}</p>
          </div>
        </div>
      )
    },
    {
      id: 'calendar',
      icon: <Calendar className="h-5 w-5" />,
      title: t('calendarTitle', language),
      description: t('calendarDesc', language),
      colorClass: 'nav-icon-calendar text-blue-500',
      glowClass: 'hover:shadow-glow-blue',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2 text-blue-400">{t('calendarViews', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>• {t('monthView', language)}</li>
              <li>• {t('weekView', language)}</li>
              <li>• {t('yearView', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2 text-blue-400">{t('calendarIcons', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>• {t('taskIcon', language)}</li>
              <li>• {t('eventIcon', language)}</li>
              <li>• {t('reminderIcon', language)}</li>
            </ul>
            <p className="text-sm text-muted-foreground/80 mt-2">{t('colorCoding', language)}</p>
          </div>
        </div>
      )
    },
    {
      id: 'contacts',
      icon: <MessageCircle className="h-5 w-5" />,
      title: t('contactsTitle', language),
      description: t('contactsDesc', language),
      colorClass: 'text-pink-500',
      glowClass: 'hover:shadow-glow',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2 text-pink-400">{t('addContacts', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>{t('contactStep1', language)}</li>
              <li>{t('contactStep2', language)}</li>
              <li>{t('contactStep3', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2 text-pink-400">{t('messaging', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>• {t('textMessages', language)}</li>
              <li>• {t('voiceMessages', language)}</li>
              <li>• {t('imageSharing', language)}</li>
              <li>• {t('privacyControls', language)}</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'settings',
      icon: <Settings className="h-5 w-5" />,
      title: t('settingsTitle', language),
      description: t('settingsDesc', language),
      colorClass: 'text-amber-500',
      glowClass: 'hover:shadow-glow',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2 text-amber-400">{t('accountSettings', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>• {t('profileInfo', language)}</li>
              <li>• {t('languageToggle', language)}</li>
              <li>• {t('themeSettings', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2 text-amber-400">{t('notificationPrefs', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>• {t('pushNotifications', language)}</li>
              <li>• {t('emailNotifications', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2 text-amber-400">{t('privacySettings', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>• {t('dataManagement', language)}</li>
              <li>• {t('accountDeletion', language)}</li>
            </ul>
          </div>
        </div>
      )
    }
  ];

  const tips = [
    t('tip1', language),
    t('tip2', language),
    t('tip3', language),
    t('tip4', language),
    t('tip5', language)
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-28 scrollbar-hide bg-gradient-background min-h-screen">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header - Enhanced 3D Liquid Glass Effect */}
        <div className="text-center relative">
          <div className="absolute inset-0 bg-gradient-primary rounded-3xl blur-2xl opacity-20 scale-110"></div>
          <div className="absolute inset-0 bg-gradient-card rounded-3xl blur-xl opacity-40 scale-105"></div>
          <div className="relative bg-gradient-card/30 backdrop-blur-2xl border border-border/30 rounded-3xl p-10 shadow-2xl transform perspective-1000 hover:rotate-x-2 transition-all duration-700 hover:shadow-colored">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 rounded-3xl"></div>
            <div className="relative z-10">
              <h1 className="text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent animate-shimmer drop-shadow-lg">
                {t('howToUseWakti', language)}
              </h1>
              <p className="text-muted-foreground/90 text-xl font-medium">{t('helpAndGuides', language)}</p>
            </div>
          </div>
        </div>

        {/* Main Sections - Enhanced 3D Glass */}
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.id} className="relative group">
              <div className={cn(
                "absolute inset-0 rounded-3xl blur-2xl opacity-0 group-hover:opacity-40 transition-all duration-700 scale-110",
                section.glowClass
              )}></div>
              <div className="absolute inset-0 bg-gradient-card/20 rounded-3xl blur-lg opacity-30 group-hover:opacity-50 transition-all duration-500 scale-105"></div>
              <Card className={cn(
                "overflow-hidden relative bg-gradient-card/40 backdrop-blur-2xl border-border/40",
                "hover:bg-gradient-card/50 hover:border-border/60 hover:shadow-2xl",
                "transform hover:-translate-y-2 hover:scale-[1.01] transition-all duration-700",
                "shadow-xl hover:shadow-colored perspective-1000"
              )}>
                <Collapsible 
                  open={openSections.includes(section.id)}
                  onOpenChange={() => toggleSection(section.id)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gradient-card/30 transition-all duration-500 group/header">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <div className={cn(
                            "p-4 rounded-2xl bg-gradient-card/50 backdrop-blur-sm border border-border/40",
                            "group-hover/header:scale-110 transition-all duration-500 shadow-lg",
                            "group-hover/header:shadow-2xl group-hover/header:rotate-3",
                            section.colorClass
                          )}>
                            {section.icon}
                          </div>
                          <div className="text-left">
                            <CardTitle className={cn(
                              "text-2xl bg-gradient-primary bg-clip-text text-transparent font-bold",
                              "group-hover/header:animate-shimmer drop-shadow-sm"
                            )}>
                              {section.title}
                            </CardTitle>
                            <CardDescription className="text-base text-muted-foreground/80 font-medium">
                              {section.description}
                            </CardDescription>
                          </div>
                        </div>
                        <ChevronRight 
                          className={cn(
                            "h-7 w-7 transition-all duration-500 text-muted-foreground/60",
                            "group-hover/header:text-foreground group-hover/header:scale-125",
                            openSections.includes(section.id) ? 'rotate-90' : ''
                          )} 
                        />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-8">
                      <div className="bg-gradient-card/30 backdrop-blur-lg rounded-2xl p-6 border border-border/30 shadow-inner">
                        {section.content}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            </div>
          ))}
        </div>

        {/* Tips Section - Enhanced 3D Glass Effect with Shadow Behind Title */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-warm rounded-3xl blur-2xl opacity-0 group-hover:opacity-40 transition-all duration-700 scale-110"></div>
          <div className="absolute inset-0 bg-gradient-card/20 rounded-3xl blur-lg opacity-40 group-hover:opacity-60 transition-all duration-500 scale-105"></div>
          <Card className="relative bg-gradient-card/40 backdrop-blur-2xl border-border/40 hover:bg-gradient-card/50 hover:border-border/60 transition-all duration-700 hover:shadow-2xl transform hover:-translate-y-2 hover:scale-[1.01] shadow-xl perspective-1000">
            <CardHeader className="relative">
              {/* Shadow behind title */}
              <div className="absolute -inset-2 bg-gradient-warm/30 rounded-2xl blur-xl opacity-60 scale-110"></div>
              <CardTitle className="flex items-center gap-4 text-2xl relative z-10">
                <div className="p-3 rounded-2xl bg-gradient-warm/50 backdrop-blur-sm border border-border/40 shadow-lg hover:scale-110 hover:rotate-3 transition-all duration-500">
                  <Lightbulb className="h-7 w-7 text-yellow-400" />
                </div>
                <span className="bg-gradient-warm bg-clip-text text-transparent font-bold drop-shadow-lg">
                  {t('tipsTitle', language)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gradient-card/30 backdrop-blur-lg rounded-2xl p-6 border border-border/30 shadow-inner">
                <ul className="space-y-4">
                  {tips.map((tip, index) => (
                    <li key={index} className="text-sm flex items-start gap-4 group/tip">
                      <span className="text-yellow-400 font-bold text-lg bg-gradient-warm/40 backdrop-blur-sm rounded-full w-8 h-8 flex items-center justify-center border border-yellow-400/40 group-hover/tip:scale-110 group-hover/tip:rotate-12 transition-all duration-500 shadow-lg">
                        {index + 1}
                      </span>
                      <span className="text-muted-foreground/90 group-hover/tip:text-foreground transition-colors duration-500 font-medium leading-relaxed">
                        {tip}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tips - Enhanced 3D Glass Effect with Shadow Behind Title */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-cool rounded-3xl blur-2xl opacity-0 group-hover:opacity-40 transition-all duration-700 scale-110"></div>
          <div className="absolute inset-0 bg-gradient-card/20 rounded-3xl blur-lg opacity-40 group-hover:opacity-60 transition-all duration-500 scale-105"></div>
          <Card className="relative bg-gradient-card/40 backdrop-blur-2xl border-border/40 hover:bg-gradient-card/50 hover:border-border/60 transition-all duration-700 hover:shadow-2xl transform hover:-translate-y-2 hover:scale-[1.01] shadow-xl perspective-1000">
            <CardHeader className="relative">
              {/* Shadow behind title */}
              <div className="absolute -inset-2 bg-gradient-cool/30 rounded-2xl blur-xl opacity-60 scale-110"></div>
              <CardTitle className="flex items-center gap-4 text-2xl relative z-10">
                <div className="p-3 rounded-2xl bg-gradient-cool/50 backdrop-blur-sm border border-border/40 shadow-lg hover:scale-110 hover:rotate-3 transition-all duration-500">
                  <Navigation className="h-7 w-7 text-blue-400" />
                </div>
                <span className="bg-gradient-cool bg-clip-text text-transparent font-bold drop-shadow-lg">
                  {t('navigationTitle', language)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gradient-card/30 backdrop-blur-lg rounded-2xl p-6 border border-border/30 shadow-inner">
                <ul className="space-y-3 text-base">
                  <li className="text-muted-foreground/90 font-medium">• {t('mobileNav', language)}</li>
                  <li className="text-muted-foreground/90 font-medium">• {t('userMenu', language)}</li>
                  <li className="text-muted-foreground/90 font-medium">• {t('backButtons', language)}</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Support Section - Premium 3D Glass Effect */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-vibrant rounded-3xl blur-2xl opacity-0 group-hover:opacity-50 transition-all duration-700 scale-110"></div>
          <div className="absolute inset-0 bg-gradient-card/20 rounded-3xl blur-lg opacity-50 group-hover:opacity-70 transition-all duration-500 scale-105"></div>
          <Card className="relative bg-gradient-vibrant/30 backdrop-blur-2xl border-primary/40 hover:bg-gradient-vibrant/40 hover:border-primary/60 transition-all duration-700 hover:shadow-2xl transform hover:-translate-y-3 hover:scale-[1.02] shadow-xl perspective-1000">
            <CardContent className="text-center p-12">
              <div className="mb-6">
                <div className="inline-flex p-6 rounded-3xl bg-gradient-primary/30 backdrop-blur-lg border border-primary/40 shadow-2xl hover:scale-110 hover:rotate-3 transition-all duration-700">
                  <MessageCircle className="h-10 w-10 text-primary animate-pulse-color" />
                </div>
              </div>
              <h3 className="font-bold text-3xl mb-4 bg-gradient-primary bg-clip-text text-transparent drop-shadow-lg">
                {t('needHelp', language)}
              </h3>
              <p className="text-base text-muted-foreground/90 mb-8 leading-relaxed font-medium max-w-md mx-auto">
                {t('contactSupport', language)}
              </p>
              <Button 
                variant="outline" 
                size="lg"
                className="bg-gradient-card/50 backdrop-blur-lg border-primary/40 hover:bg-gradient-primary/30 hover:border-primary/60 hover:shadow-2xl transition-all duration-500 hover:scale-110 hover:rotate-1 text-lg px-8 py-3 font-semibold"
              >
                {t('contact', language)}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
