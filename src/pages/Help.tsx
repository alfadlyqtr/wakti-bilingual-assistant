import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronRight, 
  LayoutDashboard, Calendar, CalendarClock, ListTodo, Sparkles, Mic, 
  Users, Settings, Lightbulb, Navigation, MessageCircle, HelpCircle, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { AppHeader } from '@/components/AppHeader';
import { SimpleContactFormModal } from '@/components/support/SimpleContactFormModal';
import { ChatThread } from '@/components/support/ChatThread';
import { formatDistanceToNow } from 'date-fns';

export default function Help() {
  const { language } = useTheme();
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('guides');
  const [showContactModal, setShowContactModal] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

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

  // Read initial tab from query param (e.g., /help?tab=support)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'support') {
      setActiveTab('support');
    }
  }, [searchParams]);

  const loadSubmissions = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      if (!profile?.email) return;
      if (!userEmail) setUserEmail(profile.email);

      const { data, error } = await supabase
        .from('contact_submissions')
        .select('*')
        .eq('email', profile.email)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error loading submissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSubmissions = () => {
    setActiveTab('support');
    loadSubmissions();
  };

  React.useEffect(() => {
    if (activeTab === 'support') {
      loadSubmissions();
    }
  }, [activeTab]);

  // Realtime updates for the signed-in user's submissions
  React.useEffect(() => {
    if (activeTab !== 'support') return;

    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      // Ensure we have the user's email for filtered realtime
      if (!userEmail) {
        await loadSubmissions();
      }
      if (!isMounted || !userEmail) return;

      channel = supabase
        .channel('help-user-submissions')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'contact_submissions', filter: `email=eq.${userEmail}` },
          () => loadSubmissions()
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'contact_submissions', filter: `email=eq.${userEmail}` },
          () => loadSubmissions()
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'contact_submissions', filter: `email=eq.${userEmail}` },
          () => loadSubmissions()
        )
        .subscribe();
    };

    setup();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [activeTab, userEmail]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main>
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide bg-gradient-background min-h-screen">

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
                {selectedSubmission ? (
                  <ChatThread
                    submission={selectedSubmission}
                    onClose={() => setSelectedSubmission(null)}
                    isAdmin={false}
                  />
                ) : (
                  <>
                    {/* Contact Support Button */}
                    <Card className="bg-gradient-card/40 backdrop-blur-2xl border-border/40">
                      <CardContent className="p-6">
                        <Button 
                          onClick={() => setShowContactModal(true)}
                          size="lg"
                          className="w-full bg-gradient-primary hover:bg-gradient-primary/90"
                        >
                          <MessageCircle className="h-5 w-5 mr-2" />
                          {language === 'ar' ? 'التواصل مع الدعم' : 'Contact Support'}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Your Messages */}
                    <Card className="bg-gradient-card/40 backdrop-blur-2xl border-border/40">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 bg-gradient-primary bg-clip-text text-transparent">
                          <MessageCircle className="h-5 w-5 text-primary" />
                          {language === 'ar' ? 'رسائلك' : 'Your Messages'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {isLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          </div>
                        ) : submissions.length === 0 ? (
                          <div className="text-center py-8">
                            <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">
                              {language === 'ar' ? 'لا توجد رسائل بعد' : 'No messages yet'}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {submissions.map((submission) => {
                              const createdAt = submission.created_at ? new Date(submission.created_at) : null;
                              const relative = createdAt ? formatDistanceToNow(createdAt, { addSuffix: true }) : '';
                              const status = submission.status;
                              const isClosed = status === 'closed';
                              const statusLabel = isClosed ? 'Closed by WAKTI Support' : status;
                              const statusClass =
                                status === 'unread' ? "bg-red-500/20 text-red-400" :
                                status === 'read' ? "bg-yellow-500/20 text-yellow-400" :
                                isClosed ? "bg-green-600/20 text-green-500" :
                                "bg-blue-500/20 text-blue-400"; // responded/other

                              return (
                                <div
                                  key={submission.id}
                                  onClick={() => setSelectedSubmission(submission)}
                                  className="p-4 bg-gradient-card/30 rounded-lg border border-border/40 cursor-pointer hover:bg-gradient-card/50 transition-all duration-200"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="mt-0.5">
                                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Ticket className="h-4 w-4 text-primary" />
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <span className="font-medium text-foreground truncate">
                                          {submission.subject || (language === 'ar' ? 'طلب دعم' : 'Support Request')}
                                        </span>
                                        <span className={cn("text-[11px] px-2 py-1 rounded-full whitespace-nowrap", statusClass)}>
                                          {statusLabel}
                                        </span>
                                      </div>
                                      <p className="text-sm text-muted-foreground line-clamp-2">
                                        {submission.message}
                                      </p>
                                      <div className="flex items-center justify-between mt-2">
                                        <p className="text-xs text-muted-foreground/70" title={createdAt ? createdAt.toLocaleString() : ''}>
                                          {relative}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Contact Form Modal */}
          <SimpleContactFormModal
            isOpen={showContactModal}
            onClose={() => setShowContactModal(false)}
            onSubmitted={refreshSubmissions}
          />
        </div>
      </main>
    </div>
  );
}