import { useLayoutEffect, useRef, useState } from 'react';
import { useGameDispatch, useGameState } from '../state/context';
import { getActiveCourts, getPlayer } from '../state/gameLogic';
import type { DropTarget } from '../types';
import { GameControls } from './GameControls';
import { FairnessNotice } from './FairnessNotice';
import { GrowthNotice } from './GrowthNotice';
import { CourtView } from './CourtView';
import { BenchList } from './BenchList';
import { TileSelectionProvider } from './TileSelection';
import { WinsBetaPanel } from './WinsBetaPanel';

const SHAKE_DURATION_MS = 400;
const SLIDE_DURATION_MS = 220;

export function RotationBoard() {
  const state = useGameState();
  const dispatch = useGameDispatch();
  const activeCourts = getActiveCourts(state);
  // Tap-to-select-then-tap-target player movement (replaces drag-and-drop -
  // see TileSelection.tsx and PlayerCard.tsx). selectedPlayerId is the
  // highlighted "source" card; shakingPlayerId briefly overlaps it with an
  // animate-tile-shake class when a tap lands somewhere that isn't a valid
  // target or the same card again, before the selection actually clears.
  const [rawSelectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [shakingPlayerId, setShakingPlayerId] = useState<string | null>(null);
  // DOM nodes for every currently-rendered PlayerCard, keyed by player id -
  // populated by PlayerCard itself via registerCardRef. Used only to
  // measure before/after positions for the slide (FLIP) animation on a move
  // or swap; not used for anything data-related.
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const flipPending = useRef<{ ids: string[]; rects: Map<string, DOMRect> } | null>(null);
  // Pending winner picks for the round in progress: courtId -> teamId. Local
  // (not dispatched) until Submit - lets you tap around and change your mind
  // before it counts.
  const [winners, setWinners] = useState<Record<string, string>>({});
  // Local, not state.lastError: that banner renders up in GameControls,
  // above the courts - on a phone the Submit button is a full scroll below
  // it, so a missing-winner error was appearing off-screen from the tap
  // that caused it. Checking here also lets a failed submit leave `winners`
  // untouched instead of wiping every pick made so far.
  const [submitError, setSubmitError] = useState<string | null>(null);

  // A selected player can be made stale by something other than a tile tap
  // (e.g. removed from the roster elsewhere while highlighted) - derive a
  // validated id instead of holding the raw state directly, so nothing
  // downstream (highlight ring, click handler) has to special-case a
  // selection pointing at a player who no longer exists.
  const selectedPlayerId = rawSelectedPlayerId && getPlayer(state, rawSelectedPlayerId) ? rawSelectedPlayerId : null;

  function registerCardRef(playerId: string, el: HTMLElement | null) {
    if (el) cardRefs.current.set(playerId, el);
    else cardRefs.current.delete(playerId);
  }

  function capturePositions(ids: string[]): Map<string, DOMRect> {
    const rects = new Map<string, DOMRect>();
    for (const id of ids) {
      const el = cardRefs.current.get(id);
      if (el) rects.set(id, el.getBoundingClientRect());
    }
    return rects;
  }

  // Classic FLIP: positions were captured just before the state-changing
  // dispatch (while cards were still in their old spot); this runs after
  // React has re-rendered them into their new spot, so we can measure the
  // delta and animate it away instead of just popping there.
  useLayoutEffect(() => {
    const pending = flipPending.current;
    if (!pending) return;
    flipPending.current = null;
    for (const id of pending.ids) {
      const el = cardRefs.current.get(id);
      const before = pending.rects.get(id);
      if (!el || !before) continue;
      const after = el.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (!dx && !dy) continue;
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      // Force a reflow so the browser registers the starting transform
      // before the next two lines change it - otherwise both writes get
      // batched together and no animation plays.
      el.getBoundingClientRect();
      el.style.transition = `transform ${SLIDE_DURATION_MS}ms ease`;
      el.style.transform = '';
      const clearInlineStyles = () => {
        el.style.transition = '';
        el.style.transform = '';
        el.removeEventListener('transitionend', clearInlineStyles);
      };
      el.addEventListener('transitionend', clearInlineStyles);
    }
  });

  function handleTileClick(clickedPlayerId: string | null, target: DropTarget) {
    if (clickedPlayerId && clickedPlayerId === selectedPlayerId) {
      setSelectedPlayerId(null); // tap the same tile again to cancel - deliberate, no shake
      return;
    }
    if (!selectedPlayerId) {
      if (clickedPlayerId) setSelectedPlayerId(clickedPlayerId);
      return; // tapping an empty slot/bench with nothing selected does nothing
    }
    const animateIds = clickedPlayerId ? [selectedPlayerId, clickedPlayerId] : [selectedPlayerId];
    flipPending.current = { ids: animateIds, rects: capturePositions(animateIds) };
    dispatch({ type: 'MOVE_PLAYER', playerId: selectedPlayerId, target });
    setSelectedPlayerId(null);
  }

  // Any click that isn't handled (and stopped) by a PlayerCard/empty-slot/
  // bench tap bubbles up here - i.e. the game manager tapped away from
  // whatever was selected. Shake the selected card briefly, then clear it.
  function handleBackgroundClick() {
    if (!selectedPlayerId) return;
    const id = selectedPlayerId;
    setShakingPlayerId(id);
    window.setTimeout(() => {
      setSelectedPlayerId((current) => (current === id ? null : current));
      setShakingPlayerId((current) => (current === id ? null : current));
    }, SHAKE_DURATION_MS);
  }

  function selectWinner(courtId: string, teamId: string) {
    setSubmitError(null);
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
    // Same check updateWins itself makes, but done here so a missing pick
    // can be reported right next to the button that was just tapped, and so
    // the picks already made survive instead of being cleared below.
    const missingCourt = activeCourts.find((c) => !winners[c.id]);
    if (missingCourt) {
      setSubmitError(`Select a winner for Court ${missingCourt.index}.`);
      return;
    }
    dispatch({ type: 'SUBMIT_WINNERS', winners });
    setWinners({});
    setSubmitError(null);
  }

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
    <section
      className="mx-auto w-full max-w-4xl p-4 lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl"
      // Catch-all for "tapped away from the selected player" - every tile
      // that actually handles a tap (PlayerCard, an empty TeamSlot, the
      // bench area) stops propagation, so this only fires for genuinely
      // unhandled taps (GameControls, notices, a winner-pick button, empty
      // margin, etc).
      onClick={handleBackgroundClick}
    >
      <div className="mb-4">
        <GameControls />
      </div>
      <GrowthNotice />
      <FairnessNotice />
      <TileSelectionProvider value={{ selectedPlayerId, shakingPlayerId, onTileClick: handleTileClick, registerCardRef }}>
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
          {inWinnerSelectMode && (
            <p className="mb-2 text-center text-sm text-gray-500 dark:text-gray-400">
              Tap the winning team on each court, then Submit.
            </p>
          )}
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
              {submitError && (
                <p className="mt-2 text-sm text-red-700 dark:text-red-300">{submitError}</p>
              )}
            </div>
          )}
          <div className="mt-4">
            <BenchList />
          </div>
        </div>
      </TileSelectionProvider>
      <WinsBetaPanel />
    </section>
  );
}
