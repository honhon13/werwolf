"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Action, GameState, View } from "../game/types";
import { deviceKey, loadCredentials, saveCredentials, store, stored } from "./storage";

const POLL_MS = 1500;

export type RoomState =
  | { status: "loading" }
  | { status: "missing" }
  | {
      status: "guest";
      phase: GameState["phase"];
      players: string[];
      seats: Seat[];
      /** The seat this device asked to take over, until the host answers. */
      waiting: string | null;
    }
  | { status: "member"; view: View; clockOffset: number };

export interface Seat {
  id: string;
  name: string;
  online: boolean;
}

interface ServerReply {
  error?: string;
  seats?: Seat[];
  member?: boolean;
  v?: number;
  online?: string[];
  view?: View;
  phase?: GameState["phase"];
  players?: string[];
}

async function request(url: string, code: string, body?: unknown): Promise<[number, ServerReply]> {
  const creds = loadCredentials(code);
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(creds ? { authorization: `Bearer ${creds.id}.${creds.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return [res.status, (await res.json().catch(() => ({}))) as ServerReply];
}

export async function createRoom(name: string): Promise<{ code?: string; error?: string }> {
  try {
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, device: deviceKey() }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "Das hat nicht geklappt." };
    saveCredentials(data.code, { id: data.id, token: data.token });
    store("name", name);
    return { code: data.code };
  } catch {
    return { error: "Keine Verbindung. Bist du online?" };
  }
}

export async function joinRoom(code: string, name: string): Promise<{ error?: string }> {
  try {
    const res = await fetch(`/api/rooms/${code}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, device: deviceKey() }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "Das hat nicht geklappt." };
    saveCredentials(code, { id: data.id, token: data.token });
    store("name", name);
    return {};
  } catch {
    return { error: "Keine Verbindung. Bist du online?" };
  }
}

const actionId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useRoom(code: string) {
  const [room, setRoom] = useState<RoomState>({ status: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  const refresh = useRef<() => void>(() => {});

  const apply = useCallback(
    (status: number, reply: ServerReply) => {
      if (status === 404) {
        saveCredentials(code, null);
        setRoom({ status: "missing" });
        return;
      }
      if (status >= 400) return;
      const waiting = stored(`rejoin:${code}`);
      if (!reply.member) {
        // Kicked, or the room was recreated: the old seat is gone. A seat
        // asked for on this device only works once the host agrees.
        if (loadCredentials(code) && !waiting) saveCredentials(code, null);
        version.current = 0;
        setRoom({
          status: "guest",
          phase: reply.phase ?? "lobby",
          players: reply.players ?? [],
          seats: reply.seats ?? [],
          waiting,
        });
        return;
      }
      if (waiting) store(`rejoin:${code}`, null);
      const v = reply.v ?? 0;
      if (v < version.current) return;
      version.current = v;
      const online = new Set(reply.online ?? []);
      setRoom((current) => {
        const view = reply.view ?? (current.status === "member" ? current.view : null);
        if (!view) return current;
        return {
          status: "member",
          clockOffset: reply.view
            ? reply.view.now - Date.now()
            : current.status === "member"
              ? current.clockOffset
              : 0,
          view: { ...view, players: view.players.map((p) => ({ ...p, online: online.has(p.id) })) },
        };
      });
    },
    [code],
  );

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    version.current = 0;

    const poll = async () => {
      clearTimeout(timer);
      if (!document.hidden) {
        try {
          const [status, reply] = await request(`/api/rooms/${code}?v=${version.current}`, code);
          if (!stopped) apply(status, reply);
        } catch {
          // Offline for a moment; the next poll tries again.
        }
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    };
    refresh.current = poll;
    poll();

    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [code, apply]);

  const send = useCallback(
    async (action: Action): Promise<boolean> => {
      setBusy(true);
      const body = { action, id: actionId() };
      try {
        // One retry with the same id: the server applies it only once.
        const [status, reply] = await request(`/api/rooms/${code}/action`, code, body).catch(async () => {
          await wait(800);
          return request(`/api/rooms/${code}/action`, code, body);
        });
        if (status >= 400) {
          setError(reply.error ?? "Das hat nicht geklappt.");
          if (status === 401 || status === 404) refresh.current();
          return false;
        }
        apply(status, reply);
        return true;
      } catch {
        setError("Keine Verbindung. Bist du online?");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [code, apply],
  );

  const join = useCallback(
    async (name: string): Promise<boolean> => {
      setBusy(true);
      const { error: problem } = await joinRoom(code, name);
      setBusy(false);
      if (problem) setError(problem);
      else refresh.current();
      return !problem;
    },
    [code],
  );

  const leave = useCallback(() => {
    saveCredentials(code, null);
  }, [code]);

  /** Asks the host to hand an existing seat to this device. */
  const rejoin = useCallback(
    async (seat: Seat): Promise<boolean> => {
      setBusy(true);
      try {
        const res = await fetch(`/api/rooms/${code}/rejoin`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ playerId: seat.id, device: deviceKey() }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Das hat nicht geklappt.");
          return false;
        }
        store(`rejoin:${code}`, seat.name);
        saveCredentials(code, { id: data.id, token: data.token });
        refresh.current();
        return true;
      } catch {
        setError("Keine Verbindung. Bist du online?");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [code],
  );

  const cancelRejoin = useCallback(() => {
    store(`rejoin:${code}`, null);
    saveCredentials(code, null);
    refresh.current();
  }, [code]);

  const clearError = useCallback(() => setError(null), []);
  /** Asks for the current state now instead of at the next poll. */
  const reload = useCallback(() => refresh.current(), []);

  return { room, error, clearError, busy, send, join, leave, rejoin, cancelRejoin, reload };
}

export type RoomApi = ReturnType<typeof useRoom>;
