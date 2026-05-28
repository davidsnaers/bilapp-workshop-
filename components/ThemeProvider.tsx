"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({
  theme: "light",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = localStorage.getItem("bilapp-workshop-theme") as Theme | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.style.setProperty("--ws-bg", "#242424");
      root.style.setProperty("--ws-surface", "#2a2a2a");
      root.style.setProperty("--ws-border", "#3a3a3a");
      root.style.setProperty("--ws-text", "#f4f4f4");
      root.style.setProperty("--ws-muted", "#888");
      root.style.setProperty("--ws-amber", "#E8A800");
      root.classList.add("ws-dark");
    } else {
      root.style.setProperty("--ws-bg", "#f9fafb");
      root.style.setProperty("--ws-surface", "#ffffff");
      root.style.setProperty("--ws-border", "#e5e7eb");
      root.style.setProperty("--ws-text", "#111827");
      root.style.setProperty("--ws-muted", "#6b7280");
      root.style.setProperty("--ws-amber", "#F5B301");
      root.classList.remove("ws-dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("bilapp-workshop-theme", next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
