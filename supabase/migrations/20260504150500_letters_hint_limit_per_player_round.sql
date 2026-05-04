begin;

alter table public.letters_games
  add column if not exists hints_per_player_round integer;

update public.letters_games
set hints_per_player_round = case when coalesce(hints_enabled, false) then 1 else 0 end
where hints_per_player_round is null;

alter table public.letters_games
  alter column hints_per_player_round set default 0;

alter table public.letters_games
  alter column hints_per_player_round set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'letters_games_hints_per_player_round_check'
      and conrelid = 'public.letters_games'::regclass
  ) then
    alter table public.letters_games
      add constraint letters_games_hints_per_player_round_check
      check (hints_per_player_round >= 0 and hints_per_player_round <= 10);
  end if;
end $$;

update public.letters_games
set hints_per_player_round = 0
where hints_enabled = false;

update public.letters_games
set hints_enabled = (hints_per_player_round > 0);

alter table public.letters_hints_used
  drop constraint if exists letters_hints_used_game_code_round_no_user_id_key;

drop index if exists public.letters_hints_used_game_code_round_no_user_id_key;

create index if not exists idx_letters_hints_used_game_round_user
  on public.letters_hints_used (game_code, round_no, user_id);

commit;
