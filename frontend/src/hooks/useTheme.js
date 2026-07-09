import { useState, useEffect } from "react";

export const THEMES = [
  { id: "glassmorphism", label: "Glassmorphism", icon: "🔮", description: "Dark glassmorphism with violet/cyan accents" },
];

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("sl-theme") || "glassmorphism"; }
    catch { return "glassmorphism"; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("sl-theme", theme); } catch { /* ignore */ }
  }, [theme]);

  const currentTheme = THEMES.find((t) => t.id === theme) || THEMES[0];

  return { theme, setTheme, themes: THEMES, currentTheme };
}
