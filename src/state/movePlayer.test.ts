import { describe, expect, it } from 'vitest';
import { createInitialState } from './initialState';
import { addPlayer, assignTeams, movePlayer } from './gameLogic';
import type { GameState } from '../types';

function withPlayers(count: number, state: GameState = createInitialState()): GameState {
  let next = state;
  for (let i = 0; i < count; i++) next = addPlayer(next, `Player${i}`);
  return next;
}

describe('movePlayer', () => {
  it('bench -> empty team slot: places the player and removes them from the bench', () => {
    const state = assignTeams(withPlayers(12), false); // 10 play, 2 sit
    const benchPlayerId = state.sittingOrder[0];
    const teamId = 'team-1';
    // Vacate one slot to move into.
    const slotIndex = state.teams[teamId].slots.findIndex((s) => s !== null);
    const occupantId = state.teams[teamId].slots[slotIndex]!;
    let next = movePlayer(state, occupantId, { kind: 'bench' }); // free up the slot first
    next = movePlayer(next, benchPlayerId, { kind: 'team-slot', teamId, slotIndex });

    expect(next.teams[teamId].slots[slotIndex]).toBe(benchPlayerId);
    expect(next.players.find((p) => p.id === benchPlayerId)!.status).toBe('team');
    expect(next.sittingOrder).not.toContain(benchPlayerId);
  });

  it('bench -> occupied team slot: swaps, sending the occupant to the bench', () => {
    const state = assignTeams(withPlayers(12), false);
    const benchPlayerId = state.sittingOrder[0];
    const teamId = 'team-1';
    const slotIndex = state.teams[teamId].slots.findIndex((s) => s !== null);
    const occupantId = state.teams[teamId].slots[slotIndex]!;

    const next = movePlayer(state, benchPlayerId, { kind: 'team-slot', teamId, slotIndex });

    expect(next.teams[teamId].slots[slotIndex]).toBe(benchPlayerId);
    expect(next.players.find((p) => p.id === occupantId)!.status).toBe('sitting');
    expect(next.sittingOrder).toContain(occupantId);
    expect(next.sittingOrder).not.toContain(benchPlayerId);
  });

  it('team slot -> bench: sits the player out', () => {
    const state = assignTeams(withPlayers(10), false);
    const onTeam = state.players.find((p) => p.status === 'team')!;
    const next = movePlayer(state, onTeam.id, { kind: 'bench' });
    expect(next.players.find((p) => p.id === onTeam.id)!.status).toBe('sitting');
    expect(next.sittingOrder).toContain(onTeam.id);
  });

  it('team slot -> empty slot on a different team: relocates without changing status', () => {
    const state = assignTeams(withPlayers(10), false);
    const player = state.players.find((p) => p.status === 'team')!;
    const otherTeamId = player.teamId === 'team-1' ? 'team-2' : 'team-1';
    // Free a slot on the other team by benching whoever's there.
    const freeSlotIndex = state.teams[otherTeamId].slots.findIndex((s) => s !== null);
    const displaced = state.teams[otherTeamId].slots[freeSlotIndex]!;
    let next = movePlayer(state, displaced, { kind: 'bench' });

    next = movePlayer(next, player.id, { kind: 'team-slot', teamId: otherTeamId, slotIndex: freeSlotIndex });

    expect(next.teams[otherTeamId].slots[freeSlotIndex]).toBe(player.id);
    expect(next.players.find((p) => p.id === player.id)!.status).toBe('team');
    expect(next.players.find((p) => p.id === player.id)!.teamId).toBe(otherTeamId);
  });

  it('team slot -> occupied slot: swaps the two players in place', () => {
    const state = assignTeams(withPlayers(10), false);
    const teamAPlayers = state.players.filter((p) => p.teamId === 'team-1');
    const teamBPlayers = state.players.filter((p) => p.teamId === 'team-2');
    const a = teamAPlayers[0];
    const b = teamBPlayers[0];
    const bSlotIndex = state.teams['team-2'].slots.indexOf(b.id);

    const next = movePlayer(state, a.id, { kind: 'team-slot', teamId: 'team-2', slotIndex: bSlotIndex });

    expect(next.teams['team-2'].slots[bSlotIndex]).toBe(a.id);
    expect(next.players.find((p) => p.id === b.id)!.teamId).toBe('team-1');
  });

  it('dropping a player on themself is a no-op', () => {
    const state = assignTeams(withPlayers(10), false);
    const player = state.players.find((p) => p.status === 'team')!;
    const slotIndex = state.teams[player.teamId!].slots.indexOf(player.id);
    const next = movePlayer(state, player.id, { kind: 'team-slot', teamId: player.teamId!, slotIndex });
    expect(next).toBe(state);
  });

  it('dragging a benched player onto a team refunds a same-round sit-count bump', () => {
    const state = assignTeams(withPlayers(12), false); // benches 2 players this round, bumping their sitCount
    const benchPlayerId = state.sittingOrder[0];
    const before = state.players.find((p) => p.id === benchPlayerId)!;
    const teamId = 'team-1';
    const occupantId = state.teams[teamId].slots.find((s) => s !== null)!;
    let next = movePlayer(state, occupantId, { kind: 'bench' });
    const slotIndex = next.teams[teamId].slots.findIndex((s) => s === null);
    next = movePlayer(next, benchPlayerId, { kind: 'team-slot', teamId, slotIndex });

    const after = next.players.find((p) => p.id === benchPlayerId)!;
    expect(after.sitCount).toBe(before.sitCount - 1);
  });
});
