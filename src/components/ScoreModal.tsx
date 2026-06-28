import { useState } from 'react';

interface Props {
  teamAName: string;
  teamBName: string;
  onSubmit: (scoreA: number, scoreB: number) => void;
  onClose: () => void;
}

export function ScoreModal({ teamAName, teamBName, onSubmit, onClose }: Props) {
  const [winner, setWinner] = useState<'a' | 'b' | null>(null);
  const [loserScore, setLoserScore] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!winner) {
      setError('Select a winner');
      return;
    }
    const score = parseInt(loserScore, 10);
    if (isNaN(score) || score < 0 || score > 20) {
      setError('Loser score must be 0-20');
      return;
    }
    const scoreA = winner === 'a' ? 21 : score;
    const scoreB = winner === 'b' ? 21 : score;
    onSubmit(scoreA, scoreB);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
      >
        <h2 className="text-xl font-bold text-white mb-4 text-center">Enter Score</h2>

        <p className="text-slate-400 text-sm mb-4 text-center">Who won?</p>

        <div className="space-y-2 mb-4">
          <button
            type="button"
            onClick={() => { setWinner('a'); setError(''); }}
            className={`w-full p-3 rounded-xl font-semibold transition text-left ${
              winner === 'a'
                ? 'bg-green-600 text-white border-2 border-green-400'
                : 'bg-slate-700 text-slate-300 border-2 border-slate-600 hover:border-slate-500'
            }`}
          >
            {teamAName}
            {winner === 'a' && <span className="float-right">21</span>}
          </button>

          <button
            type="button"
            onClick={() => { setWinner('b'); setError(''); }}
            className={`w-full p-3 rounded-xl font-semibold transition text-left ${
              winner === 'b'
                ? 'bg-green-600 text-white border-2 border-green-400'
                : 'bg-slate-700 text-slate-300 border-2 border-slate-600 hover:border-slate-500'
            }`}
          >
            {teamBName}
            {winner === 'b' && <span className="float-right">21</span>}
          </button>
        </div>

        {winner && (
          <div className="mb-4">
            <label className="text-slate-400 text-sm block mb-1">
              {winner === 'a' ? teamBName : teamAName}'s score (0-20)
            </label>
            <input
              type="number"
              min="0"
              max="20"
              value={loserScore}
              onChange={e => { setLoserScore(e.target.value); setError(''); }}
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-slate-700 text-white border border-slate-600 focus:border-blue-500 focus:outline-none text-center text-2xl font-bold"
            />
          </div>
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
            disabled={!winner}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}
