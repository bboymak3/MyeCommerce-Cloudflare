"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";
import type { ClientData } from "../types";

export function useClients() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<ClientData[]>([]);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    type: "natural", docType: "V", docNumber: "", firstName: "", lastName: "",
    businessName: "", phone: "", email: "", address: "",
  });

  // Load clients on mount + select final client
  useEffect(() => {
    authFetch("/api/clients", {})
      .then((r) => r.json())
      .then((data) => {
        setClients(data);
        const fc = data.find((c: ClientData) => c.isFinalClient);
        if (fc) setSelectedClient(fc);
      })
      .catch(() => {});
  }, []);

  // Search clients
  const searchClients = useCallback(async (term: string) => {
    if (term.length < 1) { setClientResults([]); return; }
    try {
      const res = await authFetch(`/api/clients?search=${encodeURIComponent(term)}`);
      const data = await res.json();
      setClientResults(data.slice(0, 8));
    } catch { setClientResults([]); }
  }, []);

  // Quick select helpers
  const selectFinalClient = async () => {
    try {
      const res = await authFetch("/api/clients?search=CLIENTE+FINAL");
      const data = await res.json();
      const fc = data.find((c: ClientData) => c.isFinalClient);
      if (fc) {
        setSelectedClient(fc);
        setShowClientDialog(false);
        toast.success("Cliente Final seleccionado");
      }
    } catch {}
  };

  const selectNoClient = () => {
    setSelectedClient(null);
    setShowClientDialog(false);
  };

  const selectClient = (client: ClientData) => {
    setSelectedClient(client);
    setShowClientDialog(false);
    setClientSearch("");
    setClientResults([]);
    toast.success(`Cliente: ${client.fullName}`);
  };

  // Create client from POS
  const createQuickClient = async () => {
    const isJ = newClientForm.type === "juridico";
    const fullName = isJ ? newClientForm.businessName : `${newClientForm.firstName} ${newClientForm.lastName}`.trim();
    if (!fullName || !newClientForm.docNumber) {
      toast.error("Nombre y documento requeridos");
      return;
    }
    try {
      const res = await authFetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newClientForm, fullName }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const client = await res.json();
      setSelectedClient(client);
      setShowNewClientDialog(false);
      setShowClientDialog(false);
      toast.success("Cliente creado y seleccionado");
    } catch (e: any) { toast.error(e.message); }
  };

  return {
    clients, selectedClient, setSelectedClient,
    clientSearch, setClientSearch, clientResults,
    showClientDialog, setShowClientDialog,
    showNewClientDialog, setShowNewClientDialog,
    newClientForm, setNewClientForm,
    searchClients, selectFinalClient, selectNoClient, selectClient, createQuickClient,
  };
}
