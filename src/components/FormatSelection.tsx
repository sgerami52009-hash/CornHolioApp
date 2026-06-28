import type { Format } from '../bracket';

interface Props {
  onSelect: (format: Format) => void;
  onBack: () => void;
  loading: boolean;
}

export function FormatSelection({ onSelect, onBack, loading }: Props) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">Tournament Format</h1>
        <p className="text-slate-400 mb-8 text-center">Choose your bracket type</p>

        <div className="space-y-4 mb-8">
          <button
            onClick={() => onSelect('single')}
            disabled={loading}
            className="w-full p-6 rounded-2xl bg-slate-800 border-2 border-slate-700 hover:border-blue-500 transition text-left disabled:opacity-50"
          >
            <h2 className="text-xl font-bold text-white mb-1">Single Elimination</h2>
            <p className="text-slate-400 text-sm">One loss and you're out. Fast and intense.</p>
          </button>

          <button
            onClick={() => onSelect('double')}
            disabled={loading}
            className="w-full p-6 rounded-2xl bg-slate-800 border-2 border-slate-700 hover:border-blue-500 transition text-left disabled:opacity-50"
          >
            <h2 className="text-xl font-bold text-white mb-1">Double Elimination</h2>
            <p className="text-slate-400 text-sm">Two losses to be eliminated. More games, more chances.</p>
          </button>
        </div>

        <button
          onClick={onBack}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-slate-700 text-slate-300 font-semibold hover:bg-slate-600 transition disabled:opacity-50"
        >
          {loading ? 'Creating bracket...' : 'Back'}
        </button>
      </div>
    </div>
  );
}
