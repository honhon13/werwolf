"use client";

import { useSyncExternalStore } from "react";

const PREFIX = "werwolf:";
const CHANGED = "werwolf-storage";

export interface RoomCredentials {
  id: string;
  token: string;
}

export function stored(key: string): string | null {
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

let device: string | null = null;

/**
 * A secret that stays with this browser. The server knows the device by it
 * and gives it at most one seat per room, also after the room was left.
 */
export function deviceKey(): string {
  device ??= stored("device");
  if (!device) {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    device = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    store("device", device);
  }
  return device;
}

/** A localStorage value that is null during server rendering. */
export function useStored(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => stored(key),
    () => null,
  );
}

export function loadCredentials(code: string): RoomCredentials | null {
  try {
    const parsed = JSON.parse(stored(`room:${code}`) ?? "null");
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
