# Cornhole Tournament PWA

A mobile-first Progressive Web App for running cornhole tournaments of 12, 14, or 16 players. Features single and double elimination brackets, live scoring, leaderboards, and a permanent read-only share link for spectators.

## Tech Stack

- React 18 + Vite + TypeScript
- React Router (organizer app + read-only viewer)
- Supabase (Postgres + Realtime + anonymous auth)
- Tailwind CSS (mobile-first)
- vite-plugin-pwa (installable, offline-capable)
- Vitest (bracket engine tests)

## Local Setup

### 1. Supabase Project

1. Create a new project at [supabase.com](https://supabase.com)
2. **Enable anonymous auth**: Go to Authentication → Settings → Anonymous Sign-ins → Enable
3. Run the migration in the SQL Editor: copy contents of `supabase/migrations/001_initial_schema.sql` and execute
4. Copy your project URL and anon key from Settings → API

### 2. Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your Supabase project URL and anon key.

### 3. Install & Run

```bash
npm install
npm run dev
```

### 4. Run Tests

```bash
npm test
```

## Deploy to Vercel

1. Push this repo to GitHub
2. Import in [vercel.com](https://vercel.com)
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy — Vercel auto-detects Vite

### SPA Routing

Add a `vercel.json` for client-side routing:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

## How It Works

1. **Organizer** opens the app, picks a display name (anonymous auth behind the scenes)
2. **Player setup** — choose 12/14/16 players, enter unique names
3. **Team generation** — random 2-player teams, editable names, reshuffle option
4. **Format selection** — single or double elimination
5. **Bracket & scoring** — tap ready matches, enter scores (one side must reach 21)
6. **Leaderboard** — ranked by wins, tiebreak by total score
7. **Share link** — spectators see live bracket + leaderboard (no login required)

## Project Structure

```
src/
├── bracket/          # Pure TS bracket engine (no framework deps)
│   ├── types.ts      # Type definitions
│   ├── engine.ts     # generateBracket, applyResult, resolveAllByes
│   ├── engine.test.ts # Vitest tests
│   └── index.ts      # Re-exports
├── lib/
│   ├── supabase.ts   # Supabase client init
│   ├── auth.tsx      # Auth context + anonymous sign-in
│   ├── db.ts         # Database operations
│   └── useTournament.ts # Tournament state management hook
├── components/       # UI components
├── pages/            # Route-level pages
└── App.tsx           # Router setup
supabase/
└── migrations/       # SQL migration
```

## Known MVP Simplifications

- **Double-elim grand final is a single game (no bracket reset).** In standard double elimination, the losers bracket champion would need to beat the winners bracket champion twice. This MVP plays a single grand final game.
- **Organizer session is device-bound.** The anonymous auth session lives in localStorage. There is no way to transfer or sync across devices.
- **No offline editing.** An internet connection is required for all mutations. The PWA caches the app shell for fast loading but does not support offline scoring.
