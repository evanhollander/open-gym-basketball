import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useGameDispatch, useGameState } from '../state/context';

export function AddPlayerForm() {
  const state = useGameState();
  const dispatch = useGameDispatch();
  const [name, setName] = useState('');
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const prevCount = useRef(state.players.length);

  // Watches the roster count rather than reacting inline in handleSubmit -
  // ADD_PLAYER's validation (duplicate name, too short, max players) lives
  // in gameLogic.ts and fails by setting state.lastError, which the
  // reducer swallows before it ever reaches this component, so a
  // dispatch() call here has no way to tell success from failure directly.
  // A genuine increase in player count only happens on a real add, which
  // also naturally excludes REMOVE_PLAYER (count only ever goes down there).
  // This intentionally doesn't scroll the newly added row into view (that
  // would fight the far more common bulk-add workflow - scrolling to the
  // bottom after every single add would force a scroll back up before
  // typing the next name) - just a brief note right where the input
  // already has the user's attention.
  useEffect(() => {
    if (state.players.length > prevCount.current) {
      const newest = state.players[state.players.length - 1];
      setJustAdded(newest.name);
      const timer = setTimeout(() => setJustAdded(null), 2000);
      prevCount.current = state.players.length;
      return () => clearTimeout(timer);
    }
    prevCount.current = state.players.length;
  }, [state.players]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    dispatch({ type: 'ADD_PLAYER', name });
    setName('');
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player name"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-800"
        />
        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-2 text-white active:bg-blue-700"
        >
          Add
        </button>
      </form>
      {justAdded && (
        <p aria-live="polite" className="mt-1 text-sm text-green-700 dark:text-green-400">
          Added {justAdded}
        </p>
      )}
    </div>
  );
}
