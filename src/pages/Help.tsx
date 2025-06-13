
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
            <h4 className="font-medium mb-1 text-orange-400">{t('imageMode', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('imageModeDesc', language)}</p>
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
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header - Liquid Glass Effect */}
        <div className="text-center relative">
          <div className="absolute inset-0 bg-gradient-card rounded-2xl blur-xl opacity-30"></div>
          <div className="relative bg-gradient-card/20 backdrop-blur-xl border border-border/20 rounded-2xl p-8 shadow-vibrant">
            <h1 className="text-3xl font-bold mb-3 bg-gradient-primary bg-clip-text text-transparent animate-shimmer">
              {t('howToUseWakti', language)}
            </h1>
            <p className="text-muted-foreground/80 text-lg">{t('helpAndGuides', language)}</p>
          </div>
        </div>

        {/* Main Sections - Enhanced Liquid Glass */}
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.id} className="relative group">
              <div className={cn(
                "absolute inset-0 rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-all duration-500",
                section.glowClass
              )}></div>
              <Card className={cn(
                "overflow-hidden relative bg-gradient-card/30 backdrop-blur-xl border-border/30",
                "hover:bg-gradient-card/40 hover:border-border/50 hover:shadow-vibrant",
                "transform hover:-translate-y-1 transition-all duration-500",
                "hover:scale-[1.02]"
              )}>
                <Collapsible 
                  open={openSections.includes(section.id)}
                  onOpenChange={() => toggleSection(section.id)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gradient-card/20 transition-all duration-300 group/header">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "p-3 rounded-xl bg-gradient-card/40 backdrop-blur-sm border border-border/30",
                            "group-hover/header:scale-110 transition-all duration-300",
                            "group-hover/header:shadow-glow",
                            section.colorClass
                          )}>
                            {section.icon}
                          </div>
                          <div className="text-left">
                            <CardTitle className={cn(
                              "text-xl bg-gradient-primary bg-clip-text text-transparent",
                              "group-hover/header:animate-shimmer"
                            )}>
                              {section.title}
                            </CardTitle>
                            <CardDescription className="text-sm text-muted-foreground/70">
                              {section.description}
                            </CardDescription>
                          </div>
                        </div>
                        <ChevronRight 
                          className={cn(
                            "h-6 w-6 transition-all duration-300 text-muted-foreground/60",
                            "group-hover/header:text-foreground group-hover/header:scale-110",
                            openSections.includes(section.id) ? 'rotate-90' : ''
                          )} 
                        />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 pb-6">
                      <div className="bg-gradient-card/20 backdrop-blur-sm rounded-xl p-4 border border-border/20">
                        {section.content}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            </div>
          ))}
        </div>

        {/* Tips Section - Enhanced Glass Effect */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-warm rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-all duration-500"></div>
          <Card className="relative bg-gradient-card/30 backdrop-blur-xl border-border/30 hover:bg-gradient-card/40 hover:border-border/50 transition-all duration-500 hover:shadow-vibrant transform hover:-translate-y-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-gradient-warm/40 backdrop-blur-sm border border-border/30">
                  <Lightbulb className="h-6 w-6 text-yellow-400" />
                </div>
                <span className="bg-gradient-warm bg-clip-text text-transparent">
                  {t('tipsTitle', language)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gradient-card/20 backdrop-blur-sm rounded-xl p-4 border border-border/20">
                <ul className="space-y-3">
                  {tips.map((tip, index) => (
                    <li key={index} className="text-sm flex items-start gap-3 group/tip">
                      <span className="text-yellow-400 font-bold text-base bg-gradient-warm/30 backdrop-blur-sm rounded-full w-6 h-6 flex items-center justify-center border border-yellow-400/30 group-hover/tip:scale-110 transition-transform duration-300">
                        {index + 1}
                      </span>
                      <span className="text-muted-foreground/80 group-hover/tip:text-foreground transition-colors duration-300">
                        {tip}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tips - Enhanced Glass Effect */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-cool rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-all duration-500"></div>
          <Card className="relative bg-gradient-card/30 backdrop-blur-xl border-border/30 hover:bg-gradient-card/40 hover:border-border/50 transition-all duration-500 hover:shadow-vibrant transform hover:-translate-y-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-gradient-cool/40 backdrop-blur-sm border border-border/30">
                  <Navigation className="h-6 w-6 text-blue-400" />
                </div>
                <span className="bg-gradient-cool bg-clip-text text-transparent">
                  {t('navigationTitle', language)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gradient-card/20 backdrop-blur-sm rounded-xl p-4 border border-border/20">
                <ul className="space-y-2 text-sm">
                  <li className="text-muted-foreground/80">• {t('mobileNav', language)}</li>
                  <li className="text-muted-foreground/80">• {t('userMenu', language)}</li>
                  <li className="text-muted-foreground/80">• {t('backButtons', language)}</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Support Section - Premium Glass Effect */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-vibrant rounded-2xl blur-xl opacity-0 group-hover:opacity-40 transition-all duration-500"></div>
          <Card className="relative bg-gradient-vibrant/20 backdrop-blur-xl border-primary/30 hover:bg-gradient-vibrant/30 hover:border-primary/50 transition-all duration-500 hover:shadow-colored transform hover:-translate-y-2 hover:scale-[1.02]">
            <CardContent className="text-center p-8">
              <div className="mb-4">
                <div className="inline-flex p-4 rounded-2xl bg-gradient-primary/20 backdrop-blur-sm border border-primary/30">
                  <MessageCircle className="h-8 w-8 text-primary animate-pulse-color" />
                </div>
              </div>
              <h3 className="font-bold text-xl mb-3 bg-gradient-primary bg-clip-text text-transparent">
                {t('needHelp', language)}
              </h3>
              <p className="text-sm text-muted-foreground/80 mb-6 leading-relaxed">
                {t('contactSupport', language)}
              </p>
              <Button 
                variant="outline" 
                size="lg"
                className="bg-gradient-card/40 backdrop-blur-sm border-primary/30 hover:bg-gradient-primary/20 hover:border-primary/50 hover:shadow-glow transition-all duration-300 hover:scale-105"
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
