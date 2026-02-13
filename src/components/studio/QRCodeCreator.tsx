import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { QRCodeCanvas } from 'qrcode.react';
import {
  QrCode,
  Download,
  Link,
  Mail,
  Phone,
  Wifi,
  Type,
  Palette,
  Image as ImageIcon,
  Sparkles,
  Share2,
  RotateCcw,
  Eye,
  Info,
  Upload,
  X,
  Bookmark,
  Trash2,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

/* ─────────────────────── Types ─────────────────────── */

type QRType = 'url' | 'text' | 'email' | 'phone' | 'wifi';
type SubTab = 'create' | 'saved';

interface QRConfig {
  text: string;
  dark: string;
  light: string;
  size: number;
  margin: number;
  ecLevel: 'L' | 'M' | 'Q' | 'H';
  centerImageUrl: string;
  centerImageSizeRatio: number;
}

interface SavedQR {
  id: string;
  label: string;
  qrType: QRType;
  dataUrl: string;
  createdAt: number;
}

/* ─────────────────────── Storage ─────────────────────── */

const STORAGE_KEY = 'wakti_saved_qr_codes';

function loadSavedQRs(): SavedQR[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistSavedQRs(items: SavedQR[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* quota */ }
}

/* ─────────────────────── Presets ─────────────────────── */

const COLOR_PRESETS = [
  { dark: '000000', light: 'ffffff', label: 'Classic' },
  { dark: '060541', light: 'fcfefd', label: 'Wakti' },
  { dark: '1a1a2e', light: 'e8e8e8', label: 'Midnight' },
  { dark: '0d47a1', light: 'e3f2fd', label: 'Ocean' },
  { dark: '1b5e20', light: 'e8f5e9', label: 'Forest' },
  { dark: 'b71c1c', light: 'ffebee', label: 'Ruby' },
  { dark: '4a148c', light: 'f3e5f5', label: 'Royal' },
  { dark: 'e65100', light: 'fff3e0', label: 'Sunset' },
  { dark: 'f2f2f2', light: '0c0f14', label: 'Inverted' },
  { dark: 'ff6b6b', light: '2d2d2d', label: 'Neon Red' },
  { dark: '00e676', light: '1a1a2e', label: 'Matrix' },
  { dark: '00bcd4', light: '263238', label: 'Cyber' },
];


/* ─────────────────────── Helpers ─────────────────────── */

function buildWifiString(ssid: string, password: string, encryption: string, hidden: boolean): string {
  return `WIFI:T:${encryption};S:${ssid};P:${password};H:${hidden ? 'true' : 'false'};;`;
}

/* ─────────────────────── Component ─────────────────────── */

export default function QRCodeCreator() {
  const { language } = useTheme();
  const isArabic = language === 'ar';
  const previewRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  // Sub-tabs: create / saved
  const [subTab, setSubTab] = useState<SubTab>('create');
  const [savedQRs, setSavedQRs] = useState<SavedQR[]>(() => loadSavedQRs());

  // QR type
  const [qrType, setQrType] = useState<QRType>('url');

  // Input fields per type
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [wifiSSID, setWifiSSID] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiEncryption, setWifiEncryption] = useState('WPA');
  const [wifiHidden, setWifiHidden] = useState(false);

  // Config
  const [config, setConfig] = useState<QRConfig>({
    text: '',
    dark: '000000',
    light: 'ffffff',
    size: 400,
    margin: 4,
    ecLevel: 'M',
    centerImageUrl: '',
    centerImageSizeRatio: 0.3,
  });

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  // Build the text content based on type
  const getQRText = useCallback((): string => {
    switch (qrType) {
      case 'url':
        return urlInput.trim();
      case 'text': {
        const raw = textInput.trim();
        if (!raw) return '';
        // Encode text into a Wakti page URL so scanners open a branded page instead of a search
        const base64 = btoa(unescape(encodeURIComponent(raw)));
        const urlSafe = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        return `${window.location.origin}/qr/view?t=${urlSafe}`;
      }
      case 'email':
        return emailSubject
          ? `mailto:${emailInput.trim()}?subject=${encodeURIComponent(emailSubject)}`
          : `mailto:${emailInput.trim()}`;
      case 'phone':
        return `tel:${phoneInput.trim()}`;
      case 'wifi':
        return buildWifiString(wifiSSID, wifiPassword, wifiEncryption, wifiHidden);
      default:
        return '';
    }
  }, [qrType, urlInput, textInput, emailInput, emailSubject, phoneInput, wifiSSID, wifiPassword, wifiEncryption, wifiHidden]);

  // Generate QR — renders via hidden QRCodeCanvas, then exports to data URL
  const handleGenerate = useCallback(() => {
    const text = getQRText();
    if (!text) {
      toast.error(isArabic ? 'يرجى إدخال المحتوى أولاً' : 'Please enter content first');
      return;
    }
    setIsGenerating(true);
    setConfig(prev => ({ ...prev, text }));
    // Wait for QRCodeCanvas to render, then grab the canvas data
    setTimeout(() => {
      const canvas = qrCanvasRef.current?.querySelector('canvas');
      if (canvas) {
        setQrDataUrl(canvas.toDataURL('image/png'));
      }
      setIsGenerating(false);
      setGenerated(true);
    }, 800);
  }, [config, getQRText, isArabic]);

  // Download
  const handleDownload = useCallback(async () => {
    if (!qrDataUrl) return;
    try {
      const a = document.createElement('a');
      a.href = qrDataUrl;
      a.download = 'wakti-qr-code.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(isArabic ? 'تم تحميل رمز QR' : 'QR code downloaded');
    } catch {
      toast.error(isArabic ? 'فشل التحميل' : 'Download failed');
    }
  }, [qrDataUrl, isArabic]);

  // Share QR code image
  const handleShare = useCallback(async () => {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      const file = new File([blob], 'wakti-qr-code.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Wakti QR Code' });
      } else {
        // Fallback: copy image to clipboard
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast.success(isArabic ? 'تم نسخ الصورة' : 'Image copied to clipboard');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast.error(isArabic ? 'فشل المشاركة' : 'Share failed');
      }
    }
  }, [qrDataUrl, isArabic]);

  // Save current QR code
  const handleSaveQR = useCallback(() => {
    if (!qrDataUrl) return;
    const label = qrType === 'url' ? urlInput : qrType === 'text' ? textInput : qrType === 'email' ? emailInput : qrType === 'phone' ? phoneInput : wifiSSID;
    const item: SavedQR = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      label: label.slice(0, 80) || 'QR Code',
      qrType,
      dataUrl: qrDataUrl,
      createdAt: Date.now(),
    };
    const updated = [item, ...savedQRs];
    setSavedQRs(updated);
    persistSavedQRs(updated);
    toast.success(isArabic ? 'تم حفظ رمز QR' : 'QR code saved');
  }, [qrDataUrl, qrType, urlInput, textInput, emailInput, phoneInput, wifiSSID, savedQRs, isArabic]);

  // Delete a saved QR code
  const handleDeleteQR = useCallback((id: string) => {
    const updated = savedQRs.filter(q => q.id !== id);
    setSavedQRs(updated);
    persistSavedQRs(updated);
    toast.success(isArabic ? 'تم الحذف' : 'Deleted');
  }, [savedQRs, isArabic]);

  // Handle logo file upload → convert to base64 data URI
  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(isArabic ? 'يرجى اختيار صورة' : 'Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(isArabic ? 'الحد الأقصى 2 ميغابايت' : 'Max file size is 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      setLogoPreview(dataUri);
      setConfig(prev => ({ ...prev, centerImageUrl: dataUri, ecLevel: 'H' }));
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, [isArabic]);

  // Remove logo
  const handleRemoveLogo = useCallback(() => {
    setLogoPreview('');
    setConfig(prev => ({ ...prev, centerImageUrl: '', ecLevel: 'M' }));
  }, []);

  // Reset
  const handleReset = useCallback(() => {
    setUrlInput('');
    setTextInput('');
    setEmailInput('');
    setEmailSubject('');
    setPhoneInput('');
    setWifiSSID('');
    setWifiPassword('');
    setLogoPreview('');
    setGenerated(false);
    setQrDataUrl('');
    setConfig(prev => ({ ...prev, text: '', centerImageUrl: '', dark: '000000', light: 'ffffff', ecLevel: 'M' }));
  }, []);

  // Auto-scroll to preview on generate
  useEffect(() => {
    if (generated && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [generated]);

  /* ─── QR Type Tabs ─── */
  const qrTypes: { key: QRType; icon: React.ReactNode; labelEn: string; labelAr: string }[] = [
    { key: 'url', icon: <Link className="h-4 w-4" />, labelEn: 'URL', labelAr: 'رابط' },
    { key: 'text', icon: <Type className="h-4 w-4" />, labelEn: 'Text', labelAr: 'نص' },
    { key: 'email', icon: <Mail className="h-4 w-4" />, labelEn: 'Email', labelAr: 'بريد' },
    { key: 'phone', icon: <Phone className="h-4 w-4" />, labelEn: 'Phone', labelAr: 'هاتف' },
    { key: 'wifi', icon: <Wifi className="h-4 w-4" />, labelEn: 'Wi-Fi', labelAr: 'واي فاي' },
  ];

  const hasContent = !!getQRText();

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg">
            <QrCode className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">{isArabic ? 'منشئ رموز QR' : 'QR Code Creator'}</h2>
            <p className="text-xs text-muted-foreground">{isArabic ? 'أنشئ رموز QR مخصصة وأنيقة' : 'Create beautiful, customized QR codes'}</p>
          </div>
        </div>
        {subTab === 'create' && generated && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {isArabic ? 'إعادة' : 'Reset'}
          </button>
        )}
      </div>

      {/* ─── Sub-tabs: Create / Saved ─── */}
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab('create')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            subTab === 'create'
              ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-[0_4px_14px_hsla(210,80%,50%,0.35)]'
              : 'bg-white dark:bg-white/[0.06] text-muted-foreground hover:bg-gray-50 dark:hover:bg-white/[0.1] shadow-[0_1px_6px_hsla(0,0%,0%,0.06)] dark:shadow-[0_1px_6px_hsla(0,0%,0%,0.3)] border border-gray-200/60 dark:border-white/[0.08]'
          }`}
        >
          <Plus className="h-4 w-4" />
          {isArabic ? 'إنشاء' : 'Create'}
        </button>
        <button
          onClick={() => setSubTab('saved')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            subTab === 'saved'
              ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-[0_4px_14px_hsla(210,80%,50%,0.35)]'
              : 'bg-white dark:bg-white/[0.06] text-muted-foreground hover:bg-gray-50 dark:hover:bg-white/[0.1] shadow-[0_1px_6px_hsla(0,0%,0%,0.06)] dark:shadow-[0_1px_6px_hsla(0,0%,0%,0.3)] border border-gray-200/60 dark:border-white/[0.08]'
          }`}
        >
          <Bookmark className="h-4 w-4" />
          {isArabic ? 'المحفوظة' : 'Saved'}
          {savedQRs.length > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-white/20 text-[10px] font-bold leading-none px-1">
              {savedQRs.length}
            </span>
          )}
        </button>
      </div>

      {subTab === 'create' && (
      <div className="flex flex-col lg:grid lg:grid-cols-5 gap-6">
        {/* ─── Controls ─── */}
        <div className="lg:col-span-3 space-y-5 order-2 lg:order-1">

          {/* Type Selector */}
          <div className="space-y-2.5">
            <label className="text-sm font-semibold text-foreground">{isArabic ? 'نوع المحتوى' : 'Content Type'}</label>
            <div className="flex flex-wrap gap-2">
              {qrTypes.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setQrType(t.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    qrType === t.key
                      ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-[0_4px_14px_hsla(210,80%,50%,0.35)]'
                      : 'bg-white dark:bg-white/[0.06] text-muted-foreground hover:bg-gray-50 dark:hover:bg-white/[0.1] shadow-[0_1px_6px_hsla(0,0%,0%,0.06)] dark:shadow-[0_1px_6px_hsla(0,0%,0%,0.3)] border border-gray-200/60 dark:border-white/[0.08]'
                  }`}
                >
                  {t.icon}
                  {isArabic ? t.labelAr : t.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Input Fields */}
          <div className="space-y-3">
            {qrType === 'url' && (
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">{isArabic ? 'الرابط' : 'URL'}</label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder={isArabic ? 'https://example.com' : 'https://example.com'}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40 transition-all text-sm"
                />
              </div>
            )}

            {qrType === 'text' && (
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">{isArabic ? 'النص' : 'Text'}</label>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={isArabic ? 'أدخل النص هنا...' : 'Enter your text here...'}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40 transition-all text-sm resize-none"
                />
                <div className="flex items-start gap-1.5 px-1">
                  <Info className="h-3.5 w-3.5 text-sky-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-muted-foreground/70 leading-snug">
                    {isArabic
                      ? 'سيظهر النص على صفحة Wakti أنيقة عند مسح الرمز.'
                      : 'Your text will display on a beautiful Wakti page when scanned.'}
                  </p>
                </div>
              </div>
            )}

            {qrType === 'email' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">{isArabic ? 'البريد الإلكتروني' : 'Email Address'}</label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40 transition-all text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">{isArabic ? 'الموضوع (اختياري)' : 'Subject (optional)'}</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder={isArabic ? 'موضوع الرسالة' : 'Email subject'}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40 transition-all text-sm"
                  />
                </div>
              </div>
            )}

            {qrType === 'phone' && (
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground">{isArabic ? 'رقم الهاتف' : 'Phone Number'}</label>
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+1 234 567 8900"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40 transition-all text-sm"
                />
              </div>
            )}

            {qrType === 'wifi' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-foreground">{isArabic ? 'اسم الشبكة (SSID)' : 'Network Name (SSID)'}</label>
                    <input
                      type="text"
                      value={wifiSSID}
                      onChange={(e) => setWifiSSID(e.target.value)}
                      placeholder={isArabic ? 'اسم الشبكة' : 'Network name'}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40 transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-foreground">{isArabic ? 'كلمة المرور' : 'Password'}</label>
                    <input
                      type="text"
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                      placeholder={isArabic ? 'كلمة المرور' : 'Password'}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40 transition-all text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-foreground">{isArabic ? 'التشفير' : 'Encryption'}</label>
                    <div className="flex gap-1.5">
                      {['WPA', 'WEP', 'nopass'].map((enc) => (
                        <button
                          key={enc}
                          onClick={() => setWifiEncryption(enc)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            wifiEncryption === enc
                              ? 'bg-sky-500 text-white shadow-sm'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {enc === 'nopass' ? (isArabic ? 'بدون' : 'None') : enc}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer mt-5">
                    <input
                      type="checkbox"
                      checked={wifiHidden}
                      onChange={(e) => setWifiHidden(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-sky-500 focus:ring-sky-500"
                    />
                    <span className="text-xs text-muted-foreground">{isArabic ? 'شبكة مخفية' : 'Hidden network'}</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* ─── Color Presets ─── */}
          <div className="space-y-2.5">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Palette className="h-4 w-4 text-sky-500" />
              {isArabic ? 'نمط الألوان' : 'Color Style'}
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setConfig(prev => ({ ...prev, dark: preset.dark, light: preset.light }))}
                  className={`group relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all ${
                    config.dark === preset.dark && config.light === preset.light
                      ? 'ring-2 ring-sky-500 ring-offset-2 ring-offset-background shadow-md scale-[1.03]'
                      : 'hover:shadow-md hover:scale-[1.02] border border-gray-100 dark:border-white/[0.06]'
                  }`}
                >
                  <div className="flex gap-0.5">
                    <div
                      className="w-5 h-5 rounded-l-md border border-gray-200/50 dark:border-white/10"
                      style={{ backgroundColor: `#${preset.dark}` }}
                    />
                    <div
                      className="w-5 h-5 rounded-r-md border border-gray-200/50 dark:border-white/10"
                      style={{ backgroundColor: `#${preset.light}` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium leading-none">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Colors */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{isArabic ? 'لون الرمز' : 'QR Color'}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  title="QR Color"
                  value={`#${config.dark}`}
                  onChange={(e) => setConfig(prev => ({ ...prev, dark: e.target.value.replace('#', '') }))}
                  className="w-9 h-9 rounded-lg border-0 cursor-pointer"
                />
                <input
                  type="text"
                  value={`#${config.dark}`}
                  onChange={(e) => setConfig(prev => ({ ...prev, dark: e.target.value.replace('#', '') }))}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{isArabic ? 'لون الخلفية' : 'Background'}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  title="Background Color"
                  value={`#${config.light}`}
                  onChange={(e) => setConfig(prev => ({ ...prev, light: e.target.value.replace('#', '') }))}
                  className="w-9 h-9 rounded-lg border-0 cursor-pointer"
                />
                <input
                  type="text"
                  value={`#${config.light}`}
                  onChange={(e) => setConfig(prev => ({ ...prev, light: e.target.value.replace('#', '') }))}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                />
              </div>
            </div>
          </div>

          {/* ─── Center Logo ─── */}
          <div className="space-y-2.5">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-sky-500" />
              {isArabic ? 'شعار في المنتصف (اختياري)' : 'Center Logo (optional)'}
            </label>

            {/* Logo preview or upload area */}
            {config.centerImageUrl ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/80 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06]">
                  <img
                    src={logoPreview || config.centerImageUrl}
                    alt="Logo"
                    className="w-10 h-10 rounded-lg object-contain bg-white dark:bg-white/10 border border-gray-200/50 dark:border-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {logoPreview ? (isArabic ? 'صورة مرفوعة' : 'Uploaded image') : config.centerImageUrl}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{isArabic ? 'شعار المنتصف' : 'Center logo'}</p>
                  </div>
                  <button
                    onClick={handleRemoveLogo}
                    aria-label="Remove logo"
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3 px-1">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">{isArabic ? 'حجم الشعار' : 'Logo size'}: {Math.round(config.centerImageSizeRatio * 100)}%</label>
                  <input
                    type="range"
                    min={0.1}
                    max={0.5}
                    step={0.05}
                    value={config.centerImageSizeRatio}
                    onChange={(e) => setConfig(prev => ({ ...prev, centerImageSizeRatio: Number(e.target.value) }))}
                    className="flex-1 accent-sky-500"
                  />
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={config.centerImageUrl}
                  onChange={(e) => setConfig(prev => ({ ...prev, centerImageUrl: e.target.value, ecLevel: e.target.value ? 'H' : 'M' }))}
                  placeholder={isArabic ? 'رابط صورة الشعار...' : 'Paste logo URL...'}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/40 transition-all text-sm"
                />
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white dark:bg-white/[0.06] text-muted-foreground hover:text-foreground font-medium text-sm shadow-[0_1px_6px_hsla(0,0%,0%,0.06)] dark:shadow-[0_1px_6px_hsla(0,0%,0%,0.3)] border border-gray-200/60 dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-white/[0.1] active:scale-[0.98] transition-all whitespace-nowrap"
                >
                  <Upload className="h-4 w-4" />
                  {isArabic ? 'رفع' : 'Upload'}
                </button>
              </div>
            )}
          </div>

          {/* ─── Generate Button ─── */}
          <button
            onClick={handleGenerate}
            disabled={!hasContent || isGenerating}
            className={`w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl font-bold text-base transition-all ${
              hasContent
                ? 'bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white shadow-[0_8px_32px_hsla(210,80%,50%,0.4)] hover:shadow-[0_8px_40px_hsla(210,80%,50%,0.5)] active:scale-[0.98]'
                : 'bg-gray-200 dark:bg-white/[0.06] text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {isArabic ? 'جارٍ الإنشاء...' : 'Generating...'}
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                {isArabic ? 'إنشاء رمز QR' : 'Generate QR Code'}
              </>
            )}
          </button>
        </div>

        {/* ─── Preview ─── */}
        <div className="lg:col-span-2 order-1 lg:order-2" ref={previewRef}>
          <div className="lg:sticky lg:top-6">
            <div className="rounded-3xl border border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] shadow-[0_8px_40px_hsla(0,0%,0%,0.06)] dark:shadow-[0_8px_40px_hsla(0,0%,0%,0.3)] overflow-hidden">
              {/* Preview Header */}
              <div className="px-5 py-3 border-b border-gray-100 dark:border-white/[0.06] flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{isArabic ? 'معاينة' : 'Preview'}</span>
              </div>

              {/* Hidden QRCodeCanvas for rendering */}
              <div ref={qrCanvasRef} className="absolute -left-[9999px] -top-[9999px]">
                {config.text && (
                  <QRCodeCanvas
                    value={config.text}
                    size={config.size}
                    bgColor={`#${config.light}`}
                    fgColor={`#${config.dark}`}
                    level={config.ecLevel}
                    marginSize={config.margin}
                    imageSettings={config.centerImageUrl ? {
                      src: config.centerImageUrl,
                      height: Math.round(config.size * config.centerImageSizeRatio),
                      width: Math.round(config.size * config.centerImageSizeRatio),
                      excavate: true,
                    } : undefined}
                  />
                )}
              </div>

              {/* QR Display */}
              <div className="p-5 flex flex-col items-center justify-center min-h-[200px] lg:min-h-[320px]">
                {generated && qrDataUrl ? (
                  <div className="space-y-4 w-full flex flex-col items-center">
                    <div
                      className="rounded-2xl overflow-hidden shadow-[0_4px_24px_hsla(0,0%,0%,0.1)] dark:shadow-[0_4px_24px_hsla(0,0%,0%,0.4)]"
                      style={{ backgroundColor: `#${config.light}` }}
                    >
                      <img
                        src={qrDataUrl}
                        alt="QR Code"
                        className="w-full max-w-[220px] lg:max-w-[280px] h-auto"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 w-full max-w-[280px]">
                      <button
                        onClick={handleDownload}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-semibold text-sm shadow-[0_4px_16px_hsla(210,80%,50%,0.35)] hover:shadow-[0_4px_20px_hsla(210,80%,50%,0.5)] active:scale-[0.98] transition-all"
                      >
                        <Download className="h-4 w-4" />
                        {isArabic ? 'تحميل' : 'Download'}
                      </button>
                      <button
                        onClick={handleSaveQR}
                        aria-label="Save QR code"
                        className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-white/[0.06] text-foreground font-medium text-sm shadow-[0_2px_8px_hsla(0,0%,0%,0.06)] dark:shadow-[0_2px_8px_hsla(0,0%,0%,0.25)] border border-gray-200/60 dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-white/[0.1] active:scale-[0.98] transition-all"
                      >
                        <Bookmark className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleShare}
                        aria-label="Share QR code"
                        className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-white/[0.06] text-foreground font-medium text-sm shadow-[0_2px_8px_hsla(0,0%,0%,0.06)] dark:shadow-[0_2px_8px_hsla(0,0%,0%,0.25)] border border-gray-200/60 dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-white/[0.1] active:scale-[0.98] transition-all"
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center py-6 lg:py-8">
                    <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-white/[0.06] dark:to-white/[0.02] flex items-center justify-center">
                      <QrCode className="h-8 w-8 lg:h-10 lg:w-10 text-gray-300 dark:text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{isArabic ? 'معاينة رمز QR' : 'QR Code Preview'}</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">{isArabic ? 'أدخل المحتوى واضغط إنشاء' : 'Enter content and hit Generate'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ─── Saved Tab ─── */}
      {subTab === 'saved' && (
        <div className="space-y-4">
          {savedQRs.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-white/[0.06] dark:to-white/[0.02] flex items-center justify-center">
                <Bookmark className="h-10 w-10 text-gray-300 dark:text-gray-600" />
              </div>
              <div>
                <p className="text-base font-semibold text-muted-foreground">{isArabic ? 'لا توجد رموز محفوظة' : 'No saved QR codes'}</p>
                <p className="text-sm text-muted-foreground/60 mt-1">{isArabic ? 'أنشئ رمز QR واحفظه هنا' : 'Create a QR code and save it here'}</p>
              </div>
              <button
                onClick={() => setSubTab('create')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-semibold text-sm shadow-[0_4px_16px_hsla(210,80%,50%,0.35)] active:scale-[0.98] transition-all"
              >
                <Plus className="h-4 w-4" />
                {isArabic ? 'إنشاء رمز QR' : 'Create QR Code'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {savedQRs.map((item) => (
                <div
                  key={item.id}
                  className="group rounded-2xl border border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] shadow-[0_4px_20px_hsla(0,0%,0%,0.04)] dark:shadow-[0_4px_20px_hsla(0,0%,0%,0.25)] overflow-hidden hover:shadow-[0_8px_30px_hsla(0,0%,0%,0.08)] dark:hover:shadow-[0_8px_30px_hsla(0,0%,0%,0.4)] transition-all"
                >
                  {/* QR Image */}
                  <div className="p-4 flex items-center justify-center bg-gray-50/50 dark:bg-white/[0.02]">
                    <img
                      src={item.dataUrl}
                      alt={item.label}
                      className="w-full max-w-[140px] h-auto rounded-lg"
                    />
                  </div>

                  {/* Info + Actions */}
                  <div className="px-3 py-2.5 space-y-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {new Date(item.createdAt).toLocaleDateString(isArabic ? 'ar' : 'en', { month: 'short', day: 'numeric' })}
                        {' · '}
                        {item.qrType.toUpperCase()}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={async () => {
                          const a = document.createElement('a');
                          a.href = item.dataUrl;
                          a.download = `wakti-qr-${item.id}.png`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        aria-label="Download"
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-500/20 text-[11px] font-medium transition-colors"
                      >
                        <Download className="h-3 w-3" />
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(item.dataUrl);
                            const blob = await res.blob();
                            const file = new File([blob], `wakti-qr-${item.id}.png`, { type: 'image/png' });
                            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                              await navigator.share({ files: [file], title: 'Wakti QR Code' });
                            } else {
                              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                              toast.success(isArabic ? 'تم نسخ الصورة' : 'Image copied');
                            }
                          } catch (err: any) {
                            if (err?.name !== 'AbortError') toast.error(isArabic ? 'فشل' : 'Failed');
                          }
                        }}
                        aria-label="Share"
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.04] text-muted-foreground hover:bg-gray-100 dark:hover:bg-white/[0.08] text-[11px] font-medium transition-colors"
                      >
                        <Share2 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteQR(item.id)}
                        aria-label="Delete"
                        className="flex items-center justify-center px-2 py-1.5 rounded-lg text-muted-foreground/50 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 text-[11px] transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
