import { useState, useEffect } from 'react';
import { Globe, CheckCircle2, AlertCircle, Loader2, Trash2, Copy, ShoppingCart, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  projectId: string;
  initialDomain?: string | null;
  isRTL?: boolean;
}

type DnsInstructions = {
  type: 'A' | 'CNAME';
  host: string;
  value: string;
  note: string;
};

export default function CustomDomainSection({ projectId, initialDomain, isRTL = false }: Props) {
  const { session } = useAuth();

  const [domain, setDomain] = useState(initialDomain ?? '');
  const [savedDomain, setSavedDomain] = useState(initialDomain ?? '');
  const [domainInput, setDomainInput] = useState('');
  const [dns, setDns] = useState<DnsInstructions | null>(null);
  const [configured, setConfigured] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showInput, setShowInput] = useState(false);

  // On mount, check status if a domain is already saved
  useEffect(() => {
    if (savedDomain) checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invoke = async (body: object) => {
    const { data, error } = await supabase.functions.invoke('project-domain', {
      headers: { Authorization: `Bearer ${session?.access_token}` },
      body,
    });
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error(data?.error ?? 'Request failed');
    return data;
  };

  const checkStatus = async () => {
    if (!session?.access_token) return;
    setChecking(true);
    try {
      const data = await invoke({ action: 'status', projectId });
      if (data.hasDomain) {
        setSavedDomain(data.domain);
        setDomain(data.domain);
        setConfigured(data.configured ?? false);
        if (data.dns) setDns(data.dns);
      }
    } catch {
      // silent — best effort
    } finally {
      setChecking(false);
    }
  };

  const addDomain = async () => {
    if (!domainInput.trim()) return;
    setSaving(true);
    try {
      const data = await invoke({ action: 'add', projectId, domain: domainInput.trim() });
      setSavedDomain(data.domain);
      setDomain(data.domain);
      setConfigured(data.configured ?? false);
      setDns(data.dns ?? null);
      setShowInput(false);
      setDomainInput('');
      toast.success(isRTL ? 'تم ربط النطاق بنجاح ✓' : `Domain connected ✓`);
    } catch (err: any) {
      toast.error(err?.message ?? (isRTL ? 'فشل ربط النطاق' : 'Failed to connect domain'));
    } finally {
      setSaving(false);
    }
  };

  const removeDomain = async () => {
    setRemoving(true);
    try {
      await invoke({ action: 'remove', projectId });
      setSavedDomain('');
      setDomain('');
      setDns(null);
      setConfigured(false);
      toast.success(isRTL ? 'تم إزالة النطاق' : 'Domain removed');
    } catch (err: any) {
      toast.error(err?.message ?? (isRTL ? 'فشل إزالة النطاق' : 'Failed to remove domain'));
    } finally {
      setRemoving(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied!'));
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <Globe className="h-4 w-4 text-indigo-500" />
          {isRTL ? 'نطاق مخصص' : 'Custom Domain'}
        </div>
        {checking && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
      </div>

      {/* No domain yet */}
      {!savedDomain && !showInput && (
        <div className="space-y-2">
          <button
            onClick={() => setShowInput(true)}
            className="w-full px-4 py-2.5 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-sm text-zinc-500 dark:text-zinc-400 hover:border-indigo-400 hover:text-indigo-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-2"
          >
            <Globe className="h-4 w-4" />
            {isRTL ? '+ ربط نطاق مخصص' : '+ Connect a custom domain'}
          </button>
          <a
            href="https://wakti.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
          >
            <ShoppingCart className="h-3 w-3" />
            {isRTL ? 'لا تملك نطاقاً؟ احصل على واحد من هنا' : "Don't have a domain? Get one here"}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Domain input */}
      {!savedDomain && showInput && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={domainInput}
              onChange={e => setDomainInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDomain()}
              placeholder="mywebsite.com"
              autoFocus
              className="flex-1 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-zinc-400"
            />
            <button
              onClick={addDomain}
              disabled={saving || !domainInput.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-1.5 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (isRTL ? 'ربط' : 'Connect')}
            </button>
            <button
              onClick={() => { setShowInput(false); setDomainInput(''); }}
              className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-sm transition-colors"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
          <a
            href="https://wakti.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-indigo-500 transition-colors"
          >
            <ShoppingCart className="h-3 w-3" />
            {isRTL ? 'لا تملك نطاقاً؟ احصل على واحد من هنا' : "Don't have a domain? Get one here"}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Domain is connected */}
      {savedDomain && (
        <div className="space-y-3">
          {/* Domain badge */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-2 min-w-0">
              {configured ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
              )}
              <a
                href={`https://${savedDomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-mono text-zinc-800 dark:text-zinc-200 hover:text-indigo-500 truncate flex items-center gap-1"
              >
                {savedDomain}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={checkStatus}
                disabled={checking}
                title={isRTL ? 'تحديث الحالة' : 'Refresh status'}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                <Loader2 className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={removeDomain}
                disabled={removing}
                title={isRTL ? 'إزالة النطاق' : 'Remove domain'}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* DNS status */}
          {!configured && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-700/40 space-y-2.5">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {isRTL ? 'DNS لم يتم تهيئته بعد — أضف هذا السجل في مزود النطاق الخاص بك:' : 'DNS not configured yet — add this record at your domain registrar:'}
              </p>
              {dns && (
                <div className="rounded-lg bg-white dark:bg-zinc-900 border border-amber-200 dark:border-zinc-700 overflow-hidden text-xs font-mono">
                  <div className="grid grid-cols-3 bg-amber-100 dark:bg-zinc-800 px-3 py-1.5 text-amber-700 dark:text-zinc-400 font-semibold text-xs">
                    <span>{isRTL ? 'النوع' : 'Type'}</span>
                    <span>{isRTL ? 'المضيف' : 'Host'}</span>
                    <span>{isRTL ? 'القيمة' : 'Value'}</span>
                  </div>
                  <div className="grid grid-cols-3 px-3 py-2 items-center">
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">{dns.type}</span>
                    <span className="text-zinc-800 dark:text-zinc-200">{dns.host}</span>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-zinc-800 dark:text-zinc-200 truncate">{dns.value}</span>
                      <button
                        onClick={() => copyText(dns.value)}
                        className="shrink-0 p-1 rounded text-zinc-400 hover:text-indigo-500 transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {dns?.note && (
                <p className="text-xs text-amber-600 dark:text-amber-500">{dns.note}</p>
              )}
              <button
                onClick={checkStatus}
                disabled={checking}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                {checking && <Loader2 className="h-3 w-3 animate-spin" />}
                {isRTL ? 'التحقق مجدداً' : 'Check again'}
              </button>
            </div>
          )}

          {/* Verified */}
          {configured && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-700/40 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              {isRTL ? '✓ النطاق مرتبط ويعمل بشكل صحيح' : '✓ Domain is live and working correctly'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
