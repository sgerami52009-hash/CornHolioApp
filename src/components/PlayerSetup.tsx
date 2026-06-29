import { useState } from 'react';

const PLAYER_COUNTS = [8, 10, 12, 14, 16] as const;

interface Props {
  existingPlayers?: string[];
  onComplete: (names: string[]) => void;
  onClearHistory?: () => void;
}

export function PlayerSetup({ existingPlayers = [], onComplete, onClearHistory }: Props) {
  const [playerCount, setPlayerCount] = useState<8 | 10 | 12 | 14 | 16>(12);
  const [names, setNames] = useState<string[]>(() => Array(16).fill(''));
  const [errors, setErrors] = useState<string[]>([]);
  const [showExisting, setShowExisting] = useState(false);
  const [confirmDeleteHistory, setConfirmDeleteHistory] = useState(false);

  function handleCountChange(count: 8 | 10 | 12 | 14 | 16) {
    setPlayerCount(count);
    setErrors([]);
  }

  function handleNameChange(index: number, value: string) {
    setNames(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function addExistingPlayer(playerName: string) {
    // Find the first empty slot within the current player count
    setNames(prev => {
      const next = [...prev];
      for (let i = 0; i < playerCount; i++) {
        if (!next[i].trim()) {
          next[i] = playerName;
          break;
        }
      }
      return next;
    });
  }

  function fillAllExisting() {
    setNames(prev => {
      const next = [...prev];
      let existIdx = 0;
      for (let i = 0; i < playerCount && existIdx < existingPlayers.length; i++) {
        if (!next[i].trim()) {
          next[i] = existingPlayers[existIdx];
          existIdx++;
        }
      }
      return next;
    });
  }

  function clearAll() {
    setNames(Array(16).fill(''));
    setErrors([]);
  }

  function validate(): boolean {
    const errs: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < playerCount; i++) {
      const trimmed = names[i].trim();
      if (!trimmed) {
        errs.push(`Player ${i + 1}: Name required`);
      } else if (trimmed.length > 40) {
        errs.push(`Player ${i + 1}: Max 40 characters`);
      } else if (seen.has(trimmed.toLowerCase())) {
        errs.push(`Player ${i + 1}: Duplicate name "${trimmed}"`);
      } else {
        seen.add(trimmed.toLowerCase());
      }
    }
    setErrors(errs);
    return errs.length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) {
      onComplete(names.slice(0, playerCount).map(n => n.trim()));
    }
  }

  // Players already in the name fields
  const usedNames = new Set(
    names.slice(0, playerCount).map(n => n.trim().toLowerCase()).filter(Boolean)
  );
  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Player Setup</h1>

        <div className="flex gap-2 mb-4">
          {PLAYER_COUNTS.map(c => (
            <button
              key={c}
              onClick={() => handleCountChange(c)}
              className={`flex-1 py-2 rounded-xl font-semibold transition ${
                playerCount === c
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {c} Players
            </button>
          ))}
        </div>

        {/* Existing players panel */}
        {existingPlayers.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowExisting(!showExisting)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-300 hover:border-slate-500 transition"
            >
              <span>Previous Players ({existingPlayers.length})</span>
              <span className="text-slate-500">{showExisting ? '▲' : '▼'}</span>
            </button>

            {showExisting && (
              <div className="mt-2 bg-slate-800 rounded-xl border border-slate-700 p-3">
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={fillAllExisting}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
                  >
                    Fill All
                  </button>
                  <button
                    onClick={clearAll}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-600 transition"
                  >
                    Clear All
                  </button>
                  {onClearHistory && (
                    confirmDeleteHistory ? (
                      <>
                        <button
                          onClick={() => { onClearHistory(); setConfirmDeleteHistory(false); }}
                          className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition"
                        >
                          Confirm Delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteHistory(false)}
                          className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-600 transition"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteHistory(true)}
                        className="px-3 py-1.5 rounded-lg bg-slate-700 text-red-400 text-xs font-semibold hover:bg-slate-600 transition"
                      >
                        Delete History
                      </button>
                    )
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {existingPlayers.map(name => {
                    const isUsed = usedNames.has(name.toLowerCase());
                    return (
                      <button
                        key={name}
                        onClick={() => !isUsed && addExistingPlayer(name)}
                        disabled={isUsed}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          isUsed
                            ? 'bg-green-900/30 text-green-400 cursor-default'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 cursor-pointer'
                        }`}
                      >
                        {isUsed ? '✓ ' : ''}{name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-2 mb-4">
            {Array.from({ length: playerCount }, (_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-slate-400 text-sm w-6 text-right">{i + 1}.</span>
                <input
                  type="text"
                  value={names[i]}
                  onChange={e => handleNameChange(i, e.target.value)}
                  placeholder={`Player ${i + 1}`}
                  maxLength={40}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-700 text-white placeholder-slate-500 border border-slate-600 focus:border-blue-500 focus:outline-none text-sm"
                />
                {names[i].trim() && (
                  <button
                    type="button"
                    onClick={() => handleNameChange(i, '')}
                    className="text-slate-500 hover:text-slate-300 px-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {errors.length > 0 && (
            <div className="bg-red-900/30 border border-red-700 rounded-xl p-3 mb-4">
              {errors.map((err, i) => (
                <p key={i} className="text-red-400 text-sm">{err}</p>
              ))}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
          >
            Next: Create Teams
          </button>
        </form>
      </div>
    </div>
  );
}
