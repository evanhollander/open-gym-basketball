// Thin dispatcher: translates each Action into a gameLogic.ts call and turns
// any thrown Error into state.lastError, which the UI shows as a toast
// (replacing the original's alert() popups). No business logic lives here -
// that's all in gameLogic.ts, where it can be tested without React.
import type { Action, GameState } from '../types';
import * as gameLogic from './gameLogic';

export function gameReducer(state: GameState, action: Action): GameState {
  try {
    switch (action.type) {
      case 'ADD_PLAYER':
        return { ...gameLogic.addPlayer(state, action.name), lastError: null, lastNotice: null };
      case 'REMOVE_PLAYER':
        return { ...gameLogic.removePlayer(state, action.playerId), lastError: null, lastNotice: null };
      case 'RESET_ALL':
        return gameLogic.resetAll(state);

      case 'SET_GAME_TYPE':
        return { ...state, gameType: action.gameType, lastError: null, lastNotice: null };
      case 'SET_NUM_COURTS':
        return { ...state, numCourts: action.numCourts, lastError: null, lastNotice: null };
      case 'SET_MAX_TEAM_SIZE':
        return { ...state, maxTeamSize: action.maxTeamSize, lastError: null, lastNotice: null };
      case 'SET_MAX_CONSECUTIVE_WINS':
        return { ...state, maxConsecutiveWins: action.value, lastError: null, lastNotice: null };
      case 'SET_MAX_SINGLE_COURT_PLAYERS':
        return { ...state, maxSingleCourtPlayers: action.value, lastError: null, lastNotice: null };
      case 'SET_THEME':
        return { ...state, theme: action.theme, lastError: null, lastNotice: null };

      case 'ASSIGN_TEAMS':
        return { ...gameLogic.assignTeams(state, !!action.keepTeams), lastNotice: null };
      case 'RESHUFFLE_TEAMS':
        return { ...gameLogic.reshuffleTeams(state), lastNotice: null };
      case 'SUBMIT_WINNERS':
        // updateWins sets lastNotice itself (non-null only when the
        // win-streak cap just forced a team apart) - don't clear it here.
        return gameLogic.updateWins(state, action.winners);
      case 'CLEAR_TEAMS':
        return { ...gameLogic.clearTeams(state), lastNotice: null };
      case 'CLEAR_SAT':
        return { ...gameLogic.clearSat(state), lastNotice: null };
      case 'UPDATE_ROUND':
        return { ...state, round: state.round + 1, lastError: null, lastNotice: null };

      case 'MOVE_PLAYER':
        return { ...gameLogic.movePlayer(state, action.playerId, action.target), lastNotice: null };
      case 'SWAP_PLAYERS':
        return { ...gameLogic.swapPlayers(state, action.playerAId, action.playerBId), lastNotice: null };

      default:
        return state;
    }
  } catch (err) {
    return { ...state, lastError: err instanceof Error ? err.message : 'Something went wrong.' };
  }
}
