create extension if not exists unaccent with schema extensions;
create extension if not exists http with schema extensions;

create table if not exists public.deen_hadith_collections (
  collection_id text primary key,
  name_en text not null,
  name_ar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deen_quran_verses (
  id bigserial primary key,
  surah_number integer not null,
  ayah_number integer not null,
  surah_name_ar text not null,
  surah_name_en text not null,
  arabic_text text not null,
  english_text text not null,
  normalized_arabic_text text not null default '',
  normalized_english_text text not null default '',
  search_document tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (surah_number, ayah_number)
);

create table if not exists public.deen_hadith_entries (
  id bigserial primary key,
  collection_id text not null references public.deen_hadith_collections(collection_id) on delete cascade,
  hadith_number text not null,
  book_number text,
  book_title_en text,
  book_title_ar text,
  chapter_title_en text,
  chapter_title_ar text,
  arabic_text text,
  english_text text not null,
  normalized_arabic_text text not null default '',
  normalized_english_text text not null default '',
  grade text,
  grade_source text,
  search_document tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collection_id, hadith_number)
);

create index if not exists deen_quran_verses_surah_ayah_idx on public.deen_quran_verses (surah_number, ayah_number);
create index if not exists deen_quran_verses_search_idx on public.deen_quran_verses using gin (search_document);
create index if not exists deen_hadith_entries_collection_number_idx on public.deen_hadith_entries (collection_id, hadith_number);
create index if not exists deen_hadith_entries_search_idx on public.deen_hadith_entries using gin (search_document);

create or replace function public.deen_normalize_text(input_text text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(extensions.unaccent(coalesce(input_text, ''))), '[^a-z0-9\u0600-\u06ff\s]+', ' ', 'g'));
$$;

create or replace function public.set_deen_quran_search_fields()
returns trigger
language plpgsql
as $$
begin
  new.normalized_arabic_text := public.deen_normalize_text(new.arabic_text);
  new.normalized_english_text := public.deen_normalize_text(new.english_text || ' ' || new.surah_name_en || ' ' || new.surah_name_ar);
  new.search_document :=
    setweight(to_tsvector('simple', coalesce(new.normalized_arabic_text, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.normalized_english_text, '')), 'B');
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_deen_hadith_search_fields()
returns trigger
language plpgsql
as $$
begin
  new.normalized_arabic_text := public.deen_normalize_text(new.arabic_text);
  new.normalized_english_text := public.deen_normalize_text(
    coalesce(new.english_text, '') || ' ' ||
    coalesce(new.book_title_en, '') || ' ' ||
    coalesce(new.chapter_title_en, '') || ' ' ||
    coalesce(new.collection_id, '')
  );
  new.search_document :=
    setweight(to_tsvector('simple', coalesce(new.normalized_arabic_text, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.normalized_english_text, '')), 'B');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists deen_quran_verses_search_trigger on public.deen_quran_verses;
create trigger deen_quran_verses_search_trigger
before insert or update on public.deen_quran_verses
for each row execute function public.set_deen_quran_search_fields();

drop trigger if exists deen_hadith_entries_search_trigger on public.deen_hadith_entries;
create trigger deen_hadith_entries_search_trigger
before insert or update on public.deen_hadith_entries
for each row execute function public.set_deen_hadith_search_fields();

alter table public.deen_quran_verses enable row level security;
alter table public.deen_hadith_collections enable row level security;
alter table public.deen_hadith_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'deen_quran_verses' and policyname = 'Authenticated users can read Quran sources'
  ) then
    create policy "Authenticated users can read Quran sources"
      on public.deen_quran_verses for select
      to authenticated
      using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'deen_hadith_collections' and policyname = 'Authenticated users can read Hadith collections'
  ) then
    create policy "Authenticated users can read Hadith collections"
      on public.deen_hadith_collections for select
      to authenticated
      using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'deen_hadith_entries' and policyname = 'Authenticated users can read Hadith entries'
  ) then
    create policy "Authenticated users can read Hadith entries"
      on public.deen_hadith_entries for select
      to authenticated
      using (true);
  end if;
end $$;

drop function if exists public.search_deen_sources(text, integer);
create or replace function public.search_deen_sources(query_text text, result_limit integer default 5)
returns table (
  source_type text,
  reference text,
  surah_number integer,
  ayah_number integer,
  collection_id text,
  hadith_number text,
  title_en text,
  title_ar text,
  arabic_text text,
  english_text text,
  grade text,
  score real
)
language sql
stable
as $$
with normalized as (
  select nullif(public.deen_normalize_text(query_text), '') as q
),
ts as (
  select case when q is null then null else websearch_to_tsquery('simple', q) end as query, q
  from normalized
),
quran_matches as (
  select
    'quran'::text as source_type,
    q.surah_name_en || ' ' || q.surah_number || ':' || q.ayah_number as reference,
    q.surah_number,
    q.ayah_number,
    null::text as collection_id,
    null::text as hadith_number,
    q.surah_name_en as title_en,
    q.surah_name_ar as title_ar,
    q.arabic_text,
    q.english_text,
    null::text as grade,
    (
      case when ts.query is not null then ts_rank(q.search_document, ts.query) else 0 end +
      case when ts.q is not null and (q.normalized_english_text ilike '%' || ts.q || '%' or q.normalized_arabic_text ilike '%' || ts.q || '%') then 0.25 else 0 end
    )::real as score
  from public.deen_quran_verses q
  cross join ts
  where ts.q is not null
    and (
      (ts.query is not null and q.search_document @@ ts.query)
      or q.normalized_english_text ilike '%' || ts.q || '%'
      or q.normalized_arabic_text ilike '%' || ts.q || '%'
    )
  order by score desc, q.surah_number asc, q.ayah_number asc
  limit greatest(result_limit, 1)
),
hadith_matches as (
  select
    'hadith'::text as source_type,
    c.name_en || ' #' || h.hadith_number as reference,
    null::integer as surah_number,
    null::integer as ayah_number,
    h.collection_id,
    h.hadith_number,
    c.name_en as title_en,
    c.name_ar as title_ar,
    h.arabic_text,
    h.english_text,
    h.grade,
    (
      case when ts.query is not null then ts_rank(h.search_document, ts.query) else 0 end +
      case when ts.q is not null and (h.normalized_english_text ilike '%' || ts.q || '%' or h.normalized_arabic_text ilike '%' || ts.q || '%') then 0.25 else 0 end
    )::real as score
  from public.deen_hadith_entries h
  join public.deen_hadith_collections c on c.collection_id = h.collection_id
  cross join ts
  where ts.q is not null
    and (
      (ts.query is not null and h.search_document @@ ts.query)
      or h.normalized_english_text ilike '%' || ts.q || '%'
      or h.normalized_arabic_text ilike '%' || ts.q || '%'
    )
  order by score desc, h.hadith_number asc
  limit greatest(result_limit, 1)
)
select * from quran_matches
union all
select * from hadith_matches
order by score desc, source_type asc;
$$;

create or replace function public.import_deen_quran_sources()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  arabic_doc jsonb;
  english_doc jsonb;
begin
  select content::jsonb into arabic_doc
  from extensions.http_get('https://api.alquran.cloud/v1/quran/quran-uthmani');

  select content::jsonb into english_doc
  from extensions.http_get('https://api.alquran.cloud/v1/quran/en.sahih');

  insert into public.deen_quran_verses (
    surah_number,
    ayah_number,
    surah_name_ar,
    surah_name_en,
    arabic_text,
    english_text
  )
  select
    (ar_surah.value->>'number')::integer,
    (ar_ayah.value->>'numberInSurah')::integer,
    ar_surah.value->>'name',
    en_surah.value->>'englishName',
    ar_ayah.value->>'text',
    en_ayah.value->>'text'
  from jsonb_array_elements(arabic_doc->'data'->'surahs') with ordinality as ar_surah(value, surah_ord)
  join jsonb_array_elements(english_doc->'data'->'surahs') with ordinality as en_surah(value, surah_ord)
    on en_surah.surah_ord = ar_surah.surah_ord
  join jsonb_array_elements(ar_surah.value->'ayahs') with ordinality as ar_ayah(value, ayah_ord)
    on true
  join jsonb_array_elements(en_surah.value->'ayahs') with ordinality as en_ayah(value, ayah_ord)
    on en_ayah.ayah_ord = ar_ayah.ayah_ord
  on conflict (surah_number, ayah_number)
  do update set
    surah_name_ar = excluded.surah_name_ar,
    surah_name_en = excluded.surah_name_en,
    arabic_text = excluded.arabic_text,
    english_text = excluded.english_text,
    updated_at = now();
end;
$$;

create or replace function public.import_deen_hadith_collection(target_collection_id text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  english_doc jsonb;
  arabic_doc jsonb;
begin
  select content::jsonb into english_doc
  from extensions.http_get('https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-' || target_collection_id || '.json');

  begin
    select content::jsonb into arabic_doc
    from extensions.http_get('https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-' || target_collection_id || '.json');
  exception when others then
    arabic_doc := null;
  end;

  insert into public.deen_hadith_collections (collection_id, name_en, name_ar)
  values (
    target_collection_id,
    case target_collection_id
      when 'bukhari' then 'Sahih al-Bukhari'
      when 'muslim' then 'Sahih Muslim'
      when 'abudawud' then 'Sunan Abu Dawud'
      when 'tirmidhi' then 'Jami at-Tirmidhi'
      when 'ibnmajah' then 'Sunan Ibn Majah'
      when 'nasai' then 'Sunan an-Nasa''i'
      else target_collection_id
    end,
    case target_collection_id
      when 'bukhari' then 'صحيح البخاري'
      when 'muslim' then 'صحيح مسلم'
      when 'abudawud' then 'سنن أبي داود'
      when 'tirmidhi' then 'جامع الترمذي'
      when 'ibnmajah' then 'سنن ابن ماجه'
      when 'nasai' then 'سنن النسائي'
      else null
    end
  )
  on conflict (collection_id)
  do update set name_en = excluded.name_en, name_ar = excluded.name_ar, updated_at = now();

  with english_items as (
    select elem.value as item
    from jsonb_array_elements(coalesce(english_doc->'hadiths', '[]'::jsonb)) as elem(value)
  ),
  arabic_items as (
    select nullif(elem.value->>'hadithnumber', '') as hadith_number, elem.value as item
    from jsonb_array_elements(coalesce(arabic_doc->'hadiths', '[]'::jsonb)) as elem(value)
  )
  insert into public.deen_hadith_entries (
    collection_id,
    hadith_number,
    book_number,
    book_title_en,
    book_title_ar,
    chapter_title_en,
    chapter_title_ar,
    arabic_text,
    english_text,
    grade,
    grade_source
  )
  select
    target_collection_id,
    nullif(e.item->>'hadithnumber', ''),
    nullif(e.item->>'book', ''),
    nullif(e.item->>'bookname', ''),
    null,
    nullif(e.item->>'chapter', ''),
    null,
    a.item->>'text',
    coalesce(e.item->>'text', ''),
    coalesce((e.item->'grades'->0->>'grade'), null),
    coalesce((e.item->'grades'->0->>'graded_by'), null)
  from english_items e
  left join arabic_items a on a.hadith_number = nullif(e.item->>'hadithnumber', '')
  where coalesce(e.item->>'text', '') <> ''
    and nullif(e.item->>'hadithnumber', '') is not null
  on conflict (collection_id, hadith_number)
  do update set
    book_number = excluded.book_number,
    book_title_en = excluded.book_title_en,
    chapter_title_en = excluded.chapter_title_en,
    arabic_text = excluded.arabic_text,
    english_text = excluded.english_text,
    grade = excluded.grade,
    grade_source = excluded.grade_source,
    updated_at = now();
end;
$$;
