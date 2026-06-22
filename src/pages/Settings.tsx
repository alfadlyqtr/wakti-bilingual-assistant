// @ts-nocheck

import { useState, useEffect, useRef } from "react";
import { emitEvent } from "@/utils/eventBus";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from '@/hooks/useUserProfile';
import { PageContainer } from "@/components/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import NotificationSettings from "@/components/notifications/NotificationSettings";
import { QuotePreferencesManager } from "@/components/settings/QuotePreferencesManager";
import { CustomQuoteManager } from "@/components/settings/CustomQuoteManager";
import { SavedImagesPicker } from "@/components/dashboard/SavedImagesPicker";
import { t } from "@/utils/translations";
import { Shield, Users, Eye, Quote, Palette, Bell, Layout, Home, LayoutDashboard, AlertTriangle, Image as ImageIcon, RotateCcw, X, ChevronUp, ChevronDown } from "lucide-react";
import { useAccessibility } from "@/hooks/useAccessibility";
import { COLOR_BLIND_MODES } from "@/components/accessibility/ColorBlindFilters";
import { useTextSize } from "@/hooks/useTextSize";
import { useToastHelper } from "@/hooks/use-toast-helper";
import { getScopedStorageItem, migrateLegacyScopedStorage, removeScopedStorageItem, setScopedStorageItem } from "@/utils/userScopedStorage";

const MAX_HOMESCREEN_WIDGETS = 4;
const MAX_HOMESCREEN_DOCK = 3;
const DEFAULT_BG_DARK = "/wakti-image-1773608945903.jpg";
const DEFAULT_BG_LIGHT = "/wakti-image-1774727385038.jpg";
const LS_DOCK_BASE = "homescreen_dock_v2";
const LS_BG_BASE = "homescreen_bg";
const LS_BG_POS_Y_BASE = "homescreen_bg_pos_y";
const LS_HEADER_COLOR_BASE = "homescreen_header_color";
const LS_WIDGETS_BASE = "homescreen_widgets_v1";
const LS_WIDGET_SIZES_BASE = "homescreen_widget_sizes_v1";
const LS_HSBG_BASE = "homescreen_bg_style_v1";
const LS_HSBG_ACTIVE_BASE = "homescreen_bg_style_active";
const LS_BG_CHOICE_BASE = "homescreen_bg_choice_v1";
const LS_DOCK_COLOR_BASE = "homescreen_dock_color";
const DEFAULT_DASHBOARD_LOOK = 'modern' as const;
const parseDashboardLook = (value: unknown): 'dashboard' | 'homescreen' | 'modern' | null => {
  return value === 'dashboard' || value === 'homescreen' || value === 'modern' ? value : null;
};
const MODERN_WIDGET_ORDER_KEYS = [
  'showCalendarWidget',
  'showTRWidget',
  'showMaw3dWidget',
  'showVitalityWidget',
  'showJournalWidget',
  'showQuoteWidget',
] as const;

type ModernWidgetKey = typeof MODERN_WIDGET_ORDER_KEYS[number];

const sanitizeModernWidgetOrder = (raw: unknown): ModernWidgetKey[] => {
  if (!Array.isArray(raw)) return [...MODERN_WIDGET_ORDER_KEYS];

  const validKeys = new Set<ModernWidgetKey>(MODERN_WIDGET_ORDER_KEYS);
  const normalized = raw.filter((value): value is ModernWidgetKey => typeof value === 'string' && validKeys.has(value as ModernWidgetKey));

  return [
    ...normalized,
    ...MODERN_WIDGET_ORDER_KEYS.filter((key) => !normalized.includes(key)),
  ];
};

const isBgChoiceValue = (value: unknown): value is 'default' | 'wallpaper' | 'style' => value === 'default' || value === 'wallpaper' || value === 'style';
const isDefaultBgAsset = (value?: string | null) => !value || value === DEFAULT_BG_DARK || value === DEFAULT_BG_LIGHT;
const sanitizeDockIds = (raw: string[]) => Array.from(new Set(raw.filter(Boolean))).slice(0, MAX_HOMESCREEN_DOCK);

const parseStoredHomescreenBg = (raw: string | null) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      mode: parsed.mode === 'gradient' ? 'gradient' as const : 'solid' as const,
      color1: typeof parsed.color1 === 'string' ? parsed.color1 : '',
      color2: typeof parsed.color2 === 'string' ? parsed.color2 : '',
      color3: typeof parsed.color3 === 'string' ? parsed.color3 : '',
      angle: typeof parsed.angle === 'number' ? parsed.angle : 180,
      glow: typeof parsed.glow === 'boolean' ? parsed.glow : false,
    };
  } catch {
    return null;
  }
};

const HOMESCREEN_APPS = [
  { id: "calendar", labelEn: "Calendar", labelAr: "التقويم" },
  { id: "journal", labelEn: "Journal", labelAr: "المذكرات" },
  { id: "maw3d", labelEn: "Maw3d", labelAr: "مواعيد" },
  { id: "tr", labelEn: "T & R", labelAr: "م & ت" },
  { id: "wakti-ai", labelEn: "WAKTI AI", labelAr: "WAKTI AI" },
  { id: "studio", labelEn: "Studio", labelAr: "الاستوديو" },
  { id: "vitality", labelEn: "Vitality", labelAr: "الحيوية" },
  { id: "warranty", labelEn: "My Files", labelAr: "ملفاتي" },
  { id: "projects", labelEn: "Projects", labelAr: "مشاريع" },
  { id: "text", labelEn: "Text", labelAr: "نص" },
  { id: "email", labelEn: "Email", labelAr: "البريد" },
  { id: "voice", labelEn: "Voice", labelAr: "صوت" },
  { id: "game", labelEn: "Game", labelAr: "لعبة" },
  { id: "social", labelEn: "Social", labelAr: "التواصل" },
  { id: "account", labelEn: "Account", labelAr: "حسابي" },
  { id: "settings", labelEn: "Settings", labelAr: "الإعدادات" },
  { id: "help", labelEn: "Help", labelAr: "المساعدة" },
  { id: "deen", labelEn: "Deen", labelAr: "دين" },
];

async function prepareWallpaperUpload(file: File) {
  const fallbackExt = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const fallbackType = file.type || 'image/jpeg';
  if (!fallbackType.startsWith('image/')) {
    throw new Error('invalid_image_type');
  }
  const needsHeicFallback = /heic|heif/i.test(fallbackExt) || /heic|heif/i.test(fallbackType);
  const ext = needsHeicFallback ? 'jpg' : fallbackExt;
  const contentType = needsHeicFallback ? 'image/jpeg' : fallbackType;
  return { body: file, ext, contentType };
}

export default function Settings() {
  const { theme, setTheme, language, setLanguage } = useTheme();
  const { user } = useAuth();
  const { showSuccess, showError } = useToastHelper();
  const [activeTab, setActiveTab] = useState("appearance");
  const { colorBlindMode, setColorBlindMode } = useAccessibility();
  const { textSize, setTextSize } = useTextSize();

  type WidgetConfig = {
    showNavWidget: boolean;
    showCalendarWidget: boolean;
    showEventsWidget: boolean;
    showQuoteWidget: boolean;
    showMaw3dWidget: boolean;
    showTRWidget: boolean;
    showVitalityWidget: boolean;
    showJournalWidget: boolean;
  };
  const DEFAULT_DASHBOARD_WIDGETS: WidgetConfig = {
    showNavWidget: true, showCalendarWidget: true, showEventsWidget: true,
    showQuoteWidget: true, showMaw3dWidget: true, showTRWidget: true,
    showVitalityWidget: true, showJournalWidget: true,
  };
  // Homescreen defaults
  const DEFAULT_HOMESCREEN_WIDGETS: WidgetConfig = {
    showNavWidget: false, showCalendarWidget: true, showTRWidget: true,
    showEventsWidget: false, showQuoteWidget: false, showMaw3dWidget: false,
    showVitalityWidget: false, showJournalWidget: false,
  };
  const DEFAULT_HOMESCREEN_DOCK = ["wakti-ai", "calendar", "tr"];

  // Separate widget settings for each mode — they never share state
  const [dashboardWidgets, setDashboardWidgets] = useState<WidgetConfig>({ ...DEFAULT_DASHBOARD_WIDGETS });
  const [homescreenWidgets, setHomescreenWidgets] = useState<WidgetConfig>({ ...DEFAULT_HOMESCREEN_WIDGETS });

  // Homescreen background style
  type BgMode = 'solid' | 'gradient';
  const [hsBgMode,   setHsBgMode]   = useState<BgMode>('solid');
  const [hsBgColor1, setHsBgColor1] = useState('#0c0f14');
  const [hsBgColor2, setHsBgColor2] = useState('#1a1040');
  const [hsBgColor3, setHsBgColor3] = useState('');
  const [hsBgAngle,  setHsBgAngle]  = useState(180);
  const [hsGlow,     setHsGlow]     = useState(true);
  const [homescreenWidgetSizes, setHomescreenWidgetSizes] = useState<Record<string, 'big' | 'small'>>({});
  const [homescreenDockIds, setHomescreenDockIds] = useState<string[]>(["wakti-ai", "calendar", "tr"]);
  const [homescreenBgChoice, setHomescreenBgChoice] = useState<'default' | 'wallpaper' | 'style'>('default');
  const [homescreenBgImage, setHomescreenBgImage] = useState(theme === 'light' ? DEFAULT_BG_LIGHT : DEFAULT_BG_DARK);
  const [homescreenBgPositionY, setHomescreenBgPositionY] = useState(50);
  const [homescreenHeaderColor, setHomescreenHeaderColor] = useState('');
  const [homescreenDockColor, setHomescreenDockColor] = useState('');
  const [savedImagesOpen, setSavedImagesOpen] = useState(false);
  const bgInputRef = useRef<HTMLInputElement | null>(null);

  // Dashboard look preference ('dashboard' = default widget grid, 'homescreen' = iPhone look, 'modern' = grouped modern look)
  const [dashboardLook, setDashboardLook] = useState<'dashboard' | 'homescreen' | 'modern'>(() => {
    const cached = getScopedStorageItem('wakti_dashboard_look', user?.id, 'wakti_dashboard_look');
    return parseDashboardLook(cached) || DEFAULT_DASHBOARD_LOOK;
  });

  // Active widget settings based on current mode
  const widgetSettings = dashboardLook === 'homescreen' ? homescreenWidgets : dashboardWidgets;
  const setWidgetSettings = dashboardLook === 'homescreen' ? setHomescreenWidgets : setDashboardWidgets;

  // Privacy settings
  const [privacySettings, setPrivacySettings] = useState({
    autoApproveContacts: false,
    profileVisibility: true,
    showActivityStatus: true
  });

  const { profile: cachedProfile, refetch: refetchProfile, applyFreshProfile } = useUserProfile();
  const isHomescreenLook = dashboardLook === 'homescreen';
  const homescreenWidgetEntries: { key: keyof WidgetConfig; labelEn: string; labelAr: string }[] = [
    { key: 'showCalendarWidget', labelEn: 'Calendar', labelAr: 'التقويم' },
    { key: 'showTRWidget', labelEn: 'Tasks & Reminders', labelAr: 'المهام والتذكيرات' },
    { key: 'showMaw3dWidget', labelEn: 'Maw3d Events', labelAr: 'أحداث مواعيد' },
    { key: 'showVitalityWidget', labelEn: 'Vitality (WHOOP + Health)', labelAr: 'الحيوية (WHOOP + صحتي)' },
    { key: 'showJournalWidget', labelEn: "Today's Journal", labelAr: 'يوميات وقتي' },
    { key: 'showQuoteWidget', labelEn: 'Daily Quote', labelAr: 'اقتباس اليوم' },
  ];
  const [modernWidgetOrder, setModernWidgetOrder] = useState<ModernWidgetKey[]>([...MODERN_WIDGET_ORDER_KEYS]);

  useEffect(() => {
    if (cachedProfile) {
      loadSettingsFromProfile();
    }
  }, [cachedProfile]);

  useEffect(() => {
    if (!user?.id) return;
    migrateLegacyScopedStorage('wakti_dashboard_look', user.id, 'wakti_dashboard_look');
  }, [user?.id]);

  const fetchLatestProfileSettings = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', user?.id)
      .single();
    if (error) throw error;
    return (data?.settings as any) || {};
  };

  const updateProfileSettings = async (buildNextSettings: (currentSettings: any) => any) => {
    const currentSettings = await fetchLatestProfileSettings();
    const nextSettings = buildNextSettings(currentSettings);
    const { error } = await supabase
      .from('profiles')
      .update({ settings: nextSettings })
      .eq('id', user?.id);
    if (error) throw error;
    if (cachedProfile) {
      applyFreshProfile({
        ...cachedProfile,
        settings: nextSettings,
      } as any);
    }
    return nextSettings;
  };

  const loadSettingsFromProfile = () => {
    try {
      const s = cachedProfile?.settings as any;
      const hs = s?.homescreen || {};
      const hasRemoteWidgets = !!(hs?.homescreenWidgets || s?.homescreenWidgets) && typeof (hs?.homescreenWidgets || s?.homescreenWidgets) === 'object';
      const hasRemoteWidgetSizes = !!hs?.homescreenWidgetSizes && typeof hs.homescreenWidgetSizes === 'object';
      const hasRemoteBgState = isBgChoiceValue(hs?.bgChoice) || (typeof hs?.bgImage === 'string' && !!hs.bgImage) || typeof hs?.bgPositionY === 'number' || !!s?.homescreenBg;
      const hasRemoteHomescreenState = hasRemoteWidgets
        || hasRemoteWidgetSizes
        || Array.isArray(hs?.dockIds)
        || Array.isArray(hs?.iconOrder)
        || Array.isArray(hs?.homescreenLayout)
        || Array.isArray(hs?.unifiedGrid)
        || typeof hs?.showQuote === 'boolean'
        || typeof hs?.headerColor === 'string'
        || typeof hs?.dockColor === 'string'
        || hasRemoteBgState;

      // Load dashboard widgets (legacy key 'widgets' maps to dashboard)
      if (s?.dashboardWidgets) {
        const w = s.dashboardWidgets;
        setDashboardWidgets(prev => ({ ...prev, ...w, showTRWidget: (w.showTRWidget !== false) || (w.showTasksWidget === true) }));
      } else if (s?.widgets) {
        // legacy fallback
        const w = s.widgets;
        setDashboardWidgets(prev => ({ ...prev, ...w, showTRWidget: (w.showTRWidget !== false) || (w.showTasksWidget === true) }));
      }
      setModernWidgetOrder(sanitizeModernWidgetOrder(s?.dashboardWidgets?.order ?? s?.widgets?.order));

      const rawHomescreenWidgets = hs?.homescreenWidgets || s?.homescreenWidgets;
      if (rawHomescreenWidgets) {
        const raw = { ...DEFAULT_HOMESCREEN_WIDGETS, ...rawHomescreenWidgets, showNavWidget: false };
        const VISIBLE_KEYS: (keyof WidgetConfig)[] = ['showCalendarWidget','showTRWidget','showMaw3dWidget','showVitalityWidget','showJournalWidget','showQuoteWidget'];
        let onCount = 0;
        const clamped = { ...raw };
        for (const k of VISIBLE_KEYS) {
          if (clamped[k]) {
            if (onCount < MAX_HOMESCREEN_WIDGETS) onCount++;
            else clamped[k] = false;
          }
        }
        setHomescreenWidgets(clamped);
        setScopedStorageItem(LS_WIDGETS_BASE, JSON.stringify(clamped), user?.id);
      } else if (!hasRemoteHomescreenState) {
        const localWidgetsRaw = getScopedStorageItem(LS_WIDGETS_BASE, user?.id);
        if (localWidgetsRaw) {
          try {
            setHomescreenWidgets({ ...DEFAULT_HOMESCREEN_WIDGETS, ...JSON.parse(localWidgetsRaw), showNavWidget: false });
          } catch {}
        }
      } else {
        setHomescreenWidgets({ ...DEFAULT_HOMESCREEN_WIDGETS });
        setScopedStorageItem(LS_WIDGETS_BASE, JSON.stringify({ ...DEFAULT_HOMESCREEN_WIDGETS }), user?.id);
      }

      if (hs?.homescreenWidgetSizes && typeof hs.homescreenWidgetSizes === 'object') {
        setHomescreenWidgetSizes(hs.homescreenWidgetSizes);
        setScopedStorageItem(LS_WIDGET_SIZES_BASE, JSON.stringify(hs.homescreenWidgetSizes), user?.id);
      } else if (!hasRemoteHomescreenState) {
        const localSizesRaw = getScopedStorageItem(LS_WIDGET_SIZES_BASE, user?.id);
        if (localSizesRaw) {
          try {
            setHomescreenWidgetSizes(JSON.parse(localSizesRaw));
          } catch {}
        }
      } else {
        setHomescreenWidgetSizes({});
        removeScopedStorageItem(LS_WIDGET_SIZES_BASE, user?.id);
      }

      if (Array.isArray(hs?.dockIds)) {
        const nextDock = sanitizeDockIds(hs.dockIds);
        setHomescreenDockIds(nextDock);
        setScopedStorageItem(LS_DOCK_BASE, JSON.stringify(nextDock), user?.id);
      } else if (!hasRemoteHomescreenState) {
        const localDockRaw = getScopedStorageItem(LS_DOCK_BASE, user?.id);
        if (localDockRaw) {
          try {
            setHomescreenDockIds(sanitizeDockIds(JSON.parse(localDockRaw)));
          } catch {}
        }
      } else {
        setHomescreenDockIds(DEFAULT_HOMESCREEN_DOCK);
        setScopedStorageItem(LS_DOCK_BASE, JSON.stringify(DEFAULT_HOMESCREEN_DOCK), user?.id);
      }

      if (s?.homescreenBg) {
        const bg = s.homescreenBg;
        if (bg.mode === 'solid' || bg.mode === 'gradient') setHsBgMode(bg.mode);
        if (bg.color1) setHsBgColor1(bg.color1);
        if (bg.color2) setHsBgColor2(bg.color2);
        if (bg.color3 !== undefined) setHsBgColor3(bg.color3 || '');
        if (typeof bg.angle === 'number') setHsBgAngle(bg.angle);
        if (typeof bg.glow === 'boolean') setHsGlow(bg.glow);
        setScopedStorageItem(LS_HSBG_BASE, JSON.stringify(bg), user?.id);
      } else if (hasRemoteHomescreenState) {
        setHsBgMode('solid');
        setHsBgColor1('#0c0f14');
        setHsBgColor2('#1a1040');
        setHsBgColor3('');
        setHsBgAngle(180);
        setHsGlow(true);
      }

      const localStyleBg = parseStoredHomescreenBg(getScopedStorageItem(LS_HSBG_BASE, user?.id));
      if (!s?.homescreenBg && localStyleBg) {
        setHsBgMode(localStyleBg.mode);
        setHsBgColor1(localStyleBg.color1);
        setHsBgColor2(localStyleBg.color2);
        setHsBgColor3(localStyleBg.color3);
        setHsBgAngle(localStyleBg.angle);
        setHsGlow(localStyleBg.glow);
      }
      const localBgChoice = getScopedStorageItem(LS_BG_CHOICE_BASE, user?.id);
      const localBgImage = getScopedStorageItem(LS_BG_BASE, user?.id);
      const localBgPositionRaw = getScopedStorageItem(LS_BG_POS_Y_BASE, user?.id);
      const parsedLocalBgPosition = localBgPositionRaw === null ? NaN : Number(localBgPositionRaw);
      const localBgPosition = Number.isFinite(parsedLocalBgPosition) ? Math.max(0, Math.min(100, parsedLocalBgPosition)) : 50;
      const localChoice = isBgChoiceValue(localBgChoice) ? localBgChoice : null;
      const localWallpaper = typeof localBgImage === 'string' && localBgImage && !isDefaultBgAsset(localBgImage) ? localBgImage : '';
      const remoteChoice = isBgChoiceValue(hs?.bgChoice) ? hs.bgChoice : null;
      const remoteWallpaper = typeof hs?.bgImage === 'string' && hs.bgImage && !isDefaultBgAsset(hs.bgImage) ? hs.bgImage : '';
      const resolvedChoice = remoteChoice
        || (remoteWallpaper ? 'wallpaper' : '')
        || (s?.homescreenBg ? 'style' : '')
        || localChoice
        || (localWallpaper ? 'wallpaper' : '')
        || (localStyleBg ? 'style' : '')
        || 'default';
      setHomescreenBgChoice(resolvedChoice);
      setScopedStorageItem(LS_BG_CHOICE_BASE, resolvedChoice, user?.id);
      setScopedStorageItem(LS_HSBG_ACTIVE_BASE, String(resolvedChoice === 'style'), user?.id);
      if (resolvedChoice === 'wallpaper') {
        const resolvedWallpaper = remoteWallpaper || localWallpaper;
        if (resolvedWallpaper) {
          setHomescreenBgImage(resolvedWallpaper);
          setScopedStorageItem(LS_BG_BASE, resolvedWallpaper, user?.id);
        }
      } else {
        setHomescreenBgImage(theme === 'light' ? DEFAULT_BG_LIGHT : DEFAULT_BG_DARK);
      }
      const resolvedBgPosition = resolvedChoice === 'wallpaper'
        ? (typeof hs?.bgPositionY === 'number'
            ? Math.max(0, Math.min(100, hs.bgPositionY))
            : (remoteWallpaper || localChoice === 'wallpaper' || localWallpaper)
              ? localBgPosition
              : 50)
        : 50;
      setHomescreenBgPositionY(resolvedBgPosition);
      setScopedStorageItem(LS_BG_POS_Y_BASE, String(resolvedBgPosition), user?.id);

      if (typeof hs?.headerColor === 'string') {
        setHomescreenHeaderColor(hs.headerColor);
        if (hs.headerColor) setScopedStorageItem(LS_HEADER_COLOR_BASE, hs.headerColor, user?.id);
      } else {
        const localHeaderColor = getScopedStorageItem(LS_HEADER_COLOR_BASE, user?.id) || '';
        setHomescreenHeaderColor(localHeaderColor);
        if (!localHeaderColor) removeScopedStorageItem(LS_HEADER_COLOR_BASE, user?.id);
      }

      if (typeof hs?.dockColor === 'string') {
        setHomescreenDockColor(hs.dockColor);
        if (hs.dockColor) setScopedStorageItem(LS_DOCK_COLOR_BASE, hs.dockColor, user?.id);
      } else {
        const localDockColor = getScopedStorageItem(LS_DOCK_COLOR_BASE, user?.id) || '';
        setHomescreenDockColor(localDockColor);
        if (!localDockColor) removeScopedStorageItem(LS_DOCK_COLOR_BASE, user?.id);
      }

      // Load dashboard look preference
      const profileLook = parseDashboardLook(s?.dashboardLook);
      if (profileLook) {
        setDashboardLook(profileLook);
        setScopedStorageItem('wakti_dashboard_look', profileLook, user?.id);
      } else {
        const cachedLook = parseDashboardLook(getScopedStorageItem('wakti_dashboard_look', user?.id, 'wakti_dashboard_look'));
        const resolvedLook = cachedLook || DEFAULT_DASHBOARD_LOOK;
        setDashboardLook(resolvedLook);
        if (!cachedLook) {
          setScopedStorageItem('wakti_dashboard_look', resolvedLook, user?.id);
        }
      }

      setPrivacySettings({
        autoApproveContacts: cachedProfile?.auto_approve_contacts || false,
        profileVisibility: s?.privacy?.profileVisibility !== false,
        showActivityStatus: s?.privacy?.activityStatus !== false
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleThemeChange = (newTheme: string) => {
    if (newTheme === 'light' || newTheme === 'dark') {
      setTheme(newTheme);
    }
  };

  const handleLanguageChange = (newLanguage: string) => {
    if (newLanguage === 'en' || newLanguage === 'ar') {
      setLanguage(newLanguage);
    }
  };

  const updateHomescreenSettings = async (homescreenPatch: Record<string, any> = {}, rootPatch: Record<string, any> = {}, showToast = true) => {
    await updateProfileSettings((currentSettings) => ({
      ...currentSettings,
      ...rootPatch,
      ...(homescreenPatch.homescreenWidgets ? { homescreenWidgets: homescreenPatch.homescreenWidgets } : {}),
      homescreen: {
        ...(currentSettings.homescreen || {}),
        ...homescreenPatch,
      },
    }));
    if (showToast) showSuccess(t("settingsUpdated", language));
    refetchProfile();
  };

  const persistModernWidgetOrder = async (nextOrder: ModernWidgetKey[]) => {
    const previousOrder = modernWidgetOrder;
    setModernWidgetOrder(nextOrder);

    try {
      await updateProfileSettings((currentSettings) => ({
        ...currentSettings,
        dashboardWidgets: {
          ...(currentSettings.dashboardWidgets || currentSettings.widgets || {}),
          ...dashboardWidgets,
          order: nextOrder,
        },
        widgets: {
          ...(currentSettings.widgets || currentSettings.dashboardWidgets || {}),
          ...dashboardWidgets,
          order: nextOrder,
        },
      }));

      refetchProfile();
      emitEvent('widgetSettingsChanged', { ...dashboardWidgets, order: nextOrder, mode: dashboardLook });
    } catch (error) {
      console.error('Error updating modern widget order:', error);
      setModernWidgetOrder(previousOrder);
      showError(t("errorUpdatingSettings", language));
    }
  };

  const moveModernWidget = async (key: ModernWidgetKey, direction: -1 | 1) => {
    const currentIndex = modernWidgetOrder.indexOf(key);
    const nextIndex = currentIndex + direction;

    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= modernWidgetOrder.length) return;

    const nextOrder = [...modernWidgetOrder];
    const [moved] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(nextIndex, 0, moved);

    await persistModernWidgetOrder(nextOrder);
  };

  const updateWidgetSetting = async (key: keyof WidgetConfig, value: boolean) => {
    const isHomescreen = dashboardLook === 'homescreen';
    const current = isHomescreen ? homescreenWidgets : dashboardWidgets;
    const newSettings = { ...current, [key]: value };

    // Optimistic update
    if (isHomescreen) setHomescreenWidgets(newSettings);
    else setDashboardWidgets(newSettings);

    try {
      if (isHomescreen) {
        setScopedStorageItem(LS_WIDGETS_BASE, JSON.stringify(newSettings), user?.id);
        await updateHomescreenSettings({ homescreenWidgets: newSettings }, {}, false);
      } else {
        await updateProfileSettings((currentSettings) => ({
          ...currentSettings,
          dashboardWidgets: {
            ...(currentSettings.dashboardWidgets || {}),
            ...newSettings,
            order: modernWidgetOrder,
          },
          widgets: {
            ...(currentSettings.widgets || {}),
            ...newSettings,
            order: modernWidgetOrder,
          },
        }));
      }

      showSuccess(t("settingsUpdated", language));
      refetchProfile();
      emitEvent('widgetSettingsChanged', { ...newSettings, order: modernWidgetOrder, mode: dashboardLook });
    } catch (error) {
      console.error('Error updating widget setting:', error);
      showError(t("errorUpdatingSettings", language));
      // Revert
      if (isHomescreen) setHomescreenWidgets(current);
      else setDashboardWidgets(current);
    }
  };

  const updateDashboardLook = async (look: 'dashboard' | 'homescreen' | 'modern') => {
    try {
      setDashboardLook(look);
      setScopedStorageItem('wakti_dashboard_look', look, user?.id);

      await updateProfileSettings((currentSettings) => ({
        ...currentSettings,
        dashboardLook: look,
      }));

      showSuccess(t("settingsUpdated", language));
      refetchProfile();
      
      // Force dashboard to reload by dispatching a custom event
      emitEvent('dashboardLookChanged', look);
    } catch (error) {
      console.error('Error updating dashboard look:', error);
      showError(t("errorUpdatingSettings", language));
      setDashboardLook(dashboardLook);
    }
  };

  const saveHomescreenBg = async (mode: BgMode, color1: string, color2: string, color3: string, angle: number, glow: boolean) => {
    try {
      const payload = { mode, color1, color2, color3, angle, glow };
      setScopedStorageItem(LS_HSBG_BASE, JSON.stringify(payload), user?.id);
      setScopedStorageItem(LS_BG_CHOICE_BASE, 'style', user?.id);
      setScopedStorageItem(LS_HSBG_ACTIVE_BASE, 'true', user?.id);
      removeScopedStorageItem(LS_BG_BASE, user?.id);
      removeScopedStorageItem(LS_BG_POS_Y_BASE, user?.id);
      setHomescreenBgChoice('style');
      setHomescreenBgImage('');
      setHomescreenBgPositionY(50);
      await updateHomescreenSettings({ bgChoice: 'style', bgImage: '', bgPositionY: 50 }, { homescreenBg: payload }, false);
      emitEvent('homescreenBgChanged', payload);
      showSuccess(t("settingsUpdated", language));
      refetchProfile();
    } catch (error) {
      console.error('Error saving homescreen bg:', error);
      showError(t("errorUpdatingSettings", language));
    }
  };

  const updateHomescreenWidgetSize = async (key: keyof WidgetConfig, size: 'big' | 'small') => {
    const nextSizes = { ...homescreenWidgetSizes, [key]: size };
    setHomescreenWidgetSizes(nextSizes);
    setScopedStorageItem(LS_WIDGET_SIZES_BASE, JSON.stringify(nextSizes), user?.id);
    try {
      await updateHomescreenSettings({ homescreenWidgetSizes: nextSizes }, {}, false);
      showSuccess(t("settingsUpdated", language));
    } catch (error) {
      console.error('Error updating homescreen widget size:', error);
      showError(t("errorUpdatingSettings", language));
      setHomescreenWidgetSizes(homescreenWidgetSizes);
    }
  };

  const toggleHomescreenDockApp = async (appId: string) => {
    const alreadySelected = homescreenDockIds.includes(appId);
    if (!alreadySelected && homescreenDockIds.length >= MAX_HOMESCREEN_DOCK) return;
    const nextDock = alreadySelected
      ? homescreenDockIds.filter(id => id !== appId)
      : [...homescreenDockIds, appId];
    setHomescreenDockIds(nextDock);
    setScopedStorageItem(LS_DOCK_BASE, JSON.stringify(nextDock), user?.id);
    try {
      await updateHomescreenSettings({ dockIds: nextDock }, {}, false);
      showSuccess(t("settingsUpdated", language));
    } catch (error) {
      console.error('Error updating homescreen dock:', error);
      showError(t("errorUpdatingSettings", language));
      setHomescreenDockIds(homescreenDockIds);
    }
  };

  const saveHomescreenHeaderColor = async (color: string) => {
    setHomescreenHeaderColor(color);
    setScopedStorageItem(LS_HEADER_COLOR_BASE, color, user?.id);
    try {
      await updateHomescreenSettings({ headerColor: color }, {}, false);
    } catch (error) {
      console.error('Error updating homescreen header color:', error);
      showError(t("errorUpdatingSettings", language));
    }
  };

  const clearHomescreenHeaderColor = async () => {
    setHomescreenHeaderColor('');
    removeScopedStorageItem(LS_HEADER_COLOR_BASE, user?.id);
    try {
      await updateHomescreenSettings({ headerColor: '' }, {}, false);
    } catch (error) {
      console.error('Error clearing homescreen header color:', error);
      showError(t("errorUpdatingSettings", language));
    }
  };

  const saveHomescreenDockColor = async (color: string) => {
    setHomescreenDockColor(color);
    setScopedStorageItem(LS_DOCK_COLOR_BASE, color, user?.id);
    try {
      await updateHomescreenSettings({ dockColor: color }, {}, false);
    } catch (error) {
      console.error('Error updating homescreen dock color:', error);
      showError(t("errorUpdatingSettings", language));
    }
  };

  const clearHomescreenDockColor = async () => {
    setHomescreenDockColor('');
    removeScopedStorageItem(LS_DOCK_COLOR_BASE, user?.id);
    try {
      await updateHomescreenSettings({ dockColor: '' }, {}, false);
    } catch (error) {
      console.error('Error clearing homescreen dock color:', error);
      showError(t("errorUpdatingSettings", language));
    }
  };

  const restoreDefaultHomescreenBackground = async () => {
    const fallbackBg = theme === 'light' ? DEFAULT_BG_LIGHT : DEFAULT_BG_DARK;
    setHomescreenBgChoice('default');
    setHomescreenBgImage(fallbackBg);
    setHomescreenBgPositionY(50);
    setScopedStorageItem(LS_BG_CHOICE_BASE, 'default', user?.id);
    setScopedStorageItem(LS_HSBG_ACTIVE_BASE, 'false', user?.id);
    removeScopedStorageItem(LS_BG_BASE, user?.id);
    removeScopedStorageItem(LS_BG_POS_Y_BASE, user?.id);
    try {
      await updateHomescreenSettings({ bgChoice: 'default', bgImage: '', bgPositionY: 50 }, {}, false);
      showSuccess(t("settingsUpdated", language));
    } catch (error) {
      console.error('Error restoring homescreen background:', error);
      showError(t("errorUpdatingSettings", language));
    }
  };

  const saveHomescreenWallpaperPosition = async (value: number) => {
    const next = Math.max(0, Math.min(100, value));
    setHomescreenBgPositionY(next);
    setScopedStorageItem(LS_BG_POS_Y_BASE, String(next), user?.id);
    try {
      await updateHomescreenSettings({ bgPositionY: next }, {}, false);
    } catch (error) {
      console.error('Error updating wallpaper position:', error);
      showError(t("errorUpdatingSettings", language));
    }
  };

  const applyHomescreenWallpaper = async (imageUrl: string) => {
    setHomescreenBgChoice('wallpaper');
    setHomescreenBgImage(imageUrl);
    setHomescreenBgPositionY(50);
    setScopedStorageItem(LS_BG_CHOICE_BASE, 'wallpaper', user?.id);
    setScopedStorageItem(LS_BG_BASE, imageUrl, user?.id);
    setScopedStorageItem(LS_BG_POS_Y_BASE, '50', user?.id);
    setScopedStorageItem(LS_HSBG_ACTIVE_BASE, 'false', user?.id);
    try {
      await updateHomescreenSettings({ bgChoice: 'wallpaper', bgImage: imageUrl, bgPositionY: 50 }, {}, false);
      showSuccess(t("settingsUpdated", language));
    } catch (error) {
      console.error('Error applying wallpaper:', error);
      showError(t("errorUpdatingSettings", language));
    }
  };

  const handleHomescreenWallpaperInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;
    try {
      const prepared = await prepareWallpaperUpload(file);
      const path = `homescreen/${user.id}/wallpapers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${prepared.ext}`;
      const { error: uploadError } = await supabase.storage.from('images').upload(path, prepared.body, { contentType: prepared.contentType || undefined, upsert: true, cacheControl: '31536000' });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from('images').getPublicUrl(path);
      const url = publicData?.publicUrl;
      if (!url) throw new Error('wallpaper_public_url_missing');
      await applyHomescreenWallpaper(url);
    } catch (error) {
      console.error('Wallpaper upload failed:', error);
      showError(t("errorUpdatingSettings", language));
    } finally {
      event.target.value = '';
    }
  };

  useEffect(() => {
    if (homescreenBgChoice !== 'default') return;
    setHomescreenBgImage(theme === 'light' ? DEFAULT_BG_LIGHT : DEFAULT_BG_DARK);
  }, [homescreenBgChoice, theme]);

  const updatePrivacySetting = async (key: keyof typeof privacySettings, value: boolean) => {
    try {
      const newSettings = { ...privacySettings, [key]: value };
      setPrivacySettings(newSettings);

      if (key === 'autoApproveContacts') {
        await supabase
          .from('profiles')
          .update({ auto_approve_contacts: value })
          .eq('id', user?.id);
      } else {
        await updateProfileSettings((currentSettings) => {
          const privacySettings = currentSettings.privacy || {};
          const updatedPrivacy = {
            ...privacySettings,
            [key === 'profileVisibility' ? 'profileVisibility' : 'activityStatus']: value
          };
          return {
            ...currentSettings,
            privacy: updatedPrivacy,
          };
        });
      }

      showSuccess(language === 'ar' ? 'تم تحديث إعدادات الخصوصية' : 'Privacy settings updated');
      refetchProfile();
    } catch (error) {
      console.error('Error updating privacy setting:', error);
      showError(language === 'ar' ? 'خطأ في تحديث الإعدادات' : 'Error updating settings');
      setPrivacySettings(privacySettings);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full p-6">
        <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            {t("settings", language)}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar" ? "إدارة إعدادات التطبيق" : "Manage your app settings"}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 h-auto">
            <TabsTrigger value="appearance" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-1 sm:px-3">
              <Palette className="h-4 w-4 flex-shrink-0" />
              <span className="text-[10px] sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                {t("appearance", language)}
              </span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-1 sm:px-3">
              <Bell className="h-4 w-4 flex-shrink-0" />
              <span className="text-[10px] sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                {t("notifications", language)}
              </span>
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-1 sm:px-3">
              <Layout className="h-4 w-4 flex-shrink-0" />
              <span className="text-[10px] sm:text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                {language === "ar" ? "لوحة التحكم" : "Dashboard"}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("appearanceSettings", language)}</CardTitle>
                <CardDescription>
                  {language === "ar" ? "تخصيص مظهر التطبيق" : "Customize the app appearance"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="theme">{t("theme", language)}</Label>
                  <Select value={theme} onValueChange={handleThemeChange}>
                    <SelectTrigger id="theme">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t("lightMode", language)}</SelectItem>
                      <SelectItem value="dark">{t("darkMode", language)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">{t("language", language)}</Label>
                  <Select value={language} onValueChange={handleLanguageChange}>
                    <SelectTrigger id="language">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">{t("english", language)}</SelectItem>
                      <SelectItem value="ar">{t("arabic", language)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Text Size Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-lg font-bold leading-none">A</span><span className="text-sm font-bold leading-none">A</span>
                  <span className="ml-1">{language === 'ar' ? 'حجم النص' : 'Text Size'}</span>
                </CardTitle>
                <CardDescription>
                  {language === 'ar'
                    ? 'يُكبِّر كل النصوص في التطبيق بما فيها الأزرار والقوائم والأوصاف.'
                    : 'Enlarges all text across the app including buttons, menus, and descriptions.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {([
                  { value: 'normal' as const, labelEn: 'Normal',      labelAr: 'عادي',        sample: 'Aa', sampleSize: 'text-base' },
                  { value: 'large'  as const, labelEn: 'Large',       labelAr: 'كبير',        sample: 'Aa', sampleSize: 'text-lg'   },
                  { value: 'xlarge' as const, labelEn: 'Extra Large', labelAr: 'كبير جداً',  sample: 'Aa', sampleSize: 'text-2xl'  },
                ]).map((opt) => {
                  const isActive = textSize === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setTextSize(opt.value)}
                      className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all active:scale-[0.98] ${
                        isActive
                          ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-500/15'
                          : 'border-border bg-transparent hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`font-bold ${opt.sampleSize} ${
                          isActive ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
                        }`}>{opt.sample}</span>
                        <div>
                          <p className={`text-sm font-medium leading-tight ${
                            isActive ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'
                          }`}>
                            {language === 'ar' ? opt.labelAr : opt.labelEn}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {opt.value === 'normal'  && (language === 'ar' ? 'الحجم الافتراضي' : 'Default size')}
                            {opt.value === 'large'   && (language === 'ar' ? '١١٥٪ من الحجم الاعتيادي' : '115% of normal')}
                            {opt.value === 'xlarge'  && (language === 'ar' ? '١٣٠٪ من الحجم الاعتيادي' : '130% of normal')}
                          </p>
                        </div>
                      </div>
                      {isActive && (
                        <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Accessibility Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-blue-500" />
                  {language === 'ar' ? 'إمكانية الوصول' : 'Accessibility'}
                </CardTitle>
                <CardDescription>
                  {language === 'ar'
                    ? 'فلتر الألوان يُعيد رسم كل شيء في التطبيق — بما فيه الصور ومقاطع الفيديو — لتحسين التمييز بين الألوان.'
                    : 'The color filter redraws everything in the app — including images and videos — to improve color distinction.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {language === 'ar' ? 'وضع عمى الألوان' : 'Color Blindness Mode'}
                  </Label>
                  {/* Mobile-optimized button group — no dropdown needed */}
                  <div className="grid grid-cols-1 gap-2">
                    {COLOR_BLIND_MODES.map((m) => {
                      const isActive = colorBlindMode === m.value;
                      return (
                        <button
                          key={m.value}
                          onClick={() => setColorBlindMode(m.value)}
                          className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all active:scale-[0.98] ${
                            isActive
                              ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-500/15'
                              : 'border-border bg-transparent hover:border-border/80 hover:bg-muted/40'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium leading-tight ${
                              isActive ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'
                            }`}>
                              {language === 'ar' ? m.labelAr : m.labelEn}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                              {language === 'ar' ? m.descriptionAr : m.description}
                            </p>
                          </div>
                          {isActive && (
                            <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {colorBlindMode !== 'none' && (
                  <div className="rounded-xl border border-amber-400/60 bg-amber-50 dark:bg-amber-950/20 p-3 flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                      {language === 'ar'
                        ? 'ملاحظة: يُغير هذا الفلتر الألوان رياضياً لتحسين التباين. قد يبدو التطبيق غير طبيعي لمن لديهم رؤية عادية.'
                        : 'Note: This filter mathematically alters colors to improve contrast. The app may look unnatural to those with standard vision.'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Privacy Settings in Appearance Tab */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {language === 'ar' ? 'إعدادات الخصوصية' : 'Privacy Settings'}
                </CardTitle>
                <CardDescription>
                  {language === 'ar' 
                    ? 'تحكم في خصوصيتك وكيفية تفاعل الآخرين معك'
                    : 'Control your privacy and how others can interact with you'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-md border">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <Label className="text-sm font-medium">
                        {language === 'ar' ? 'الموافقة التلقائية على طلبات التواصل' : 'Auto-approve Contact Requests'}
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === 'ar' 
                        ? 'قبول طلبات إضافة جهات الاتصال تلقائياً بدون مراجعة'
                        : 'Automatically accept contact requests without manual review'}
                    </p>
                  </div>
                  <Switch
                    checked={privacySettings.autoApproveContacts}
                    onCheckedChange={(checked) => updatePrivacySetting('autoApproveContacts', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-md border">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <Label className="text-sm font-medium">
                        {language === 'ar' ? 'إظهار الملف الشخصي للآخرين' : 'Profile Visibility to Others'}
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === 'ar' 
                        ? 'السماح للمستخدمين الآخرين برؤية ملفك الشخصي'
                        : 'Allow other users to view your profile information'}
                    </p>
                  </div>
                  <Switch
                    checked={privacySettings.profileVisibility}
                    onCheckedChange={(checked) => updatePrivacySetting('profileVisibility', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-md border">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-green-500"></div>
                      <Label className="text-sm font-medium">
                        {language === 'ar' ? 'إظهار حالة النشاط' : 'Show Activity Status'}
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === 'ar' 
                        ? 'السماح للآخرين برؤية ما إذا كنت متصلاً أم لا'
                        : 'Let others see when you are online or active'}
                    </p>
                  </div>
                  <Switch
                    checked={privacySettings.showActivityStatus}
                    onCheckedChange={(checked) => updatePrivacySetting('showActivityStatus', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <NotificationSettings />
            
            {/* Quote Preferences */}
            <QuotePreferencesManager />

            {/* Custom Quotes */}
            <CustomQuoteManager />
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Dashboard Look Toggle */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutDashboard className="h-5 w-5" />
                  {language === "ar" ? "مظهر لوحة التحكم" : "Dashboard Look"}
                </CardTitle>
                <CardDescription>
                  {language === "ar" ? "اختر مظهر شاشتك الرئيسية" : "Choose your home screen style"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  {
                    value: 'dashboard',
                    titleEn: 'Dashboard Look',
                    titleAr: 'مظهر لوحة التحكم',
                    descEn: 'Show widgets as customizable cards',
                    descAr: 'عرض الأدوات كبطاقات قابلة للتخصيص',
                  },
                  {
                    value: 'homescreen',
                    titleEn: 'Home Screen Look',
                    titleAr: 'شكل الشاشة الرئيسية',
                    descEn: 'Clean, focused layout for quick access',
                    descAr: 'عرض أنيق ومركز للوصول السريع',
                  },
                  {
                    value: 'modern',
                    titleEn: 'Modern Look (Default)',
                    titleAr: 'المظهر الحديث (الافتراضي)',
                    descEn: 'Default for new users, with grouped app sections, widget carousel, and WAKTI AI chat bar',
                    descAr: 'الافتراضي للمستخدمين الجدد، مع مجموعات تطبيقات حديثة وكاروسيل للودجتس وشريط دردشة وكتي AI',
                  },
                ].map((option) => {
                  const isActive = dashboardLook === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateDashboardLook(option.value as 'dashboard' | 'homescreen' | 'modern')}
                      className={`w-full rounded-xl border p-4 text-left transition-all ${isActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{language === 'ar' ? option.titleAr : option.titleEn}</p>
                          <p className="text-xs text-muted-foreground">{language === 'ar' ? option.descAr : option.descEn}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          {isActive ? (language === 'ar' ? 'مفعّل' : 'Active') : (language === 'ar' ? 'تفعيل' : 'Select')}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Widget Visibility — always shown, behavior changes per mode */}
            {(() => {
              const isHomescreen = dashboardLook === 'homescreen';
              const isModern = dashboardLook === 'modern';
              const widgetEntries = isModern
                ? modernWidgetOrder.map((key) => homescreenWidgetEntries.find((entry) => entry.key === key)).filter(Boolean)
                : homescreenWidgetEntries;
              const enabledCount = widgetEntries.filter(e => widgetSettings[e.key]).length;

              const handleWidgetToggle = (key: keyof typeof widgetSettings, checked: boolean) => {
                if (isHomescreen && checked && enabledCount >= MAX_HOMESCREEN_WIDGETS) return;
                updateWidgetSetting(key, checked);
              };

              return (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{t("widgetVisibility", language)}</span>
                        {isHomescreen && (
                          <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded-full">
                            {language === 'ar' ? `${enabledCount}/${MAX_HOMESCREEN_WIDGETS} محدد` : `${enabledCount}/${MAX_HOMESCREEN_WIDGETS} selected`}
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {isHomescreen
                          ? (language === "ar" ? "اختر ما يصل إلى ٤ ودجتات تظهر في الشاشة الرئيسية" : "Choose up to 4 widgets to show on your Home Screen")
                          : isModern
                            ? (language === "ar" ? "اختر الأدوات ورتّبها كما تريد في المظهر الحديث" : "Choose and reorder the widgets for Modern Look")
                            : (language === "ar" ? "اختر الأدوات التي تريد عرضها في لوحة التحكم" : "Choose which widgets to display on your dashboard")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {widgetEntries.map(({ key, labelEn, labelAr }) => {
                        const isOn = !!widgetSettings[key];
                        const isDisabled = isHomescreen && !isOn && enabledCount >= MAX_HOMESCREEN_WIDGETS;
                        const currentSize = homescreenWidgetSizes[key] ?? 'big';
                        const orderIndex = isModern ? modernWidgetOrder.indexOf(key as ModernWidgetKey) : -1;
                        return (
                          <div
                            key={key}
                            className={`flex items-center justify-between rounded-md border p-4 transition-opacity ${isDisabled ? 'opacity-40' : ''}`}
                          >
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium">
                                {language === "ar" ? labelAr : labelEn}
                              </p>
                              {isDisabled && (
                                <p className="text-xs text-muted-foreground">
                                  {language === 'ar' ? 'الحد الأقصى ٤ ودجتات' : 'Max 4 reached'}
                                </p>
                              )}
                              {isModern && (
                                <p className="text-xs text-muted-foreground">
                                  {language === 'ar' ? 'يمكنك تغيير الترتيب من الأسهم' : 'Use the arrows to change the order'}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {isModern && (
                                <div className="flex overflow-hidden rounded-lg border border-border bg-muted/30">
                                  <button
                                    type="button"
                                    onClick={() => moveModernWidget(key as ModernWidgetKey, -1)}
                                    disabled={orderIndex <= 0}
                                    className="px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
                                    aria-label={language === 'ar' ? 'حرّك لأعلى' : 'Move up'}
                                  >
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveModernWidget(key as ModernWidgetKey, 1)}
                                    disabled={orderIndex === -1 || orderIndex >= modernWidgetOrder.length - 1}
                                    className="border-l border-border px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
                                    aria-label={language === 'ar' ? 'حرّك لأسفل' : 'Move down'}
                                  >
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                              {isHomescreen && isOn && (
                                <div className="flex overflow-hidden rounded-lg border border-border bg-muted/30">
                                  <button
                                    type="button"
                                    onClick={() => updateHomescreenWidgetSize(key, 'big')}
                                    className={`px-3 py-1 text-[11px] font-semibold transition-colors ${currentSize === 'big' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                                  >
                                    {language === 'ar' ? 'كبير' : 'Big'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateHomescreenWidgetSize(key, 'small')}
                                    className={`px-3 py-1 text-[11px] font-semibold transition-colors ${currentSize === 'small' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                                  >
                                    {language === 'ar' ? 'صغير' : 'Small'}
                                  </button>
                                </div>
                              )}
                              <Switch
                                checked={isOn}
                                disabled={isDisabled}
                                onCheckedChange={(checked) => handleWidgetToggle(key, checked)}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {isHomescreen && enabledCount >= MAX_HOMESCREEN_WIDGETS && (
                        <p className="text-xs text-amber-500">
                          {language === 'ar' ? 'الحد الأقصى ٤ ودجتات. ألغِ واحداً لإضافة غيره.' : 'Max 4 widgets. Turn one off to add another.'}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </>
              );
            })()}

            {dashboardLook === 'homescreen' && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ImageIcon className="h-5 w-5" />
                      {language === 'ar' ? 'خلفية الشاشة الرئيسية' : 'Home Screen Wallpaper'}
                    </CardTitle>
                    <CardDescription>
                      {language === 'ar' ? 'ارفع صورة أو اختر صورة محفوظة أو ارجع للخلفية الافتراضية' : 'Upload a wallpaper, pick a saved one, or go back to the default background'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => bgInputRef.current?.click()}>
                        <ImageIcon className="h-4 w-4 mr-2" />
                        {language === 'ar' ? 'رفع صورة' : 'Upload'}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setSavedImagesOpen(true)}>
                        {language === 'ar' ? 'اختر من المحفوظ' : 'Pick Saved'}
                      </Button>
                      {homescreenBgChoice === 'wallpaper' && homescreenBgImage && !isDefaultBgAsset(homescreenBgImage) && (
                        <Button type="button" variant="destructive" onClick={restoreDefaultHomescreenBackground}>
                          <X className="h-4 w-4 mr-2" />
                          {language === 'ar' ? 'حذف الخلفية' : 'Remove Wallpaper'}
                        </Button>
                      )}
                      <Button type="button" variant="outline" onClick={restoreDefaultHomescreenBackground}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {language === 'ar' ? 'افتراضي' : 'Default'}
                      </Button>
                    </div>
                    {homescreenBgChoice === 'wallpaper' && homescreenBgImage && !isDefaultBgAsset(homescreenBgImage) && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>{language === 'ar' ? 'موضع الخلفية' : 'Wallpaper Position'}</span>
                          <span className="text-primary font-semibold">{homescreenBgPositionY}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={homescreenBgPositionY}
                          onChange={(event) => saveHomescreenWallpaperPosition(parseInt(event.target.value, 10))}
                          title={language === 'ar' ? 'موضع الخلفية' : 'Wallpaper Position'}
                          aria-label={language === 'ar' ? 'موضع الخلفية' : 'Wallpaper Position'}
                          className="w-full"
                        />
                      </div>
                    )}
                    <input ref={bgInputRef} type="file" accept="image/*" title={language === 'ar' ? 'رفع خلفية الشاشة الرئيسية' : 'Upload Home Screen wallpaper'} aria-label={language === 'ar' ? 'رفع خلفية الشاشة الرئيسية' : 'Upload Home Screen wallpaper'} className="hidden" onChange={handleHomescreenWallpaperInput} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{language === 'ar' ? 'الدوك' : 'Dock'}</CardTitle>
                    <CardDescription>
                      {language === 'ar' ? 'اختر حتى ٣ تطبيقات أسفل الشاشة الرئيسية' : 'Choose up to 3 apps for the Home Screen dock'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-xl border p-4">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{language === 'ar' ? 'لون خلفية الدوك' : 'Dock Background Color'}</p>
                        <p className="text-xs text-muted-foreground">{language === 'ar' ? `${homescreenDockIds.length}/${MAX_HOMESCREEN_DOCK} مختار` : `${homescreenDockIds.length}/${MAX_HOMESCREEN_DOCK} selected`}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" title="Dock color" value={homescreenDockColor || '#0c0f14'} onChange={(event) => saveHomescreenDockColor(event.target.value)} className="w-10 h-10 rounded-xl cursor-pointer border border-border p-0.5 bg-transparent" />
                        {homescreenDockColor && (
                          <Button type="button" variant="outline" size="sm" onClick={clearHomescreenDockColor}>
                            {language === 'ar' ? 'إعادة' : 'Reset'}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {HOMESCREEN_APPS.map((app) => {
                        const isSelected = homescreenDockIds.includes(app.id);
                        const isDisabled = !isSelected && homescreenDockIds.length >= MAX_HOMESCREEN_DOCK;
                        return (
                          <button
                            key={app.id}
                            type="button"
                            onClick={() => !isDisabled && toggleHomescreenDockApp(app.id)}
                            className={`rounded-xl border px-3 py-3 text-sm font-medium transition-all text-left ${isSelected ? 'border-primary bg-primary/10 text-primary' : isDisabled ? 'border-border opacity-40 cursor-not-allowed' : 'border-border hover:border-primary/40'}`}
                          >
                            {language === 'ar' ? app.labelAr : app.labelEn}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{language === 'ar' ? 'ألوان الشاشة الرئيسية' : 'Home Screen Colors'}</CardTitle>
                    <CardDescription>
                      {language === 'ar' ? 'تحكم في لون العنوان أعلى الشاشة' : 'Control the greeting/header color shown at the top of the Home Screen'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between rounded-xl border p-4">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{language === 'ar' ? 'لون العنوان' : 'Header Color'}</p>
                        <p className="text-xs text-muted-foreground">{language === 'ar' ? 'للون جملة الترحيب في أعلى الشاشة' : 'For the greeting text at the top of the Home Screen'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" title="Header color" value={homescreenHeaderColor || '#ffffff'} onChange={(event) => saveHomescreenHeaderColor(event.target.value)} className="w-10 h-10 rounded-xl cursor-pointer border border-border p-0.5 bg-transparent" />
                        {homescreenHeaderColor && (
                          <Button type="button" variant="outline" size="sm" onClick={clearHomescreenHeaderColor}>
                            {language === 'ar' ? 'إعادة' : 'Reset'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Homescreen Background Style — only when homescreen look is active */}
            {dashboardLook === 'homescreen' && (() => {
              // Compute preview gradient string
              const gradientStr = hsBgMode === 'gradient'
                ? hsBgColor3
                  ? `linear-gradient(${hsBgAngle}deg, ${hsBgColor1} 0%, ${hsBgColor3} 50%, ${hsBgColor2} 100%)`
                  : `linear-gradient(${hsBgAngle}deg, ${hsBgColor1} 0%, ${hsBgColor2} 100%)`
                : hsBgColor1;

              // Angle presets
              const ANGLES: { label: string; labelAr: string; deg: number; icon: string }[] = [
                { label: 'Top → Bottom', labelAr: '↓', deg: 180, icon: '↓' },
                { label: 'Bottom → Top', labelAr: '↑', deg: 0,   icon: '↑' },
                { label: 'Left → Right', labelAr: '→', deg: 90,  icon: '→' },
                { label: 'Right → Left', labelAr: '←', deg: 270, icon: '←' },
                { label: '↘ Diagonal',   labelAr: '↘', deg: 135, icon: '↘' },
                { label: '↗ Diagonal',   labelAr: '↗', deg: 45,  icon: '↗' },
                { label: '↙ Diagonal',   labelAr: '↙', deg: 225, icon: '↙' },
                { label: '↖ Diagonal',   labelAr: '↖', deg: 315, icon: '↖' },
              ];

              return (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5" />
                      {language === 'ar' ? 'خلفية الشاشة الرئيسية' : 'Home Screen Style'}
                    </CardTitle>
                    <CardDescription>
                      {language === 'ar'
                        ? 'اختر لون أو تدرج مع زاوية وثلاثة ألوان'
                        : 'Solid color or custom gradient — pick angle and up to 3 colors'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">

                    {/* Mode toggle */}
                    <div className="flex gap-2">
                      {(['solid', 'gradient'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setHsBgMode(m)}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                            hsBgMode === m
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border text-muted-foreground hover:border-primary/50'
                          }`}
                        >
                          {m === 'solid'
                            ? (language === 'ar' ? 'لون ثابت' : 'Solid')
                            : (language === 'ar' ? 'تدرج' : 'Gradient')}
                        </button>
                      ))}
                    </div>

                    {/* Live preview — tall enough to feel real */}
                    <div
                      className="w-full h-24 rounded-2xl border border-border/40 relative overflow-hidden"
                      style={{ background: gradientStr }}
                    >
                      {hsGlow && (
                        <div className="absolute inset-0 pointer-events-none" style={{
                          background: `radial-gradient(ellipse at 50% 20%, ${hsBgColor2}66 0%, transparent 65%)`
                        }} />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center gap-3">
                        {[...Array(3)].map((_, i) => (
                          <div
                            key={i}
                            className="w-10 h-10 rounded-[23%] bg-white/20 backdrop-blur-sm border border-white/30"
                            style={{ boxShadow: hsGlow ? `0 0 14px ${hsBgColor2}aa` : 'none' }}
                          />
                        ))}
                      </div>
                      <span className="absolute bottom-1.5 left-0 right-0 text-center text-[9px] text-white/50">
                        {language === 'ar' ? 'معاينة' : 'Preview'}
                      </span>
                    </div>

                    {/* Color pickers */}
                    <div className="space-y-3">
                      {/* Color 1 */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-5 h-5 rounded-full border-2 border-border flex-shrink-0" style={{ background: hsBgColor1 }} />
                          <Label className="text-sm font-medium">
                            {hsBgMode === 'gradient' ? (language === 'ar' ? 'اللون ١' : 'Color 1') : (language === 'ar' ? 'اللون' : 'Color')}
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono hidden sm:block">{hsBgColor1}</span>
                          <input type="color" title={language === 'ar' ? 'اللون الأول' : 'Color 1'}
                            value={hsBgColor1} onChange={e => setHsBgColor1(e.target.value)}
                            className="w-10 h-10 rounded-xl cursor-pointer border border-border p-0.5 bg-transparent" />
                        </div>
                      </div>

                      {/* Color 2 — gradient only */}
                      {hsBgMode === 'gradient' && (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1">
                            <div className="w-5 h-5 rounded-full border-2 border-border flex-shrink-0" style={{ background: hsBgColor2 }} />
                            <Label className="text-sm font-medium">{language === 'ar' ? 'اللون ٢' : 'Color 2'}</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-mono hidden sm:block">{hsBgColor2}</span>
                            <input type="color" title={language === 'ar' ? 'اللون الثاني' : 'Color 2'}
                              value={hsBgColor2} onChange={e => setHsBgColor2(e.target.value)}
                              className="w-10 h-10 rounded-xl cursor-pointer border border-border p-0.5 bg-transparent" />
                          </div>
                        </div>
                      )}

                      {/* Color 3 — gradient only, optional */}
                      {hsBgMode === 'gradient' && (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1">
                            <div className="w-5 h-5 rounded-full border-2 border-border flex-shrink-0"
                              style={{ background: hsBgColor3 || 'transparent' }} />
                            <div>
                              <Label className="text-sm font-medium">{language === 'ar' ? 'اللون ٣ (اختياري)' : 'Color 3 (optional)'}</Label>
                              {!hsBgColor3 && <p className="text-[10px] text-muted-foreground">{language === 'ar' ? 'اضغط لإضافة لون وسط' : 'Tap to add middle color'}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {hsBgColor3 && (
                              <button onClick={() => setHsBgColor3('')}
                                className="text-[10px] text-muted-foreground hover:text-destructive px-2 py-1 rounded-lg border border-border">
                                {language === 'ar' ? 'حذف' : 'Clear'}
                              </button>
                            )}
                            <input type="color" title={language === 'ar' ? 'اللون الثالث' : 'Color 3 (middle)'}
                              value={hsBgColor3 || hsBgColor1}
                              onChange={e => setHsBgColor3(e.target.value)}
                              className="w-10 h-10 rounded-xl cursor-pointer border border-border p-0.5 bg-transparent" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Angle selector — gradient only */}
                    {hsBgMode === 'gradient' && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{language === 'ar' ? 'اتجاه التدرج' : 'Gradient Direction'}</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {ANGLES.map(a => (
                            <button
                              key={a.deg}
                              onClick={() => setHsBgAngle(a.deg)}
                              className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-base font-bold transition-all ${
                                hsBgAngle === a.deg
                                  ? 'border-primary bg-primary/15 text-primary'
                                  : 'border-border text-muted-foreground hover:border-primary/40'
                              }`}
                            >
                              <span className="text-lg leading-none">{a.icon}</span>
                              <span className="text-[9px] mt-1 font-normal opacity-70">{a.deg}°</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Glow toggle */}
                    <div className="flex items-center justify-between rounded-xl border p-4">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">
                          {language === 'ar' ? 'تأثير الإضاءة ✨' : 'Glow Effect ✨'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {language === 'ar' ? 'إضاءة ملونة خلف الأيقونات والودجيتس' : 'Colored glow behind icons and widgets'}
                        </p>
                      </div>
                      <Switch checked={hsGlow} onCheckedChange={v => setHsGlow(v)} />
                    </div>

                    {/* Save button */}
                    <Button
                      className="w-full h-12 text-sm font-semibold rounded-xl"
                      onClick={() => saveHomescreenBg(hsBgMode, hsBgColor1, hsBgColor2, hsBgColor3, hsBgAngle, hsGlow)}
                    >
                      {language === 'ar' ? 'حفظ النمط' : 'Save Style'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })()}

            {dashboardLook === 'homescreen' && savedImagesOpen && (
              <SavedImagesPicker
                onSelect={(imageUrl) => {
                  void applyHomescreenWallpaper(imageUrl);
                  setSavedImagesOpen(false);
                }}
                onClose={() => setSavedImagesOpen(false)}
              />
            )}
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}
