# Cornhole Competition PWA — Product Requirements Document

## 1. Overview

A mobile-first Progressive Web App for organizing and running cornhole tournaments for 12–16 players. The organizer enters players, auto-generates random 2-player teams, runs a single- or double-elimination bracket, tracks winners/points, and views a live leaderboard. Hosted online and cloud-backed so state persists and viewers can follow along live via a permanent read-only share link.

## 2. Goals

- Set up a tournament in under 2 minutes on a phone.
- Run a full bracket with no manual record-keeping.
- Persist all data to the cloud; resumable on the same device.
- Let spectators follow live via a read-only link.
- Installable as a PWA on smartphones.

## 3. Users

- **Organizer** — creates and runs the tournament; identified by an anonymous device session.
- **Viewer** — opens a shared link to watch the live bracket and leaderboard, read-only.

## 4. Functional Requirements

### 4.1 Session & Identity
- **Anonymous session tied to the device** — no login. On first use, a persistent anonymous session is created and stored on the device; the organizer's tournaments are bound to it.
- The user **chooses their own display name** on first visit, editable in settings.
- Returning on the same device resumes the existing session and any in-progress tournament.

### 4.2 Player Setup
- Input the number of players: **12, 14, or 16** (even only — teams of 2). No odd counts.
- Enter a name per player; names required and unique, validated before proceeding.
- Edit/remove players before teams are created.

### 4.3 Team Generation
- "Create Teams" randomly pairs players into teams of 2.
- Each team auto-named (editable).
- "Reshuffle" to re-randomize before locking.
- Teams lock once the bracket is created.

### 4.4 Bracket Creation
- User selects **Single** or **Double Elimination**.
- Bracket auto-generated from locked teams (6, 7, or 8 teams).
- Non-power-of-2 counts (e.g., 6 or 7 teams) handled via **byes** assigned to randomly seeded teams in round 1.
- Double elimination includes winners bracket, losers bracket, and grand final.

### 4.5 Match & Score Tracking
- Each match shows the two competing teams.
- **Games are played to 21.** The organizer enters each team's score; the team reaching **21** is the winner, the loser's score (0–20) is recorded.
- Validation: exactly one team at 21, the other strictly less than 21.
- Winner advances automatically; in double elimination the loser drops to the losers bracket.
- Completed matches are visually distinct; results editable until the next dependent match starts.
- All updates write to the database immediately and sync live.

### 4.6 Points System
- **1 point** per match win, per team (bracket points).
- **Total score** = the **sum of a team's per-match scores** across all matches played.
- Both tracked independently and shown on the leaderboard.

### 4.7 Bye Handling
- A bye **advances the team to the next round but is skipped** for scoring: **no win point and no score added** for a bye.
- Points and total score accrue only from actual played matches.

### 4.8 Leaderboard
- Live ranking by **wins (bracket points)**, tiebreak by **total score gathered**. (No further tiebreak beyond total score.)
- Displays: rank, team name/players, wins, total score, status (active/eliminated).
- Visual bracket view showing match progression and winners.
- Updates in real time across the organizer's device and all viewers.

### 4.9 Read-Only Share Link
- Each tournament has a **permanent share token** generating a stable shareable link.
- Viewers open the link with no session or login and see a **read-only** live bracket and leaderboard.
- Viewers cannot edit players, scores, or advance matches.

### 4.10 Tournament Completion
- Declares champion when the bracket resolves.
- Final standings summary (1st, 2nd, etc.).
- Option to start a new tournament.

## 5. Non-Functional Requirements

- **PWA**: installable, mobile-first, responsive; iOS Safari and Android Chrome.
- **Online**: cloud-backed state; graceful "reconnecting" handling on network drops; optimistic UI where safe.
- **Persistence**: all state in Supabase; survives refresh and app close on the same device.
- **Real-time**: bracket and leaderboard reflect updates live for organizer and viewers.
- **Performance**: sub-second interactions on mobile.

## 6. Technical Architecture

- **Frontend**: React + Vite, deployed on **Vercel**.
- **PWA**: service worker + web manifest (installable, app icon, splash); cache static assets, network-first for data.
- **Backend / Data**: **Supabase** — Postgres for storage, Supabase Realtime for live sync.
- **Identity**: Supabase **anonymous auth**, session persisted on the device. No email/password.
- **Bracket engine**: pluggable module supporting both elimination formats; pure, unit-testable advancement functions.
- **Authorization (RLS)**: organizer (matching anonymous session) can read+write their own tournament; **viewers get read-only access** to a tournament via its permanent `share_token`.

### 6.1 Data Model (Supabase / Postgres)

- **organizers** — id (anon session id), display_name, created_at.
- **tournaments** — id, organizer_id, name, format (single/double), status, share_token (permanent, read-only link), created_at.
- **players** — id, tournament_id, name.
- **teams** — id, tournament_id, name, player_1_id, player_2_id, wins, total_score, status (active/eliminated).
- **matches** — id, tournament_id, bracket (winners/losers/grand_final), round, slot, team_a_id, team_b_id, score_a, score_b, winner_id, next_match_id, loser_next_match_id, is_bye, status.

**RLS sketch**: write where `organizer_id = current anonymous session`; read where session matches **or** request carries a valid `share_token`.

## 7. Key Screens

1. First-run: choose your name
2. Player setup
3. Team generation/reshuffle
4. Format selection (single/double)
5. Bracket view (interactive, score-to-21 entry)
6. Leaderboard
7. Champion/results
8. Viewer (read-only) bracket + leaderboard

## 8. Out of Scope (MVP)

- Offline editing/sync, multiple concurrent tournaments per organizer, custom team sizes (≠2), historical archives, viewer accounts, export, cross-device organizer sync.

## 9. Resolved Decisions

- Identity: anonymous session tied to device; user picks their own name.
- Player counts: even only (12/14/16); no odd counts.
- Match scoring: games to 21.
- Viewers: permanent read-only share link.
- Total score: sum of a team's per-match scores.
- Tiebreak: wins, then total score (no further tiebreak).
- Byes: skipped — no point, no score.
