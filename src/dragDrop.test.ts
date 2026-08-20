import { describe, expect, it } from 'vitest';
import { resolveDropAction } from './dragDrop';
import type { Active, Over } from '@dnd-kit/core';

function makeOver(data: unknown): Over {
  return { id: 'x', data: { current: data }, rect: {} } as unknown as Over;
}

const ACTIVE = { id: 'player-1' } as unknown as Active;

describe('resolveDropAction', () => {
  it('returns null when dropped outside any droppable', () => {
    expect(resolveDropAction(ACTIVE, null)).toBeNull();
  });

  it('returns null when there is no active drag', () => {
    expect(resolveDropAction(null, makeOver({ kind: 'bench' }))).toBeNull();
  });

  it('extracts the DropTarget carried by the droppable', () => {
    const target = { kind: 'team-slot' as const, teamId: 'team-1', slotIndex: 2 };
    expect(resolveDropAction(ACTIVE, makeOver(target))).toEqual(target);
  });

  it('returns null if the droppable has no data attached', () => {
    expect(resolveDropAction(ACTIVE, makeOver(undefined))).toBeNull();
  });
});
