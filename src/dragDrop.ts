// Tiny glue layer between dnd-kit and the app: translates a drag-and-drop
// event into a DropTarget for gameLogic.ts's movePlayer() to act on. Kept
// as its own function (rather than inline in RotationBoard.tsx) so it can be
// unit-tested directly without touching dnd-kit's pointer/sensor internals,
// which are notoriously hard to drive in tests - see OPEN_GYM_LOGIC.md's
// port plan, Testing strategy section. All the actual move-is-allowed rules
// live in movePlayer itself; this function only extracts "what were they
// dropped on".
import type { Active, Over } from '@dnd-kit/core';
import type { DropTarget } from './types';

export function resolveDropAction(active: Active | null, over: Over | null): DropTarget | null {
  if (!active || !over) return null; // dropped outside any droppable - cancel
  return (over.data.current as DropTarget | undefined) ?? null;
}
