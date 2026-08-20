import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import type { Action, GameState } from '../types';
import { gameReducer } from './reducer';
import { createInitialState } from './initialState';
import { loadState, saveState } from './persistence';

const GameStateContext = createContext<GameState | null>(null);
const GameDispatchContext = createContext<Dispatch<Action> | null>(null);

function init(): GameState {
  return loadState() ?? createInitialState();
}

export function GameStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, init);

  // Persist on every change. A JSON.stringify of the whole state is cheap
  // enough at this app's scale (a few dozen players) to just do on every
  // dispatch rather than debouncing.
  useEffect(() => {
    saveState(state);
  }, [state]);

  return (
    <GameStateContext.Provider value={state}>
      <GameDispatchContext.Provider value={dispatch}>{children}</GameDispatchContext.Provider>
    </GameStateContext.Provider>
  );
}

export function useGameState(): GameState {
  const state = useContext(GameStateContext);
  if (!state) throw new Error('useGameState must be used within a GameStateProvider');
  return state;
}

export function useGameDispatch(): Dispatch<Action> {
  const dispatch = useContext(GameDispatchContext);
  if (!dispatch) throw new Error('useGameDispatch must be used within a GameStateProvider');
  return dispatch;
}
