import { useGameState } from '../state/context';
import { AddPlayerForm } from './AddPlayerForm';
import { RosterRow } from './RosterRow';

export function RosterPanel() {
  const state = useGameState();

  return (
    // Capped at max-w-md regardless of screen size used to leave ~50% of a
    // desktop/Chromebook width empty (unlike the Courts tab, which already
    // steps up at lg:/xl:/2xl: - see RotationBoard.tsx) - widen the same way
    // here, and let the list itself flow into columns instead of staying a
    // single column stretched wide with nothing to fill it.
    <section className="mx-auto w-full max-w-md p-4 lg:max-w-3xl xl:max-w-5xl">
      <h2 className="mb-3 text-lg font-semibold">All Players ({state.players.length})</h2>
      <div className="max-w-md">
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
      </div>
      <ul className="mt-4 lg:grid lg:grid-cols-2 lg:gap-x-8 xl:grid-cols-3">
        {state.players.map((player) => (
          <RosterRow key={player.id} player={player} />
        ))}
        {state.players.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-500 lg:col-span-2 xl:col-span-3 dark:text-gray-400">
            No players yet - add your first player above.
          </p>
        )}
      </ul>
    </section>
  );
}
