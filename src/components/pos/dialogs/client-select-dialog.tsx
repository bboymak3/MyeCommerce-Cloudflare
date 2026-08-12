"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { ClientData } from "../types";

interface ClientSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSearch: string;
  onClientSearchChange: (v: string) => void;
  clientResults: ClientData[];
  onSelectClient: (client: ClientData) => void;
  onSelectFinalClient: () => void;
  onSelectNoClient: () => void;
  onOpenNewClient: () => void;
}

export function ClientSelectDialog({
  open, onOpenChange,
  clientSearch, onClientSearchChange,
  clientResults, onSelectClient,
  onSelectFinalClient, onSelectNoClient, onOpenNewClient,
}: ClientSelectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Seleccionar Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 text-xs" onClick={onSelectFinalClient}>Cliente Final</Button>
            <Button variant="outline" className="flex-1 text-xs" onClick={onSelectNoClient}>Sin Cliente</Button>
            <Button variant="outline" className="flex-1 text-xs" onClick={onOpenNewClient}>+ Nuevo</Button>
          </div>
          <Separator />
          <Input placeholder="Buscar por nombre, cedula, RIF..." value={clientSearch}
            onChange={(e) => onClientSearchChange(e.target.value)} />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {clientResults.map((client) => (
              <button key={client.id} onClick={() => onSelectClient(client)}
                className="w-full flex items-center justify-between p-2 rounded border hover:bg-muted text-left text-xs">
                <div>
                  <p className="font-medium">{client.fullName}</p>
                  <p className="text-muted-foreground">{client.docType}-{client.docNumber}{client.phone ? ` | ${client.phone}` : ""}</p>
                </div>
                <Badge variant={client.isFinalClient ? "secondary" : "default"} className="text-[8px]">
                  {client.isFinalClient ? "FINAL" : client.type === "natural" ? "NAT" : "JUR"}
                </Badge>
              </button>
            ))}
            {clientResults.length === 0 && clientSearch.length > 0 && (
              <p className="text-center text-muted-foreground text-xs py-4">No se encontraron clientes</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
