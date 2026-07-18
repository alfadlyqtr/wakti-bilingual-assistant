import { useEffect, useState } from 'react';
import { Github, X, ExternalLink, CheckCircle2, Loader2, GitBranch, Lock, Unlock, Eye, EyeOff, ArrowRight, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

type GitHubConnectionStatus = 'checking' | 'disconnected' | 'connected' | 'invalid';

interface GitHubPanelProps {
  projectId: string;
  projectName: string;
  /** Existing github_repo from project row, e.g. "username/my-repo" */
  githubRepo?: string | null;
  /** Existing github_branch from project row */
  githubBranch?: string | null;
  isRTL?: boolean;
  onClose: () => void;
  onPushSuccess?: (repoUrl: string) => void;
}

export default function GitHubPanel({
  projectId,
  projectName,
  githubRepo,
  githubBranch,
  isRTL = false,
  onClose,
  onPushSuccess,
}: GitHubPanelProps) {
  const { session } = useAuth();

  // ── Connection state ──────────────────────────────────────────────────────
  const [pat, setPat] = useState('');
  const [showPat, setShowPat] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<GitHubConnectionStatus>('checking');
  const [verifiedUsername, setVerifiedUsername] = useState<string | null>(null);

  // ── Push state ────────────────────────────────────────────────────────────
  const [repoName, setRepoName] = useState(() => {
    if (githubRepo) return githubRepo.includes('/') ? githubRepo.split('/')[1] : githubRepo;
    return projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 40);
  });
  const [branch, setBranch] = useState(githubBranch ?? 'main');
  const [commitMsg, setCommitMsg] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ repoUrl: string; commitUrl: string; filesCount: number } | null>(null);
  const [pushStep, setPushStep] = useState('');

  const connected = connectionStatus === 'connected';
  const showReconnectState = connectionStatus === 'invalid';

  const validateGitHubToken = async (token: string): Promise<{ ok: true; login: string } | { ok: false }> => {
    const resp = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!resp.ok) {
      return { ok: false };
    }

    const me = await resp.json() as { login: string };
    return { ok: true, login: me.login };
  };

  useEffect(() => {
    let cancelled = false;

    const checkSavedConnection = async () => {
      if (!session?.user?.id) {
        setConnectionStatus('disconnected');
        setVerifiedUsername(null);
        return;
      }

      setConnectionStatus('checking');

      try {
        const { data } = await supabase
          .from('profiles' as any)
          .select('settings')
          .eq('id', session.user.id)
          .single();

        if (cancelled) return;

        const settings = (data?.settings ?? {}) as Record<string, unknown>;
        const savedToken = typeof settings.github_token === 'string' ? settings.github_token : '';
        const savedUsername = typeof settings.github_username === 'string' ? settings.github_username : null;

        if (!savedToken) {
          setConnectionStatus('disconnected');
          setVerifiedUsername(null);
          return;
        }

        const validation = await validateGitHubToken(savedToken);
        if (cancelled) return;

        if (validation.ok) {
          setConnectionStatus('connected');
          setVerifiedUsername(validation.login);
          return;
        }

        setConnectionStatus('invalid');
        setVerifiedUsername(savedUsername);
      } catch {
        if (cancelled) return;
        setConnectionStatus('disconnected');
        setVerifiedUsername(null);
      }
    };

    void checkSavedConnection();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // ─────────────────────────────────────────────────────────────────────────
  // Save Personal Access Token
  // ─────────────────────────────────────────────────────────────────────────
  const saveToken = async () => {
    if (!pat.trim()) return;
    if (!session?.user?.id) return;

    setSavingToken(true);
    try {
      const validation = await validateGitHubToken(pat.trim());
      if (!validation.ok) {
        toast.error(isRTL ? 'رمز GitHub غير صالح أو منتهي. أنشئ رمزاً جديداً ثم أعد الربط.' : 'That GitHub token is invalid or expired. Create a fresh token and reconnect.');
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles' as any)
        .select('settings')
        .eq('id', session.user.id)
        .single();

      const existingSettings = ((profileData as any)?.settings ?? {}) as Record<string, unknown>;
      await supabase
        .from('profiles' as any)
        .update({ settings: { ...existingSettings, github_token: pat.trim(), github_username: validation.login } })
        .eq('id', session.user.id);

      setConnectionStatus('connected');
      setVerifiedUsername(validation.login);
      setPat('');
      toast.success(isRTL ? `تم التحقق والربط بـ @${validation.login} بنجاح ✓` : `Verified and connected as @${validation.login} ✓`);
    } catch {
      toast.error(isRTL ? 'فشل التحقق من رمز GitHub' : 'Failed to verify GitHub token');
    } finally {
      setSavingToken(false);
    }
  };

  const disconnectGitHub = async () => {
    if (!session?.user?.id) return;
    const { data: profileData } = await supabase
      .from('profiles' as any)
      .select('settings')
      .eq('id', session.user.id)
      .single();
    const existingSettings = { ...((profileData as any)?.settings ?? {}) } as Record<string, unknown>;
    delete existingSettings.github_token;
    delete existingSettings.github_username;
    await supabase
      .from('profiles' as any)
      .update({ settings: existingSettings })
      .eq('id', session.user.id);
    setConnectionStatus('disconnected');
    setVerifiedUsername(null);
    setPat('');
    toast.success(isRTL ? 'تم قطع الاتصال بـ GitHub' : 'GitHub disconnected');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Push to GitHub
  // ─────────────────────────────────────────────────────────────────────────
  const pushToGitHub = async () => {
    if (!session?.access_token) return;
    if (connectionStatus === 'checking') {
      toast.error(isRTL ? 'نحن نتحقق من اتصال GitHub الآن. انتظر لحظة ثم حاول مرة أخرى.' : 'I am still checking your GitHub connection. Please try again in a moment.');
      return;
    }
    if (!repoName.trim()) {
      toast.error(isRTL ? 'أدخل اسم المستودع' : 'Enter a repository name');
      return;
    }

    setPushing(true);
    setPushStep(isRTL ? 'تحضير الملفات...' : 'Preparing files...');
    setPushResult(null);

    try {
      setPushStep(isRTL ? 'رفع الملفات إلى GitHub...' : 'Uploading to GitHub...');

      const { data, error } = await supabase.functions.invoke('github-push', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          projectId,
          repoName: repoName.trim(),
          branch: branch.trim() || 'main',
          commitMessage: commitMsg.trim() || undefined,
          isPrivate,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.ok) {
        if (data?.needsReconnect || data?.code === 'GITHUB_BAD_CREDENTIALS') {
          setConnectionStatus('invalid');
          setVerifiedUsername(null);
          toast.error(data?.error ?? (isRTL ? 'رمز GitHub المحفوظ لم يعد صالحاً. أعد الربط برمز جديد ثم حاول مرة أخرى.' : 'Your saved GitHub token is no longer valid. Reconnect GitHub with a fresh token and try again.'));
          return;
        }
        throw new Error(data?.error ?? 'Push failed');
      }

      setPushResult({ repoUrl: data.repoUrl, commitUrl: data.commitUrl, filesCount: data.filesCount });
      setConnectionStatus('connected');
      setVerifiedUsername(typeof data.owner === 'string' ? data.owner : verifiedUsername);
      onPushSuccess?.(data.repoUrl);
      toast.success(isRTL ? `✓ تم الرفع بنجاح — ${data.filesCount} ملف` : `✓ Pushed ${data.filesCount} files to GitHub`);
    } catch (err: any) {
      toast.error(err?.message ?? (isRTL ? 'فشل الرفع إلى GitHub' : 'Failed to push to GitHub'));
    } finally {
      setPushing(false);
      setPushStep('');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-700 flex items-center justify-center">
              <Github className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">GitHub</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isRTL ? 'رفع المشروع إلى GitHub' : 'Push project to GitHub'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {connectionStatus === 'checking' && !pushResult && (
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-center space-y-3">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500 mx-auto" />
            <div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {isRTL ? 'جاري التحقق من اتصال GitHub...' : 'Checking your GitHub connection...'}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {isRTL ? 'نتأكد أن الرمز المحفوظ ما زال يعمل قبل أن نعرض حالة الاتصال.' : 'I am making sure the saved token still works before showing the connection state.'}
              </p>
            </div>
          </div>
        )}

        {connectionStatus !== 'connected' && connectionStatus !== 'checking' && (
          <div className="space-y-4">
            {showReconnectState && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 space-y-3">
                <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">
                      {isRTL ? 'رمز GitHub المحفوظ لم يعد صالحاً' : 'Your saved GitHub token is no longer valid'}
                    </p>
                    <p className="text-xs mt-1 text-amber-700 dark:text-amber-300">
                      {isRTL ? 'GitHub رفض الرمز المحفوظ. الصق رمزاً جديداً أدناه لإعادة الربط ثم حاول الرفع مرة أخرى.' : 'GitHub rejected the saved token. Paste a fresh token below to reconnect, then try pushing again.'}
                    </p>
                    {verifiedUsername && (
                      <p className="text-xs mt-2 text-amber-700 dark:text-amber-300">
                        {isRTL ? `آخر حساب محفوظ: @${verifiedUsername}` : `Last saved account: @${verifiedUsername}`}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={disconnectGitHub}
                  className="text-xs text-amber-800 dark:text-amber-200 underline underline-offset-2"
                >
                  {isRTL ? 'إزالة الرمز القديم' : 'Remove old token'}
                </button>
              </div>
            )}

            {/* Step 1: one-click token generation */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 space-y-3">
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                {isRTL ? 'الخطوة ١ — احصل على رمز GitHub' : 'Step 1 — Get a GitHub Token'}
              </p>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=Wakti+AI+Coder"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-zinc-900 dark:bg-zinc-700 hover:bg-zinc-800 dark:hover:bg-zinc-600 text-white transition-colors text-sm font-semibold group"
              >
                <div className="flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  {isRTL ? 'إنشاء رمز على GitHub →' : 'Generate Token on GitHub'}
                </div>
                <ArrowRight className="h-4 w-4 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </a>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isRTL
                  ? 'انقر على الزر، ثم مرر للأسفل واضغط "Generate token"، ثم انسخ الرمز الناتج'
                  : 'Click the button, scroll down and click "Generate token", then copy the result'}
              </p>
            </div>

            {/* Step 2: paste token */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                {isRTL ? 'الخطوة ٢ — الصق الرمز هنا' : 'Step 2 — Paste the token here'}
              </p>
              <div className="relative">
                <input
                  type={showPat ? 'text' : 'password'}
                  value={pat}
                  onChange={e => setPat(e.target.value)}
                  placeholder="ghp_..."
                  className="w-full px-3 py-2.5 pr-10 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500/40 placeholder:text-zinc-400 font-mono"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPat(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  tabIndex={-1}
                >
                  {showPat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              onClick={saveToken}
              disabled={savingToken || !pat.trim()}
              className="w-full px-4 py-3 rounded-xl bg-zinc-900 dark:bg-zinc-700 hover:bg-zinc-800 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors font-semibold flex items-center justify-center gap-2 text-sm"
            >
              {savingToken ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{isRTL ? 'جاري التحقق...' : 'Verifying...'}</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" />{showReconnectState ? (isRTL ? 'إعادة ربط GitHub' : 'Reconnect GitHub') : (isRTL ? 'ربط GitHub' : 'Connect GitHub')}</>
              )}
            </button>
          </div>
        )}

        {/* ── Connected — Push form ── */}
        {connected && !pushResult && (
          <div className="space-y-4">
            {/* Connected badge */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50">
              <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isRTL ? 'تم التحقق من GitHub' : 'GitHub verified'}
                {verifiedUsername && (
                  <span className="text-emerald-600/80 dark:text-emerald-400/80 font-mono">
                    (@{verifiedUsername})
                  </span>
                )}
                {githubRepo && (
                  <span className="text-emerald-600/70 dark:text-emerald-400/70 font-mono">
                    ({githubRepo})
                  </span>
                )}
              </div>
              <button
                onClick={disconnectGitHub}
                className="text-xs text-zinc-400 hover:text-red-500 transition-colors underline"
              >
                {isRTL ? 'قطع الاتصال' : 'Disconnect'}
              </button>
            </div>

            {/* Repo name */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                {isRTL ? 'اسم المستودع' : 'Repository name'}
              </label>
              <input
                type="text"
                value={repoName}
                onChange={e => setRepoName(e.target.value.toLowerCase().replace(/[^a-z0-9-_.]/g, '-'))}
                placeholder="my-project"
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500/40 placeholder:text-zinc-400"
              />
              <p className="text-xs text-zinc-400 mt-1">
                {isRTL ? 'سيتم إنشاؤه تلقائياً إذا لم يكن موجوداً' : 'Will be created automatically if it does not exist'}
              </p>
            </div>

            {/* Branch */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5 flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />
                {isRTL ? 'الفرع' : 'Branch'}
              </label>
              <input
                type="text"
                value={branch}
                onChange={e => setBranch(e.target.value.replace(/\s/g, '-'))}
                placeholder="main"
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500/40 placeholder:text-zinc-400"
              />
            </div>

            {/* Commit message */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                {isRTL ? 'رسالة الـ Commit (اختياري)' : 'Commit message (optional)'}
              </label>
              <input
                type="text"
                value={commitMsg}
                onChange={e => setCommitMsg(e.target.value)}
                placeholder={isRTL ? 'تحديث من Wakti AI Coder' : 'Update from Wakti AI Coder'}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500/40 placeholder:text-zinc-400"
              />
            </div>

            {/* Private toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                {isPrivate ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                {isRTL ? 'مستودع خاص' : 'Private repo'}
              </span>
              <button
                role="switch"
                aria-checked={isPrivate}
                onClick={() => setIsPrivate(p => !p)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  isPrivate ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow ${
                  isPrivate ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                disabled={pushing}
                className="flex-1 px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium text-sm disabled:opacity-50"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={pushToGitHub}
                disabled={pushing || !repoName.trim()}
                className="flex-1 px-4 py-3 rounded-xl bg-zinc-900 dark:bg-zinc-700 hover:bg-zinc-800 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors font-semibold flex items-center justify-center gap-2 text-sm"
              >
                {pushing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{pushStep || (isRTL ? 'جاري الرفع...' : 'Pushing...')}</>
                ) : (
                  <><Github className="h-4 w-4" />{isRTL ? 'رفع إلى GitHub' : 'Push to GitHub'}</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Success result ── */}
        {pushResult && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                {isRTL ? '✓ تم الرفع بنجاح!' : '✓ Pushed successfully!'}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                {isRTL ? `${pushResult.filesCount} ملف` : `${pushResult.filesCount} files`}
              </p>
            </div>

            <div className="space-y-2">
              <a
                href={pushResult.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-zinc-900 dark:bg-zinc-700 hover:bg-zinc-800 dark:hover:bg-zinc-600 text-white transition-colors text-sm font-medium group"
              >
                <div className="flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  {isRTL ? 'فتح المستودع' : 'Open Repository'}
                </div>
                <ExternalLink className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
              </a>
              <a
                href={pushResult.commitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors text-sm font-medium group"
              >
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  {isRTL ? 'عرض الـ Commit' : 'View Commit'}
                </div>
                <ExternalLink className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
              </a>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPushResult(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-medium"
              >
                {isRTL ? 'رفع مجدداً' : 'Push again'}
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-700 text-white hover:bg-zinc-800 transition-colors text-sm font-medium"
              >
                {isRTL ? 'إغلاق' : 'Done'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
