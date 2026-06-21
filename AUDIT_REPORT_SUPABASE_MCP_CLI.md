# Supabase MCP & CLI Audit Report

Date: 2026-06-18
Project: Wakti (hxauxozopvpzpdygoqwf)

## 1. MCP Connection

- **Status**: Not connected / unauthorized
- **Error**: `Unauthorized. Please provide a valid access token to the MCP server via the --access-token flag or SUPABASE_ACCESS_TOKEN.`
- **Root cause**: The Supabase MCP server (`@supabase/mcp-server-supabase`) was running without a valid access token. The MCP tools in this chat interface do not accept an `access_token` parameter, so the token must be supplied to the MCP server process itself via the `SUPABASE_ACCESS_TOKEN` environment variable.
- **Token state**: A valid Supabase access token was provided in a previous conversation. The token was not stored in the project or shell environment before this audit.

## 2. CLI Connection

- **Status**: Connected and authenticated
- **Project**: `hxauxozopvpzpdygoqwf` (Wakti, Singapore region)
- **Verification**: `supabase projects list` returned the linked project correctly.
- **Config**: `supabase/config.toml` contains `project_id = "hxauxozopvpzpdygoqwf"`.
- **CLI version**: `2.106.0` (update `2.107.0` available)
- **Functions**: 159+ active Edge Functions visible via `supabase functions list`.
- **Migrations**: 197+ migrations tracked. Significant drift exists between local and remote migration history.

## 3. Pending Backend Change

- **File**: `supabase/migrations/20260618100000_add_mention_notifications_to_group_chat.sql`
- **Type**: Database migration (trigger + function for group-chat mention notifications)
- **State before deployment**: Local only, not recorded in remote `supabase_migrations.schema_migrations`.
- **Migration history drift**: Multiple local-only and remote-only migrations exist. Running `supabase migration up --linked` would attempt to apply all local-only migrations, which would likely fail on older migrations (e.g., `20240513_create_events_tables.sql` creates policies that already exist).

## 4. Recommendations

1. **MCP**: Configure the MCP server with the access token and restart the MCP server (requires Devin app reload). The token has been added to `~/.zshrc` and set via `launchctl setenv` for the current session.
2. **CLI**: Use CLI as the working backend deployment path until MCP is restarted. The CLI is fully authenticated and reliable.
3. **Migrations**: For divergent migration history, prefer applying specific migrations with `supabase db query --linked --file <file>` and then manually recording them in `supabase_migrations.schema_migrations`, or clean up migration drift with `supabase migration repair` after careful review.
