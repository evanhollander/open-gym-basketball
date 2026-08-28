import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useGameDispatch, useGameState } from '../state/context';
import { getActiveCourts, getPlayer } from '../state/gameLogic';
import { resolveDropAction } from '../dragDrop';
import { GameControls } from './GameControls';
import { CourtView } from './CourtView';
import { BenchList } from './BenchList';
import { PlayerCard } from './PlayerCard';

export function RotationBoard() {
  const state = useGameState();
  const dispatch = useGameDispatch();
  const activeCourts = getActiveCourts(state);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Pending winner picks for the round in progress: courtId -> teamId. Local
  // (not dispatched) until Submit - lets you tap around and change your mind
  // before it counts.
  const [winners, setWinners] = useState<Record<string, string>>({});

  // TouchSensor's activation delay stops a drag from starting on what's
  // actually a page-scroll gesture on phones (this tool is meant to be used
  // courtside). KeyboardSensor gives arrow-key/Enter drag-and-drop as a
  // keyboard-accessible fallback.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const target = resolveDropAction(event.active, event.over);
    if (target) dispatch({ type: 'MOVE_PLAYER', playerId: String(event.active.id), target });
  }

  function selectWinner(courtId: string, teamId: string) {
    setWinners((prev) => {
      const next = { ...prev };
      if (next[courtId] === teamId) {
        delete next[courtId]; // tap again to un-pick
      } else {
        next[courtId] = teamId;
      }
      return next;
    });
  }

  function submitWinners() {
    dispatch({ type: 'SUBMIT_WINNERS', winners });
    setWinners({});
  }

  const draggingPlayer = draggingId ? getPlayer(state, draggingId) : undefined;
  // Winner-picking only makes sense once teams are actually assigned right
  // now - `round > 0` alone is wrong here too: Clear Teams can wipe every
  // team without resetting the round counter, which would otherwise leave
  // this UI showing with nothing valid to submit a winner for (see the
  // matching fix in GameControls for Assign Teams vs Reshuffle Teams).
  const inWinnerSelectMode = state.players.some((p) => p.status === 'team');
  // Only widen to a 2-column layout once there's actually a 2nd court to
  // show - a single court/bench stretched across a 2-column grid on desktop
  // left the court narrow in one column with the bench oddly full-width
  // below it. Bench lives in the same width-constrained wrapper as the
  // courts so it always matches, rather than always spanning full width.
  const isMultiCourt = activeCourts.length > 1;

  return (
    <section className="mx-auto w-full max-w-4xl p-4 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
      <div className="mb-4">
        <GameControls />
      </div>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Single-court view stays capped well below the outer section's
            width even on a big screen (a lone court stretched full-width
            reads worse than a lone court sized like the multi-court case) -
            just steps up gradually with viewport size instead of staying
            phone-width on a Chromebook/desktop. Multi-court matches the
            outer section's cap at every step so it actually fills a wide
            monitor instead of stopping short and leaving a big empty
            margin (see the 2603bf7 follow-up: 5xl alone left ~490px of
            unused space per side on a typical wide external display). */}
        <div className={'mx-auto mt-4 ' + (isMultiCourt ? 'max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl' : 'max-w-md md:max-w-xl lg:max-w-2xl xl:max-w-3xl')}>
          <div className={'grid grid-cols-1 gap-4' + (isMultiCourt ? ' md:grid-cols-2' : '')}>
            {activeCourts.map((court) => (
              <CourtView
                key={court.id}
                court={court}
                selectedWinnerTeamId={inWinnerSelectMode ? (winners[court.id] ?? null) : undefined}
                onSelectWinner={inWinnerSelectMode ? (teamId) => selectWinner(court.id, teamId) : undefined}
              />
            ))}
          </div>
          {inWinnerSelectMode && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={submitWinners}
                className="rounded bg-green-600 px-6 py-3 text-lg font-semibold text-white active:bg-green-700 sm:px-8 sm:py-4 sm:text-xl"
              >
                Submit Winners / Next Game
              </button>
            </div>
          )}
          <div className="mt-4">
            <BenchList />
          </div>
        </div>
        <DragOverlay>{draggingPlayer ? <PlayerCard player={draggingPlayer} /> : null}</DragOverlay>
      </DndContext>
    </section>
  );
}
