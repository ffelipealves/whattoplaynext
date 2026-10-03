"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SequenceEntry = { id: number; slug: string; title: string };

type ResultSequence = {
  entries: SequenceEntry[];
  setEntries: (entries: SequenceEntry[]) => void;
};

const ResultSequenceContext = createContext<ResultSequence | null>(null);

/**
 * Remembers the games on the results page last shown, so a game opened over
 * those results can step to its neighbours. It lives above both the page and
 * the modal slot, which are siblings in the layout.
 */
export function ResultSequenceProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<SequenceEntry[]>([]);
  const value = useMemo(() => ({ entries, setEntries }), [entries]);

  return (
    <ResultSequenceContext.Provider value={value}>
      {children}
    </ResultSequenceContext.Provider>
  );
}

/** Records the current results page; renders nothing. */
export function RegisterResultSequence({
  entries,
}: {
  entries: SequenceEntry[];
}) {
  const sequence = useContext(ResultSequenceContext);
  const setEntries = sequence?.setEntries;
  // The ids are the identity: a new array with the same games is no change.
  const key = entries.map((entry) => entry.id).join(",");

  useEffect(() => {
    setEntries?.(entries);
    // `entries` is read through `key`; depending on the array itself would
    // re-run on every render of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setEntries]);

  return null;
}

/** Where a game sits among the results it was opened from, if it was. */
export function useResultNeighbours(gameId: number) {
  const sequence = useContext(ResultSequenceContext);
  const entries = sequence?.entries ?? [];
  const index = entries.findIndex((entry) => entry.id === gameId);

  if (index < 0) {
    return { index: -1, total: 0, previous: undefined, next: undefined };
  }
  return {
    index,
    total: entries.length,
    previous: entries[index - 1],
    next: entries[index + 1],
  };
}
