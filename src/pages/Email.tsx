import React, { useMemo, useRef, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useEmailConnections, ImapConnectionHealth } from '@/hooks/useEmailConnections';
import { EmailConnectionModal } from '@/components/email/EmailConnectionModal';
import { AppleLogo } from '@/components/calendar/AppleLogo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Settings2, XCircle, Plug, RefreshCw, Trash2, Star, Loader2, Search, Sparkles, ImagePlus } from 'lucide-react';
import { GmailClient } from '@/components/email/GmailClient';
import { CustomMailClient } from '@/components/email/CustomMailClient';
import { toast } from 'sonner';
import { buildSignatureHtml, generateEmailSignatureHtml, prepareEmailSignatureImage, readEmailSignatureSettings, saveEmailSignatureSettings } from '@/utils/emailSignature';

type EmailTab = 'settings' | 'gmail' | 'apple' | 'mail';

function GmailIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" className={className}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function Email() {
  const { language } = useTheme();
  const emailConn = useEmailConnections();
  const storedSignatureSettings = useMemo(() => readEmailSignatureSettings(), []);
  const signatureImageInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<EmailTab>('settings');
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [signatureHtmlDraft, setSignatureHtmlDraft] = useState(storedSignatureSettings.html);
  const [signaturePrompt, setSignaturePrompt] = useState(storedSignatureSettings.prompt);
  const [signatureImageDataUrl, setSignatureImageDataUrl] = useState(storedSignatureSettings.imageDataUrl);
  const [signatureImageAlt, setSignatureImageAlt] = useState(storedSignatureSettings.imageAlt);
  const [signatureUpdatedAt, setSignatureUpdatedAt] = useState(storedSignatureSettings.updatedAt);
  const [generatingSignature, setGeneratingSignature] = useState(false);
  const [processingSignatureImage, setProcessingSignatureImage] = useState(false);
  const pageCardClass = 'rounded-[26px] border border-[#060541]/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.995),rgba(249,250,255,0.98))] shadow-[0_18px_48px_rgba(6,5,65,0.08)] ring-1 ring-[#060541]/5 dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(12,15,20,0.98),rgba(18,22,31,0.96))] dark:shadow-[0_20px_48px_rgba(0,0,0,0.45)] dark:ring-1 dark:ring-white/5';
  const panelClass = 'rounded-[22px] border border-[#060541]/15 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(245,247,255,0.97))] shadow-[0_10px_28px_rgba(6,5,65,0.07)] ring-1 ring-[#060541]/5 dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(15,18,26,0.98),rgba(10,12,18,0.96))] dark:shadow-[0_12px_30px_rgba(0,0,0,0.36)] dark:ring-1 dark:ring-white/5';
  const outlineButtonClass = 'border-[#060541]/16 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.96))] text-[#060541] shadow-[0_4px_12px_rgba(6,5,65,0.06)] hover:bg-[#f3f5ff] hover:text-[#060541] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.98),rgba(11,14,21,0.96))] dark:text-foreground dark:shadow-[0_10px_24px_rgba(0,0,0,0.34)] dark:hover:!bg-[linear-gradient(180deg,rgba(28,33,46,0.98),rgba(15,18,26,0.96))]';

  const customConnections = emailConn.imap.connections;
  const gmailConnected = emailConn.gmail.connection.connected;
  const verifiedCustomCount = customConnections.filter(connection => emailConn.imap.health[connection.id]?.status === 'verified').length;

  const t = useMemo(() => ({
    title: language === 'ar' ? 'البريد' : 'Email',
    subtitle: language === 'ar' ? 'إدارة وربط حسابات البريد في مكان واحد' : 'Manage and connect your email accounts in one place',
    settings: language === 'ar' ? 'إعدادات البريد' : 'Email Settings',
    gmail: 'Gmail',
    apple: language === 'ar' ? 'أبل' : 'Apple',
    mail: language === 'ar' ? 'البريد' : 'Mail',
    connected: language === 'ar' ? 'متصل' : 'Connected',
    notConnected: language === 'ar' ? 'غير متصل' : 'Not connected',
    connectEmail: language === 'ar' ? 'ربط بريد جديد' : 'Connect Email Account',
    refresh: language === 'ar' ? 'تحديث' : 'Refresh',
    primaryEmail: language === 'ar' ? 'البريد الأساسي' : 'Primary Email',
    noPrimaryEmail: language === 'ar' ? 'لا يوجد بريد متصل بعد' : 'No email connected yet',
    customMail: language === 'ar' ? 'بريد مخصص' : 'Custom Mail',
    customMailSubtitle: language === 'ar' ? 'الحسابات التي تم ربطها عبر IMAP / SMTP' : 'Accounts connected through IMAP / SMTP',
    gmailSubtitle: language === 'ar' ? 'ربط Gmail بنفس التدفق الحالي العامل' : 'Connect Gmail using the existing working flow',
    appleSubtitle: language === 'ar' ? 'دعم Apple سيأتي لاحقًا' : 'Apple support will come later',
    settingsSubtitle: language === 'ar' ? 'هذا هو المكان الرئيسي لربط وإدارة البريد' : 'This is the main place to connect and manage email',
    mailSubtitle: language === 'ar' ? 'استعرض وأدر حسابات البريد المخصص' : 'Review and manage your custom mail accounts',
    connectGmail: language === 'ar' ? 'ربط Gmail' : 'Connect Gmail',
    disconnectGmail: language === 'ar' ? 'فصل Gmail' : 'Disconnect Gmail',
    makePrimary: language === 'ar' ? 'تعيين كأساسي' : 'Make Primary',
    remove: language === 'ar' ? 'إزالة' : 'Remove',
    connectedEmail: language === 'ar' ? 'البريد المتصل' : 'Connected email',
    noCustomMail: language === 'ar' ? 'لا توجد حسابات بريد مخصص بعد' : 'No custom mail accounts yet',
    noCustomMailHint: language === 'ar' ? 'استخدم تبويب إعدادات البريد لربط أول حساب.' : 'Use the Email Settings tab to connect your first account.',
    appleUnavailable: language === 'ar' ? 'Apple / iCloud غير متاح هنا بعد' : 'Apple / iCloud is not available here yet',
    appleUnavailableHint: language === 'ar' ? 'سنتركه ظاهرًا هنا لكن بدون ربط الآن.' : 'It stays visible here, but it is not connectable yet.',
    openSettings: language === 'ar' ? 'افتح الإعدادات' : 'Open Settings',
    provider: language === 'ar' ? 'المزود' : 'Provider',
    username: language === 'ar' ? 'اسم المستخدم' : 'Username',
    customConnectedCount: language === 'ar' ? 'عدد الحسابات المخصصة' : 'Custom accounts',
    addAnotherEmail: language === 'ar' ? 'ربط بريد آخر' : 'Connect Another Email',
    addCustomMail: language === 'ar' ? 'إضافة بريد مخصص' : 'Add Custom Mail',
    comingSoon: language === 'ar' ? 'قريبًا' : 'Coming soon',
    connectApple: language === 'ar' ? 'ربط Apple' : 'Connect Apple',
    customAccount: language === 'ar' ? 'حساب مخصص' : 'Custom account',
    customMailAccounts: language === 'ar' ? 'حسابات البريد المخصص' : 'Custom Mail Accounts',
    checking: language === 'ar' ? 'جارٍ التحقق' : 'Checking',
    needsAttention: language === 'ar' ? 'تحتاج مراجعة' : 'Needs attention',
    verifiedMailbox: language === 'ar' ? 'تم التحقق من الصندوق' : 'Mailbox verified',
    inboxProof: language === 'ar' ? 'صندوق الوارد' : 'Inbox',
    searchPlaceholder: language === 'ar' ? 'ابحث في المرسل أو الموضوع' : 'Search sender or subject',
    appleSearchHint: language === 'ar' ? 'سيعمل البحث هنا عندما يصبح Apple Mail متاحًا.' : 'Search will work here once Apple Mail is available.',
    signatureTitle: language === 'ar' ? 'توقيع البريد' : 'Email Signature',
    signatureSubtitle: language === 'ar' ? 'اكتب طلبك فقط، ويمكنك رفع صورة إذا احتجت.' : 'Just write your prompt, and add an image only if you need one.',
    signaturePromptLabel: language === 'ar' ? 'صف الشكل والإحساس الذي تريده' : 'Describe the look and feel you want',
    signaturePromptPlaceholder: language === 'ar' ? 'مثال: ابنِ لي توقيع بريد حديثاً ومرتباً جداً. استخدم اسمي عبدالله الفاضلي، CEO، wakti.ai، Doha, Qatar، مع الهاتف والموقع، وضع الشعار على اليسار واجعل الشكل راقياً وواضحاً.' : 'Example: Build me a clean modern email signature. Use my name Abdullah Alfadly, CEO, wakti.ai, Doha, Qatar, with my phone and website, put the logo on the left, and make it polished and clear.',
    generateSignature: language === 'ar' ? 'أنشئ واحفظ التوقيع' : 'Generate and save signature',
    generatingSignature: language === 'ar' ? 'جارٍ التوليد...' : 'Generating...',
    signaturePreview: language === 'ar' ? 'معاينة التوقيع' : 'Signature preview',
    signatureSaved: language === 'ar' ? 'تم حفظ التوقيع' : 'Signature saved',
    signatureGenerated: language === 'ar' ? 'تم إنشاء التوقيع وحفظه' : 'Signature generated and saved',
    signaturePromptHelp: language === 'ar' ? 'اكتب ما الذي يجب أن يظهر في التوقيع.' : 'Write what should appear in the signature.',
    signatureImageTitle: language === 'ar' ? 'صورة أو شعار اختياري' : 'Optional image or logo',
    signatureImageHelp: language === 'ar' ? 'اختياري فقط.' : 'Optional only.',
    uploadSignatureImage: language === 'ar' ? 'رفع صورة أو شعار' : 'Upload image or logo',
    changeSignatureImage: language === 'ar' ? 'تغيير الصورة' : 'Change image',
    removeSignatureImage: language === 'ar' ? 'إزالة الصورة' : 'Remove image',
    processingSignatureImage: language === 'ar' ? 'جارٍ تجهيز الصورة...' : 'Preparing image...',
    signatureReadyHelp: language === 'ar' ? 'الصورة جاهزة.' : 'Image ready.',
  }), [language]);

  const signaturePreviewHtml = useMemo(() => buildSignatureHtml({
    enabled: true,
    html: signatureHtmlDraft,
    showWaktiAiFooter: false,
    prompt: signaturePrompt,
    stylePreset: '',
    imageDataUrl: signatureImageDataUrl,
    imageAlt: signatureImageAlt,
    updatedAt: signatureUpdatedAt,
  }), [signatureHtmlDraft, signatureImageAlt, signatureImageDataUrl, signaturePrompt, signatureUpdatedAt]);

  const getHealthBadge = (health?: ImapConnectionHealth) => {
    if (!health || health.status === 'unknown') {
      return <Badge variant="outline" className="border-[#060541]/12 bg-white text-[#060541]/70 dark:border-border/60 dark:bg-transparent dark:text-muted-foreground">{t.notConnected}</Badge>;
    }
    if (health.status === 'checking') {
      return <Badge variant="outline" className="border-yellow-400/40 bg-yellow-50 text-yellow-600 dark:bg-transparent dark:text-yellow-400">{t.checking}</Badge>;
    }
    if (health.status === 'verified') {
      return <Badge className="bg-green-600 text-white hover:bg-green-600">{t.verifiedMailbox}</Badge>;
    }
    return <Badge variant="outline" className="border-red-400/40 bg-red-50 text-red-500 dark:bg-transparent dark:text-red-400">{t.needsAttention}</Badge>;
  };

  const tabs: Array<{
    key: EmailTab;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'settings',
      label: t.settings,
      icon: (
        <span className="flex items-center gap-1">
          <Mail className="h-3.5 w-3.5" />
          <Settings2 className="h-3.5 w-3.5" />
        </span>
      ),
    },
    {
      key: 'gmail',
      label: t.gmail,
      icon: <GmailIcon size={14} />,
    },
    {
      key: 'apple',
      label: t.apple,
      icon: <AppleLogo size={14} className="text-current" />,
    },
    {
      key: 'mail',
      label: t.mail,
      icon: <Mail className="h-3.5 w-3.5" />,
    },
  ];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        emailConn.gmail.checkConnection(),
        emailConn.imap.refresh(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const persistSignature = (overrides: Partial<ReturnType<typeof readEmailSignatureSettings>> = {}, showToast = true) => {
    const nextSettings: ReturnType<typeof readEmailSignatureSettings> = {
      enabled: true,
      html: overrides?.html ?? signatureHtmlDraft,
      showWaktiAiFooter: false,
      prompt: overrides?.prompt ?? signaturePrompt,
      stylePreset: overrides?.stylePreset ?? '',
      imageDataUrl: overrides?.imageDataUrl ?? signatureImageDataUrl,
      imageAlt: overrides?.imageAlt ?? signatureImageAlt,
      updatedAt: new Date().toISOString(),
    };
    const saved = saveEmailSignatureSettings(nextSettings);
    setSignatureHtmlDraft(saved.html);
    setSignaturePrompt(saved.prompt);
    setSignatureImageDataUrl(saved.imageDataUrl);
    setSignatureImageAlt(saved.imageAlt);
    setSignatureUpdatedAt(saved.updatedAt);
    if (showToast) {
      toast.success(t.signatureSaved);
    }
    return saved;
  };

  const handleGenerateSignature = async () => {
    setGeneratingSignature(true);
    try {
      const generatedHtml = await generateEmailSignatureHtml({
        prompt: signaturePrompt,
        language: language === 'ar' ? 'ar' : 'en',
        imageDataUrl: signatureImageDataUrl,
        imageAlt: signatureImageAlt,
      });
      persistSignature({ html: generatedHtml }, false);
      toast.success(t.signatureGenerated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate signature');
    } finally {
      setGeneratingSignature(false);
    }
  };

  const handleSignatureImagePick = () => {
    signatureImageInputRef.current?.click();
  };

  const handleSignatureImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProcessingSignatureImage(true);
    try {
      const prepared = await prepareEmailSignatureImage(file);
      setSignatureImageDataUrl(prepared.dataUrl);
      setSignatureImageAlt(prepared.alt);
      toast.success(t.signatureSaved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to prepare image');
    } finally {
      setProcessingSignatureImage(false);
    }
  };

  const handleRemoveSignatureImage = () => {
    setSignatureImageDataUrl('');
    setSignatureImageAlt('');
  };

  const renderSettingsTab = () => (
    <div className="space-y-4">
      <Card className={pageCardClass}>
        <CardHeader>
          <CardTitle>{t.settings}</CardTitle>
          <CardDescription>{t.settingsSubtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm text-muted-foreground">{t.primaryEmail}</div>
              <div className="mt-1 text-base font-semibold break-all">
                {emailConn.primaryEmail || t.noPrimaryEmail}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowConnectionModal(true)}
                className="bg-[#060541] text-white hover:bg-[#0a0a5c] dark:bg-[linear-gradient(180deg,rgba(20,24,34,0.98),rgba(11,14,21,0.96))] dark:text-white dark:shadow-[0_12px_28px_rgba(0,0,0,0.38)] dark:hover:bg-[linear-gradient(180deg,rgba(28,33,46,0.98),rgba(15,18,26,0.96))]"
              >
                <Mail className="h-4 w-4" />
                {t.addCustomMail}
              </Button>
              <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className={outlineButtonClass}>
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {t.refresh}
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-[24px] border border-[#060541]/15 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(245,247,255,0.97))] shadow-[0_16px_36px_rgba(6,5,65,0.08)] ring-1 ring-[#060541]/5 divide-y divide-[#060541]/10 dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(14,17,24,0.98),rgba(10,12,18,0.96))] dark:divide-white/10 dark:shadow-[0_18px_36px_rgba(0,0,0,0.4)] dark:ring-1 dark:ring-white/5">
            <div className="flex items-center justify-between gap-3 px-4 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <GmailIcon size={16} />
                  <span className="font-medium">Gmail</span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground break-all">
                  {emailConn.gmail.connection.emailAddress
                    ? emailConn.gmail.connection.emailAddress
                    : gmailConnected
                    ? '...'
                    : null}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                {gmailConnected ? (
                  <Badge className="bg-green-600 text-white hover:bg-green-600 shrink-0">{t.connected}</Badge>
                ) : (
                  <Badge variant="outline" className="border-red-400/40 bg-red-50 text-red-500 shrink-0 dark:bg-transparent dark:text-red-400">{t.notConnected}</Badge>
                )}
                {gmailConnected ? (
                  <Button variant="outline" size="sm" onClick={emailConn.gmail.disconnectGmail} className={outlineButtonClass}>
                    <XCircle className="h-4 w-4" />
                    {t.disconnectGmail}
                  </Button>
                ) : (
                  <Button size="sm" onClick={emailConn.gmail.initiateGmailAuth} className="bg-[#060541] text-white hover:bg-[#0a0a5c] dark:bg-[linear-gradient(180deg,rgba(20,24,34,0.98),rgba(11,14,21,0.96))] dark:text-white dark:shadow-[0_12px_28px_rgba(0,0,0,0.38)] dark:hover:bg-[linear-gradient(180deg,rgba(28,33,46,0.98),rgba(15,18,26,0.96))]">
                    <GmailIcon size={14} />
                    {t.connectGmail}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <AppleLogo size={16} className="text-current" />
                  <span className="font-medium">Apple / iCloud</span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{t.comingSoon}</div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Badge variant="outline" className="border-red-400/40 bg-red-50 text-red-500 shrink-0 dark:bg-transparent dark:text-red-400">{t.comingSoon}</Badge>
                <Button variant="outline" size="sm" disabled className={outlineButtonClass}>
                  <AppleLogo size={14} className="text-current" />
                  {t.connectApple}
                </Button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Plug className="h-4 w-4 text-[#E9CEB0]" />
                  <span className="font-medium">{t.customMailAccounts}</span>
                  {customConnections.length > 0 ? (
                    verifiedCustomCount > 0 ? (
                      <Badge className="bg-green-600 text-white hover:bg-green-600">{verifiedCustomCount} {t.customConnectedCount}</Badge>
                    ) : (
                      <Badge variant="outline" className="border-red-400/40 bg-red-50 text-red-500 dark:bg-transparent dark:text-red-400">0 {t.customConnectedCount}</Badge>
                    )
                  ) : (
                    <Badge variant="outline" className="border-red-400/40 bg-red-50 text-red-500 dark:bg-transparent dark:text-red-400">{t.notConnected}</Badge>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowConnectionModal(true)} className={outlineButtonClass}>
                  <Mail className="h-4 w-4" />
                  {t.addCustomMail}
                </Button>
              </div>

              {customConnections.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#060541]/24 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,248,255,0.9))] p-5 text-sm text-muted-foreground dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(18,22,31,0.76),rgba(12,15,20,0.72))]">
                  {t.noCustomMailHint}
                </div>
              ) : (
                customConnections.map((connection) => (
                  <div key={connection.id} className={panelClass}>
                    <div className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{connection.display_name || t.customAccount}</span>
                          {connection.is_primary && (
                            <Badge className="bg-green-600 text-white hover:bg-green-600">
                              {t.primaryEmail}
                            </Badge>
                          )}
                          {getHealthBadge(emailConn.imap.health[connection.id])}
                        </div>
                        <div className="text-sm text-muted-foreground break-all">{connection.email_address || connection.username}</div>
                        {emailConn.imap.health[connection.id]?.status === 'verified' && emailConn.imap.health[connection.id]?.proof && (
                          <div className="text-xs text-muted-foreground">
                            {emailConn.imap.health[connection.id]?.proof?.login} · {t.inboxProof.toLowerCase()} {emailConn.imap.health[connection.id]?.proof?.inboxCount}
                          </div>
                        )}
                        {emailConn.imap.health[connection.id]?.status === 'failed' && emailConn.imap.health[connection.id]?.error && (
                          <div className="text-xs text-red-400">
                            {emailConn.imap.health[connection.id]?.error}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {!connection.is_primary && (
                          <Button variant="outline" size="sm" onClick={() => emailConn.imap.setPrimary(connection.id)} className={outlineButtonClass}>
                            <Star className="h-4 w-4" />
                            {t.makePrimary}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => emailConn.imap.remove(connection.id)} className={outlineButtonClass}>
                          <Trash2 className="h-4 w-4" />
                          {t.remove}
                        </Button>
                      </div>
                    </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={pageCardClass}>
        <CardHeader>
          <CardTitle>{t.signatureTitle}</CardTitle>
          <CardDescription>{t.signatureSubtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={signatureImageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleSignatureImageChange}
            aria-label={t.uploadSignatureImage}
            title={t.uploadSignatureImage}
            className="hidden"
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">{t.signatureImageTitle}</div>
              <div className="mt-1 text-xs text-muted-foreground">{t.signatureImageHelp}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleSignatureImagePick} disabled={processingSignatureImage} className={outlineButtonClass}>
                {processingSignatureImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {processingSignatureImage ? t.processingSignatureImage : (signatureImageDataUrl ? t.changeSignatureImage : t.uploadSignatureImage)}
              </Button>
              {signatureImageDataUrl ? (
                <Button type="button" variant="outline" onClick={handleRemoveSignatureImage} className={outlineButtonClass}>
                  <Trash2 className="h-4 w-4" />
                  {t.removeSignatureImage}
                </Button>
              ) : null}
            </div>
          </div>

          {signatureImageDataUrl ? (
            <div className="flex items-center gap-3 rounded-xl border border-[#060541]/10 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-background/60">
              <img src={signatureImageDataUrl} alt={signatureImageAlt || 'signature preview'} className="h-12 w-12 rounded-lg object-cover ring-1 ring-[#060541]/10 dark:ring-white/10" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{signatureImageAlt || 'Image ready'}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{t.signatureReadyHelp}</div>
              </div>
            </div>
          ) : null}

          <div>
            <div className="text-sm font-medium text-foreground">{t.signaturePromptLabel}</div>
            <div className="mt-1 text-xs text-muted-foreground">{t.signaturePromptHelp}</div>
            <Textarea
              value={signaturePrompt}
              onChange={(event) => setSignaturePrompt(event.target.value)}
              placeholder={t.signaturePromptPlaceholder}
              className="mt-3 min-h-[140px] rounded-2xl border border-[#060541]/12 bg-white text-sm text-[#060541] shadow-[0_1px_2px_rgba(6,5,65,0.04)] dark:border-white/10 dark:bg-background/70 dark:text-foreground"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={handleGenerateSignature} disabled={generatingSignature} className="gap-2 rounded-xl bg-[#060541] text-white hover:bg-[#0a0a5c]">
                {generatingSignature ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generatingSignature ? t.generatingSignature : t.generateSignature}
              </Button>
            </div>
          </div>

          {signaturePreviewHtml ? (
            <div>
              <div className="text-sm font-medium text-foreground">{t.signaturePreview}</div>
              <div className="mt-3 overflow-x-auto rounded-2xl border border-[#060541]/12 bg-white p-4 shadow-[inset_0_1px_2px_rgba(6,5,65,0.04)]">
                <div className="min-w-[320px]" dangerouslySetInnerHTML={{ __html: signaturePreviewHtml }} />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );

  const renderGmailTab = () => (
    <div className="space-y-2">
      <GmailClient
        connected={gmailConnected}
        emailAddress={emailConn.gmail.connection.emailAddress}
        onConnect={emailConn.gmail.initiateGmailAuth}
        onDisconnect={emailConn.gmail.disconnectGmail}
        language={language}
      />
    </div>
  );

  const renderAppleTab = () => (
    <Card className={pageCardClass}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AppleLogo size={18} className="text-current" />
          Apple
        </CardTitle>
        <CardDescription>{t.appleSubtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-red-400/40 bg-red-50 text-red-500 dark:bg-transparent dark:text-red-400">{t.notConnected}</Badge>
        </div>
        <div className="overflow-hidden rounded-[24px] border border-[#060541]/15 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(246,248,255,0.98))] shadow-[0_16px_36px_rgba(6,5,65,0.08)] ring-1 ring-[#060541]/5 dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(14,17,24,0.98),rgba(10,12,18,0.96))] dark:shadow-[0_18px_36px_rgba(0,0,0,0.4)] dark:ring-1 dark:ring-white/5">
          <div className="border-b border-[#060541]/10 px-4 py-3 dark:border-border/50 sm:px-5">
            <div className="flex items-center gap-2 rounded-2xl border border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,249,255,0.98))] px-3 py-2.5 shadow-[0_4px_12px_rgba(6,5,65,0.05)] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
              <Search className="h-4 w-4 shrink-0 text-[#060541]/45 dark:text-muted-foreground" />
              <input
                type="text"
                value=""
                readOnly
                disabled
                placeholder={t.searchPlaceholder}
                className="h-5 w-full bg-transparent text-sm text-[#060541]/60 outline-none placeholder:text-[#060541]/36 disabled:cursor-not-allowed dark:text-foreground/70 dark:placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="p-4 sm:p-5">
          <div className="flex items-center gap-2 text-base font-medium">
            <XCircle className="h-5 w-5 text-red-400" />
            {t.appleUnavailable}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">{t.appleUnavailableHint}</div>
          <div className="mt-3 text-xs text-muted-foreground">{t.appleSearchHint}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderMailTab = () => (
    <div className="space-y-2">
      <CustomMailClient
        connections={customConnections}
        health={emailConn.imap.health}
        onOpenSettings={() => setActiveTab('settings')}
        language={language}
      />
    </div>
  );

  return (
    <div className="w-full h-full">
      <div className="mx-auto w-full max-w-none bg-[radial-gradient(circle_at_top,rgba(233,206,176,0.16),transparent_28%),linear-gradient(180deg,rgba(252,254,253,1),rgba(245,247,255,0.95))] px-3 pb-6 pt-2 md:px-6 md:pt-4 lg:px-8 dark:bg-none">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold md:text-xl">{t.title}</h1>
            <p className="mt-1 hidden text-xs text-muted-foreground sm:block sm:text-sm">{t.subtitle}</p>
          </div>
          {activeTab === 'settings' ? (
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className={`shrink-0 ${outlineButtonClass}`}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          ) : null}
        </div>

        <div className="mb-3">
          <div className="grid grid-cols-4 gap-1.5 rounded-[26px] border border-[#060541]/15 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(245,247,255,0.97))] p-1.5 shadow-[0_16px_36px_rgba(6,5,65,0.08)] ring-1 ring-[#060541]/5 dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(16,20,29,0.98),rgba(10,12,18,0.96))] dark:shadow-[0_18px_36px_rgba(0,0,0,0.4)] dark:ring-1 dark:ring-white/5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex min-h-[46px] items-center justify-center gap-2 rounded-[18px] border px-2 py-2 text-[11px] font-medium transition-all md:text-sm ${activeTab === tab.key ? 'border-[#060541] bg-[#060541] text-white shadow-[0_14px_28px_rgba(6,5,65,0.3)] ring-1 ring-[#060541]/35 dark:border-white/15 dark:bg-[linear-gradient(180deg,rgba(34,40,56,0.98),rgba(16,20,29,0.96))] dark:text-white dark:shadow-[0_16px_30px_rgba(0,0,0,0.45)] dark:ring-white/10' : 'border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.98))] text-[#060541]/88 shadow-[0_4px_12px_rgba(6,5,65,0.06)] hover:border-[#060541]/22 hover:bg-[#f3f5ff] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(18,22,31,0.96),rgba(11,14,21,0.94))] dark:text-foreground dark:shadow-[0_10px_22px_rgba(0,0,0,0.32)] dark:hover:!bg-[linear-gradient(180deg,rgba(26,31,43,0.96),rgba(14,17,24,0.94))]'}`}
              >
                <span className="flex items-center gap-1">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'settings' && renderSettingsTab()}
        {activeTab === 'gmail' && renderGmailTab()}
        {activeTab === 'apple' && renderAppleTab()}
        {activeTab === 'mail' && renderMailTab()}

        <EmailConnectionModal
          open={showConnectionModal}
          onOpenChange={setShowConnectionModal}
          onSave={emailConn.imap.add}
        />
      </div>
    </div>
  );
}
