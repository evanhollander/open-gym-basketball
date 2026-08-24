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
    <nav className="flex border-b border-gray-200 dark:border-gray-700">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={
            'flex-1 py-3 text-center font-medium ' +
            (active === tab.id
              ? 'border-b-2 border-blue-600 text-blue-700 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400')
          }
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('roster');

  return (
    <GameStateProvider>
      <ThemeManager />
      <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <h1 className="bg-blue-100 py-3 text-center text-2xl font-semibold text-blue-950 dark:bg-blue-950 dark:text-blue-100">
          Open Gym Basketball
        </h1>
        <TabNav active={tab} onChange={setTab} />
        {tab === 'roster' && <RosterPanel />}
        {tab === 'courts' && <RotationBoard />}
        {tab === 'settings' && <SettingsPanel />}
      </div>
    </GameStateProvider>
  );
}
