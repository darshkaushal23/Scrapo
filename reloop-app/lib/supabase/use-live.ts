"use client";

import { useEffect, useState } from "react";

export function useLive<T>(key: string, load: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    attempt: number;
    phase: "loading" | "ready" | "error";
    data: T | null;
    message: string;
  }>({ key, attempt: 0, phase: "loading", data: null, message: "" });
  const matches = state.key === key && state.attempt === attempt;

  useEffect(() => {
    let cancel = false;
    load()
      .then((value) => {
        if (cancel) return;
        setState({ key, attempt, phase: "ready", data: value, message: "" });
      })
      .catch((error: unknown) => {
        if (cancel) return;
        setState({
          key,
          attempt,
          phase: "error",
          data: null,
          message: error instanceof Error ? error.message : "Could not load records.",
        });
      });
    return () => {
      cancel = true;
    };
    // load is read once per key. Callers change `key` when the query should rerun.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return {
    phase: matches ? state.phase : "loading",
    data: matches ? state.data : null,
    message: matches ? state.message : "",
    retry: () => setAttempt((value) => value + 1),
  };
}
