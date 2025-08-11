import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronRight, 
  LayoutDashboard, Calendar, CalendarClock, ListTodo, Sparkles, Mic, 
  Users, Settings, Lightbulb, Navigation, MessageCircle, HelpCircle, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AppLayout } from '@/components/AppLayout';
import { SupportTicketModal } from '@/components/support/SupportTicketModal';
import { UserTicketList } from '@/components/support/UserTicketList';

export default function Help() {
  const { language } = useTheme();
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('guides');
  const [showTicketModal, setShowTicketModal] = useState(false);

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
              <li>1. {t('step1Record', language)}</li>
              <li>2. {t('step2Stop', language)}</li>
              <li>3. {t('step3Transcribe', language)}</li>
              <li>4. {t('step4Save', language)}</li>
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

  const refreshTickets = () => {
    setActiveTab('support');
  };

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto p-4 pb-8 scrollbar-hide bg-gradient-background min-h-screen">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center relative">
            <div className="absolute inset-0 bg-gradient-primary rounded-3xl blur-2xl opacity-20 scale-110"></div>
            <div className="absolute inset-0 bg-gradient-card rounded-3xl blur-xl opacity-40 scale-105"></div>
            <div className="relative bg-gradient-card/30 backdrop-blur-2xl border border-border/30 rounded-3xl p-10 shadow-2xl">
              <h1 className="text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
                {t('howToUseWakti', language)}
              </h1>
              <p className="text-muted-foreground/90 text-xl font-medium">{t('helpAndGuides', language)}</p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 bg-gradient-card/50 backdrop-blur-sm">
              <TabsTrigger value="guides" className="data-[state=active]:bg-primary/20">
                {language === 'ar' ? 'الأدلة' : 'Guides'}
              </TabsTrigger>
              <TabsTrigger value="support" className="data-[state=active]:bg-primary/20">
                {language === 'ar' ? 'الدعم' : 'Support'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="guides" className="space-y-6">
              {/* Need Help? Card */}
              <Card className="bg-gradient-card/40 backdrop-blur-2xl border-border/40">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-gradient-card/50 backdrop-blur-sm border border-border/40">
                      <HelpCircle className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-xl bg-gradient-primary bg-clip-text text-transparent">
                        {language === 'ar' ? 'هل تحتاج مساعدة؟' : 'Need Help?'}
                      </CardTitle>
                      <CardDescription>
                        {language === 'ar' ? 'تواصل مع فريق الدعم' : 'Contact our support team'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground/90 mb-4">
                    {language === 'ar' 
                      ? 'إذا كان لديك أي أسئلة أو تحتاج مساعدة، لا تتردد في التواصل معنا'
                      : 'If you have any questions or need assistance, don\'t hesitate to reach out to us'
                    }
                  </p>
                  <Button onClick={() => setShowTicketModal(true)} className="w-full">
                    <Ticket className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'فتح تذكرة دعم' : 'Open Support Ticket'}
                  </Button>
                </CardContent>
              </Card>

              {/* Collapsible Navigation Tips - Moved to Top */}
              <Card className="bg-gradient-card/40 backdrop-blur-2xl border-border/40">
                <Collapsible 
                  open={openSections.includes('navigation')}
                  onOpenChange={() => toggleSection('navigation')}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gradient-card/30 transition-all duration-500">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-2xl bg-gradient-card/50 backdrop-blur-sm border border-border/40">
                            <Navigation className="h-5 w-5 text-blue-500" />
                          </div>
                          <div>
                            <CardTitle className="text-xl bg-gradient-primary bg-clip-text text-transparent">
                              {language === 'ar' ? 'نصائح التنقّل' : 'Navigation Tips'}
                            </CardTitle>
                            <CardDescription>
                              {language === 'ar' ? 'كيفية التنقل في التطبيق' : 'How to navigate the app'}
                            </CardDescription>
                          </div>
                        </div>
                        <ChevronRight 
                          className={cn(
                            "h-6 w-6 transition-all duration-500 text-muted-foreground/60",
                            openSections.includes('navigation') ? 'rotate-90' : ''
                          )} 
                        />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="bg-gradient-card/30 backdrop-blur-lg rounded-2xl p-6 border border-border/30">
                        <div className="space-y-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                              <span className="text-sm font-semibold text-blue-400">1</span>
                            </div>
                            <p className="text-sm text-muted-foreground/90">
                              {language === 'ar' 
                                ? 'استخدم شريط التنقل السفلي للانتقال بين الأقسام الرئيسية'
                                : 'Use the bottom navigation bar to move between main sections'
                              }
                            </p>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                              <span className="text-sm font-semibold text-blue-400">2</span>
                            </div>
                            <p className="text-sm text-muted-foreground/90">
                              {language === 'ar' 
                                ? 'اضغط على صورة الملف الشخصي في الأعلى للوصول للإعدادات والرسائل'
                                : 'Tap your profile picture at the top to access settings and messages'
                              }
                            </p>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                              <span className="text-sm font-semibold text-blue-400">3</span>
                            </div>
                            <p className="text-sm text-muted-foreground/90">
                              {language === 'ar' 
                                ? 'اسحب لأسفل في أي صفحة لتحديث المحتوى'
                                : 'Pull down on any page to refresh content'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Collapsible Tips & Best Practices - Moved to Top */}
              <Card className="bg-gradient-card/40 backdrop-blur-2xl border-border/40">
                <Collapsible 
                  open={openSections.includes('tips')}
                  onOpenChange={() => toggleSection('tips')}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gradient-card/30 transition-all duration-500">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-2xl bg-gradient-card/50 backdrop-blur-sm border border-border/40">
                            <Lightbulb className="h-5 w-5 text-amber-500" />
                          </div>
                          <div>
                            <CardTitle className="text-xl bg-gradient-primary bg-clip-text text-transparent">
                              {language === 'ar' ? 'نصائح وأفضل الممارسات' : 'Tips & Best Practices'}
                            </CardTitle>
                            <CardDescription>
                              {language === 'ar' ? 'نصائح وحيل لاستخدام أفضل لـ WAKTI' : 'Tips and tricks for better WAKTI usage'}
                            </CardDescription>
                          </div>
                        </div>
                        <ChevronRight 
                          className={cn(
                            "h-6 w-6 transition-all duration-500 text-muted-foreground/60",
                            openSections.includes('tips') ? 'rotate-90' : ''
                          )} 
                        />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="bg-gradient-card/30 backdrop-blur-lg rounded-2xl p-6 border border-border/30">
                        <div className="space-y-4">
                          {tips.map((tip, index) => (
                            <div key={index} className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                                <span className="text-sm font-semibold text-amber-400">💡</span>
                              </div>
                              <p className="text-sm text-muted-foreground/90">{tip}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Main Sections */}
              <div className="space-y-6">
                {sections.map((section) => (
                  <Card key={section.id} className="bg-gradient-card/40 backdrop-blur-2xl border-border/40">
                    <Collapsible 
                      open={openSections.includes(section.id)}
                      onOpenChange={() => toggleSection(section.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-gradient-card/30 transition-all duration-500">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={cn("p-3 rounded-2xl bg-gradient-card/50 backdrop-blur-sm border border-border/40", section.colorClass)}>
                                {section.icon}
                              </div>
                              <div>
                                <CardTitle className="text-xl bg-gradient-primary bg-clip-text text-transparent">
                                  {section.title}
                                </CardTitle>
                                <CardDescription>
                                  {section.description}
                                </CardDescription>
                              </div>
                            </div>
                            <ChevronRight 
                              className={cn(
                                "h-6 w-6 transition-all duration-500 text-muted-foreground/60",
                                openSections.includes(section.id) ? 'rotate-90' : ''
                              )} 
                            />
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent>
                          <div className="bg-gradient-card/30 backdrop-blur-lg rounded-2xl p-6 border border-border/30">
                            {section.content}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                ))}
              </div>

            </TabsContent>

            <TabsContent value="support" className="space-y-6">
              {/* Open Support Ticket Button */}
              <Card className="bg-gradient-card/40 backdrop-blur-2xl border-border/40">
                <CardContent className="p-6">
                  <Button 
                    onClick={() => setShowTicketModal(true)}
                    size="lg"
                    className="w-full bg-gradient-primary hover:bg-gradient-primary/90"
                  >
                    <Ticket className="h-5 w-5 mr-2" />
                    {language === 'ar' ? 'فتح تذكرة دعم' : 'Open Support Ticket'}
                  </Button>
                </CardContent>
              </Card>

              {/* User Ticket List */}
              <UserTicketList key={activeTab} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Support Ticket Modal */}
        <SupportTicketModal
          isOpen={showTicketModal}
          onClose={() => setShowTicketModal(false)}
          onSubmitted={refreshTickets}
        />
      </div>
    </AppLayout>
  );
}