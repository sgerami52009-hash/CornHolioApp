import { useState, useCallback } from 'react';
import {
  createTournament,
  createPlayers,
  createTeams,
  createMatches,
  updateMatchLinks,
  getTeams,
  getMatches,
  updateMatch,
  updateTeamStats,
  updateTournamentStatus,
  broadcastUpdate,
  upsertPlayerWins,
  incrementTournamentsPlayed,
  type TeamInsert,
  type MatchInsert,
} from './db';
import {
  generateBracket,
  resolveAllByes,
  applyResult,
  type SeededTeam,
  type Format,
  type Bracket,
} from '../bracket';

export interface TournamentState {
  tournamentId: string | null;
  shareToken: string | null;
  format: Format | null;
  status: 'setup' | 'in_progress' | 'complete';
  players: Array<{ id: string; name: string }>;
  teams: Array<{
    id: string;
    name: string;
    player_1_id: string;
    player_2_id: string;
    seed: number;
    wins: number;
    total_score: number;
    status: string;
  }>;
  matches: Array<Record<string, unknown>>;
  bracket: Bracket | null;
  engineResults: Record<string, { winnerId: string; scoreA: number; scoreB: number }>;
  championTeamId: string | null;
}

const initialState: TournamentState = {
  tournamentId: null,
  shareToken: null,
  format: null,
  status: 'setup',
  players: [],
  teams: [],
  matches: [],
  bracket: null,
  engineResults: {},
  championTeamId: null,
};

export function useTournament() {
  const [state, setState] = useState<TournamentState>(initialState);
  const [loading, setLoading] = useState(false);

  const startTournament = useCallback(async (
    organizerId: string,
    name: string,
    format: Format,
    playerNames: string[],
    teamDefs: Array<{ name: string; player1Index: number; player2Index: number }>,
  ) => {
    setLoading(true);
    try {
      // 1. Create tournament
      const tournament = await createTournament(organizerId, name, format);

      // 2. Create players
      const dbPlayers = await createPlayers(tournament.id, playerNames);

      // 3. Create teams
      const teamInserts: TeamInsert[] = teamDefs.map((td, i) => ({
        tournament_id: tournament.id,
        name: td.name,
        player_1_id: dbPlayers[td.player1Index].id,
        player_2_id: dbPlayers[td.player2Index].id,
        seed: i + 1,
      }));
      const dbTeams = await createTeams(teamInserts);

      // 4. Generate bracket
      const seededTeams: SeededTeam[] = dbTeams.map(t => ({ id: t.id, seed: t.seed }));
      const bracket = generateBracket(seededTeams, format);
      const engineResults: Record<string, { winnerId: string; scoreA: number; scoreB: number }> = {};
      resolveAllByes(bracket, engineResults);

      // 5. Persist matches
      const matchInserts: MatchInsert[] = bracket.matches.map(em => {
        const result = engineResults[em.key];
        const isResolved = !!result;
        return {
          tournament_id: tournament.id,
          bracket: em.bracket,
          round: em.round,
          slot: em.slot,
          team_a_id: em.teamA,
          team_b_id: em.teamB,
          is_bye: em.isBye,
          status: isResolved ? 'complete' : (em.teamA && em.teamB ? 'ready' : 'pending'),
          next_match_id: null,
          next_match_slot: em.nextMatchSlot,
          loser_next_match_id: null,
          loser_next_slot: em.loserNextSlot,
          score_a: isResolved ? result.scoreA : null,
          score_b: isResolved ? result.scoreB : null,
          winner_id: isResolved ? result.winnerId : null,
        };
      });

      const dbMatches = await createMatches(matchInserts);

      // 6. Update match links (next_match_id, loser_next_match_id)
      await updateMatchLinks(tournament.id, bracket.matches, dbMatches);

      // 7. Award 0.5 points to players who got a bye
      for (const [key, result] of Object.entries(engineResults)) {
        const em = bracket.matches.find(m => m.key === key);
        if (em?.isBye && result.winnerId) {
          const byeTeam = dbTeams.find(t => t.id === result.winnerId);
          if (byeTeam) {
            const byePlayers = dbPlayers.filter(
              p => p.id === byeTeam.player_1_id || p.id === byeTeam.player_2_id,
            );
            for (const player of byePlayers) {
              await upsertPlayerWins(player.name, 0.5);
            }
          }
        }
      }

      // 9. Track tournaments_played for all players
      await incrementTournamentsPlayed(playerNames);

      // 10. Set tournament status to in_progress
      await updateTournamentStatus(tournament.id, 'in_progress');

      // 11. Reload matches with links
      const fullMatches = await getMatches(tournament.id);

      setState({
        tournamentId: tournament.id,
        shareToken: tournament.share_token,
        format,
        status: 'in_progress',
        players: dbPlayers,
        teams: dbTeams,
        matches: fullMatches,
        bracket,
        engineResults,
        championTeamId: null,
      });

      broadcastUpdate(tournament.share_token);
    } finally {
      setLoading(false);
    }
  }, []);

  const submitScore = useCallback(async (
    matchKey: string,
    dbMatchId: string,
    scoreA: number,
    scoreB: number,
  ) => {
    if (!state.bracket || !state.tournamentId || !state.shareToken) return;

    setLoading(true);
    try {
      const result = applyResult(
        state.bracket,
        state.engineResults,
        matchKey,
        scoreA,
        scoreB,
      );

      // Determine winner
      const match = state.bracket.matches.find(m => m.key === matchKey)!;
      const winnerId = scoreA === 21 ? match.teamA! : match.teamB!;

      // Update the match in DB
      await updateMatch(dbMatchId, {
        score_a: scoreA,
        score_b: scoreB,
        winner_id: winnerId,
        status: 'complete',
      });

      // Update team stats
      const winnerTeam = state.teams.find(t => t.id === winnerId)!;
      await updateTeamStats(winnerId, {
        wins: winnerTeam.wins + 1,
        total_score: winnerTeam.total_score + (scoreA === 21 ? scoreA : scoreB),
      });

      const loserId = scoreA === 21 ? match.teamB! : match.teamA!;
      const loserTeam = state.teams.find(t => t.id === loserId)!;
      await updateTeamStats(loserId, {
        total_score: loserTeam.total_score + (scoreA === 21 ? scoreB : scoreA),
      });

      // Update per-player standings: both players on the winning team get +1 win
      const winnerTeamPlayers = state.players.filter(
        p => p.id === winnerTeam.player_1_id || p.id === winnerTeam.player_2_id,
      );
      for (const player of winnerTeamPlayers) {
        await upsertPlayerWins(player.name, 1);
      }

      // Update eliminated teams
      for (const eid of result.eliminatedTeamIds) {
        await updateTeamStats(eid, { status: 'eliminated' });
      }

      // Update downstream matches in DB
      for (const um of result.updatedMatches) {
        // Find the DB match by key pattern
        const dbm = state.matches.find(
          (m: Record<string, unknown>) =>
            m.bracket === um.bracket && m.round === um.round && m.slot === um.slot,
        );
        if (dbm) {
          const updates: Record<string, unknown> = {};
          if (um.teamA) updates.team_a_id = um.teamA;
          if (um.teamB) updates.team_b_id = um.teamB;

          // Check if both teams are now set -> ready
          const newA = um.teamA ?? (dbm.team_a_id as string | null);
          const newB = um.teamB ?? (dbm.team_b_id as string | null);
          if (newA && newB && !um.isBye) {
            updates.status = 'ready';
          }

          // If this is a bye that got auto-resolved
          if (um.isBye && state.engineResults[um.key]) {
            const byeResult = state.engineResults[um.key];
            updates.team_a_id = um.teamA;
            updates.is_bye = true;
            updates.status = 'complete';
            updates.score_a = byeResult.scoreA;
            updates.score_b = byeResult.scoreB;
            updates.winner_id = byeResult.winnerId;
          }

          await updateMatch(dbm.id as string, updates);
        }
      }

      // Update tournament if complete
      if (result.isComplete && result.championId) {
        await updateTournamentStatus(state.tournamentId, 'complete', result.championId);
      }

      // Reload state
      const [freshTeams, freshMatches] = await Promise.all([
        getTeams(state.tournamentId),
        getMatches(state.tournamentId),
      ]);

      setState(prev => ({
        ...prev,
        teams: freshTeams,
        matches: freshMatches,
        status: result.isComplete ? 'complete' : 'in_progress',
        championTeamId: result.championId,
      }));

      broadcastUpdate(state.shareToken);
    } finally {
      setLoading(false);
    }
  }, [state]);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return { state, loading, startTournament, submitScore, reset };
}
