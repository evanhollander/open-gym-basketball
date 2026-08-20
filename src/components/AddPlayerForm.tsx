import { useState, type FormEvent } from 'react';
import { useGameDispatch } from '../state/context';

export function AddPlayerForm() {
  const dispatch = useGameDispatch();
  const [name, setName] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    dispatch({ type: 'ADD_PLAYER', name });
    setName('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Player name"
        className="flex-1 rounded border border-gray-300 px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-800"
      />
      <button
        type="submit"
        className="rounded bg-blue-600 px-4 py-2 text-white active:bg-blue-700"
      >
        Add
      </button>
    </form>
  );
}
