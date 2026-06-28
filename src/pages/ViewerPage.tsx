import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicTournament, getPublicPlayerStandings, subscribeToUpdates } from '../lib/db';
import { BracketView } from '../components/BracketView';
import { Leaderboard, type PlayerStanding } from '../components/Leaderboard';

interface TournamentData {
  tournament: Record<string, unknown>;
  teams: Array<Record<string, unknown>>;
  matches: Array<Record<string, unknown>>;
  players: Array<{ id: string; name: string }>;
}

export function ViewerPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [data, setData] = useState<TournamentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'bracket' | 'leaderboard'>('bracket');
  const [offline, setOffline] = useState(false);
  const [playerStandings, setPlayerStandings] = useState<PlayerStanding[]>([]);

  const fetchData = useCallback(async () => {
    if (!shareToken) return;
    try {
      const [result, standings] = await Promise.all([
        getPublicTournament(shareToken),
        getPublicPlayerStandings().catch(() => []),
      ]);
      if (result) {
        setData(result);
        if (standings) setPlayerStandings(standings);
        setError(null);
        setOffline(false);
      } else {
        setError('Tournament not found');
      }
    } catch {
      setOffline(true);
    }
  }, [shareToken]);

  useEffect(() => {
    fetchData();

    // Poll every 8 seconds as safety net
    const interval = setInterval(fetchData, 8000);

    // Subscribe to broadcast updates
    let unsubscribe: (() => void) | undefined;
    if (shareToken) {
      unsubscribe = subscribeToUpdates(shareToken, fetchData);
    }

    return () => {
      clearInterval(interval);
      unsubscribe?.();
    };
  }, [shareToken, fetchData]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-2">{error}</p>
          <p className="text-slate-400 text-sm">Check the link and try again.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading tournament...</div>
      </div>
    );
  }

  const tournament = data.tournament;
  const teams = data.teams as Array<{
    id: string; name: string; seed: number;
    player_1_id: string; player_2_id: string;
    wins: number; total_score: number; status: string;
  }>;
  const matches = data.matches as Array<{
    id: string; bracket: 'winners' | 'losers' | 'grand_final';
    round: number; slot: number;
    team_a_id: string | null; team_b_id: string | null;
    score_a: number | null; score_b: number | null;
    winner_id: string | null; is_bye: boolean; status: string;
    next_match_id: string | null;
  }>;
  const championTeamId = tournament.champion_team_id as string | null;

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        {offline && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-3 mb-4 text-center">
            <p className="text-amber-400 text-sm">Reconnecting... Showing last known data.</p>
          </div>
        )}

        <div className="mb-4">
          <h1 className="text-xl font-bold text-white">{tournament.name as string}</h1>
          <p className="text-slate-400 text-sm">
            {tournament.format === 'single' ? 'Single' : 'Double'} Elimination
            {tournament.status === 'complete' && ' — Complete'}
            <span className="ml-2 text-slate-500">· Live view</span>
          </p>
        </div>

        {/* Champion banner */}
        {tournament.status === 'complete' && championTeamId && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-2xl p-6 mb-6 text-center">
            <p className="text-yellow-400 text-sm font-semibold uppercase mb-1">Champion</p>
            <p className="text-2xl font-bold text-white">
              {teams.find(t => t.id === championTeamId)?.name}
            </p>
          </div>
        )}

        {/* View toggle */}
        <div className="flex gap-1 mb-4 bg-slate-800 rounded-xl p-1">
          <button
            onClick={() => setActiveView('bracket')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              activeView === 'bracket' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Bracket
          </button>
          <button
            onClick={() => setActiveView('leaderboard')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              activeView === 'leaderboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Leaderboard
          </button>
        </div>

        {activeView === 'bracket' ? (
          <BracketView matches={matches} teams={teams} readOnly />
        ) : (
          <Leaderboard teams={teams} players={data.players} championTeamId={championTeamId} playerStandings={playerStandings} />
        )}
      </div>
    </div>
  );
}
