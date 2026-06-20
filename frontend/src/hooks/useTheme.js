import { useState, useEffect } from "react";

export const THEMES = [
  { id: "cold-black",   label: "Cold Black",   icon: "🌑", description: "Pure monochromatic dark" },
  { id: "neon-cyber",   label: "Neon Cyber",   icon: "⚡", description: "Deep dark with neon accents" },
  { id: "nordic-light", label: "Nordic Light", icon: "☀️", description: "Clean ice-white mode" },
];

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("sl-theme") || "cold-black"; }
    catch { return "cold-black"; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("sl-theme", theme); } catch { /* ignore */ }
  }, [theme]);

  const currentTheme = THEMES.find((t) => t.id === theme) || THEMES[0];

  return { theme, setTheme, themes: THEMES, currentTheme };
}
