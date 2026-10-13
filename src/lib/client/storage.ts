"use client";

import { useSyncExternalStore } from "react";

const PREFIX = "werwolf:";
const CHANGED = "werwolf-storage";

export interface RoomCredentials {
  id: string;
  token: string;
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function store(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(PREFIX + key);
    else window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // Private mode: the game still works until the tab is closed.
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** A localStorage value that is null during server rendering. */
export function useStored(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
}

export function loadCredentials(code: string): RoomCredentials | null {
  try {
    const parsed = JSON.parse(read(`room:${code}`) ?? "null");
    return parsed && typeof parsed.id === "string" && typeof parsed.token === "string"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function saveCredentials(code: string, creds: RoomCredentials | null) {
  store(`room:${code}`, creds ? JSON.stringify(creds) : null);
  store("last", creds ? code : null);
}
