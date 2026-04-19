// ============================================================================
// WAKTI AI CODER — GitHub Export Edge Function
// Pushes the current project files to the user's GitHub account.
//
// Flow:
//   1. User connects GitHub via Supabase OAuth (provider_token)
//   2. Frontend calls this function with { projectId, repoName, createNew }
//   3. We fetch all project_files and commit them to GitHub
//
// Requirements:
//   - User must be signed in via GitHub OAuth (needs provider_token with repo scope)
//   - OR user provides a Personal Access Token (PAT)
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GITHUB_API = "https://api.github.com";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sessionToken = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(sessionToken);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { projectId, repoName, githubToken, createNew = true, branch = "main" } = await req.json();

    if (!projectId || !repoName || !githubToken) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: projectId, repoName, githubToken" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate project ownership
    const { data: project, error: projectError } = await (supabase as any)
      .from("projects")
      .select("id, name, user_id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Project not found or access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all project files
    const { data: files, error: filesError } = await (supabase as any)
      .from("project_files")
      .select("path, content")
      .eq("project_id", projectId);

    if (filesError || !files || files.length === 0) {
      return new Response(
        JSON.stringify({ error: "No files found for this project." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ghHeaders = {
      "Authorization": `token ${githubToken}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Wakti-AI-Coder",
      "Content-Type": "application/json",
    };

    // Step 1: Get the authenticated GitHub user
    const meRes = await fetch(`${GITHUB_API}/user`, { headers: ghHeaders });
    if (!meRes.ok) {
      return new Response(
        JSON.stringify({ error: "Invalid GitHub token or insufficient permissions. Make sure your token has the 'repo' scope." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const me = await meRes.json();
    const ghUsername = me.login;

    const fullRepoName = `${ghUsername}/${repoName}`;
    let repoExists = false;

    // Step 2: Check if repo exists
    const checkRes = await fetch(`${GITHUB_API}/repos/${fullRepoName}`, { headers: ghHeaders });
    repoExists = checkRes.ok;

    // Step 3: Create repo if it doesn't exist and createNew is true
    if (!repoExists) {
      if (!createNew) {
        return new Response(
          JSON.stringify({ error: `Repository '${fullRepoName}' does not exist. Set createNew: true to create it.` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const createRes = await fetch(`${GITHUB_API}/user/repos`, {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({
          name: repoName,
          description: `Built with Wakti AI Coder — wakti.qa`,
          private: false,
          auto_init: false,
        }),
      });

      if (!createRes.ok) {
        const errBody = await createRes.json();
        return new Response(
          JSON.stringify({ error: `Failed to create repository: ${errBody.message || createRes.statusText}` }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[github-export] Created new repo: ${fullRepoName}`);
    }

    // Step 4: Get current branch SHA (if repo already exists and has commits)
    let baseTreeSha: string | undefined;
    let parentSha: string | undefined;

    const branchRes = await fetch(`${GITHUB_API}/repos/${fullRepoName}/branches/${branch}`, { headers: ghHeaders });
    if (branchRes.ok) {
      const branchData = await branchRes.json();
      parentSha = branchData.commit?.sha;
      baseTreeSha = branchData.commit?.commit?.tree?.sha;
    }

    // Step 5: Create git tree with all project files
    const treeItems = files.map((file: { path: string; content: string }) => ({
      path: file.path.startsWith("/") ? file.path.slice(1) : file.path,
      mode: "100644",
      type: "blob",
      content: file.content,
    }));

    const treeRes = await fetch(`${GITHUB_API}/repos/${fullRepoName}/git/trees`, {
      method: "POST",
      headers: ghHeaders,
      body: JSON.stringify({
        tree: treeItems,
        ...(baseTreeSha ? { base_tree: baseTreeSha } : {}),
      }),
    });

    if (!treeRes.ok) {
      const errBody = await treeRes.json();
      return new Response(
        JSON.stringify({ error: `Failed to create git tree: ${errBody.message}` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tree = await treeRes.json();

    // Step 6: Create commit
    const commitRes = await fetch(`${GITHUB_API}/repos/${fullRepoName}/git/commits`, {
      method: "POST",
      headers: ghHeaders,
      body: JSON.stringify({
        message: `🚀 Built with Wakti AI Coder — ${new Date().toISOString().slice(0, 10)}`,
        tree: tree.sha,
        ...(parentSha ? { parents: [parentSha] } : { parents: [] }),
      }),
    });

    if (!commitRes.ok) {
      const errBody = await commitRes.json();
      return new Response(
        JSON.stringify({ error: `Failed to create commit: ${errBody.message}` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const commit = await commitRes.json();

    // Step 7: Update branch reference (create or force-update)
    const refPath = `refs/heads/${branch}`;
    const refCheckRes = await fetch(`${GITHUB_API}/repos/${fullRepoName}/git/ref/heads/${branch}`, { headers: ghHeaders });

    if (refCheckRes.ok) {
      // Update existing ref
      const updateRefRes = await fetch(`${GITHUB_API}/repos/${fullRepoName}/git/refs/heads/${branch}`, {
        method: "PATCH",
        headers: ghHeaders,
        body: JSON.stringify({ sha: commit.sha, force: true }),
      });
      if (!updateRefRes.ok) {
        const errBody = await updateRefRes.json();
        return new Response(
          JSON.stringify({ error: `Failed to update branch ref: ${errBody.message}` }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Create new ref
      const createRefRes = await fetch(`${GITHUB_API}/repos/${fullRepoName}/git/refs`, {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({ ref: refPath, sha: commit.sha }),
      });
      if (!createRefRes.ok) {
        const errBody = await createRefRes.json();
        return new Response(
          JSON.stringify({ error: `Failed to create branch ref: ${errBody.message}` }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const repoUrl = `https://github.com/${fullRepoName}`;
    console.log(`[github-export] ✅ Pushed ${files.length} files → ${repoUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        repoUrl,
        commitSha: commit.sha,
        fileCount: files.length,
        branch,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[github-export] Fatal:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
