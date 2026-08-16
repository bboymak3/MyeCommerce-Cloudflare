"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type ThemeMode = "light" | "dark" | "professional";
type ColorTheme = "blue" | "green" | "red" | "purple";

interface ThemeContextType {
  mode: ThemeMode;
  colorTheme: ColorTheme;
  setMode: (mode: ThemeMode) => void;
  setColorTheme: (theme: ColorTheme) => void;
  resolvedTheme: string;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: "light",
  colorTheme: "blue",
  setMode: () => {},
  setColorTheme: () => {},
  resolvedTheme: "light-blue",
});

export function useThemeContext() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [colorTheme, setColorTheme] = useState<ColorTheme>("blue");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("myecommerce-theme");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.mode) setMode(parsed.mode);
        if (parsed.colorTheme) setColorTheme(parsed.colorTheme);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.setAttribute("data-theme", colorTheme);
    if (mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    if (mode === "professional") {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "blue");
    }
    localStorage.setItem("myecommerce-theme", JSON.stringify({ mode, colorTheme }));
  }, [mode, colorTheme, mounted]);

  const resolvedTheme = `${mode}-${colorTheme}`;

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ mode, colorTheme, setMode, setColorTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
