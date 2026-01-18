import { writable } from "svelte/store";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "./firebase";

export const session = writable({
  user: null,
  name: "",
  mode: "BASE",
  ready: false,
});

let started = false;

export function startSession() {
  if (started) return;
  started = true;

  onAuthStateChanged(auth, async (u) => {
    if (u) {
      session.update((s) => ({ ...s, user: u, ready: true }));
      return;
    }

    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.error("[session] Anonymous login failed:", e);
      session.update((s) => ({ ...s, ready: true }));
    }
  });
}

export function setProfile({ name, mode }) {
  session.update((s) => ({
    ...s,
    name: typeof name === "string" ? name : s.name,
    mode: typeof mode === "string" ? mode : s.mode,
  }));
}

export function resetProfile() {
  session.update((s) => ({
    ...s,
    name: "",
    mode: "BASE",
  }));
}
