"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useDirector, SPEEDS } from "@/store/director";
import { useOrchestrator } from "@/store/orchestrator";
import type { Focus } from "@/engine/scenario";

/** Number row → the six camera presets, in the order the legend lists them. */
const PRESET_KEYS: Record<string, Focus> = {
  "1": "overview",
  "2": "hub",
  "3": "cloud",
  "4": "onprem",
  "5": "diode",
  "6": "airgapped",
};

/** Anything that owns the keyboard while focused: typing never triggers a presenter key. */
const TEXT_ENTRY =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="combobox"], [role="listbox"], [role="option"], [role="menu"], [role="menuitem"], [role="slider"]';

/**
 * Focused controls that would also react to Space on their own (a button fires click on keyup,
 * a radix switch/tab handles the key itself). Space is still handled, but the control is blurred
 * first so it cannot double-fire.
 */
const SPACE_OWNERS = "button, [role=switch], [role=tab], [role=tablist], a, summary";

const isElement = (t: EventTarget | null): t is Element => t instanceof Element;
const isTextEntry = (t: EventTarget | null) => isElement(t) && t.closest(TEXT_ENTRY) !== null;
const inDialog = (t: EventTarget | null) => isElement(t) && t.closest('[role="dialog"]') !== null;
const inTablist = (t: EventTarget | null) => isElement(t) && t.closest('[role="tablist"]') !== null;

function blurActive() {
  const el = document.activeElement;
  if (el instanceof HTMLElement) el.blur();
}

function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.()?.catch(() => {});
    } else {
      // On the root element so radix portals (body) stay inside the fullscreen subtree.
      void document.documentElement.requestFullscreen?.({ navigationUI: "hide" })?.catch(() => {});
    }
  } catch {
    /* unsupported (iframe without allowfullscreen, old browser) */
  }
}

function onKey(e: KeyboardEvent) {
  // Browser and OS shortcuts stay untouched; IME composition is never intercepted.
  if (e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
  const d = useDirector.getState();
  // The opener owns the keyboard while it is on screen (IntroOverlay dismisses on Space/Enter/Esc).
  if (d.intro) return;
  // While the legend is open only "?" is ours; radix owns Escape and Tab.
  if (d.legendOpen) {
    if (e.key === "?") {
      e.preventDefault();
      d.setLegendOpen(false);
    }
    return;
  }
  if (isTextEntry(e.target) || inDialog(e.target)) return;

  const key = e.key;
  const lower = key.length === 1 ? key.toLowerCase() : key;

  switch (lower) {
    case " ": {
      // Always cancel the default: no page scroll, no click on a focused button at keyup.
      e.preventDefault();
      if (e.repeat) return;
      if (isElement(e.target) && e.target.closest(SPACE_OWNERS)) blurActive();
      if (d.status === "playing") d.pause();
      else if (d.status === "paused") d.resume();
      else void d.play();
      return;
    }
    case "n":
    case "ArrowRight": {
      if (inTablist(e.target)) return; // radix roving focus owns the arrows inside the tab strip
      if (lower === "ArrowRight") e.preventDefault();
      if (d.status === "playing" || d.status === "paused") d.next();
      return;
    }
    case "ArrowLeft": {
      if (inTablist(e.target)) return;
      e.preventDefault();
      // Re-centre on the current step's subject: undoes mouse orbiting without changing the step.
      d.setFocus(d.stepIndex >= 0 ? (d.steps[d.stepIndex]?.focus ?? "overview") : "overview");
      return;
    }
    case "1":
    case "2":
    case "3":
    case "4":
    case "5":
    case "6": {
      d.setFocus(PRESET_KEYS[lower]);
      return;
    }
    case "+":
    case "=": {
      const i = SPEEDS.indexOf(d.speed);
      d.setSpeed(SPEEDS[Math.min(i + 1, SPEEDS.length - 1)]);
      return;
    }
    case "-": {
      const i = SPEEDS.indexOf(d.speed);
      d.setSpeed(SPEEDS[Math.max(i - 1, 0)]);
      return;
    }
    case "r": {
      if (e.repeat) return;
      if (!e.shiftKey) {
        toast("Reset needs SHIFT+R", { description: "Guards against an accidental restart mid-presentation." });
        return;
      }
      // Same as the top-bar reset button: stop the director, restore the seed.
      d.stop();
      useOrchestrator.getState().reset();
      return;
    }
    case "s": {
      if (e.repeat) return;
      d.toggleSound(); // a user gesture: unlocks the AudioContext
      return;
    }
    case "m": {
      if (e.repeat) return;
      d.setReducedMotion(!d.reducedMotion);
      return;
    }
    case "f": {
      if (e.repeat) return;
      toggleFullscreen();
      return;
    }
    case "j": {
      if (e.repeat) return;
      d.toggleJury();
      return;
    }
    case "?": {
      e.preventDefault();
      if (e.repeat) return;
      d.setLegendOpen(true);
      return;
    }
    default:
      return;
  }
}

/**
 * Presenter hotkeys. One window listener that reads the stores at keypress time, so this
 * component never re-renders. Keys are listed in the ShortcutLegend ("?").
 */
export function Hotkeys() {
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
