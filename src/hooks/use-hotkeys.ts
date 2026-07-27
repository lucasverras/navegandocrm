"use client";

import { useEffect } from "react";

// Minimal keyboard-shortcut hook: maps a single key (case-insensitive) to a handler.
// Ignores keystrokes while the user is typing in an input/textarea/select.
export function useHotkeys(bindings: Record<string, () => void>, deps: unknown[] = []) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const handler = bindings[key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
