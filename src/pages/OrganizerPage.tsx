import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { useTournament } from '../lib/useTournament';
import { getPlayerStandings, resetPlayerStandings } from '../lib/db';
import { NamePrompt } from '../components/NamePrompt';
import { PlayerSetup } from '../components/PlayerSetup';
import { TeamGeneration } from '../components/TeamGeneration';
import { FormatSelection } from '../components/FormatSelection';
import { BracketView } from '../components/BracketView';
import { Leaderboard, type PlayerStanding } from '../components/Leaderboard';
import type { Format } from '../bracket';

type Step = 'players' | 'teams' | 'format' | 'bracket';

export function OrganizerPage() {
  const { user, displayName, loading: authLoading } = useAuth();
  const { state, loading, startTournament, submitScore, reset } = useTournament();
  const [step, setStep] = useState<Step>('players');
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  const [teamDefs, setTeamDefs] = useState<Array<{ name: string; player1Index: number; player2Index: number }>>([]);
  const [activeView, setActiveView] = useState<'bracket' | 'leaderboard'>('bracket');
  const [tournamentName] = useState('Cornhole Tournament');
  const [copied, setCopied] = useState(false);
  const [playerStandings, setPlayerStandings] = useState<PlayerStanding[]>([]);

  const fetchStandings = useCallback(async () => {
    try {
      const data = await getPlayerStandings();
      if (data) setPlayerStandings(data);
    } catch {
      // Non-critical, silently fail
    }
  }, []);

  useEffect(() => {
    fetchStandings();
  }, [fetchStandings, state.status, state.matches]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!displayName) {
    return <NamePrompt />;
  }

  // Tournament is in progress or complete
  if (state.status !== 'setup' && state.tournamentId) {
    const shareUrl = `${window.location.origin}/t/${state.shareToken}`;

    return (
      <div className="min-h-screen bg-slate-900 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-white">{tournamentName}</h1>
              <p className="text-slate-400 text-sm">
                {state.format === 'single' ? 'Single' : 'Double'} Elimination
                {state.status === 'complete' && ' — Complete'}
              </p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className={`px-3 py-2 rounded-lg text-sm transition ${
                copied ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              title="Copy share link"
            >
              {copied ? 'Copied!' : 'Share Link'}
            </button>
          </div>

          {/* Champion banner */}
          {state.status === 'complete' && state.championTeamId && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-2xl p-6 mb-6 text-center">
              <p className="text-yellow-400 text-sm font-semibold uppercase mb-1">Champion</p>
              <p className="text-2xl font-bold text-white">
                {state.teams.find(t => t.id === state.championTeamId)?.name}
              </p>
              <button
                onClick={() => {
                  reset();
                  setStep('players');
                  setPlayerNames([]);
                  setTeamDefs([]);
                  setActiveView('bracket');
                  fetchStandings();
                }}
                className="mt-4 px-6 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
              >
                New Tournament
              </button>
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
            <BracketView
              matches={state.matches as never[]}
              teams={state.teams}
              onScore={submitScore}
            />
          ) : (
            <Leaderboard
              teams={state.teams as never[]}
              players={state.players}
              championTeamId={state.championTeamId}
              playerStandings={playerStandings}
              onResetStandings={async () => {
                await resetPlayerStandings();
                setPlayerStandings([]);
              }}
            />
          )}

          {loading && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full text-sm shadow-lg">
              Updating...
            </div>
          )}
        </div>
      </div>
    );
  }

  // Setup flow
  if (step === 'players') {
    return (
      <PlayerSetup
        existingPlayers={playerStandings.map(p => p.player_name)}
        onComplete={(names) => {
          setPlayerNames(names);
          setStep('teams');
        }}
        onClearHistory={async () => {
          await resetPlayerStandings();
          setPlayerStandings([]);
        }}
      />
    );
  }

  if (step === 'teams') {
    return (
      <TeamGeneration
        playerNames={playerNames}
        onComplete={(teams) => {
          setTeamDefs(teams);
          setStep('format');
        }}
        onBack={() => setStep('players')}
      />
    );
  }

  if (step === 'format') {
    return (
      <FormatSelection
        loading={loading}
        onSelect={async (format: Format) => {
          if (!user) return;
          await startTournament(user.id, tournamentName, format, playerNames, teamDefs);
          setStep('bracket');
        }}
        onBack={() => setStep('teams')}
      />
    );
  }

  return null;
}
