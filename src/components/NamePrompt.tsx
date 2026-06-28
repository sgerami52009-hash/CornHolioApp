import { useState } from 'react';
import { useAuth } from '../lib/auth';

export function NamePrompt() {
  const { setDisplayName } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 40) {
      setError('Name must be 1-40 characters');
      return;
    }
    setSaving(true);
    try {
      await setDisplayName(trimmed);
    } catch (err) {
      console.error('setDisplayName failed:', err);
      setError('Failed to save name. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-8 w-full max-w-sm shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-2">Welcome!</h1>
        <p className="text-slate-400 mb-6">What should we call you?</p>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setError(''); }}
          placeholder="Your name"
          maxLength={40}
          autoFocus
          className="w-full px-4 py-3 rounded-xl bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:border-blue-500 focus:outline-none mb-2"
        />
        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full mt-4 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
