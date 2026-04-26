$idx = Get-Content -Raw 'supabase/functions/freepik-image2video/index.ts'
$a = Get-Content -Raw 'supabase/functions/_shared/aiLogger.ts'
$t = Get-Content -Raw 'supabase/functions/_shared/trial-tracker.ts'
$p = Get-Content -Raw 'supabase/functions/_shared/promptSafety.ts'
$u = Get-Content -Raw 'supabase/functions/_shared/getUserIdFromRequest.ts'

$payload = @{ files = @(
  @{ name = 'index.ts'; content = $idx },
  @{ name = '../_shared/aiLogger.ts'; content = $a },
  @{ name = '../_shared/trial-tracker.ts'; content = $t },
  @{ name = '../_shared/promptSafety.ts'; content = $p },
  @{ name = '../_shared/getUserIdFromRequest.ts'; content = $u }
) } | ConvertTo-Json -Depth 10 -Compress

Set-Content -Path 'deploy_payload.json' -Value $payload -Encoding UTF8 -NoNewline
Write-Host ('Bytes: ' + (Get-Item 'deploy_payload.json').Length)
