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
import { WinnerSelectModal } from './WinnerSelectModal';
import { ManualControls } from './ManualControls';
import { CourtView } from './CourtView';
import { BenchList } from './BenchList';
import { PlayerCard } from './PlayerCard';

export function RotationBoard() {
  const state = useGameState();
  const dispatch = useGameDispatch();
  const activeCourts = getActiveCourts(state);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // TouchSensor's activation delay stops a drag from starting on what's
  // actually a page-scroll gesture on phones (this tool is meant to be used
  // courtside). KeyboardSensor gives arrow-key/Enter drag-and-drop as a
  // fallback for anyone who can't use touch/pointer - ManualControls below
  // is kept on-screen too as a simpler, fully-keyboard-native alternative.
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

  const draggingPlayer = draggingId ? getPlayer(state, draggingId) : undefined;

  return (
    <section className="mx-auto w-full max-w-4xl p-4">
      <div className="mb-4">
        <GameControls />
      </div>
      <WinnerSelectModal />
      <ManualControls />
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {activeCourts.map((court) => (
            <CourtView key={court.id} court={court} />
          ))}
        </div>
        <div className="mt-4">
          <BenchList />
        </div>
        <DragOverlay>{draggingPlayer ? <PlayerCard player={draggingPlayer} /> : null}</DragOverlay>
      </DndContext>
    </section>
  );
}
