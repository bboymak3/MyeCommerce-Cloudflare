"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";

export default function BackupTab() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [dbStats, setDbStats] = useState<{
    products: number; categories: number; clients: number;
    sales: number; users: number; devolutions: number; cashClosings: number;
  } | null>(null);
  const [backupVersion, setBackupVersion] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStats = async () => {
    try {
      const res = await authFetch("/api/backup/stats");
      if (res.ok) {
        const data = await res.json();
        setDbStats(data);
        setBackupVersion(data.version || "");
      }
    } catch {}
    const stored = localStorage.getItem("myecommerce_last_backup");
    if (stored) setLastBackup(stored);
  };

  useEffect(() => { loadStats(); }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await authFetch("/api/backup");
      if (!res.ok) throw new Error("Error al exportar");
      const data = await res.json();

      // Create JSON file
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.download = `myecommerce_respaldo_${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Save last backup time
      const now = new Date().toLocaleString("es-VE");
      localStorage.setItem("myecommerce_last_backup", now);
      setLastBackup(now);
      toast.success("Respaldo descargado correctamente");
    } catch (error: any) {
      toast.error("Error al crear respaldo: " + (error.message || ""));
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".json")) {
        toast.error("Seleccione un archivo .json valido");
        return;
      }
      setImportFile(file);
      setConfirmRestore(false);
    }
  };

  const handleRestore = async () => {
    if (!importFile) { toast.error("Seleccione un archivo de respaldo"); return; }
    if (!confirmRestore) { setConfirmRestore(true); return; }

    setImporting(true);
    try {
      const text = await importFile.text();
      const data = JSON.parse(text);

      // Validate backup structure
      if (!data.products && !data.sales) {
        throw new Error("El archivo no parece un respaldo valido de MyeCommerce");
      }

      const res = await authFetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al restaurar");
      }

      toast.success("Respaldo restaurado correctamente. La pagina se recargara...");
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      toast.error("Error al restaurar: " + (error.message || "Archivo invalido"));
      setConfirmRestore(false);
    } finally {
      setImporting(false);
    }
  };

  const handleCancelRestore = () => {
    setConfirmRestore(false);
    setImportFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl mt-0.5">&#128230;</div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-800">Respaldo y Restauracion</h3>
              <p className="text-xs text-blue-700 mt-1">
                Aqui puedes crear respaldos completos de todos tus datos (productos, ventas, clientes, configuracion) 
                y restaurarlos cuando lo necesites. El respaldo se descarga como archivo JSON en tu computadora. 
                Se recomienda hacer un respaldo al menos una vez por semana.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Stats */}
      {dbStats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              &#128202; Estado de la Base de Datos
              {backupVersion && <Badge variant="secondary" className="text-[9px]">v{backupVersion}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {[
                { label: "Productos", value: dbStats.products, color: "text-green-600" },
                { label: "Categorias", value: dbStats.categories, color: "text-blue-600" },
                { label: "Clientes", value: dbStats.clients, color: "text-purple-600" },
                { label: "Ventas", value: dbStats.sales, color: "text-amber-600" },
                { label: "Usuarios", value: dbStats.users, color: "text-indigo-600" },
                { label: "Devoluciones", value: dbStats.devolutions, color: "text-red-600" },
                { label: "Cierres de Caja", value: dbStats.cashClosings, color: "text-teal-600" },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-2 rounded bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
            {lastBackup && (
              <p className="text-xs text-muted-foreground mt-3">
                &#128197; Ultimo respaldo: {lastBackup}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Export */}
      <Card className="border-green-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            &#128190; Crear Respaldo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Descarga un archivo JSON con todos los datos de tu sistema. Guarda este archivo en un lugar seguro 
            (USB, Google Drive, etc.) para proteger tu informacion.
          </p>
          <Button
            className="w-full sm:w-auto"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <span className="animate-spin mr-2 inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Creando respaldo...
              </>
            ) : (
              <>
                &#128190; Descargar Respaldo Completo
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Import */}
      <Card className="border-amber-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
            &#9888;&#65039; Restaurar Respaldo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-amber-700 font-medium bg-amber-50 p-2 rounded">
            <strong>ADVERTENCIA:</strong> Restaurar un respaldo reemplazara TODOS los datos actuales del sistema. 
            Esta accion no se puede deshacer. Asegurate de tener un respaldo actual antes de continuar.
          </p>

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="text-xs file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 file:cursor-pointer"
            />
          </div>

          {importFile && (
            <div className="p-3 bg-muted/50 rounded space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{importFile.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {(importFile.size / 1024).toFixed(1)} KB
                </Badge>
              </div>

              {!confirmRestore ? (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleRestore}
                  disabled={importing}
                >
                  Restaurar este Respaldo
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-center">
                    <p className="text-sm font-bold text-red-700">¿Esta completamente seguro?</p>
                    <p className="text-xs text-red-600">Se reemplazaran TODOS los datos actuales</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="destructive" className="flex-1" onClick={handleRestore} disabled={importing}>
                      {importing ? "Restaurando..." : "SI, Restaurar Ahora"}
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={handleCancelRestore}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="border-muted">
        <CardContent className="p-3">
          <p className="text-xs font-semibold mb-2">&#128161; Consejos de Seguridad</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Haz un respaldo antes de restaurar otro archivo</li>
            <li>Guarda copias en al menos 2 lugares diferentes</li>
            <li>Usa el boton &quot;RESPALDAR-BD.bat&quot; para copias rapidas desde el escritorio</li>
            <li>Los respaldos contienen toda tu informacion comercial, protegelos</li>
            <li>Nunca edites el archivo JSON manualmente</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
