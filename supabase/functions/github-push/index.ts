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

function getReconnectResponse(err: unknown) {
  if (!(err instanceof Error)) return null;
  const normalized = err.message.toLowerCase();
  if (normalized.includes('github 401') && normalized.includes('bad credentials')) {
    return {
      ok: false,
      code: 'GITHUB_BAD_CREDENTIALS',
      needsReconnect: true,
      error: 'Your saved GitHub token is no longer valid. Reconnect GitHub with a fresh token and try again.',
    };
  }
  return null;
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
        auto_init: true, // creates initial commit so Git Data API works immediately
        description: "Created with Wakti AI Coder",
      }),
    });
    return false; // auto_init creates first commit so NOT empty
  }
  throw new Error(`Failed to check repo: ${resp.status}`);
}

async function branchExists(token: string, owner: string, repo: string, branch: string): Promise<boolean> {
  const resp = await ghFetch(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`);
  return resp.ok;
}

/**
 * Resolves HEAD SHA and base tree SHA for the target branch.
 * Handles the 409 "Git Repository is empty" case by initializing
 * the repo via the Contents API (which works on uninitialized git repos)
 * before any Git Data API calls are made.
 */
async function resolveHead(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<{ headSha: string | null; baseTreeSha: string | null }> {
  // First probe: does the git repo have any commits at all?
  const refsResp = await ghFetch(token, `/repos/${owner}/${repo}/git/refs`);

  if (refsResp.status === 409) {
    // Truly uninitialized git repo — bootstrap via Contents API
    console.log(`[github-push] Repo ${owner}/${repo} is uninitialized. Bootstrapping via Contents API...`);
    const initResult = await ghJson<{ commit: { sha: string } }>(
      token,
      `/repos/${owner}/${repo}/contents/.wakti`,
      {
        method: "PUT",
        body: JSON.stringify({
          message: "chore: initialize repository",
          content: btoa("# Initialized by Wakti AI Coder\n"),
        }),
      },
    );
    // Return init commit SHA as parent (no base_tree so our tree replaces everything)
    return { headSha: initResult.commit.sha, baseTreeSha: null };
  }

  // Repo is initialized — try to get the target branch
  const branchResp = await ghFetch(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`);
  if (branchResp.ok) {
    const refData = await branchResp.json() as { object: { sha: string } };
    const headSha = refData.object.sha;
    try {
      const commitData = await ghJson<{ tree: { sha: string } }>(
        token,
        `/repos/${owner}/${repo}/git/commits/${headSha}`,
      );
      return { headSha, baseTreeSha: commitData.tree.sha };
    } catch {
      return { headSha, baseTreeSha: null };
    }
  }

  // Branch doesn't exist yet (first push to this branch)
  return { headSha: null, baseTreeSha: null };
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
}): Promise<string> {
  const { token, owner, repo, branch, files, commitMessage } = params;

  console.log(`[github-push] Pushing ${files.length} files to ${owner}/${repo}@${branch}`);

  // 1. Resolve HEAD — handles uninitialized repos before any blob calls
  const { headSha, baseTreeSha } = await resolveHead(token, owner, repo, branch);

  // 2. Create blobs (safe to call now — repo is guaranteed to be initialized)
  const treeItems: { path: string; mode: string; type: string; sha: string }[] = [];
  for (const file of files) {
    const sha = await createBlob(token, owner, repo, file.content);
    treeItems.push({ path: file.path, mode: "100644", type: "blob", sha });
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
        code: "GITHUB_NOT_CONNECTED",
        needsReconnect: true,
        error: "GitHub not connected. Add your Personal Access Token in the GitHub settings panel.",
      });
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

    // Ensure repo exists (creates it if needed with auto_init)
    await ensureRepo(githubToken, owner, repoName, isPrivate);

    const finalMsg = commitMessage
      || `Update from Wakti AI Coder — ${new Date().toISOString().split("T")[0]}`;

    const commitSha = await pushToGitHub({
      token: githubToken,
      owner,
      repo: repoName,
      branch,
      files: pushFiles,
      commitMessage: finalMsg,
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
    const reconnectResponse = getReconnectResponse(err);
    if (reconnectResponse) {
      return jsonResp(reconnectResponse);
    }
    return jsonResp({
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
