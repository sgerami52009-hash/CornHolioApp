import { useState, useCallback } from 'react';

interface TeamDef {
  name: string;
  player1Index: number;
  player2Index: number;
}

interface Props {
  playerNames: string[];
  onComplete: (teams: TeamDef[]) => void;
  onBack: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function generateTeams(playerNames: string[]): TeamDef[] {
  const indices = shuffle(Array.from({ length: playerNames.length }, (_, i) => i));
  const teams: TeamDef[] = [];
  for (let i = 0; i < indices.length; i += 2) {
    const p1 = indices[i];
    const p2 = indices[i + 1];
    teams.push({
      name: `${playerNames[p1]} & ${playerNames[p2]}`,
      player1Index: p1,
      player2Index: p2,
    });
  }
  return teams;
}

export function TeamGeneration({ playerNames, onComplete, onBack }: Props) {
  const [teams, setTeams] = useState<TeamDef[]>(() => generateTeams(playerNames));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const reshuffle = useCallback(() => {
    setTeams(generateTeams(playerNames));
    setEditingIndex(null);
  }, [playerNames]);

  function startEdit(index: number) {
    setEditingIndex(index);
    setEditName(teams[index].name);
  }

  function saveEdit(index: number) {
    const trimmed = editName.trim();
    if (trimmed && trimmed.length <= 60) {
      setTeams(prev => {
        const next = [...prev];
        next[index] = { ...next[index], name: trimmed };
        return next;
      });
    }
    setEditingIndex(null);
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Teams</h1>
        <p className="text-slate-400 mb-6">{teams.length} teams of 2. Tap a team name to edit.</p>

        <div className="space-y-2 mb-6">
          {teams.map((team, i) => (
            <div key={i} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-500 text-xs font-mono">Seed #{i + 1}</span>
              </div>
              {editingIndex === i ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveEdit(i)}
                    autoFocus
                    maxLength={60}
                    className="flex-1 px-3 py-1 rounded-lg bg-slate-700 text-white border border-blue-500 focus:outline-none text-sm"
                  />
                  <button
                    onClick={() => saveEdit(i)}
                    className="px-3 py-1 rounded-lg bg-blue-600 text-white text-sm"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => startEdit(i)}
                  className="text-white font-semibold text-left w-full hover:text-blue-400 transition"
                >
                  {team.name}
                </button>
              )}
              <p className="text-slate-400 text-sm mt-1">
                {playerNames[team.player1Index]} + {playerNames[team.player2Index]}
              </p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-semibold hover:bg-slate-600 transition"
          >
            Back
          </button>
          <button
            onClick={reshuffle}
            className="flex-1 py-3 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700 transition"
          >
            Reshuffle
          </button>
          <button
            onClick={() => onComplete(teams)}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
          >
            Lock & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
