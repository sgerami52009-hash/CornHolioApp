import { useState } from 'react';

interface TeamData {
  id: string;
  name: string;
  player_1_id: string;
  player_2_id: string;
  wins: number;
  total_score: number;
  status: string;
}

interface PlayerData {
  id: string;
  name: string;
}

export interface PlayerStanding {
  player_name: string;
  total_wins: number;
  tournaments_played: number;
}

interface Props {
  teams: TeamData[];
  players: PlayerData[];
  championTeamId?: string | null;
  playerStandings?: PlayerStanding[];
  onResetStandings?: () => void;
}

function getPlayerNames(team: TeamData, players: PlayerData[]): string {
  const p1 = players.find(p => p.id === team.player_1_id)?.name ?? '?';
  const p2 = players.find(p => p.id === team.player_2_id)?.name ?? '?';
  return `${p1} & ${p2}`;
}

export function Leaderboard({ teams, players, championTeamId, playerStandings, onResetStandings }: Props) {
  const [view, setView] = useState<'tournament' | 'alltime'>('tournament');

  const sorted = [...teams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.total_score - a.total_score;
  });

  return (
    <div>
      {/* View toggle */}
      {playerStandings && playerStandings.length > 0 && (
        <div className="flex gap-1 mb-4 bg-slate-800 rounded-xl p-1">
          <button
            onClick={() => setView('tournament')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              view === 'tournament' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            This Tournament
          </button>
          <button
            onClick={() => setView('alltime')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              view === 'alltime' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            All-Time
          </button>
        </div>
      )}

      {view === 'alltime' && playerStandings ? (
        <AllTimeLeaderboard standings={playerStandings} onReset={onResetStandings} />
      ) : (
        <TournamentLeaderboard teams={sorted} players={players} championTeamId={championTeamId} />
      )}
    </div>
  );
}

function TournamentLeaderboard({
  teams,
  players,
  championTeamId,
}: {
  teams: TeamData[];
  players: PlayerData[];
  championTeamId?: string | null;
}) {
  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left text-slate-400 text-xs font-semibold p-3 w-8">#</th>
            <th className="text-left text-slate-400 text-xs font-semibold p-3">Team</th>
            <th className="text-center text-slate-400 text-xs font-semibold p-3 w-12">W</th>
            <th className="text-center text-slate-400 text-xs font-semibold p-3 w-14">Pts</th>
            <th className="text-center text-slate-400 text-xs font-semibold p-3 w-16">Status</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, i) => (
            <tr
              key={team.id}
              className={`border-b border-slate-700/50 last:border-0 ${
                team.id === championTeamId ? 'bg-yellow-900/20' : ''
              }`}
            >
              <td className="p-3 text-slate-500 text-sm">{i + 1}</td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  {team.id === championTeamId && <span className="text-yellow-400">👑</span>}
                  <div>
                    <p className={`text-sm font-semibold ${
                      team.id === championTeamId ? 'text-yellow-400' : 'text-white'
                    }`}>{team.name}</p>
                    <p className="text-xs text-slate-400">{getPlayerNames(team, players)}</p>
                  </div>
                </div>
              </td>
              <td className="p-3 text-center text-white font-bold text-sm">{team.wins}</td>
              <td className="p-3 text-center text-slate-300 text-sm">{team.total_score}</td>
              <td className="p-3 text-center">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  team.id === championTeamId
                    ? 'bg-yellow-600/30 text-yellow-400'
                    : team.status === 'active'
                      ? 'bg-green-600/30 text-green-400'
                      : 'bg-red-600/30 text-red-400'
                }`}>
                  {team.id === championTeamId ? 'Champion' : team.status === 'active' ? 'Active' : 'Out'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AllTimeLeaderboard({ standings, onReset }: { standings: PlayerStanding[]; onReset?: () => void }) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div>
    <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left text-slate-400 text-xs font-semibold p-3 w-8">#</th>
            <th className="text-left text-slate-400 text-xs font-semibold p-3">Player</th>
            <th className="text-center text-slate-400 text-xs font-semibold p-3 w-14">Wins</th>
            <th className="text-center text-slate-400 text-xs font-semibold p-3 w-20">Tournaments</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr key={s.player_name} className="border-b border-slate-700/50 last:border-0">
              <td className="p-3 text-slate-500 text-sm">{i + 1}</td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  {i === 0 && standings.length > 1 && <span className="text-yellow-400">👑</span>}
                  <span className={`text-sm font-semibold ${i === 0 ? 'text-yellow-400' : 'text-white'}`}>
                    {s.player_name}
                  </span>
                </div>
              </td>
              <td className="p-3 text-center text-white font-bold text-sm">{s.total_wins}</td>
              <td className="p-3 text-center text-slate-300 text-sm">{s.tournaments_played}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {onReset && (
      <div className="mt-4">
        {confirmReset ? (
          <div className="flex gap-2 items-center justify-center bg-red-900/20 border border-red-700 rounded-xl p-4">
            <p className="text-red-400 text-sm">Reset all player standings?</p>
            <button
              onClick={() => { onReset(); setConfirmReset(false); }}
              className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
            >
              Yes, Reset
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="px-4 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-600 transition"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="w-full py-2 rounded-xl bg-slate-800 border border-slate-700 text-red-400 text-sm font-semibold hover:border-red-700 transition"
          >
            Reset All-Time Standings
          </button>
        )}
      </div>
    )}
    </div>
  );
}
