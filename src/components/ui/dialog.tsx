"use client";

import { cn } from "@/lib/utils";
import { createContext, useContext, useState } from "react";

interface DialogContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextType>({ open: false, setOpen: () => {} });

function Dialog({ children, open, onOpenChange }: any) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  return (
    <DialogContext.Provider value={{ open: isOpen, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

function DialogTrigger({ children, ...props }: any) {
  return <div onClick={(e) => {}} {...props}>{children}</div>;
}

function DialogContent({ className, children, ...props }: any) {
  const { open, setOpen } = useContext(DialogContext);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/80" />
      <div className={cn("relative z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border bg-background p-6 shadow-lg", className)} onClick={(e) => e.stopPropagation()} {...props}>
        {children}
        <button className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100" onClick={() => setOpen(false)}>✕</button>
      </div>
    </div>
  );
}

function DialogHeader({ className, children, ...props }: any) {
  return <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left mb-4", className)} {...props}>{children}</div>;
}

function DialogTitle({ className, children, ...props }: any) {
  return <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props}>{children}</h2>;
}

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle };
