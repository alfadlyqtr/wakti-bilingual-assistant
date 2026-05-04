begin;

create or replace function public.enforce_letters_hint_limit()
returns trigger
language plpgsql
as $$
declare
  allowed_limit integer;
  used_count integer;
begin
  select coalesce(g.hints_per_player_round, case when g.hints_enabled then 1 else 0 end)
    into allowed_limit
  from public.letters_games g
  where g.code = new.game_code;

  if coalesce(allowed_limit, 0) <= 0 then
    raise exception 'Hints are disabled for this game';
  end if;

  select count(*)
    into used_count
  from public.letters_hints_used h
  where h.game_code = new.game_code
    and h.round_no = new.round_no
    and h.user_id = new.user_id;

  if used_count >= allowed_limit then
    raise exception 'Hint limit reached for this round';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_letters_hint_limit on public.letters_hints_used;

create trigger trg_enforce_letters_hint_limit
before insert on public.letters_hints_used
for each row
execute function public.enforce_letters_hint_limit();

commit;
