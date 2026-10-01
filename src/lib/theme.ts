import type { CSSProperties } from "react";
import type { Theme } from "./game";

export const PRESETS: Record<string, Omit<Theme, "logo" | "bgImage" | "preset">> = {
  Sunset: { primary: "#e8622c", accent: "#f3c73c", background: "#fbf5ea", button: "#e8622c", bgType: "solid", background2: "#f7d9b8" },
  Ocean: { primary: "#1f7fa8", accent: "#6fd3c7", background: "#eef7f8", button: "#1f7fa8", bgType: "gradient", background2: "#cfe8f2" },
  Forest: { primary: "#2f8a57", accent: "#d9c55a", background: "#f1f5ec", button: "#2f8a57", bgType: "solid", background2: "#d8e6c9" },
  Berry: { primary: "#b23a7a", accent: "#ffb3c7", background: "#fbf0f4", button: "#b23a7a", bgType: "gradient", background2: "#f2d1e0" },
  Midnight: { primary: "#ff7a45", accent: "#ffd166", background: "#1c1b2b", button: "#ff7a45", bgType: "gradient", background2: "#2e2946" },
  Mono: { primary: "#222222", accent: "#e5e5e5", background: "#fafafa", button: "#222222", bgType: "solid", background2: "#eeeeee" },
};

export const DEFAULT_ANSWERS = ["#e0533a", "#2b93a8", "#e9b739", "#a8407a", "#3a9e62", "#5563b8"];

export const DEFAULT_THEME: Theme = { preset: "Sunset", ...PRESETS["Sunset"]!, logo: "", bgImage: "" };

export function themeOf(t: Partial<Theme> | null | undefined): Theme {
  return { ...DEFAULT_THEME, ...(t ?? {}) };
}

function lum(hex: string) {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m || m.length < 3) return 1;
  const [r, g, b] = m.map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const on = (hex: string) => (lum(hex) > 0.4 ? "#2a211b" : "#fffaf2");

/** CSS variables that re-skin everything inside a themed area. */
export function themeStyle(input: Partial<Theme> | null | undefined): CSSProperties {
  const t = themeOf(input);
  const dark = lum(t.background) < 0.2;
  const fg = dark ? "#f7f2ea" : "#2a211b";
  const vars: Record<string, string> = {
    "--primary": t.primary,
    "--primary-foreground": on(t.primary),
    "--ring": t.primary,
    "--accent": t.accent,
    "--accent-foreground": on(t.accent),
    "--btn": t.button,
    "--btn-foreground": on(t.button),
    "--background": t.background,
    "--foreground": fg,
    "--ink": fg,
    "--card-foreground": fg,
    "--card": dark ? `color-mix(in oklab, ${t.background} 85%, white)` : `color-mix(in oklab, ${t.background} 40%, white)`,
    "--secondary": `color-mix(in oklab, ${t.background} 85%, ${fg})`,
    "--muted-foreground": `color-mix(in oklab, ${fg} 62%, ${t.background})`,
  };
  const answers = (t.answers ?? []).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  if (answers.length === 6) {
    answers.forEach((c, i) => { vars[`--a${i + 1}`] = c; });
    const light = answers.filter((c) => lum(c) > 0.4).length;
    vars["--on-answer"] = light > 3 ? "#2a211b" : "#fffaf2";
  }
  let background: string = t.background;
  if (t.bgType === "gradient") background = `linear-gradient(160deg, ${t.background}, ${t.background2})`;
  if (t.bgType === "image" && t.bgImage)
    background = `linear-gradient(color-mix(in oklab, ${t.background} 55%, transparent), color-mix(in oklab, ${t.background} 55%, transparent)), url("${t.bgImage}") center/cover fixed`;
  return { ...(vars as CSSProperties), background, color: fg };
}
