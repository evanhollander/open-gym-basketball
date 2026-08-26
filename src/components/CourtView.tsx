import { useGameState } from '../state/context';
import { getTeam } from '../state/gameLogic';
import type { Court } from '../types';
import { TeamSlot } from './TeamSlot';

interface TeamColumnProps {
  teamId: string;
  size: number;
  isWinnerPick: boolean;
  onPickWinner?: () => void;
  /** Court 1's current consecutive-win streak, only if this team is the
   * one holding it (see maxConsecutiveWins in Settings). */
  winStreak?: number;
}

// Fixed (not app-theme-dependent) colors matching real pinny/jersey colors,
// so "White"/"Dark" is visually obvious at a glance courtside, not just a
// text label - independent of the app's own light/dark UI theme, since
// "Dark team" and "dark mode" are unrelated axes.
const SIDE_STYLES = {
  white: 'bg-white text-gray-900 ring-2 ring-gray-300 active:bg-gray-100',
  dark: 'bg-gray-900 text-white ring-2 ring-gray-700 active:bg-gray-800',
} as const;

function TeamColumn({ teamId, size, isWinnerPick, onPickWinner, winStreak }: TeamColumnProps) {
  const state = useGameState();
  const team = getTeam(state, teamId)!;
  const teamNumber = teamId.split('-')[1];
  const label = `Team ${teamNumber} (${team.side === 'white' ? 'White' : 'Dark'})`;
  // Ternary, not `winStreak && winStreak > 0 && (...)`: when winStreak is
  // 0, `0 && x` evaluates to 0, and JSX renders a literal 0 (unlike false/
  // null/undefined, which render as nothing) - that would print a stray
  // "0" next to every non-streaking team's name.
  const streakBadge =
    winStreak && winStreak > 0 ? (
      <span className="ml-1" title={`${winStreak} wins in a row`}>
        🔥{winStreak}
      </span>
    ) : null;

  return (
    <div className="flex-1">
      {onPickWinner ? (
        // Once a round is underway, the team header doubles as the winner
        // picker - tap the team that won right where you're already looking,
        // instead of a separate dropdown panel elsewhere on the page.
        <button
          type="button"
          onClick={onPickWinner}
          aria-pressed={isWinnerPick}
          className={
            'mb-1 w-full rounded px-2 py-1.5 text-center text-sm font-semibold transition-colors sm:px-3 sm:py-2 sm:text-base ' +
            (isWinnerPick ? 'bg-green-600 text-white' : SIDE_STYLES[team.side])
          }
        >
          {label}
          {isWinnerPick ? ' ✓ Won' : ''}
          {streakBadge}
        </button>
      ) : (
        <h3
          className={
            'mb-1 rounded px-2 py-1.5 text-center text-sm font-semibold sm:px-3 sm:py-2 sm:text-base ' +
            SIDE_STYLES[team.side]
          }
        >
          {label}
          {streakBadge}
        </h3>
      )}
      <div className="flex flex-col gap-1 sm:gap-1.5">
        {team.slots.slice(0, size).map((playerId, i) => (
          <TeamSlot key={i} teamId={teamId} slotIndex={i} playerId={playerId} />
        ))}
      </div>
    </div>
  );
}

interface CourtViewProps {
  court: Court;
  /** Present only once a round is underway (see RotationBoard) - lets the
   * team headers act as winner-pick buttons instead of plain labels. */
  selectedWinnerTeamId?: string | null;
  onSelectWinner?: (teamId: string) => void;
}

export function CourtView({ court, selectedWinnerTeamId, onSelectWinner }: CourtViewProps) {
  const state = useGameState();
  // The streak only applies to Court 1 (see updateWins in gameLogic.ts -
  // it's the only court with a consecutive-win cap).
  const court1Streak = court.index === 1 ? state.court1WinStreak : 0;

  return (
    <div
      className={
        'rounded border p-3 transition-colors sm:p-4 lg:p-5 ' +
        (selectedWinnerTeamId ? 'border-green-400 dark:border-green-700' : 'border-gray-300 dark:border-gray-600')
      }
    >
      <h2 className="mb-2 text-center text-lg font-semibold sm:text-xl">Court {court.index}</h2>
      <div className="flex gap-2 sm:gap-3 lg:gap-4">
        <TeamColumn
          teamId={court.teamAId}
          size={court.sizePerTeam}
          isWinnerPick={selectedWinnerTeamId === court.teamAId}
          onPickWinner={onSelectWinner ? () => onSelectWinner(court.teamAId) : undefined}
          winStreak={state.court1WinnerTeamId === court.teamAId ? court1Streak : 0}
        />
        <TeamColumn
          teamId={court.teamBId}
          size={court.sizePerTeam}
          isWinnerPick={selectedWinnerTeamId === court.teamBId}
          onPickWinner={onSelectWinner ? () => onSelectWinner(court.teamBId) : undefined}
          winStreak={state.court1WinnerTeamId === court.teamBId ? court1Streak : 0}
        />
      </div>
    </div>
  );
}
