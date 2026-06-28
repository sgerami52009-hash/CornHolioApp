-- Cornhole Tournament PWA — Initial Schema
create extension if not exists pgcrypto;

-- ============ ORGANIZERS ============
create table organizers (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 40),
  created_at    timestamptz not null default now()
);

-- ============ TOURNAMENTS ============
create type tournament_format as enum ('single', 'double');
create type tournament_status as enum ('setup', 'in_progress', 'complete');

create table tournaments (
  id            uuid primary key default gen_random_uuid(),
  organizer_id  uuid not null references organizers(id) on delete cascade,
  name          text not null default 'Cornhole Tournament' check (char_length(name) between 1 and 80),
  format        tournament_format not null,
  status        tournament_status not null default 'setup',
  share_token   text not null unique default encode(gen_random_bytes(12), 'hex'),
  champion_team_id uuid,
  created_at    timestamptz not null default now()
);
create index on tournaments (organizer_id);
create index on tournaments (share_token);

-- ============ PLAYERS ============
create table players (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 40),
  created_at    timestamptz not null default now(),
  unique (tournament_id, name)
);
create index on players (tournament_id);

-- ============ TEAMS ============
create type team_status as enum ('active', 'eliminated');

create table teams (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  player_1_id   uuid not null references players(id) on delete cascade,
  player_2_id   uuid not null references players(id) on delete cascade,
  seed          int  not null,
  wins          int  not null default 0,
  total_score   int  not null default 0,
  status        team_status not null default 'active',
  created_at    timestamptz not null default now(),
  check (player_1_id <> player_2_id)
);
create index on teams (tournament_id);

alter table tournaments
  add constraint fk_champion_team
  foreign key (champion_team_id) references teams(id) on delete set null;

-- ============ MATCHES ============
create type bracket_kind as enum ('winners', 'losers', 'grand_final');
create type match_status as enum ('pending', 'ready', 'complete');

create table matches (
  id                  uuid primary key default gen_random_uuid(),
  tournament_id       uuid not null references tournaments(id) on delete cascade,
  bracket             bracket_kind not null,
  round               int not null,
  slot                int not null,
  team_a_id           uuid references teams(id) on delete set null,
  team_b_id           uuid references teams(id) on delete set null,
  score_a             int check (score_a between 0 and 21),
  score_b             int check (score_b between 0 and 21),
  winner_id           uuid references teams(id) on delete set null,
  next_match_id       uuid references matches(id) on delete set null,
  next_match_slot     char(1),
  loser_next_match_id uuid references matches(id) on delete set null,
  loser_next_slot     char(1),
  is_bye              boolean not null default false,
  status              match_status not null default 'pending',
  created_at          timestamptz not null default now(),
  unique (tournament_id, bracket, round, slot)
);
create index on matches (tournament_id);
create index on matches (next_match_id);

alter table matches add constraint valid_final_score check (
  status <> 'complete'
  or is_bye
  or (
    (score_a = 21 and score_b < 21) or (score_b = 21 and score_a < 21)
  )
);

-- ============ ROW LEVEL SECURITY ============
alter table organizers  enable row level security;
alter table tournaments enable row level security;
alter table players     enable row level security;
alter table teams       enable row level security;
alter table matches     enable row level security;

create policy organizers_self_all on organizers
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy tournaments_owner_all on tournaments
  for all using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());

create policy players_owner_all on players
  for all
  using    (exists (select 1 from tournaments t where t.id = players.tournament_id and t.organizer_id = auth.uid()))
  with check(exists (select 1 from tournaments t where t.id = players.tournament_id and t.organizer_id = auth.uid()));

create policy teams_owner_all on teams
  for all
  using    (exists (select 1 from tournaments t where t.id = teams.tournament_id and t.organizer_id = auth.uid()))
  with check(exists (select 1 from tournaments t where t.id = teams.tournament_id and t.organizer_id = auth.uid()));

create policy matches_owner_all on matches
  for all
  using    (exists (select 1 from tournaments t where t.id = matches.tournament_id and t.organizer_id = auth.uid()))
  with check(exists (select 1 from tournaments t where t.id = matches.tournament_id and t.organizer_id = auth.uid()));

-- ============ VIEWER READ PATH (PUBLIC, TOKEN-SCOPED) ============
create or replace function get_public_tournament(p_share_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tournament', to_jsonb(t) - 'organizer_id',
    'teams',   coalesce((select jsonb_agg(to_jsonb(te) order by te.seed) from teams te where te.tournament_id = t.id), '[]'),
    'matches', coalesce((select jsonb_agg(to_jsonb(m) order by m.bracket, m.round, m.slot) from matches m where m.tournament_id = t.id), '[]'),
    'players', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name)) from players p where p.tournament_id = t.id), '[]')
  )
  from tournaments t
  where t.share_token = p_share_token
  limit 1;
$$;

grant execute on function get_public_tournament(text) to anon, authenticated;
