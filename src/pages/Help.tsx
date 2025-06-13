
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, 
  LayoutDashboard, Bot, Mic, Calendar as CalendarIcon, 
  CheckSquare, Users, Settings, Lightbulb, Navigation, 
  PartyPopper, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

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
      content: (
        <div className="space-y-3">
          <div>
            <h4 className="font-medium mb-2">{t('widgetManagement', language)}</h4>
            <p className="text-sm text-muted-foreground mb-2">{t('widgetManagementDesc', language)}</p>
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
      icon: <Bot className="h-5 w-5" />,
      title: t('waktiAiTitle', language),
      description: t('waktiAiDesc', language),
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-1">{t('chatMode', language)}</h4>
            <p className="text-sm text-muted-foreground">{t('chatModeDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">{t('searchMode', language)}</h4>
            <p className="text-sm text-muted-foreground">{t('searchModeDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">{t('imageMode', language)}</h4>
            <p className="text-sm text-muted-foreground">{t('imageModeDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">{t('voiceFeatures', language)}</h4>
            <p className="text-sm text-muted-foreground">{t('voiceFeaturesDesc', language)}</p>
          </div>
        </div>
      )
    },
    {
      id: 'tasjeel',
      icon: <Mic className="h-5 w-5" />,
      title: t('tasjeelTitle', language),
      description: t('tasjeelDesc', language),
      content: (
        <div className="space-y-3">
          <div>
            <h4 className="font-medium mb-2">{t('recordingSteps', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>{t('step1Record', language)}</li>
              <li>{t('step2Stop', language)}</li>
              <li>{t('step3Transcribe', language)}</li>
              <li>{t('step4Save', language)}</li>
            </ul>
          </div>
          <p className="text-sm text-muted-foreground">{t('autoDeleteFeature', language)}</p>
        </div>
      )
    },
    {
      id: 'maw3d',
      icon: <PartyPopper className="h-5 w-5" />,
      title: t('maw3dTitle', language),
      description: t('maw3dDesc', language),
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">{t('createEvent', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>{t('eventStep1', language)}</li>
              <li>{t('eventStep2', language)}</li>
              <li>{t('eventStep3', language)}</li>
              <li>{t('eventStep4', language)}</li>
              <li>{t('eventStep5', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">{t('manageEvent', language)}</h4>
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
      icon: <CheckSquare className="h-5 w-5" />,
      title: t('trTitle', language),
      description: t('trDesc', language),
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">{t('createTask', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>{t('taskStep1', language)}</li>
              <li>{t('taskStep2', language)}</li>
              <li>{t('taskStep3', language)}</li>
              <li>{t('taskStep4', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">{t('shareTask', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>{t('shareStep1', language)}</li>
              <li>{t('shareStep2', language)}</li>
              <li>{t('shareStep3', language)}</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">{t('sharedTaskFeatures', language)}</p>
          </div>
        </div>
      )
    },
    {
      id: 'calendar',
      icon: <CalendarIcon className="h-5 w-5" />,
      title: t('calendarTitle', language),
      description: t('calendarDesc', language),
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">{t('calendarViews', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>• {t('monthView', language)}</li>
              <li>• {t('weekView', language)}</li>
              <li>• {t('yearView', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">{t('calendarIcons', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>• {t('taskIcon', language)}</li>
              <li>• {t('eventIcon', language)}</li>
              <li>• {t('reminderIcon', language)}</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">{t('colorCoding', language)}</p>
          </div>
        </div>
      )
    },
    {
      id: 'contacts',
      icon: <MessageCircle className="h-5 w-5" />,
      title: t('contactsTitle', language),
      description: t('contactsDesc', language),
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">{t('addContacts', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>{t('contactStep1', language)}</li>
              <li>{t('contactStep2', language)}</li>
              <li>{t('contactStep3', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">{t('messaging', language)}</h4>
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
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">{t('accountSettings', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>• {t('profileInfo', language)}</li>
              <li>• {t('languageToggle', language)}</li>
              <li>• {t('themeSettings', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">{t('notificationPrefs', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>• {t('pushNotifications', language)}</li>
              <li>• {t('emailNotifications', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">{t('privacySettings', language)}</h4>
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
    <div className="flex-1 overflow-y-auto p-4 pb-28 scrollbar-hide">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">{t('howToUseWakti', language)}</h1>
          <p className="text-muted-foreground">{t('helpAndGuides', language)}</p>
        </div>

        {/* Main Sections */}
        <div className="space-y-3">
          {sections.map((section) => (
            <Card key={section.id} className="overflow-hidden">
              <Collapsible 
                open={openSections.includes(section.id)}
                onOpenChange={() => toggleSection(section.id)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-primary">
                          {section.icon}
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-lg">{section.title}</CardTitle>
                          <CardDescription className="text-sm">
                            {section.description}
                          </CardDescription>
                        </div>
                      </div>
                      <ChevronRight 
                        className={`h-5 w-5 transition-transform ${
                          openSections.includes(section.id) ? 'rotate-90' : ''
                        }`} 
                      />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {section.content}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>

        {/* Tips Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              {t('tipsTitle', language)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {tips.map((tip, index) => (
                <li key={index} className="text-sm flex items-start gap-2">
                  <span className="text-primary font-medium">{index + 1}.</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Navigation Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-blue-500" />
              {t('navigationTitle', language)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>• {t('mobileNav', language)}</li>
              <li>• {t('userMenu', language)}</li>
              <li>• {t('backButtons', language)}</li>
            </ul>
          </CardContent>
        </Card>

        {/* Support Section */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="text-center p-6">
            <h3 className="font-semibold mb-2">{t('needHelp', language)}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('contactSupport', language)}
            </p>
            <Button variant="outline" size="sm">
              {t('contact', language)}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
