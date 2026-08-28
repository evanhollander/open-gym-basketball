import { useGameState } from '../state/context';
import { AddPlayerForm } from './AddPlayerForm';
import { RosterRow } from './RosterRow';

export function RosterPanel() {
  const state = useGameState();

  return (
    <section className="mx-auto w-full max-w-md p-4">
      <h2 className="mb-3 text-lg font-semibold">All Players ({state.players.length})</h2>
      <AddPlayerForm />
      {state.lastError && (
        <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.lastError}
        </p>
      )}
      {state.lastNotice && (
        <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {state.lastNotice}
        </p>
      )}
      <ul className="mt-4">
        {state.players.map((player) => (
          <RosterRow key={player.id} player={player} />
        ))}
        {state.players.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No players yet - add your first player above.
          </p>
        )}
      </ul>
    </section>
  );
}
