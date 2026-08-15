"use client";

import { Search, CreditCard, DollarSign, Banknote, Smartphone, ShoppingCart, PauseCircle, XCircle } from 'lucide-react';

interface ShortcutsBarProps {
  onHoldSale?: () => void;
  onSearch?: () => void;
  onToggleCredit?: () => void;
  onCashUsd?: () => void;
  onCashBs?: () => void;
  onPagoMovil?: () => void;
  onCharge?: () => void;
  onClear?: () => void;
}

interface ShortcutButtonProps {
  label: string;
  keyHint: string;
  color: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

function ShortcutButton({ label, keyHint, color, icon, onClick }: ShortcutButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold
        shadow-sm hover:shadow-md active:shadow-sm active:scale-[0.96]
        transition-all duration-150 select-none
        ${color}
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      {icon}
      <span className="flex-shrink-0">{label}</span>
      <kbd className="text-[9px] font-semibold opacity-60 bg-black/10 rounded px-1 py-0.5 leading-none">{keyHint}</kbd>
    </button>
  );
}

export function ShortcutsBar({ onHoldSale, onSearch, onToggleCredit, onCashUsd, onCashBs, onPagoMovil, onCharge, onClear }: ShortcutsBarProps) {
  return (
    <div className="flex flex-wrap gap-1.5 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800 rounded-xl px-3 py-2 border border-slate-200/60 dark:border-slate-700/60">
      <ShortcutButton label="Buscar" keyHint="F2" color="bg-blue-500 text-white hover:bg-blue-600 shadow-blue-500/20"
        icon={<Search className="w-3.5 h-3.5" />} onClick={onSearch} />
      <ShortcutButton label="Credito" keyHint="F4" color="bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20"
        icon={<CreditCard className="w-3.5 h-3.5" />} onClick={onToggleCredit} />
      <ShortcutButton label="Efectivo$" keyHint="F5" color="bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20"
        icon={<DollarSign className="w-3.5 h-3.5" />} onClick={onCashUsd} />
      <ShortcutButton label="Efectivo" keyHint="F6" color="bg-green-500 text-white hover:bg-green-600 shadow-green-500/20"
        icon={<Banknote className="w-3.5 h-3.5" />} onClick={onCashBs} />
      <ShortcutButton label="PMovil" keyHint="F7" color="bg-violet-500 text-white hover:bg-violet-600 shadow-violet-500/20"
        icon={<Smartphone className="w-3.5 h-3.5" />} onClick={onPagoMovil} />
      <ShortcutButton label="COBRAR" keyHint="F8" color="bg-red-500 text-white hover:bg-red-600 shadow-red-500/20"
        icon={<ShoppingCart className="w-3.5 h-3.5" />} onClick={onCharge} />
      <ShortcutButton label="Espera" keyHint="F9" color="bg-orange-500 text-white hover:bg-orange-600 shadow-orange-500/20"
        icon={<PauseCircle className="w-3.5 h-3.5" />} onClick={onHoldSale} />
      <ShortcutButton label="Vaciar" keyHint="Esc" color="bg-slate-400 text-white hover:bg-slate-500 shadow-slate-400/20"
        icon={<XCircle className="w-3.5 h-3.5" />} onClick={onClear} />
    </div>
  );
}
