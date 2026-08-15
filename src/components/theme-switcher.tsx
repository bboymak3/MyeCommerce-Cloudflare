"use client";

import { useState } from "react";
import { useThemeContext } from "./theme-provider";

const MODES = [
  { id: "light" as const, label: "Claro", icon: "☀️", desc: "Tema claro predeterminado" },
  { id: "dark" as const, label: "Oscuro", icon: "🌙", desc: "Modo oscuro elegante" },
  { id: "professional" as const, label: "Profesional", icon: "💼", desc: "Azul corporativo limpio" },
];

const COLORS = [
  { id: "blue" as const, label: "Azul", color: "#3b82f6" },
  { id: "green" as const, label: "Verde", color: "#10b981" },
  { id: "red" as const, label: "Coral", color: "#ef4444" },
  { id: "purple" as const, label: "Morado", color: "#8b5cf6" },
];

export default function ThemeSwitcher() {
  const { mode, colorTheme, setMode, setColorTheme } = useThemeContext();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-card hover:bg-accent/50 transition-all text-xs font-medium"
        title="Cambiar tema"
      >
        <span className="text-sm">{MODES.find(m => m.id === mode)?.icon}</span>
        <span className="hidden sm:inline">{MODES.find(m => m.id === mode)?.label}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border bg-card shadow-xl shadow-black/10 z-50 overflow-hidden">
            <div className="p-3 border-b bg-muted/30">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Modo de Tema</p>
            </div>
            <div className="p-2 space-y-1">
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setMode(m.id); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                    mode === m.id
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "hover:bg-muted"
                  }`}
                >
                  <span className="text-xl">{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{m.label}</p>
                    <p className="text-[10px] text-muted-foreground">{m.desc}</p>
                  </div>
                  {mode === m.id && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {mode !== "professional" && (
              <>
                <div className="p-3 border-t border-b bg-muted/30">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Color Principal</p>
                </div>
                <div className="p-3 flex justify-center gap-3">
                  {COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setColorTheme(c.id); setOpen(false); }}
                      className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center border-2 ${
                        colorTheme === c.id
                          ? "border-foreground scale-110 shadow-md"
                          : "border-transparent hover:border-muted-foreground/30 hover:scale-105"
                      }`}
                      style={{ backgroundColor: c.color }}
                      title={c.label}
                    >
                      {colorTheme === c.id && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
