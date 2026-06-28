import { supabase } from './supabase';
import type { Format, EngineMatch } from '../bracket';

// ---- Tournament CRUD ----

export async function createTournament(organizerId: string, name: string, format: Format) {
  const { data, error } = await supabase
    .from('tournaments')
    .insert({ organizer_id: organizerId, name, format })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getTournament(id: string) {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getOrganizerTournaments(organizerId: string) {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateTournamentStatus(id: string, status: string, championTeamId?: string) {
  const update: Record<string, unknown> = { status };
  if (championTeamId) update.champion_team_id = championTeamId;
  const { error } = await supabase.from('tournaments').update(update).eq('id', id);
  if (error) throw error;
}

// ---- Players ----

export async function createPlayers(tournamentId: string, names: string[]) {
  const rows = names.map(name => ({ tournament_id: tournamentId, name }));
  const { data, error } = await supabase.from('players').insert(rows).select();
  if (error) throw error;
  return data;
}

export async function getPlayers(tournamentId: string) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('tournament_id', tournamentId);
  if (error) throw error;
  return data;
}

// ---- Teams ----

export interface TeamInsert {
  tournament_id: string;
  name: string;
  player_1_id: string;
  player_2_id: string;
  seed: number;
}

export async function createTeams(teams: TeamInsert[]) {
  const { data, error } = await supabase.from('teams').insert(teams).select();
  if (error) throw error;
  return data;
}

export async function getTeams(tournamentId: string) {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('seed');
  if (error) throw error;
  return data;
}

export async function updateTeamStats(
  teamId: string,
  updates: { wins?: number; total_score?: number; status?: string },
) {
  const { error } = await supabase.from('teams').update(updates).eq('id', teamId);
  if (error) throw error;
}

// ---- Matches ----

export interface MatchInsert {
  tournament_id: string;
  bracket: string;
  round: number;
  slot: number;
  team_a_id: string | null;
  team_b_id: string | null;
  is_bye: boolean;
  status: string;
  next_match_id: string | null;
  next_match_slot: string | null;
  loser_next_match_id: string | null;
  loser_next_slot: string | null;
  score_a: number | null;
  score_b: number | null;
  winner_id: string | null;
}

export async function createMatches(matches: MatchInsert[]) {
  // Insert matches without FK references first (next_match_id, loser_next_match_id)
  const firstPass = matches.map(m => ({
    tournament_id: m.tournament_id,
    bracket: m.bracket,
    round: m.round,
    slot: m.slot,
    team_a_id: m.team_a_id,
    team_b_id: m.team_b_id,
    is_bye: m.is_bye,
    status: m.status,
    score_a: m.score_a,
    score_b: m.score_b,
    winner_id: m.winner_id,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('matches')
    .insert(firstPass)
    .select();
  if (insertError) throw insertError;

  return inserted;
}

export async function updateMatchLinks(
  _tournamentId: string,
  engineMatches: EngineMatch[],
  dbMatches: Array<{ id: string; bracket: string; round: number; slot: number }>,
) {
  // Build a key->dbId map
  const keyToDbId = new Map<string, string>();
  for (const dbm of dbMatches) {
    const prefix = dbm.bracket === 'winners' ? 'W' : dbm.bracket === 'losers' ? 'L' : 'GF';
    const key = `${prefix}-${dbm.round}-${dbm.slot}`;
    keyToDbId.set(key, dbm.id);
  }

  // Update each match with next_match_id and loser_next_match_id
  for (const em of engineMatches) {
    const dbId = keyToDbId.get(em.key);
    if (!dbId) continue;

    const updates: Record<string, unknown> = {};
    if (em.nextMatchKey) {
      updates.next_match_id = keyToDbId.get(em.nextMatchKey) ?? null;
      updates.next_match_slot = em.nextMatchSlot;
    }
    if (em.loserNextMatchKey) {
      updates.loser_next_match_id = keyToDbId.get(em.loserNextMatchKey) ?? null;
      updates.loser_next_slot = em.loserNextSlot;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('matches').update(updates).eq('id', dbId);
      if (error) throw error;
    }
  }
}

export async function getMatches(tournamentId: string) {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('bracket')
    .order('round')
    .order('slot');
  if (error) throw error;
  return data;
}

export async function updateMatch(
  matchId: string,
  updates: {
    team_a_id?: string | null;
    team_b_id?: string | null;
    score_a?: number | null;
    score_b?: number | null;
    winner_id?: string | null;
    status?: string;
  },
) {
  const { error } = await supabase.from('matches').update(updates).eq('id', matchId);
  if (error) throw error;
}

// ---- Player Standings (cross-tournament) ----

export async function upsertPlayerWins(playerName: string, winsToAdd: number) {
  // Try to update first
  const { data: existing } = await supabase
    .from('player_standings')
    .select('id, total_wins')
    .eq('player_name', playerName)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('player_standings')
      .update({ total_wins: existing.total_wins + winsToAdd })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('player_standings')
      .insert({ player_name: playerName, total_wins: winsToAdd, tournaments_played: 0 });
    if (error) throw error;
  }
}

export async function incrementTournamentsPlayed(playerNames: string[]) {
  for (const name of playerNames) {
    const { data: existing } = await supabase
      .from('player_standings')
      .select('id, tournaments_played')
      .eq('player_name', name)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('player_standings')
        .update({ tournaments_played: existing.tournaments_played + 1 })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('player_standings')
        .insert({ player_name: name, total_wins: 0, tournaments_played: 1 });
      if (error) throw error;
    }
  }
}

export async function getPlayerStandings() {
  const { data, error } = await supabase
    .from('player_standings')
    .select('*')
    .order('total_wins', { ascending: false })
    .order('player_name');
  if (error) throw error;
  return data;
}

export async function resetPlayerStandings() {
  const { error } = await supabase
    .from('player_standings')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows
  if (error) throw error;
}

export async function getPublicPlayerStandings() {
  const { data, error } = await supabase.rpc('get_player_standings');
  if (error) throw error;
  return data;
}

// ---- Public tournament (viewer) ----

export async function getPublicTournament(shareToken: string) {
  const { data, error } = await supabase.rpc('get_public_tournament', {
    p_share_token: shareToken,
  });
  if (error) throw error;
  return data;
}

// ---- Realtime broadcast ----

export function broadcastUpdate(shareToken: string) {
  const channel = supabase.channel(`tournament:${shareToken}`);
  channel.send({
    type: 'broadcast',
    event: 'update',
    payload: { ts: Date.now() },
  });
}

export function subscribeToUpdates(shareToken: string, callback: () => void) {
  const channel = supabase.channel(`tournament:${shareToken}`);
  channel
    .on('broadcast', { event: 'update' }, () => callback())
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
