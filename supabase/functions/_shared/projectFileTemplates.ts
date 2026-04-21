/**
 * ============================================================================
 * PROJECT FILE TEMPLATES — placeholder resolver
 * ============================================================================
 *
 * The AI Coder's system prompts instruct the model to emit backend-api calls
 * using a literal `{{PROJECT_ID}}` placeholder (so the same prompt can be
 * reused across projects). This helper resolves that placeholder to the real
 * projectId at the DB save boundary, so:
 *
 *   - The Sandpack preview works immediately (no "projectId=undefined" errors).
 *   - GitHub / ZIP exports contain already-resolved, clean code.
 *   - Publish-time replacement (in the frontend) becomes a no-op safety net.
 *
 * The function is idempotent: running it twice is harmless. Content without
 * the placeholder is returned unchanged (same reference when possible).
 *
 * Used by:
 *   - supabase/functions/projects-generate/index.ts  (replaceProjectFiles, upsertProjectFiles)
 *   - supabase/functions/projects-generate/agentTools.ts  (write_file, search_replace, insert_code, Morph edits)
 * ============================================================================
 */

const PROJECT_ID_TOKEN = /\{\{PROJECT_ID\}\}/g;

/**
 * Replace `{{PROJECT_ID}}` in a single file's content with the real projectId.
 * Returns the original string reference when no placeholder is present.
 */
export function resolveProjectPlaceholders(content: string, projectId: string): string {
  if (!content || !projectId) return content;
  if (!content.includes("{{PROJECT_ID}}")) return content;
  return content.replace(PROJECT_ID_TOKEN, projectId);
}

/**
 * Resolve placeholders across a map of files. Returns a new object with
 * resolved content for files that needed it; entries without the placeholder
 * are copied by reference.
 */
export function resolveProjectPlaceholdersInFiles(
  files: Record<string, string>,
  projectId: string,
): Record<string, string> {
  if (!projectId) return files;
  const out: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    out[path] = resolveProjectPlaceholders(content, projectId);
  }
  return out;
}
