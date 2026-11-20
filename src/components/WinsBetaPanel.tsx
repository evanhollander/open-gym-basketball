import { useState } from 'react';
import { useGameState } from '../state/context';

/** Small, easy-to-miss "beta" link at the very bottom of the Courts page
 * that expands into a full-roster leaderboard, ranked by Player.wins (a
 * hidden field - see types.ts - never shown anywhere else in the UI) with
 * name as an alphabetical tie-breaker. Tapping "beta" again collapses it.
 * Deliberately its own tiny component rather than folded into
 * RotationBoard.tsx, since it has nothing to do with tile selection or the
 * active round. */
export function WinsBetaPanel() {
  const state = useGameState();
  const [expanded, setExpanded] = useState(false);

  const ranked = [...state.players].sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));

  return (
    <div className="mt-8 text-center">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="text-xs text-ink-700/50 underline decoration-dotted underline-offset-2 hover:text-ink-700 dark:text-plank-200/50 dark:hover:text-plank-200"
      >
        beta
      </button>
      {expanded && (
        <div className="mx-auto mt-2 max-w-xs overflow-hidden rounded-sm border-2 border-plank-300 text-left sm:max-w-sm dark:border-ink-600">
          <table className="w-full text-sm">
            <thead className="bg-ink-900 text-plank-50">
              <tr>
                <th className="px-3 py-1.5 text-left font-display font-semibold tracking-wide">Player</th>
                <th className="px-3 py-1.5 text-right font-display font-semibold tracking-wide tabular-nums">Wins</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((p) => (
                <tr key={p.id} className="border-t border-plank-200 dark:border-ink-700">
                  <td className="max-w-0 truncate px-3 py-1">{p.name}</td>
                  <td className="px-3 py-1 text-right font-display tabular-nums text-hoop-600 dark:text-hoop-400">{p.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ranked.length === 0 && (
            <p className="p-3 text-center text-sm text-ink-700/70 dark:text-plank-200/70">No players yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
