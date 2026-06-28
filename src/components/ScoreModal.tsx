import { useState } from 'react';

interface Props {
  teamAName: string;
  teamBName: string;
  onSubmit: (scoreA: number, scoreB: number) => void;
  onClose: () => void;
}

export function ScoreModal({ teamAName, teamBName, onSubmit, onClose }: Props) {
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const a = parseInt(scoreA, 10);
    const b = parseInt(scoreB, 10);
    if (isNaN(a) || isNaN(b)) {
      setError('Enter both scores');
      return;
    }
    if (a < 0 || b < 0) {
      setError('Scores must be non-negative');
      return;
    }
    if (a === b) {
      setError('Scores cannot be tied — one team must win');
      return;
    }
    onSubmit(a, b);
  }

  const a = parseInt(scoreA, 10);
  const b = parseInt(scoreB, 10);
  const hasScores = !isNaN(a) && !isNaN(b) && a >= 0 && b >= 0;
  const winnerLabel = hasScores && a !== b
    ? (a > b ? teamAName : teamBName)
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
      >
        <h2 className="text-xl font-bold text-white mb-4 text-center">Enter Score</h2>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-slate-400 text-sm block mb-1">{teamAName}</label>
            <input
              type="number"
              min="0"
              value={scoreA}
              onChange={e => { setScoreA(e.target.value); setError(''); }}
              autoFocus
              placeholder="Score"
              className="w-full px-4 py-3 rounded-xl bg-slate-700 text-white border border-slate-600 focus:border-blue-500 focus:outline-none text-center text-2xl font-bold"
            />
          </div>

          <div className="text-center text-slate-500 text-sm font-semibold">vs</div>

          <div>
            <label className="text-slate-400 text-sm block mb-1">{teamBName}</label>
            <input
              type="number"
              min="0"
              value={scoreB}
              onChange={e => { setScoreB(e.target.value); setError(''); }}
              placeholder="Score"
              className="w-full px-4 py-3 rounded-xl bg-slate-700 text-white border border-slate-600 focus:border-blue-500 focus:outline-none text-center text-2xl font-bold"
            />
          </div>
        </div>

        {winnerLabel && (
          <p className="text-green-400 text-sm text-center mb-3 font-semibold">
            Winner: {winnerLabel}
          </p>
        )}

        {error && <p className="text-red-400 text-sm mb-3 text-center">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-semibold hover:bg-slate-600 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!hasScores || a === b}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}
