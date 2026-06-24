alter table public.project_generation_jobs
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.project_generation_jobs
  drop constraint if exists project_generation_jobs_mode_check;

alter table public.project_generation_jobs
  add constraint project_generation_jobs_mode_check
  check (mode = any (array['create'::text, 'edit'::text, 'agent'::text]));

alter table public.project_generation_jobs
  drop constraint if exists project_generation_jobs_status_check;

alter table public.project_generation_jobs
  add constraint project_generation_jobs_status_check
  check (status = any (array['queued'::text, 'running'::text, 'paused'::text, 'succeeded'::text, 'failed'::text]));
