import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GITHUB_API = "https://api.github.com";

// ─── GitHub REST helpers ────────────────────────────────────────────────────

async function ghFetch(token: string, path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    },
  });
}

async function ghJson<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const resp = await ghFetch(token, path, options);
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`GitHub ${resp.status} on ${path}: ${body.slice(0, 300)}`);
  }
  return resp.json() as Promise<T>;
}

// ─── Repo helpers ───────────────────────────────────────────────────────────

async function ensureRepo(token: string, owner: string, repo: string, isPrivate: boolean): Promise<boolean> {
  const resp = await ghFetch(token, `/repos/${owner}/${repo}`);
  if (resp.ok) {
    const data = await resp.json() as { size: number };
    return data.size === 0; // true = empty repo
  }
  if (resp.status === 404) {
    await ghJson(token, `/user/repos`, {
      method: "POST",
      body: JSON.stringify({
        name: repo,
        private: isPrivate,
        auto_init: false,
        description: "Created with Wakti AI Coder",
      }),
    });
    return true; // brand new = empty
  }
  throw new Error(`Failed to check repo: ${resp.status}`);
}

async function branchExists(token: string, owner: string, repo: string, branch: string): Promise<boolean> {
  const resp = await ghFetch(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`);
  return resp.ok;
}

async function createBlob(token: string, owner: string, repo: string, content: string): Promise<string> {
  // Encode to base64 — handle unicode safely
  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const b64 = btoa(binary);

  const data = await ghJson<{ sha: string }>(token, `/repos/${owner}/${repo}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content: b64, encoding: "base64" }),
  });
  return data.sha;
}

// ─── Core push ─────────────────────────────────────────────────────────────

async function pushToGitHub(params: {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  files: { path: string; content: string }[];
  commitMessage: string;
  treatAsEmpty: boolean;
}): Promise<string> {
  const { token, owner, repo, branch, files, commitMessage, treatAsEmpty } = params;

  console.log(`[github-push] Creating ${files.length} blobs for ${owner}/${repo}@${branch}`);

  // 1. Create blobs
  const treeItems: { path: string; mode: string; type: string; sha: string }[] = [];
  for (const file of files) {
    const sha = await createBlob(token, owner, repo, file.content);
    treeItems.push({ path: file.path, mode: "100644", type: "blob", sha });
  }

  // 2. Get current HEAD + base tree (if branch exists)
  let headSha: string | null = null;
  let baseTreeSha: string | null = null;

  if (!treatAsEmpty) {
    try {
      const ref = await ghJson<{ object: { sha: string } }>(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`);
      headSha = ref.object.sha;
      const commit = await ghJson<{ tree: { sha: string } }>(token, `/repos/${owner}/${repo}/git/commits/${headSha}`);
      baseTreeSha = commit.tree.sha;
    } catch {
      // Branch may not exist yet — treat as empty
      headSha = null;
      baseTreeSha = null;
    }
  }

  // 3. Create tree
  const treeBody: Record<string, unknown> = { tree: treeItems };
  if (baseTreeSha) treeBody.base_tree = baseTreeSha;
  const tree = await ghJson<{ sha: string }>(token, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify(treeBody),
  });

  // 4. Create commit
  const commitBody: Record<string, unknown> = {
    message: commitMessage,
    tree: tree.sha,
    parents: headSha ? [headSha] : [],
  };
  const newCommit = await ghJson<{ sha: string }>(token, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify(commitBody),
  });
  const newCommitSha = newCommit.sha;

  // 5. Update or create the branch ref
  if (headSha) {
    await ghJson(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommitSha, force: false }),
    });
  } else {
    await ghJson(token, `/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: newCommitSha }),
    });
  }

  return newCommitSha;
}

// ─── Main handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonResp = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return jsonResp({ ok: false, error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) return jsonResp({ ok: false, error: "Unauthorized" }, 401);

    const {
      projectId,
      repoName,
      branch = "main",
      commitMessage,
      isPrivate = false,
    }: {
      projectId: string;
      repoName: string;
      branch?: string;
      commitMessage?: string;
      isPrivate?: boolean;
    } = await req.json();

    if (!projectId || !repoName) {
      return jsonResp({ ok: false, error: "projectId and repoName are required" }, 400);
    }

    // Get GitHub token from user profile settings
    const { data: profile } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .single();

    const settings = (profile?.settings ?? {}) as Record<string, unknown>;
    const githubToken = settings.github_token as string | undefined;

    if (!githubToken) {
      return jsonResp({
        ok: false,
        error: "GitHub not connected. Add your Personal Access Token in the GitHub settings panel.",
      }, 400);
    }

    // Validate token + get actual GitHub username
    const meData = await ghJson<{ login: string }>(githubToken, "/user");
    const owner = meData.login;

    // Load project files
    const { data: files, error: filesErr } = await supabase
      .from("project_files")
      .select("path, content")
      .eq("project_id", projectId);

    if (filesErr) throw new Error(`DB error loading files: ${filesErr.message}`);
    if (!files || files.length === 0) {
      return jsonResp({ ok: false, error: "No project files found to push." }, 400);
    }

    // Load project name for README
    const { data: project } = await supabase
      .from("projects")
      .select("name, description")
      .eq("id", projectId)
      .single();

    // Prepare files — strip leading /, exclude system files
    const pushFiles = files
      .filter((f: { path: string }) => !f.path.startsWith("/_wakti_"))
      .map((f: { path: string; content: string }) => ({
        path: f.path.startsWith("/") ? f.path.slice(1) : f.path,
        content: f.content,
      }));

    // Auto-add README.md if absent
    if (!pushFiles.some(f => f.path.toLowerCase() === "readme.md")) {
      pushFiles.push({
        path: "README.md",
        content: `# ${project?.name ?? repoName}\n\n${project?.description ?? "Created with Wakti AI Coder"}\n\n> Built with [Wakti AI](https://wakti.ai)\n`,
      });
    }

    // Ensure repo exists; detect if empty
    const repoIsEmpty = await ensureRepo(githubToken, owner, repoName, isPrivate);
    const branchMissing = !repoIsEmpty && !(await branchExists(githubToken, owner, repoName, branch));

    const finalMsg = commitMessage
      || `Update from Wakti AI Coder — ${new Date().toISOString().split("T")[0]}`;

    const commitSha = await pushToGitHub({
      token: githubToken,
      owner,
      repo: repoName,
      branch,
      files: pushFiles,
      commitMessage: finalMsg,
      treatAsEmpty: repoIsEmpty || branchMissing,
    });

    // Persist github_repo + github_branch on the project row
    await supabase
      .from("projects")
      .update({ github_repo: `${owner}/${repoName}`, github_branch: branch })
      .eq("id", projectId);

    // Keep github_username in sync
    if ((settings.github_username as string | undefined) !== owner) {
      await supabase
        .from("profiles")
        .update({ settings: { ...settings, github_username: owner } })
        .eq("id", user.id);
    }

    return jsonResp({
      ok: true,
      repoUrl: `https://github.com/${owner}/${repoName}`,
      commitUrl: `https://github.com/${owner}/${repoName}/commit/${commitSha}`,
      commitSha,
      filesCount: pushFiles.length,
      owner,
      repo: repoName,
      branch,
    });
  } catch (err) {
    console.error("[github-push] Error:", err);
    return jsonResp({
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
