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
        return { ...gameLogic.addPlayer(state, action.name), lastError: null };
      case 'REMOVE_PLAYER':
        return { ...gameLogic.removePlayer(state, action.playerId), lastError: null };
      case 'RESET_ALL':
        return gameLogic.resetAll(state);
      case 'LOAD_STATE':
        return action.state;

      case 'SET_GAME_TYPE':
        return { ...state, gameType: action.gameType, lastError: null };
      case 'SET_NUM_COURTS':
        return { ...state, numCourts: action.numCourts, lastError: null };
      case 'SET_MAX_TEAM_SIZE':
        return { ...state, maxTeamSize: action.maxTeamSize, lastError: null };
      case 'SET_MAX_SIT':
        return { ...state, maxSit: action.maxSit, lastError: null };
      case 'SET_MAX_CONSECUTIVE_WINS':
        return { ...state, maxConsecutiveWins: action.value, lastError: null };
      case 'SET_MAX_SINGLE_COURT_PLAYERS':
        return { ...state, maxSingleCourtPlayers: action.value, lastError: null };
      case 'SET_THEME':
        return { ...state, theme: action.theme, lastError: null };

      case 'ASSIGN_TEAMS':
        return gameLogic.assignTeams(state, !!action.keepTeams);
      case 'RESHUFFLE_TEAMS':
        return gameLogic.reshuffleTeams(state);
      case 'SUBMIT_WINNERS':
        return gameLogic.updateWins(state, action.winners);
      case 'CLEAR_TEAMS':
        return gameLogic.clearTeams(state);
      case 'CLEAR_SAT':
        return gameLogic.clearSat(state);
      case 'UPDATE_ROUND':
        return { ...state, round: state.round + 1, lastError: null };

      case 'MOVE_PLAYER':
        return gameLogic.movePlayer(state, action.playerId, action.target);
      case 'SWAP_PLAYERS':
        return gameLogic.swapPlayers(state, action.playerAId, action.playerBId);

      default:
        return state;
    }
  } catch (err) {
    return { ...state, lastError: err instanceof Error ? err.message : 'Something went wrong.' };
  }
}
