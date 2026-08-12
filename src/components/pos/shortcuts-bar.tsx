"use client";

interface ShortcutsBarProps {
  onHoldSale?: () => void;
}

export function ShortcutsBar({ onHoldSale }: ShortcutsBarProps) {
  return (
    <div className="flex flex-wrap gap-1.5 bg-muted/60 rounded-lg px-3 py-1.5">
      <kbd className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-100 text-blue-800 font-bold text-xs border border-blue-200 shadow-sm">
        <span className="text-[10px] opacity-70">F2</span> Buscar
      </kbd>
      <kbd className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 shadow-sm">
        <span className="text-[10px] opacity-70">F4</span> Credito
      </kbd>
      <kbd className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-green-100 text-green-800 font-bold text-xs border border-green-200 shadow-sm">
        <span className="text-[10px] opacity-70">F5</span> Efectivo$
      </kbd>
      <kbd className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200 shadow-sm">
        <span className="text-[10px] opacity-70">F6</span> Efectivo
      </kbd>
      <kbd className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-100 text-purple-800 font-bold text-xs border border-purple-200 shadow-sm">
        <span className="text-[10px] opacity-70">F7</span> PMovil
      </kbd>
      <kbd
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-100 text-orange-800 font-bold text-xs border border-orange-200 shadow-sm cursor-pointer"
        onClick={onHoldSale}
        title="Poner en Espera"
      >
        <span className="text-[10px] opacity-70">F9</span> Espera
      </kbd>
      <kbd className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-100 text-red-800 font-bold text-xs border border-red-200 shadow-sm">
        <span className="text-[10px] opacity-70">F8</span> COBRAR
      </kbd>
      <kbd className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 font-bold text-xs border border-gray-200 shadow-sm">
        <span className="text-[10px] opacity-70">Esc</span> Vaciar
      </kbd>
    </div>
  );
}
