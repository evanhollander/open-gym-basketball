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
// so "White"/"Dark" is visually obvious at a glance across the *whole* team
// column - like two actual dugouts - not just a small text label, and
// independent of the app's own light/dark UI theme, since "Dark team" and
// "dark mode" are unrelated axes. PlayerCard reads this same `side` to tint
// its own cards so they read as part of the dugout rather than a neutral
// app-theme card dropped on top of it (see SIDE_CARD there).
const SIDE_CONTAINER = {
  white: 'bg-white ring-2 ring-plank-300',
  dark: 'bg-ink-950 ring-2 ring-ink-600',
} as const;

const SIDE_LABEL_TEXT = {
  white: 'text-ink-900',
  dark: 'text-plank-50',
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
    <div className={'flex-1 rounded-sm p-1.5 transition-colors sm:p-2 ' + SIDE_CONTAINER[team.side]}>
      {onPickWinner ? (
        // Once a round is underway, the team header doubles as the winner
        // picker - tap the team that won right where you're already looking,
        // instead of a separate dropdown panel elsewhere on the page.
        <button
          type="button"
          onClick={onPickWinner}
          aria-pressed={isWinnerPick}
          className={
            'mb-1.5 w-full rounded-sm px-2 py-1.5 text-center font-display text-sm font-medium tracking-wide transition-colors sm:px-3 sm:py-2 sm:text-base ' +
            (isWinnerPick ? 'bg-green-600 text-white' : SIDE_LABEL_TEXT[team.side] + ' active:opacity-70')
          }
        >
          {label}
          {isWinnerPick ? ' ✓ Won' : ''}
          {streakBadge}
        </button>
      ) : (
        <h3
          className={
            'mb-1.5 px-2 py-1.5 text-center font-display text-sm font-medium tracking-wide sm:px-3 sm:py-2 sm:text-base ' +
            SIDE_LABEL_TEXT[team.side]
          }
        >
          {label}
          {streakBadge}
        </h3>
      )}
      <div className="flex flex-col gap-1 sm:gap-1.5">
        {team.slots.slice(0, size).map((playerId, i) => (
          <TeamSlot key={i} teamId={teamId} slotIndex={i} playerId={playerId} side={team.side} />
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
        'rounded-sm border-2 bg-plank-50 p-3 transition-colors sm:p-4 lg:p-5 dark:bg-ink-800 ' +
        (selectedWinnerTeamId ? 'border-green-500 dark:border-green-600' : 'border-plank-300 dark:border-ink-600')
      }
    >
      <h2 className="mb-2 text-center font-display text-lg font-semibold tracking-wide text-ink-800 sm:text-xl dark:text-plank-50">
        Court {court.index}
      </h2>
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
