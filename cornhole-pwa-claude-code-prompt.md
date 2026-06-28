# Claude Code Build Prompt — Cornhole Competition PWA

> Paste this into Claude Code as the project brief. It is self-contained: stack, schema, RLS policies, bracket-engine spec, and acceptance criteria.

---

## Role & Objective

Build a production-ready, mobile-first **Progressive Web App** for running cornhole tournaments of **12, 14, or 16 players**. The organizer enters players, auto-generates random 2-player teams, runs a **single- or double-elimination** bracket, records scores, and views a **live leaderboard**. Spectators follow along live via a **permanent read-only share link**.

Ship a working app deployable to **Vercel** with **Supabase** as the backend (Postgres + Realtime + anonymous auth).

## Tech Stack (use exactly this)

- **React 18 + Vite + TypeScript**
- **React Router** for routing (`/` organizer app, `/t/:shareToken` read-only viewer)
- **Supabase JS client** (`@supabase/supabase-js`) — anonymous auth, Postgres, Realtime
- **Tailwind CSS** for styling, mobile-first
- **vite-plugin-pwa** for service worker + manifest (installable; app icon + splash; precache static assets, network-first for Supabase calls)
- **Vitest** for unit tests (bracket engine must be fully tested)
- Deploy target: **Vercel**. Supabase credentials via `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars.

## Identity Model

- On first load, call `supabase.auth.signInAnonymously()` and persist the session on-device (Supabase handles this in `localStorage`). This anonymous user is the **organizer**.
- Prompt the user to **choose a display name** on first run; store in `organizers.display_name`. Editable in settings.
- All write operations are scoped to the current anonymous user via RLS.
- Viewers use **no auth** — they hit `/t/:shareToken` and read via a public, token-scoped read path (see RLS below).

---

## Supabase Schema

Run as a migration. Postgres with `pgcrypto` for UUIDs and token generation.

```sql
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
  champion_team_id uuid,  -- set when complete; FK added after teams table
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
  slot                int not null,           -- position within the round
  team_a_id           uuid references teams(id) on delete set null,
  team_b_id           uuid references teams(id) on delete set null,
  score_a             int check (score_a between 0 and 21),
  score_b             int check (score_b between 0 and 21),
  winner_id           uuid references teams(id) on delete set null,
  next_match_id       uuid references matches(id) on delete set null,  -- winner advances here
  next_match_slot     char(1),                -- 'a' or 'b' feed into next_match
  loser_next_match_id uuid references matches(id) on delete set null,  -- double-elim loser drop
  loser_next_slot     char(1),
  is_bye              boolean not null default false,
  status              match_status not null default 'pending',
  created_at          timestamptz not null default now(),
  unique (tournament_id, bracket, round, slot)
);
create index on matches (tournament_id);
create index on matches (next_match_id);

-- Enforce a valid final score: exactly one side at 21, other strictly less,
-- only when the match is complete and not a bye.
alter table matches add constraint valid_final_score check (
  status <> 'complete'
  or is_bye
  or (
    (score_a = 21 and score_b < 21) or (score_b = 21 and score_a < 21)
  )
);
```

---

## Row Level Security (RLS)

Enable RLS on all tables. Organizers read/write only their own data. Viewers read tournament data **only** through the `share_token` path. Implement viewer reads via **`SECURITY DEFINER` RPC functions** keyed on `share_token` (cleanest way to expose read-only data to unauthenticated clients without leaking the whole table).

```sql
alter table organizers  enable row level security;
alter table tournaments enable row level security;
alter table players     enable row level security;
alter table teams       enable row level security;
alter table matches     enable row level security;

-- ----- ORGANIZERS -----
create policy organizers_self_all on organizers
  for all using (id = auth.uid()) with check (id = auth.uid());

-- ----- TOURNAMENTS -----
create policy tournaments_owner_all on tournaments
  for all using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());

-- ----- PLAYERS -----
create policy players_owner_all on players
  for all
  using    (exists (select 1 from tournaments t where t.id = players.tournament_id and t.organizer_id = auth.uid()))
  with check(exists (select 1 from tournaments t where t.id = players.tournament_id and t.organizer_id = auth.uid()));

-- ----- TEAMS -----
create policy teams_owner_all on teams
  for all
  using    (exists (select 1 from tournaments t where t.id = teams.tournament_id and t.organizer_id = auth.uid()))
  with check(exists (select 1 from tournaments t where t.id = teams.tournament_id and t.organizer_id = auth.uid()));

-- ----- MATCHES -----
create policy matches_owner_all on matches
  for all
  using    (exists (select 1 from tournaments t where t.id = matches.tournament_id and t.organizer_id = auth.uid()))
  with check(exists (select 1 from tournaments t where t.id = matches.tournament_id and t.organizer_id = auth.uid()));
```

### Viewer read path (public, token-scoped)

```sql
-- Returns the full read-only snapshot for a share token. No auth required.
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
```

**Realtime for viewers:** Since RLS blocks anon from reading the tables directly, the viewer should poll `get_public_tournament` on an interval (e.g. every 5s) AND/OR you may create a dedicated, read-only realtime channel. Simplest robust approach for MVP: viewer subscribes to a Supabase Realtime broadcast channel named by `share_token` that the organizer client publishes to on every mutation; fall back to interval polling of the RPC. Implement both: broadcast on write, poll every 8s as a safety net.

---

## Bracket Engine Spec

Implement as a **pure, framework-agnostic TypeScript module** (`src/bracket/`) with **no Supabase imports**. The app layer maps engine output to DB rows. Fully unit-tested with Vitest.

### Types

```ts
export type Format = 'single' | 'double';
export type BracketKind = 'winners' | 'losers' | 'grand_final';

export interface SeededTeam { id: string; seed: number; }

export interface EngineMatch {
  key: string;                 // stable deterministic key, e.g. "W-1-0"
  bracket: BracketKind;
  round: number;
  slot: number;
  teamA: string | null;        // team id or null (TBD / bye)
  teamB: string | null;
  isBye: boolean;
  nextMatchKey: string | null;
  nextMatchSlot: 'a' | 'b' | null;
  loserNextMatchKey: string | null;   // double elim only
  loserNextSlot: 'a' | 'b' | null;
}

export interface Bracket { matches: EngineMatch[]; }
```

### Functions

```ts
// Build the full bracket structure from seeded teams.
generateBracket(teams: SeededTeam[], format: Format): Bracket;

// Apply a completed result and return the set of mutations to persist:
// winner advancement, loser drop (double), eliminations, and whether the
// tournament is now complete (with champion id).
applyResult(
  bracket: Bracket,
  results: Record<string, { winnerId: string; scoreA: number; scoreB: number }>,
  matchKey: string,
  scoreA: number,
  scoreB: number
): {
  updatedMatches: EngineMatch[];      // matches whose teamA/teamB/status changed
  eliminatedTeamIds: string[];
  isComplete: boolean;
  championId: string | null;
};
```

### Rules

1. **Seeding & byes.** Teams = players / 2 (so 6, 7, or 8 teams). Pad the winners-bracket round 1 up to the next power of two (8) with **byes**. Standard seeding so byes land on the highest seeds. A bye match has one real team and `teamB = null`, `isBye = true`, and is **auto-resolved**: the real team advances with **no win point and no score** (see scoring).
2. **Single elimination.** Winners bracket only. Last match's winner is champion.
3. **Double elimination.** Winners bracket + losers bracket + grand final.
   - Loser of each winners-bracket match drops into the correct losers-bracket match (`loserNextMatchKey`).
   - Losers bracket alternates "minor" rounds (drop-ins) and "major" rounds (consolidation) per standard double-elim topology.
   - **Grand final:** winners-bracket champion vs losers-bracket champion. Implement a **single grand final** for MVP (no bracket reset) — document this clearly; the WB champion wins the tournament if they win the grand final, and if the LB champion wins, they are champion (no reset game in MVP). *(Flag this as a known simplification.)*
4. **Determinism.** Match keys are stable so the engine can be re-run/reconciled against DB rows idempotently.
5. **Advancement.** When a match completes, set the winner into `nextMatch` at `nextMatchSlot`; in double-elim set the loser into `loserNextMatch`. When both teams of a downstream match are filled, its status becomes `ready`.

### Scoring (applied in the app layer, driven by engine signals)

- On a **played** match completion: `winner.wins += 1`; **each team's `total_score += its own match score`** (so both the 21 and the 0–20 are added to the respective teams' totals).
- On a **bye**: no win increment, no score added.
- A team's `status` becomes `eliminated` when it can no longer advance (single-elim: any loss; double-elim: second loss).

### Required unit tests

- Bracket generation for **6, 7, 8 teams** × **single & double** → correct match counts, correct bye placement, valid `next/loser` links.
- Full simulated tournament for each case → exactly one champion, all non-champions eliminated, leaderboard totals consistent.
- Bye correctly advances with no point/score.
- Score validation rejects non-21 winners.
- Idempotent re-apply of the same result is a no-op.

---

## App Behavior & Screens

Routes: `/` (organizer), `/t/:shareToken` (viewer, read-only).

1. **First-run name** — prompt for organizer display name; anonymous sign-in behind the scenes.
2. **Player setup** — choose 12 / 14 / 16; enter unique names; validate before continuing.
3. **Team generation** — "Create Teams" randomly pairs into teams of 2; editable team names; "Reshuffle"; "Lock & Continue".
4. **Format selection** — Single or Double elimination. On confirm: generate bracket, persist teams + matches, set status `in_progress`, auto-resolve byes.
5. **Bracket view** — interactive, mobile-friendly bracket; tap a `ready` match to enter scores (one side must be 21). Optimistic update + write; broadcast on success. Completed matches visually distinct; editable until a dependent match starts.
6. **Leaderboard** — rank by **wins**, tiebreak **total score**; show rank, team, players, wins, total score, status; live-updating.
7. **Champion / results** — final standings; "New Tournament".
8. **Viewer** — read-only bracket + leaderboard via `get_public_tournament`, live via broadcast + poll fallback. Share button copies `/t/:shareToken`.

## PWA Requirements

- `vite-plugin-pwa` with `registerType: 'autoUpdate'`.
- Manifest: name, short_name, theme/background colors, 192/512 icons, `display: standalone`, portrait.
- Service worker: precache app shell; **network-first** for Supabase requests with a friendly offline/reconnecting banner.

## Acceptance Criteria

- [ ] Installable PWA on iOS Safari & Android Chrome; passes Lighthouse PWA checks.
- [ ] Anonymous session persists across reloads on the same device; name persists.
- [ ] Only 12/14/16 players accepted; duplicate/empty names rejected.
- [ ] Random teams + reshuffle; locking generates a valid bracket for single & double.
- [ ] Byes auto-resolve with no point/score.
- [ ] Score entry enforces a 21-to-win rule; winner advances; double-elim loser drops correctly.
- [ ] Wins and total score computed per spec; leaderboard sorts by wins then total score.
- [ ] Champion declared and shown; final standings correct.
- [ ] Permanent share link renders a live, read-only view with no login.
- [ ] Organizer cannot read/write another organizer's tournament (RLS verified).
- [ ] Bracket-engine unit tests pass for all required cases.

## Deliverables

- Full repo: React + Vite + TS app, Tailwind, PWA config.
- `supabase/migrations/*.sql` containing schema + RLS + RPC above.
- `src/bracket/` engine + Vitest tests.
- `README.md`: local setup, env vars, Supabase project setup (enable anonymous auth), Vercel deploy steps.
- `.env.example` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Known MVP Simplifications (document in README)

- Double-elim grand final is a **single game (no bracket reset)**.
- Organizer session is **device-bound** (no cross-device sync).
- No offline editing; online required for mutations.
