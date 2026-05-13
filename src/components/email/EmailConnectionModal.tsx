import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/providers/ThemeProvider';
import { detectProviderSettings } from '@/hooks/useEmailConnections';
import { Mail, Server, Save, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: {
    provider: string;
    display_name: string;
    email_address: string;
    smtp_host: string;
    smtp_port: number;
    smtp_secure: boolean;
    username: string;
    password: string;
    imap_host?: string;
    imap_port?: number;
    imap_secure?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
}

export const EmailConnectionModal: React.FC<Props> = ({ open, onOpenChange, onSave }) => {
  const { language } = useTheme();
  const isAr = language === 'ar';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [imapSecure, setImapSecure] = useState(true);
  const [username, setUsername] = useState('');
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const t = {
    title: isAr ? 'ربط حساب بريد إلكتروني' : 'Connect Email Account',
    subtitle: isAr ? 'أدخل بيانات حسابك لإرسال واستقبال البريد' : 'Enter your account details to send and receive email',
    emailLabel: isAr ? 'عنوان البريد الإلكتروني' : 'Email Address',
    passwordLabel: isAr ? 'كلمة المرور / كلمة مرور التطبيق' : 'Password / App Password',
    passwordHint: isAr
      ? 'للحسابات ذات المصادقة الثنائية، استخدم "كلمة مرور التطبيق" من إعدادات الأمان'
      : 'For 2FA accounts, use an "App Password" from your security settings',
    nameLabel: isAr ? 'اسم العرض (اختياري)' : 'Display Name (optional)',
    autoDetect: isAr ? 'تم اكتشاف الإعدادات تلقائيًا' : 'Settings auto-detected',
    manual: isAr ? 'إعدادات الخادم اليدوية' : 'Manual Server Settings',
    smtpHost: isAr ? 'عنوان الخادم' : 'Server Address',
    smtpPort: isAr ? 'المنفذ' : 'Port',
    smtpSecure: isAr ? 'SMTP TLS (465) — بدلاً من STARTTLS (587)' : 'SMTP TLS (port 465) — instead of STARTTLS (587)',
    imapHost: isAr ? 'عنوان الخادم' : 'Server Address',
    imapPort: isAr ? 'المنفذ' : 'Port',
    imapSecure: isAr ? 'IMAP SSL/TLS' : 'IMAP SSL/TLS',
    usernameLabel: isAr ? 'اسم المستخدم للدخول' : 'Login Username',
    saveBtn: isAr ? 'حفظ وحفظ' : 'Save & Connect',
    cancel: isAr ? 'إلغاء' : 'Cancel',
    required: isAr ? 'مطلوب' : 'Required',
    providerLabel: isAr ? 'مزود البريد' : 'Email Provider',
    unknownProvider: isAr ? 'مزود مخصص' : 'Custom Provider',
    loginSection: isAr ? 'بيانات تسجيل الدخول' : 'Login Details',
    loginHint: isAr ? 'استخدم البريد الإلكتروني الكامل كاسم مستخدم ما لم يطلب مزودك غير ذلك' : 'Use the full email address as the username unless your provider told you otherwise',
    incomingSection: isAr ? 'الخادم الوارد' : 'Incoming Server',
    incomingHint: isAr ? 'هذا الخادم يُستخدم لاستقبال الرسائل (IMAP)' : 'This server is used to receive messages (IMAP)',
    outgoingSection: isAr ? 'الخادم الصادر' : 'Outgoing Server',
    outgoingHint: isAr ? 'هذا الخادم يُستخدم لإرسال الرسائل (SMTP)' : 'This server is used to send messages (SMTP)',
    usernameHelp: isAr ? 'في أغلب استضافات cPanel يكون اسم المستخدم هو نفس البريد الإلكتروني الكامل' : 'For most cPanel mailboxes, the username is the full email address',
    usernameMismatch: isAr ? 'اسم المستخدم الحالي مختلف عن البريد الإلكتروني. إذا كنت تستخدم cPanel أو SecureServer فالغالب أنه يجب أن يكون البريد الكامل.' : 'The username currently differs from the email. If this is a cPanel or SecureServer mailbox, it usually needs to be the full email address.',
    timeoutHint: isAr ? 'انتهت مهلة اتصال IMAP. تحقق أولاً من أن اسم المستخدم هو البريد الإلكتروني الكامل، ثم راجع كلمة المرور وعنوان الخادم والمنفذ.' : 'IMAP connection timed out. First check that the username is the full email address, then verify the password, server address, and port.',
  };

  // Auto-detect when email changes
  useEffect(() => {
    if (!email.includes('@')) {
      setDetectedProvider(null);
      return;
    }
    if (!username.trim()) setUsername(email.trim());
    const settings = detectProviderSettings(email);
    if (settings) {
      setDetectedProvider(settings.provider);
      setSmtpHost(settings.smtp_host);
      setSmtpPort(String(settings.smtp_port));
      setSmtpSecure(settings.smtp_secure);
      setImapHost(settings.imap_host);
      setImapPort(String(settings.imap_port));
      setImapSecure(settings.imap_secure);
      if (!username) setUsername(email);
      if (!displayName) setDisplayName(settings.provider.charAt(0).toUpperCase() + settings.provider.slice(1));
    }
  }, [email]);

  const handleSave = useCallback(async () => {
    setError('');
    setSuccess(false);

    if (!email.trim() || !password.trim() || !smtpHost.trim()) {
      setError(isAr ? 'الرجاء ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }

    setSaving(true);
    const result = await onSave({
      provider: detectedProvider || 'custom',
      display_name: displayName.trim() || detectedProvider || 'Custom',
      email_address: email.trim(),
      smtp_host: smtpHost.trim(),
      smtp_port: parseInt(smtpPort, 10) || 587,
      smtp_secure: smtpSecure,
      username: username.trim() || email.trim(),
      password,
      imap_host: imapHost.trim() || undefined,
      imap_port: imapPort ? parseInt(imapPort, 10) : undefined,
      imap_secure: imapSecure,
    });
    setSaving(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
        setEmail('');
        setPassword('');
        setDisplayName('');
        setSmtpHost('');
        setImapHost('');
        setUsername('');
      }, 1200);
    } else {
      setError(result.error || (isAr ? 'فشل الحفظ' : 'Save failed'));
    }
  }, [email, password, smtpHost, smtpPort, smtpSecure, imapHost, imapPort, imapSecure, username, displayName, detectedProvider, onSave, onOpenChange, isAr]);

  const providerDisplayName = detectedProvider
    ? detectedProvider.charAt(0).toUpperCase() + detectedProvider.slice(1)
    : t.unknownProvider;
  const normalizedEmail = email.trim();
  const normalizedUsername = username.trim();
  const showUsernameMismatch = Boolean(normalizedEmail && normalizedUsername && normalizedEmail !== normalizedUsername);
  const friendlyError = error.includes('IMAP timeout waiting for A0001') ? t.timeoutHint : error;
  const lightFieldClass = 'border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(249,250,255,0.98))] text-[#060541] shadow-[0_4px_12px_rgba(6,5,65,0.05)] placeholder:text-[#060541]/35 focus-visible:border-[#060541]/24 focus-visible:ring-[#060541]/20 dark:border-input dark:bg-background dark:text-foreground dark:shadow-none';
  const lightOutlineButtonClass = 'border-[#060541]/16 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.96))] text-[#060541] shadow-[0_4px_12px_rgba(6,5,65,0.06)] hover:bg-[#f3f5ff] hover:text-[#060541] dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-accent';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto border border-[#060541]/16 bg-[radial-gradient(circle_at_top,rgba(233,206,176,0.16),transparent_26%),linear-gradient(180deg,rgba(255,255,255,1),rgba(246,248,255,0.98))] shadow-[0_28px_80px_rgba(6,5,65,0.14)] ring-1 ring-[#060541]/5 dark:border-border dark:bg-background dark:shadow-2xl dark:ring-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#E9CEB0]" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="conn-email">{t.emailLabel}</Label>
            <Input
              id="conn-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={lightFieldClass}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="conn-password">{t.passwordLabel}</Label>
            <Input
              id="conn-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={lightFieldClass}
            />
            <p className="text-xs text-muted-foreground">{t.passwordHint}</p>
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <Label htmlFor="conn-name">{t.nameLabel}</Label>
            <Input
              id="conn-name"
              placeholder={isAr ? 'مثال: بريدي في ياهو' : 'e.g. My Yahoo Mail'}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={lightFieldClass}
            />
          </div>

          {/* Detected provider badge */}
          {detectedProvider && (
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-sm text-green-700 dark:text-green-300">
                {t.autoDetect}: <strong>{providerDisplayName}</strong>
              </span>
            </div>
          )}

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-sm text-[#E9CEB0] hover:text-[#d4b896] flex items-center gap-1 transition-colors"
          >
            <Server className="h-3.5 w-3.5" />
            {showAdvanced ? (isAr ? 'إخفاء الإعدادات المتقدمة' : 'Hide Advanced') : t.manual}
          </button>

          {/* Advanced fields */}
          {showAdvanced && (
            <div className="space-y-3 rounded-xl border border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,248,255,0.92))] p-4 shadow-[0_10px_24px_rgba(6,5,65,0.06)] ring-1 ring-[#060541]/5 dark:border-border/60 dark:bg-muted/30 dark:shadow-none dark:ring-0">
              <div className="space-y-2 rounded-xl border border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,249,255,0.98))] p-3 shadow-[0_4px_12px_rgba(6,5,65,0.05)] dark:border-border/60 dark:bg-background/70 dark:shadow-none">
                <div>
                  <div className="text-sm font-medium text-foreground">{t.loginSection}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{t.loginHint}</div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="conn-username" className="text-xs">{t.usernameLabel}</Label>
                  <Input id="conn-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={email || 'user@example.com'} className={lightFieldClass} />
                  <p className="text-xs text-muted-foreground">{t.usernameHelp}{normalizedEmail ? `: ${normalizedEmail}` : ''}</p>
                </div>
                {showUsernameMismatch ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    {t.usernameMismatch}
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 rounded-xl border border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,249,255,0.98))] p-3 shadow-[0_4px_12px_rgba(6,5,65,0.05)] dark:border-border/60 dark:bg-background/70 dark:shadow-none">
                <div>
                  <div className="text-sm font-medium text-foreground">{t.incomingSection}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{t.incomingHint}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2 sm:col-span-1">
                    <Label htmlFor="imap-host" className="text-xs">{t.imapHost}</Label>
                    <Input id="imap-host" value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="imap.example.com" className={lightFieldClass} />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <Label htmlFor="imap-port" className="text-xs">{t.imapPort}</Label>
                    <Input id="imap-port" value={imapPort} onChange={(e) => setImapPort(e.target.value)} placeholder="993" className={lightFieldClass} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={imapSecure}
                    onChange={(e) => setImapSecure(e.target.checked)}
                    className="rounded border-muted-foreground"
                  />
                  {t.imapSecure}
                </label>
              </div>

              <div className="space-y-3 rounded-xl border border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,249,255,0.98))] p-3 shadow-[0_4px_12px_rgba(6,5,65,0.05)] dark:border-border/60 dark:bg-background/70 dark:shadow-none">
                <div>
                  <div className="text-sm font-medium text-foreground">{t.outgoingSection}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{t.outgoingHint}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2 sm:col-span-1">
                    <Label htmlFor="smtp-host" className="text-xs">{t.smtpHost}</Label>
                    <Input id="smtp-host" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.example.com" className={lightFieldClass} />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <Label htmlFor="smtp-port" className="text-xs">{t.smtpPort}</Label>
                    <Input id="smtp-port" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" className={lightFieldClass} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smtpSecure}
                    onChange={(e) => setSmtpSecure(e.target.checked)}
                    className="rounded border-muted-foreground"
                  />
                  {t.smtpSecure}
                </label>
              </div>
            </div>
          )}

          {/* Error / Success */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              <XCircle className="h-4 w-4 shrink-0" />
              {friendlyError}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {isAr ? 'تم الاتصال بنجاح!' : 'Connected successfully!'}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className={`flex-1 ${lightOutlineButtonClass}`}
            >
              {t.cancel}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !email.trim() || !password.trim() || !smtpHost.trim()}
              className="flex-1 bg-[#060541] hover:bg-[#0a0a5c] text-white"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1.5" />
                  {t.saveBtn}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
