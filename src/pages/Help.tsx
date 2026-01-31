import React, { useState, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronRight, 
  LayoutDashboard, Calendar, CalendarClock, ListTodo, Sparkles, Mic, 
  Users, Settings, Lightbulb, Navigation, MessageCircle, HelpCircle, Ticket,
  Music, Heart, BookOpen, Gamepad2, AudioWaveform } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { SimpleContactFormModal } from '@/components/support/SimpleContactFormModal';
import { ChatThread } from '@/components/support/ChatThread';
import { HelpAssistantChat } from '@/components/help/HelpAssistantChat';
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
              <li>• {t('journalWidget', language)}</li>
              <li>• {t('whoopWidget', language)}</li>
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
            <h4 className="font-medium mb-1 text-orange-400">{t('modesButton', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('modesButtonDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-blue-500">{t('chatMode', language)}</h4>
            <p className="text-sm text-muted-foreground/80 mb-2">{t('chatModeDesc', language)}</p>
            <ul className="text-sm space-y-1 ml-4">
              <li className="text-blue-500">• {t('chatSubMode', language)}</li>
              <li className="text-purple-500">• {t('studySubMode', language)}</li>
              <li className="text-pink-500">• {t('talkSubMode', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-green-500">{t('searchMode', language)}</h4>
            <p className="text-sm text-muted-foreground/80 mb-2">{t('searchModeDesc', language)}</p>
            <ul className="text-sm space-y-1 ml-4">
              <li className="text-green-500">• {t('webSubMode', language)}</li>
              <li className="text-red-500">• {t('youtubeSubMode', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-orange-400">{t('imageMode', language)}</h4>
            <p className="text-sm text-muted-foreground/80 mb-2">{t('imageModeDesc', language)}</p>
            <ul className="text-sm space-y-1 ml-4">
              <li className="text-orange-500">• <strong>{t('textToImage', language)}:</strong> {t('textToImageDesc', language)}</li>
              <li className="text-orange-500">• <strong>{t('imageToImage', language)}:</strong> {t('imageToImageDesc', language)}</li>
              <li className="text-orange-500">• <strong>{t('backgroundRemoval', language)}:</strong> {t('backgroundRemovalDesc', language)}</li>
              <li className="text-orange-500">• <strong>{t('drawMode', language)}:</strong> {t('drawModeDesc', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-orange-400">{t('extraTab', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('extraTabDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-orange-400">{t('personalTouch', language)}</h4>
            <p className="text-sm text-muted-foreground/80 mb-2">{t('personalTouchDesc', language)}</p>
            <ul className="text-sm space-y-1 ml-4">
              <li>• {t('userNickname', language)}</li>
              <li>• {t('aiNickname', language)}</li>
              <li>• {t('toneStyle', language)}</li>
              <li>• {t('customNotes', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-orange-400">{t('talkBack', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('talkBackDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-orange-400">{t('conversationHistory', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('conversationHistoryDesc', language)}</p>
          </div>
        </div>
      )
    },
    {
      id: 'smart-tools',
      icon: <Lightbulb className="h-5 w-5" />,
      title: t('smartToolsTitle', language),
      description: t('smartToolsDesc', language),
      colorClass: 'text-emerald-500',
      glowClass: 'hover:shadow-glow',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-1 text-emerald-400">{t('textGenerator', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('textGeneratorDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-emerald-400">{t('presentationsFeature', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('presentationsFeatureDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-emerald-400">{t('diagramsTab', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('diagramsTabDesc', language)}</p>
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
        <div className="space-y-4">
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
          <div>
            <h4 className="font-medium mb-1 text-cyan-400">{t('quickSummaryUpload', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('quickSummaryUploadDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-cyan-400">{t('generateAudio', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('generateAudioDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-cyan-400">{t('savedRecordings', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('savedRecordingsDesc', language)}</p>
          </div>
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
            <h4 className="font-medium mb-2 text-purple-400">{t('helpCreateEvent', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>{t('eventStep1', language)}</li>
              <li>{t('eventStep2', language)}</li>
              <li>{t('eventStep3', language)}</li>
              <li>{t('eventStep4', language)}</li>
              <li>{t('eventStep5', language)}</li>
              <li>{t('eventStep6', language)}</li>
              <li>{t('eventStep7', language)}</li>
              <li>{t('eventStep8', language)}</li>
              <li>{t('eventStep9', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2 text-purple-400">{t('manageEvent', language)}</h4>
            <ul className="text-sm space-y-1">
              <li>• {t('checkAttendance', language)}</li>
              <li>• {t('eventCustomization', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-purple-400">{t('shareEvent', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('shareEventDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-purple-400">{t('publicEventView', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('publicEventViewDesc', language)}</p>
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
              <li>{t('taskStep5', language)}</li>
              <li>{t('taskStep6', language)}</li>
              <li>{t('taskStep7', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-green-400">{t('subtasksFeature', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('subtasksFeatureDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-green-400">{t('aiTaskGenerator', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('aiTaskGeneratorDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-green-400">{t('aiTidy', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('aiTidyDesc', language)}</p>
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
          <div>
            <h4 className="font-medium mb-1 text-green-400">{t('snoozeTask', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('snoozeTaskDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-green-400">{t('remindersFeature', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('remindersFeatureDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-green-400">{t('activityMonitor', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('activityMonitorDesc', language)}</p>
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
              <li>• {t('agendaView', language)}</li>
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
          <div>
            <h4 className="font-medium mb-1 text-blue-400">{t('manualNotes', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('manualNotesDesc', language)}</p>
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
              <li>{t('contactStep4', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-pink-400">{t('contactRequests', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('contactRequestsDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-pink-400">{t('blockedUsers', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('blockedUsersDesc', language)}</p>
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
          <div>
            <h4 className="font-medium mb-1 text-pink-400">{t('typingIndicator', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('typingIndicatorDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-pink-400">{t('savedMessages', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('savedMessagesDesc', language)}</p>
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
    },
    {
      id: 'voice-studio',
      icon: <AudioWaveform className="h-5 w-5" />,
      title: t('voiceStudioTitle', language),
      description: t('voiceStudioDesc', language),
      colorClass: 'text-indigo-500',
      glowClass: 'hover:shadow-glow',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-1 text-indigo-400">{t('ttsFeature', language)}</h4>
            <p className="text-sm text-muted-foreground/80 mb-2">{t('ttsFeatureDesc', language)}</p>
            <ul className="text-sm space-y-1">
              <li>{t('ttsStep1', language)}</li>
              <li>{t('ttsStep2', language)}</li>
              <li>{t('ttsStep3', language)}</li>
              <li>{t('ttsStep4', language)}</li>
              <li>{t('ttsStep5', language)}</li>
              <li>{t('ttsStep6', language)}</li>
            </ul>
            <p className="text-sm text-muted-foreground/80 mt-2">{t('ttsQuota', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-indigo-400">{t('voiceClone', language)}</h4>
            <p className="text-sm text-muted-foreground/80 mb-2">{t('voiceCloneDesc', language)}</p>
            <ul className="text-sm space-y-1">
              <li>{t('voiceCloneStep1', language)}</li>
              <li>{t('voiceCloneStep2', language)}</li>
              <li>{t('voiceCloneStep3', language)}</li>
              <li>{t('voiceCloneStep4', language)}</li>
            </ul>
            <p className="text-sm text-muted-foreground/80 mt-2">{t('voiceCloneTip', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-indigo-400">{t('voiceTranslator', language)}</h4>
            <p className="text-sm text-muted-foreground/80 mb-2">{t('voiceTranslatorDesc', language)}</p>
            <ul className="text-sm space-y-1">
              <li>{t('voiceTranslatorStep1', language)}</li>
              <li>{t('voiceTranslatorStep2', language)}</li>
              <li>{t('voiceTranslatorStep3', language)}</li>
              <li>{t('voiceTranslatorStep4', language)}</li>
              <li>{t('voiceTranslatorStep5', language)}</li>
              <li>{t('voiceTranslatorStep6', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-indigo-400">{t('textTranslator', language)}</h4>
            <p className="text-sm text-muted-foreground/80 mb-2">{t('textTranslatorDesc', language)}</p>
            <ul className="text-sm space-y-1">
              <li>{t('textTranslatorStep1', language)}</li>
              <li>{t('textTranslatorStep2', language)}</li>
              <li>{t('textTranslatorStep3', language)}</li>
              <li>{t('textTranslatorStep4', language)}</li>
              <li>{t('textTranslatorStep5', language)}</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'music-studio',
      icon: <Music className="h-5 w-5" />,
      title: t('musicStudioTitle', language),
      description: t('musicStudioDesc', language),
      colorClass: 'text-fuchsia-500',
      glowClass: 'hover:shadow-glow',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-1 text-fuchsia-400">{t('generateMusic', language)}</h4>
            <p className="text-sm text-muted-foreground/80 mb-2">{t('generateMusicDesc', language)}</p>
            <ul className="text-sm space-y-1">
              <li>{t('musicStep1', language)}</li>
              <li>{t('musicStep2', language)}</li>
              <li>{t('musicStep3', language)}</li>
              <li>{t('musicStep4', language)}</li>
              <li>{t('musicStep5', language)}</li>
            </ul>
            <p className="text-sm text-muted-foreground/80 mt-2">{t('musicQuota', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-fuchsia-400">{t('savedTracks', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('savedTracksDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-fuchsia-400">{t('shareMusic', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('shareMusicDesc', language)}</p>
          </div>
        </div>
      )
    },
    {
      id: 'fitness',
      icon: <Heart className="h-5 w-5" />,
      title: t('fitnessTitle', language),
      description: t('fitnessDesc', language),
      colorClass: 'text-red-500',
      glowClass: 'hover:shadow-glow',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-1 text-red-400">{t('connectWhoop', language)}</h4>
            <p className="text-sm text-muted-foreground/80 mb-2">{t('connectWhoopDesc', language)}</p>
            <ul className="text-sm space-y-1">
              <li>{t('connectWhoopStep1', language)}</li>
              <li>{t('connectWhoopStep2', language)}</li>
              <li>{t('connectWhoopStep3', language)}</li>
              <li>{t('connectWhoopStep4', language)}</li>
            </ul>
            <p className="text-sm text-muted-foreground/80 mt-2">{t('whoopRequirement', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-red-400">{t('aiInsights', language)}</h4>
            <p className="text-sm text-muted-foreground/80 mb-2">{t('aiInsightsDesc', language)}</p>
            <ul className="text-sm space-y-1">
              <li>{t('aiInsightsStep1', language)}</li>
              <li>{t('aiInsightsStep2', language)}</li>
              <li>{t('aiInsightsStep3', language)}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-red-400">{t('whoopTabs', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('whoopTabsDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-red-400">{t('syncWhoop', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('syncWhoopDesc', language)}</p>
          </div>
        </div>
      )
    },
    {
      id: 'journal',
      icon: <BookOpen className="h-5 w-5" />,
      title: t('journalTitle', language),
      description: t('journalDesc', language),
      colorClass: 'text-teal-500',
      glowClass: 'hover:shadow-glow',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-1 text-teal-400">{t('todayTab', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('todayTabDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-teal-400">{t('timelineTab', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('timelineTabDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-teal-400">{t('chartsTab', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('chartsTabDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-teal-400">{t('askJournalTab', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('askJournalTabDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-teal-400">{t('journalStreaks', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('journalStreaksDesc', language)}</p>
          </div>
        </div>
      )
    },
    {
      id: 'games',
      icon: <Gamepad2 className="h-5 w-5" />,
      title: t('gamesTitle', language),
      description: t('gamesDesc', language),
      colorClass: 'text-yellow-500',
      glowClass: 'hover:shadow-glow',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-1 text-yellow-400">{t('chessGame', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('chessGameDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-yellow-400">{t('ticTacToeGame', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('ticTacToeGameDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-yellow-400">{t('solitaireGame', language)}</h4>
            <p className="text-sm text-muted-foreground/80">{t('solitaireGameDesc', language)}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1 text-yellow-400">{t('lettersGame', language)}</h4>
            <p className="text-sm text-muted-foreground/80 mb-2">{t('lettersGameDesc', language)}</p>
            <ul className="text-sm space-y-1">
              <li>{t('lettersGameStep1', language)}</li>
              <li>{t('lettersGameStep2', language)}</li>
              <li>{t('lettersGameStep3', language)}</li>
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
    t('tip5', language),
    t('tip6', language),
    t('tip7', language),
    t('tip8', language),
    t('tip9', language),
    t('tip10', language)
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
    <div className="w-full">
      <div className="w-full">
        <div className="max-w-6xl mx-auto space-y-8 pb-8">
            {/* Header */}
            <div className="text-center">
              <div className="enhanced-card rounded-2xl p-8 md:p-10">
                <h1 className="text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
                  {t('howToUseWakti', language)}
                </h1>
                <p className="text-muted-foreground/90 text-xl font-medium">{t('helpAndGuides', language)}</p>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="enhanced-card grid w-full grid-cols-3">
                <TabsTrigger value="guides" className="data-[state=active]:bg-primary/20">
                  {language === 'ar' ? 'الأدلة' : 'Guides'}
                </TabsTrigger>
                <TabsTrigger value="assistant" className="data-[state=active]:bg-primary/20">
                  {language === 'ar' ? 'المساعد' : 'Assistant'}
                </TabsTrigger>
                <TabsTrigger value="support" className="data-[state=active]:bg-primary/20">
                  {language === 'ar' ? 'الدعم' : 'Support'}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="guides" className="space-y-6">

                {/* Collapsible Navigation Tips - Moved to Top */}
                <Card className="enhanced-card">
                  <Collapsible 
                    open={openSections.includes('navigation')}
                    onOpenChange={() => toggleSection('navigation')}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/40 transition-all duration-500">
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
                        <div className="rounded-2xl border p-6">
                          <div className="space-y-4">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                                <span className="text-sm font-semibold text-blue-400">1</span>
                              </div>
                              <p className="text-sm text-muted-foreground/90">
                                {language === 'ar' 
                                  ? 'اضغط على شعار WAKTI (أعلى الوسط) لفتح قائمة التنقل السريع'
                                  : 'Tap the WAKTI logo (top center) to open the quick navigation menu'
                                }
                              </p>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                                <span className="text-sm font-semibold text-blue-400">2</span>
                              </div>
                              <p className="text-sm text-muted-foreground/90">
                                {language === 'ar' 
                                  ? 'اضغط على صورة ملفك الشخصي (أعلى اليمين) للوصول للإعدادات وجهات الاتصال والرسائل'
                                  : 'Tap your profile picture (top right) to access Settings, Contacts, and Messages'
                                }
                              </p>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                                <span className="text-sm font-semibold text-blue-400">3</span>
                              </div>
                              <p className="text-sm text-muted-foreground/90">
                                {language === 'ar' 
                                  ? 'في WAKTI AI، اضغط على "Extra" للوصول لإعدادات Personal وسجل المحادثات (Convos)'
                                  : 'In WAKTI AI, tap "Extra" to access Personal settings and conversation history (Convos)'
                                }
                              </p>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                                <span className="text-sm font-semibold text-blue-400">4</span>
                              </div>
                              <p className="text-sm text-muted-foreground/90">
                                {language === 'ar' 
                                  ? 'استخدم أزرار الرجوع للعودة إلى الشاشات السابقة'
                                  : 'Use back buttons to return to previous screens'
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
                <Card className="enhanced-card">
                  <Collapsible 
                    open={openSections.includes('tips')}
                    onOpenChange={() => toggleSection('tips')}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/40 transition-all duration-500">
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
                        <div className="rounded-2xl border p-6">
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
                    <Card key={section.id} className="enhanced-card">
                      <Collapsible 
                        open={openSections.includes(section.id)}
                        onOpenChange={() => toggleSection(section.id)}
                      >
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-muted/40 transition-all duration-500">
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
                            <div className="rounded-2xl border p-6">
                              {section.content}
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  ))}
                </div>

              </TabsContent>

              <TabsContent value="assistant" className="space-y-6">
                <HelpAssistantChat />
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
                    <Card className="enhanced-card">
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
                    <Card className="enhanced-card">
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
                                  className="p-4 rounded-lg border cursor-pointer hover:bg-muted/40 transition-all duration-200"
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
      </div>
  );
}