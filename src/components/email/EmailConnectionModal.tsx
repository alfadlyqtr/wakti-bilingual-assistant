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
import { Mail, Server, Shield, TestTube, Save, Loader2, CheckCircle2, XCircle } from 'lucide-react';

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
    manual: isAr ? 'إعدادات متقدمة' : 'Advanced Settings',
    smtpHost: isAr ? 'خادم SMTP' : 'SMTP Server',
    smtpPort: isAr ? 'منفذ SMTP' : 'SMTP Port',
    smtpSecure: isAr ? 'SMTP TLS (465) — بدلاً من STARTTLS (587)' : 'SMTP TLS (port 465) — instead of STARTTLS (587)',
    imapHost: isAr ? 'خادم IMAP' : 'IMAP Server',
    imapPort: isAr ? 'منفذ IMAP' : 'IMAP Port',
    imapSecure: isAr ? 'IMAP SSL/TLS' : 'IMAP SSL/TLS',
    usernameLabel: isAr ? 'اسم المستخدم (عادةً نفس البريد)' : 'Username (usually same as email)',
    testBtn: isAr ? 'اختبار الاتصال' : 'Test Connection',
    saveBtn: isAr ? 'حفظ وحفظ' : 'Save & Connect',
    cancel: isAr ? 'إلغاء' : 'Cancel',
    required: isAr ? 'مطلوب' : 'Required',
    providerLabel: isAr ? 'مزود البريد' : 'Email Provider',
    unknownProvider: isAr ? 'مزود مخصص' : 'Custom Provider',
  };

  // Auto-detect when email changes
  useEffect(() => {
    if (!email.includes('@')) {
      setDetectedProvider(null);
      return;
    }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4">
              {/* SMTP */}
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">SMTP</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="smtp-host" className="text-xs">{t.smtpHost}</Label>
                    <Input id="smtp-host" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.example.com" />
                  </div>
                  <div>
                    <Label htmlFor="smtp-port" className="text-xs">{t.smtpPort}</Label>
                    <Input id="smtp-port" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs mt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smtpSecure}
                    onChange={(e) => setSmtpSecure(e.target.checked)}
                    className="rounded border-muted-foreground"
                  />
                  {t.smtpSecure}
                </label>
              </div>

              {/* IMAP */}
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">IMAP</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="imap-host" className="text-xs">{t.imapHost}</Label>
                    <Input id="imap-host" value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="imap.example.com" />
                  </div>
                  <div>
                    <Label htmlFor="imap-port" className="text-xs">{t.imapPort}</Label>
                    <Input id="imap-port" value={imapPort} onChange={(e) => setImapPort(e.target.value)} placeholder="993" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs mt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={imapSecure}
                    onChange={(e) => setImapSecure(e.target.checked)}
                    className="rounded border-muted-foreground"
                  />
                  {t.imapSecure}
                </label>
              </div>

              {/* Username */}
              <div className="space-y-1">
                <Label htmlFor="conn-username" className="text-xs">{t.usernameLabel}</Label>
                <Input id="conn-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={email || 'user@example.com'} />
              </div>
            </div>
          )}

          {/* Error / Success */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              <XCircle className="h-4 w-4 shrink-0" />
              {error}
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
              className="flex-1"
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
