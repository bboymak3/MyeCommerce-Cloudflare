"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Truck, Phone, Mail, MapPin, Search } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

interface Supplier {
  id: string;
  name: string;
  rif: string;
  phone: string;
  email: string;
  address: string;
  contact: string;
  notes: string;
  isActive: boolean;
  _count?: { purchases: number };
}

export default function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", rif: "", phone: "", email: "", address: "", contact: "", notes: "" });
  const searchRef = useRef<NodeJS.Timeout | null>(null);

  const load = async (q?: string) => {
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : "";
      const res = await authFetch(`/api/suppliers${params}`);
      setSuppliers(await res.json());
    } catch { toast.error("Error al cargar proveedores"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (v: string) => {
    setSearch(v);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => load(v), 300);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", rif: "", phone: "", email: "", address: "", contact: "", notes: "" });
    setShowDialog(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, rif: s.rif, phone: s.phone, email: s.email, address: s.address, contact: s.contact, notes: s.notes });
    setShowDialog(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Nombre requerido"); return; }
    setSaving(true);
    try {
      const res = await authFetch("/api/suppliers", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...form } : form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(editing ? "Proveedor actualizado" : "Proveedor registrado");
      setShowDialog(false);
      load(search);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (s: Supplier) => {
    if (!confirm(`Desactivar proveedor "${s.name}"?`)) return;
    try {
      await authFetch(`/api/suppliers?id=${s.id}`, { method: "DELETE" });
      toast.success("Proveedor desactivado");
      load(search);
    } catch { toast.error("Error al desactivar"); }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <p className="text-2xl font-bold">{suppliers.length}</p>
          <p className="text-xs text-muted-foreground">Total Proveedores</p>
        </Card>
        <Card className="p-3">
          <p className="text-2xl font-bold">{suppliers.filter(s => s.isActive).length}</p>
          <p className="text-xs text-muted-foreground">Activos</p>
        </Card>
        <Card className="p-3">
          <p className="text-2xl font-bold">{suppliers.reduce((sum, s) => sum + (s._count?.purchases || 0), 0)}</p>
          <p className="text-xs text-muted-foreground">Compras Totales</p>
        </Card>
      </div>

      {/* Search + Create */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar proveedor..." value={search} onChange={(e) => handleSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={openCreate}>+ Nuevo Proveedor</Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Nombre</th>
                  <th className="text-left p-3 font-medium">RIF</th>
                  <th className="text-left p-3 font-medium">Contacto</th>
                  <th className="text-right p-3 font-medium">Compras</th>
                  <th className="text-center p-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="font-medium flex items-center gap-2">
                        <Truck className="h-4 w-4 text-primary" />
                        {s.name}
                      </div>
                      {s.address && <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{s.address}</p>}
                    </td>
                    <td className="p-3 font-mono text-xs">{s.rif || "-"}</td>
                    <td className="p-3 text-xs">
                      {s.contact && <p>{s.contact}</p>}
                      {s.phone && <p className="text-muted-foreground">{s.phone}</p>}
                      {s.email && <p className="text-muted-foreground">{s.email}</p>}
                    </td>
                    <td className="p-3 text-right font-bold">{s._count?.purchases || 0}</td>
                    <td className="p-3 text-center">
                      <div className="flex gap-1 justify-center">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)} className="h-7 text-xs">Editar</Button>
                        <Button variant="ghost" size="sm" onClick={() => remove(s)} className="h-7 text-xs text-destructive">X</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {suppliers.length === 0 && (
                  <tr><td colSpan={5} className="text-center p-8 text-muted-foreground">{loading ? "Cargando..." : "No hay proveedores registrados"}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nombre / Razon Social *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre del proveedor" />
              </div>
              <div>
                <Label>RIF</Label>
                <Input value={form.rif} onChange={(e) => setForm({ ...form, rif: e.target.value })} placeholder="J-00000000-0" />
              </div>
              <div>
                <Label>Persona de Contacto</Label>
                <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="Nombre del contacto" />
              </div>
              <div>
                <Label>Telefono</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+58 412-1234567" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="correo@proveedor.com" />
              </div>
              <div className="col-span-2">
                <Label>Direccion</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Direccion del proveedor" />
              </div>
              <div className="col-span-2">
                <Label>Notas</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observaciones adicionales" />
              </div>
            </div>
            <Button className="w-full" onClick={save} disabled={saving}>{saving ? "Guardando..." : editing ? "Actualizar" : "Registrar Proveedor"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
