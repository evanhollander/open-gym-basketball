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
  const inWinnerSelectMode = state.round > 0;

  return (
    <section className="mx-auto w-full max-w-4xl p-4">
      <div className="mb-4">
        <GameControls />
      </div>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
              className="rounded bg-green-600 px-6 py-3 text-lg font-semibold text-white active:bg-green-700"
            >
              Submit Winners / Next Game
            </button>
          </div>
        )}
        <div className="mt-4">
          <BenchList />
        </div>
        <DragOverlay>{draggingPlayer ? <PlayerCard player={draggingPlayer} /> : null}</DragOverlay>
      </DndContext>
    </section>
  );
}
