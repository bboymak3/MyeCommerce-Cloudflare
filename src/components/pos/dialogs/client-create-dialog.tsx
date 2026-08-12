"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ClientCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: {
    type: string;
    docType: string;
    docNumber: string;
    firstName: string;
    lastName: string;
    businessName: string;
    phone: string;
    email: string;
    address: string;
  };
  onFormChange: (form: any) => void;
  onSubmit: () => void;
}

export function ClientCreateDialog({ open, onOpenChange, form, onFormChange, onSubmit }: ClientCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Cliente Nuevo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => onFormChange({ ...form, type: "natural", docType: "V" })}
              className={`flex-1 p-2 rounded border text-xs font-medium ${form.type === "natural" ? "bg-primary text-primary-foreground" : ""}`}>Natural</button>
            <button type="button" onClick={() => onFormChange({ ...form, type: "juridico", docType: "J" })}
              className={`flex-1 p-2 rounded border text-xs font-medium ${form.type === "juridico" ? "bg-primary text-primary-foreground" : ""}`}>Juridico</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tipo Doc</Label>
              <select value={form.docType} onChange={(e) => onFormChange({ ...form, docType: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs">
                {form.type === "natural" ? (
                  <><option value="V">V</option><option value="E">E</option><option value="P">P</option></>
                ) : (
                  <><option value="J">J</option><option value="G">G</option><option value="V">V</option></>
                )}
              </select>
            </div>
            <div>
              <Label className="text-xs">Numero *</Label>
              <Input value={form.docNumber} onChange={(e) => onFormChange({ ...form, docNumber: e.target.value.toUpperCase() })} className="h-9 text-xs" />
            </div>
          </div>
          {form.type === "natural" ? (
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Nombre *</Label><Input value={form.firstName} onChange={(e) => onFormChange({ ...form, firstName: e.target.value })} className="h-9 text-xs" /></div>
              <div><Label className="text-xs">Apellido *</Label><Input value={form.lastName} onChange={(e) => onFormChange({ ...form, lastName: e.target.value })} className="h-9 text-xs" /></div>
            </div>
          ) : (
            <div><Label className="text-xs">Razon Social *</Label><Input value={form.businessName} onChange={(e) => onFormChange({ ...form, businessName: e.target.value })} className="h-9 text-xs" /></div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Telefono</Label><Input value={form.phone} onChange={(e) => onFormChange({ ...form, phone: e.target.value })} className="h-9 text-xs" /></div>
            <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={(e) => onFormChange({ ...form, email: e.target.value })} className="h-9 text-xs" /></div>
          </div>
          <div><Label className="text-xs">Direccion</Label><Input value={form.address} onChange={(e) => onFormChange({ ...form, address: e.target.value })} className="h-9 text-xs" /></div>
          <Button className="w-full" onClick={onSubmit}>Registrar y Seleccionar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
