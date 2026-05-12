import React, { useMemo, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useEmailConnections, ImapConnectionHealth } from '@/hooks/useEmailConnections';
import { EmailConnectionModal } from '@/components/email/EmailConnectionModal';
import { AppleLogo } from '@/components/calendar/AppleLogo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Settings2, XCircle, Plug, RefreshCw, Trash2, Star, Loader2 } from 'lucide-react';
import { GmailClient } from '@/components/email/GmailClient';
import { CustomMailClient } from '@/components/email/CustomMailClient';

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
  const [activeTab, setActiveTab] = useState<EmailTab>('settings');
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
  }), [language]);

  const getHealthBadge = (health?: ImapConnectionHealth) => {
    if (!health || health.status === 'unknown') {
      return <Badge variant="outline" className="border-border/60 text-muted-foreground">{t.notConnected}</Badge>;
    }
    if (health.status === 'checking') {
      return <Badge variant="outline" className="border-yellow-400/40 text-yellow-400">{t.checking}</Badge>;
    }
    if (health.status === 'verified') {
      return <Badge className="bg-green-600 text-white hover:bg-green-600">{t.verifiedMailbox}</Badge>;
    }
    return <Badge variant="outline" className="border-red-400/40 text-red-400">{t.needsAttention}</Badge>;
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

  const renderSettingsTab = () => (
    <div className="space-y-4">
      <Card>
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
                className="bg-[#060541] hover:bg-[#0a0a5c] text-white"
              >
                <Mail className="h-4 w-4" />
                {t.addCustomMail}
              </Button>
              <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {t.refresh}
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/30 divide-y divide-border/50 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
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
                  <Badge variant="outline" className="border-red-400/40 text-red-400 shrink-0">{t.notConnected}</Badge>
                )}
                {gmailConnected ? (
                  <Button variant="outline" size="sm" onClick={emailConn.gmail.disconnectGmail}>
                    <XCircle className="h-4 w-4" />
                    {t.disconnectGmail}
                  </Button>
                ) : (
                  <Button size="sm" onClick={emailConn.gmail.initiateGmailAuth} className="bg-[#060541] hover:bg-[#0a0a5c] text-white">
                    <GmailIcon size={14} />
                    {t.connectGmail}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <AppleLogo size={16} className="text-current" />
                  <span className="font-medium">Apple / iCloud</span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{t.comingSoon}</div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Badge variant="outline" className="border-red-400/40 text-red-400 shrink-0">{t.comingSoon}</Badge>
                <Button variant="outline" size="sm" disabled>
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
                      <Badge variant="outline" className="border-red-400/40 text-red-400">0 {t.customConnectedCount}</Badge>
                    )
                  ) : (
                    <Badge variant="outline" className="border-red-400/40 text-red-400">{t.notConnected}</Badge>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowConnectionModal(true)}>
                  <Mail className="h-4 w-4" />
                  {t.addCustomMail}
                </Button>
              </div>

              {customConnections.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
                  {t.noCustomMailHint}
                </div>
              ) : (
                customConnections.map((connection) => (
                  <div key={connection.id} className="rounded-xl border border-border/60 bg-background/30 p-4">
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
                          <Button variant="outline" size="sm" onClick={() => emailConn.imap.setPrimary(connection.id)}>
                            <Star className="h-4 w-4" />
                            {t.makePrimary}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => emailConn.imap.remove(connection.id)}>
                          <Trash2 className="h-4 w-4" />
                          {t.remove}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AppleLogo size={18} className="text-current" />
          Apple
        </CardTitle>
        <CardDescription>{t.appleSubtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-red-400/40 text-red-400">{t.notConnected}</Badge>
        </div>
        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
          <div className="flex items-center gap-2 text-base font-medium">
            <XCircle className="h-5 w-5 text-red-400" />
            {t.appleUnavailable}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">{t.appleUnavailableHint}</div>
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
      <div className="mx-auto w-full max-w-none pt-4 md:pt-8 pb-6 px-3 md:px-6 lg:px-8">
        <div className="text-center mb-4">
          <h1 className="text-xl md:text-2xl font-semibold">{t.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>

        <div className="mb-4">
          <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl border border-border/70 bg-white/60 dark:bg-white/5 shadow-sm">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`min-h-[48px] px-2 py-2 rounded-xl border text-[11px] md:text-sm font-medium transition-all flex flex-col items-center justify-center gap-1 leading-tight ${activeTab === tab.key ? 'bg-[#060541] text-white shadow-lg border-[#060541] ring-1 ring-[#060541]/40' : 'bg-white/80 dark:bg-white/5 border-border shadow-sm hover:shadow-md hover:bg-white dark:hover:bg-white/10'}`}
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
