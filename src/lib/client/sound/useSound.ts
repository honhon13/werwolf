"use client";

import { useEffect, useRef } from "react";
import type { View } from "../../game/types";
import { narration } from "../narrator";
import { store, useStored } from "../storage";
import { clipFor } from "./clips";
import { sound } from "./engine";
import type { Mood } from "./music";

/** The sound switches of this device. Off until somebody turns them on. */
export function useSoundSettings() {
  const on = useStored("sound") === "1";
  const music = useStored("music") !== "0";
  return {
    on,
    music,
    /** Call from a tap handler, browsers only start sound on a tap. */
    toggle: () => {
      store("sound", on ? null : "1");
      if (on) sound.sleep();
      else sound.wake();
    },
    toggleMusic: () => store("music", music ? "0" : null),
  };
}

/** Plays the narrator for each new moment and the music for the time of day. */
export function useGameSound(view: View, mood: Mood) {
  const { on, music } = useSoundSettings();
  const moment = [view.phase, view.round, view.step, view.announce?.kind, view.vote?.kind, view.vote?.round].join(":");
  const clip = clipFor(view);
  const text = narration(view);
  const told = useRef(moment);

  useEffect(() => {
    sound.setMusic(on && music ? mood : null);
  }, [on, music, mood]);

  useEffect(() => {
    if (told.current === moment) return;
    told.current = moment;
    if (on && clip) void sound.narrate(clip, text);
  }, [moment, on, clip, text]);

  // After a reload the switch is still on, but the browser waits for a tap.
  useEffect(() => {
    if (!on) return;
    const wake = () => sound.wake();
    document.addEventListener("pointerdown", wake);
    return () => document.removeEventListener("pointerdown", wake);
  }, [on]);

  useEffect(() => () => sound.sleep(), []);
}
