export const STORAGE_KEY = "bend-effects:last-signal";

// Browser APIs live here. Bend chooses when to call them and consumes their results.
export function createBrowserHost({ message, tone, delay, failNetwork, paint, saved, finish }) {
  return {
    message: () => message,
    palette: async () => {
      // A same-origin JSON resource makes the demo work without an API key.
      const response = await fetch(failNetwork ? "./missing-palette.json" : "./palette.json");
      if (!response.ok) throw new Error(`Palette request failed (HTTP ${response.status}).`);
      const palette = await response.json();
      const hue = palette.tones?.[tone]?.hue;
      if (!Number.isInteger(hue) || hue < 0 || hue > 360) throw new Error("Invalid palette hue.");
      return hue;
    },
    paint,
    delay: () => delay,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    save: (text) => {
      try {
        localStorage.setItem(STORAGE_KEY, text);
        saved(text);
        return true;
      } catch {
        return false;
      }
    },
    finish,
  };
}
