import { useState } from 'react';
import { GameStateProvider } from './state/context';
import { RosterPanel } from './components/RosterPanel';
import { RotationBoard } from './components/RotationBoard';
import { SettingsPanel } from './components/SettingsPanel';
import { ThemeManager } from './components/ThemeManager';

type Tab = 'roster' | 'courts' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'roster', label: 'Roster' },
  { id: 'courts', label: 'Courts' },
  { id: 'settings', label: 'Settings' },
];

// Plain useState tab switcher - no router needed for 3 screens (see the
// "favor fewer, flatter files" directive in OPEN_GYM_LOGIC.md's port plan).
function TabNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="flex gap-1 sm:gap-1.5">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={
            'rounded-sm px-3 py-1.5 font-display text-sm font-medium tracking-wide transition-colors sm:px-4 sm:py-2 sm:text-base ' +
            (active === tab.id
              ? 'bg-hoop-500 text-ink-950'
              : 'text-plank-200/70 active:bg-ink-700 dark:text-ink-200/70')
          }
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

// The header fascia is always the dark "scoreboard" ink tone, independent of
// the Light/Dark/System appearance setting that governs the rest of the
// page - a scoreboard reads the same whether it's day or night outside.
export default function App() {
  const [tab, setTab] = useState<Tab>('roster');

  return (
    <GameStateProvider>
      <ThemeManager />
      <div className="min-h-screen bg-plank-100 text-ink-900 dark:bg-plank-950 dark:text-ink-50">
        <header className="flex flex-col gap-2 border-b-4 border-hoop-500 bg-ink-900 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
          <h1 className="flex items-center gap-2 font-display text-xl font-semibold tracking-wide text-plank-50 sm:text-2xl">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-hoop-500" />
            Open Gym
          </h1>
          <TabNav active={tab} onChange={setTab} />
        </header>
        {tab === 'roster' && <RosterPanel />}
        {tab === 'courts' && <RotationBoard />}
        {tab === 'settings' && <SettingsPanel />}
      </div>
    </GameStateProvider>
  );
}
