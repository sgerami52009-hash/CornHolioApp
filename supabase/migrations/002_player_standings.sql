-- Player standings: tracks cumulative per-player stats across all tournaments
create table player_standings (
  id                uuid primary key default gen_random_uuid(),
  player_name       text not null unique,
  total_wins        numeric(10,1) not null default 0,
  tournaments_played int not null default 0,
  created_at        timestamptz not null default now()
);

alter table player_standings enable row level security;

-- Everyone can read standings (global leaderboard)
create policy player_standings_read on player_standings
  for select using (true);

-- Authenticated users can insert new player records
create policy player_standings_insert on player_standings
  for insert with check (true);

-- Authenticated users can update (increment wins/tournaments)
create policy player_standings_update on player_standings
  for update using (true);

-- RPC to get all standings (accessible to anon for viewer page)
create or replace function get_player_standings()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'player_name', ps.player_name,
        'total_wins', ps.total_wins,
        'tournaments_played', ps.tournaments_played
      )
      order by ps.total_wins desc, ps.player_name asc
    ),
    '[]'
  )
  from player_standings ps;
$$;

grant execute on function get_player_standings() to anon, authenticated;
