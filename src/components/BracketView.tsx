import { useState } from 'react';
import { ScoreModal } from './ScoreModal';
import type { BracketKind } from '../bracket';

interface MatchData {
  id: string;
  bracket: BracketKind;
  round: number;
  slot: number;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number | null;
  score_b: number | null;
  winner_id: string | null;
  is_bye: boolean;
  status: string;
  next_match_id: string | null;
}

interface TeamData {
  id: string;
  name: string;
  seed: number;
}

interface Props {
  matches: MatchData[];
  teams: TeamData[];
  onScore?: (matchKey: string, dbMatchId: string, scoreA: number, scoreB: number) => void;
  readOnly?: boolean;
}

function getTeamName(teams: TeamData[], id: string | null): string {
  if (!id) return 'TBD';
  return teams.find(t => t.id === id)?.name ?? 'TBD';
}

function matchKey(m: { bracket: string; round: number; slot: number }): string {
  const prefix = m.bracket === 'winners' ? 'W' : m.bracket === 'losers' ? 'L' : 'GF';
  return `${prefix}-${m.round}-${m.slot}`;
}

// Deterministic "coin flip" for first throw based on match id
function firstThrow(matchId: string): 'a' | 'b' {
  let hash = 0;
  for (let i = 0; i < matchId.length; i++) {
    hash = ((hash << 5) - hash + matchId.charCodeAt(i)) | 0;
  }
  return (hash & 1) === 0 ? 'a' : 'b';
}

function canEditMatch(match: MatchData, allMatches: MatchData[]): boolean {
  if (match.status !== 'complete') return false;
  // Can edit if no dependent match has started (has a result)
  // A match is editable if no match that received the winner has been completed
  const downstream = allMatches.filter(m => {
    // Matches where this match's winner went
    return (m.team_a_id === match.winner_id || m.team_b_id === match.winner_id) &&
      m.id !== match.id && m.status === 'complete';
  });
  return downstream.length === 0;
}

export function BracketView({ matches, teams, onScore, readOnly }: Props) {
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);
  const [activeTab, setActiveTab] = useState<BracketKind>('winners');

  const brackets = ['winners', 'losers', 'grand_final'] as const;
  const availableBrackets = brackets.filter(b => matches.some(m => m.bracket === b));

  const filteredMatches = matches.filter(m => m.bracket === activeTab);
  const rounds = [...new Set(filteredMatches.map(m => m.round))].sort((a, b) => a - b);

  function handleMatchClick(match: MatchData) {
    if (readOnly) return;
    if (match.is_bye) return;
    if (match.status === 'ready' || (match.status === 'complete' && canEditMatch(match, matches))) {
      setSelectedMatch(match);
    }
  }

  function handleScore(scoreA: number, scoreB: number) {
    if (!selectedMatch || !onScore) return;
    const key = matchKey(selectedMatch);
    onScore(key, selectedMatch.id, scoreA, scoreB);
    setSelectedMatch(null);
  }

  const roundLabel = (bracket: BracketKind, round: number, totalRounds: number) => {
    if (bracket === 'grand_final') return 'Grand Final';
    if (bracket === 'winners') {
      if (round === totalRounds) return 'W Finals';
      if (round === totalRounds - 1) return 'W Semis';
      return `W Round ${round}`;
    }
    return `L Round ${round}`;
  };

  return (
    <div>
      {/* Bracket tabs */}
      {availableBrackets.length > 1 && (
        <div className="flex gap-1 mb-4 bg-slate-800 rounded-xl p-1">
          {availableBrackets.map(b => (
            <button
              key={b}
              onClick={() => setActiveTab(b)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === b
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {b === 'winners' ? 'Winners' : b === 'losers' ? 'Losers' : 'Grand Final'}
            </button>
          ))}
        </div>
      )}

      {/* Matches by round */}
      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-4">
          {rounds.map(round => {
            const roundMatches = filteredMatches
              .filter(m => m.round === round)
              .sort((a, b) => a.slot - b.slot);

            return (
              <div key={round} className="min-w-[200px]">
                <h3 className="text-slate-400 text-xs font-semibold uppercase mb-2 text-center">
                  {roundLabel(activeTab, round, rounds.length)}
                </h3>
                <div className="space-y-2">
                  {roundMatches.map(match => (
                    <button
                      key={match.id}
                      onClick={() => handleMatchClick(match)}
                      disabled={readOnly || match.is_bye || (match.status !== 'ready' && !(match.status === 'complete' && canEditMatch(match, matches)))}
                      className={`w-full rounded-xl border-2 overflow-hidden transition ${
                        match.status === 'complete'
                          ? 'border-green-700 bg-slate-800/80'
                          : match.status === 'ready'
                            ? 'border-blue-600 bg-slate-800 hover:border-blue-400 cursor-pointer'
                            : 'border-slate-700 bg-slate-800/50 opacity-60'
                      } ${match.is_bye ? 'opacity-40' : ''}`}
                    >
                      {(() => {
                        const ft = !match.is_bye && match.status === 'ready' && match.team_a_id && match.team_b_id
                          ? firstThrow(match.id)
                          : null;
                        return (
                          <>
                            <div className={`px-3 py-2 flex justify-between items-center ${
                              match.winner_id === match.team_a_id && match.status === 'complete'
                                ? 'bg-green-900/30' : ''
                            }`}>
                              <span className={`text-sm truncate ${
                                match.winner_id === match.team_a_id ? 'text-green-400 font-bold' : 'text-white'
                              }`}>
                                {ft === 'a' && <span className="text-amber-400 text-xs mr-1">1st</span>}
                                {getTeamName(teams, match.team_a_id)}
                              </span>
                              {match.score_a !== null && (
                                <span className="text-sm font-mono text-slate-300 ml-2">{match.score_a}</span>
                              )}
                            </div>
                            <div className="border-t border-slate-700" />
                            <div className={`px-3 py-2 flex justify-between items-center ${
                              match.winner_id === match.team_b_id && match.status === 'complete'
                                ? 'bg-green-900/30' : ''
                            }`}>
                              <span className={`text-sm truncate ${
                                match.winner_id === match.team_b_id ? 'text-green-400 font-bold' : 'text-white'
                              }`}>
                                {ft === 'b' && <span className="text-amber-400 text-xs mr-1">1st</span>}
                                {match.is_bye ? 'BYE' : getTeamName(teams, match.team_b_id)}
                              </span>
                              {match.score_b !== null && (
                                <span className="text-sm font-mono text-slate-300 ml-2">{match.score_b}</span>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Score modal */}
      {selectedMatch && (
        <ScoreModal
          teamAName={getTeamName(teams, selectedMatch.team_a_id)}
          teamBName={getTeamName(teams, selectedMatch.team_b_id)}
          onSubmit={handleScore}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
}
