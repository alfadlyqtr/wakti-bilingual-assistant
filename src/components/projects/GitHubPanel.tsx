import { useState } from 'react';
import { Github, X, ExternalLink, AlertTriangle, CheckCircle2, Loader2, GitBranch, Lock, Unlock, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

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
  const [savingToken, setSavingToken] = useState(false);
  const [connected, setConnected] = useState(false);

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

  // ── Check if already connected (token exists in profile) ──────────────────
  const [checkedConnection, setCheckedConnection] = useState(false);
  const [alreadyConnected, setAlreadyConnected] = useState(false);

  if (!checkedConnection) {
    setCheckedConnection(true);
    supabase
      .from('profiles' as any)
      .select('settings')
      .eq('id', session?.user?.id ?? '')
      .single()
      .then(({ data }: { data: any }) => {
        const settings = (data?.settings ?? {}) as Record<string, unknown>;
        if (settings.github_token) {
          setAlreadyConnected(true);
          setConnected(true);
        }
      });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Save Personal Access Token
  // ─────────────────────────────────────────────────────────────────────────
  const saveToken = async () => {
    if (!pat.trim()) return;
    if (!session?.user?.id) return;

    setSavingToken(true);
    try {
      // Validate token against GitHub API
      const resp = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${pat.trim()}` },
      });
      if (!resp.ok) {
        toast.error(isRTL ? 'رمز GitHub غير صالح. تأكد من صحة الرمز وصلاحياته.' : 'Invalid GitHub token. Check it has "repo" scope.');
        return;
      }
      const me = await resp.json() as { login: string };

      // Store in profiles.settings
      const { data: profileData } = await supabase
        .from('profiles' as any)
        .select('settings')
        .eq('id', session.user.id)
        .single();

      const existingSettings = ((profileData as any)?.settings ?? {}) as Record<string, unknown>;
      await supabase
        .from('profiles' as any)
        .update({ settings: { ...existingSettings, github_token: pat.trim(), github_username: me.login } })
        .eq('id', session.user.id);

      setAlreadyConnected(true);
      setConnected(true);
      toast.success(isRTL ? `تم الربط بـ @${me.login} بنجاح ✓` : `Connected as @${me.login} ✓`);
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
    setAlreadyConnected(false);
    setConnected(false);
    setPat('');
    toast.success(isRTL ? 'تم قطع الاتصال بـ GitHub' : 'GitHub disconnected');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Push to GitHub
  // ─────────────────────────────────────────────────────────────────────────
  const pushToGitHub = async () => {
    if (!session?.access_token) return;
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
      if (!data?.ok) throw new Error(data?.error ?? 'Push failed');

      setPushResult({ repoUrl: data.repoUrl, commitUrl: data.commitUrl, filesCount: data.filesCount });
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

        {/* ── Not connected ── */}
        {!connected && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 text-xs text-amber-700 dark:text-amber-300 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5" />
                {isRTL ? 'كيفية الحصول على الرمز:' : 'How to get your token:'}
              </p>
              <ol className={`space-y-0.5 ${isRTL ? 'pr-4' : 'pl-4'} list-decimal`}>
                <li>{isRTL ? 'اذهب إلى github.com ← Settings ← Developer settings' : 'Go to github.com → Settings → Developer settings'}</li>
                <li>{isRTL ? 'Personal access tokens ← Tokens (classic)' : 'Personal access tokens → Tokens (classic)'}</li>
                <li>{isRTL ? 'أنشئ رمزاً جديداً مع صلاحية "repo"' : 'Generate new token with "repo" scope'}</li>
              </ol>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                {isRTL ? 'Personal Access Token' : 'Personal Access Token'}
              </label>
              <input
                type="password"
                value={pat}
                onChange={e => setPat(e.target.value)}
                placeholder="ghp_..."
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500/40 placeholder:text-zinc-400 font-mono"
                autoFocus
              />
            </div>

            <button
              onClick={saveToken}
              disabled={savingToken || !pat.trim()}
              className="w-full px-4 py-3 rounded-xl bg-zinc-900 dark:bg-zinc-700 hover:bg-zinc-800 dark:hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors font-semibold flex items-center justify-center gap-2 text-sm"
            >
              {savingToken ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{isRTL ? 'جاري التحقق...' : 'Verifying...'}</>
              ) : (
                <><Github className="h-4 w-4" />{isRTL ? 'ربط GitHub' : 'Connect GitHub'}</>
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
                {isRTL ? 'GitHub متصل' : 'GitHub connected'}
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
                {isRTL ? (isPrivate ? 'مستودع خاص' : 'مستودع عام') : (isPrivate ? 'Private repo' : 'Public repo')}
              </span>
              <button
                onClick={() => setIsPrivate(p => !p)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isPrivate ? 'bg-zinc-800 dark:bg-zinc-600' : 'bg-zinc-200 dark:bg-zinc-700'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow ${
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
