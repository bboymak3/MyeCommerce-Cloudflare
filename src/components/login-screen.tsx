"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { CurrentUser } from "./users-tab";

interface BusinessInfo {
  name: string;
  active: boolean;
  reason: string;
  plan: string;
  expiresAt: string | null;
}

const SUPPORT_WHATSAPP = "584220550136";

interface LoginScreenProps {
  onLogin: (user: CurrentUser & { token?: string }) => void;
  storeName?: string;
}

export default function LoginScreen({ onLogin, storeName = "MyeCommerce" }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Aviso de confirmacion del negocio + estado de licencia, antes de entrar
  const [confirmUser, setConfirmUser] = useState<(CurrentUser & { token?: string; business?: BusinessInfo | null }) | null>(null);

  // Estado para forzar cambio de contraseña
  const [showForceChange, setShowForceChange] = useState(false);
  const [pendingUser, setPendingUser] = useState<(CurrentUser & { token?: string; business?: BusinessInfo | null }) | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  // Toggle password visibility
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [showLoginPwd, setShowLoginPwd] = useState(false);

  const EyeButton = ({ show, onToggle }: { show: boolean; onToggle: () => void }) => (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
      tabIndex={-1}
    >
      {show ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  );


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      toast.error("Ingrese su usuario");
      return;
    }
    if (!password.trim()) {
      toast.error("Ingrese su contrasena");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json() as any;

      if (!res.ok) {
        toast.error(data.error || "Error al iniciar sesion");
        return;
      }

      // Si el servidor indica que debe cambiar la contraseña
      if (data.requirePasswordChange) {
        setPendingUser(data);
        setShowForceChange(true);
        toast.warning("Debe cambiar la contrasena por defecto antes de continuar");
        return;
      }

      finalizeOrConfirm(data);
    } catch {
      toast.error("Error de conexion con el servidor");
    } finally {
      setLoading(false);
    }
  };

  // Si hay negocio (Nexus One), primero se confirma antes de entrar; si no, entra directo
  const finalizeOrConfirm = (data: CurrentUser & { token?: string; business?: BusinessInfo | null }) => {
    if (data.business) {
      setConfirmUser(data);
    } else {
      completeLogin(data);
    }
  };

  const completeLogin = (data: CurrentUser & { token?: string }) => {
    if (data.token) {
      localStorage.setItem("myecommerce_token", data.token);
    }
    localStorage.setItem("myecommerce_user", JSON.stringify(data));
    onLogin(data);
    toast.success(`Bienvenido, ${data.fullName || data.username}`);
  };

  const cancelLogin = () => {
    setConfirmUser(null);
    setPassword("");
    fetch("/api/auth", { method: "DELETE" }).catch(() => { /* silent */ });
  };

  const handleForceChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error("La nueva contrasena debe tener al menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contrasenas no coinciden");
      return;
    }
    if (newPassword === "admin") {
      toast.error("No puede usar la contrasena por defecto");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: pendingUser?.id,
          currentPassword: password,
          newPassword,
        }),
      });

      const data = await res.json() as any;

      if (!res.ok) {
        toast.error(data.error || "Error al cambiar la contrasena");
        return;
      }

      // Contraseña cambiada — usar el nuevo token pero mantener el negocio/licencia ya conocidos
      if (pendingUser) {
        setShowForceChange(false);
        toast.success("Contrasena actualizada correctamente");
        finalizeOrConfirm({ ...pendingUser, token: data.token || pendingUser.token });
      }
    } catch {
      toast.error("Error de conexion con el servidor");
    } finally {
      setChangingPassword(false);
    }
  };

  // Pantalla de cambio forzado de contraseña
  if (showForceChange && pendingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 mb-4">
              <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Cambiar Contrasena</h1>
            <p className="text-amber-400 text-sm mt-2">
              Por seguridad, debe cambiar la contrasena por defecto antes de usar el sistema.
            </p>
          </div>

          <Card className="border-amber-500/30 bg-slate-800/80 backdrop-blur-sm shadow-2xl">
            <CardContent className="p-6">
              <form onSubmit={handleForceChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-slate-300 text-sm">
                    Nueva Contrasena
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPwd ? "text" : "password"}
                      placeholder="Minimo 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoFocus
                      autoComplete="new-password"
                      className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:ring-amber-500 focus:border-amber-500 pr-10"
                    />
                    <EyeButton show={showNewPwd} onToggle={() => setShowNewPwd(!showNewPwd)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-300 text-sm">
                    Confirmar Contrasena
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPwd ? "text" : "password"}
                      placeholder="Repita la nueva contrasena"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      onKeyDown={(e) => e.key === "Enter" && handleForceChangePassword(e)}
                      className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:ring-amber-500 focus:border-amber-500 pr-10"
                    />
                    <EyeButton show={showConfirmPwd} onToggle={() => setShowConfirmPwd(!showConfirmPwd)} />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-sm font-semibold bg-amber-600 hover:bg-amber-700"
                  disabled={changingPassword}
                >
                  {changingPassword ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Cambiando...
                    </span>
                  ) : (
                    "Cambiar Contrasena y Entrar"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-slate-500 text-xs mt-6">
            MyeCommerce POS v2.9.56
          </p>
        </div>
      </div>
    );
  }

  // Pantalla de login normal
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">{storeName}</h1>
          <p className="text-slate-400 text-sm mt-1">Sistema Punto de Venta</p>
        </div>

        {/* Login Card */}
        <Card className="border-slate-700 bg-slate-800/80 backdrop-blur-sm shadow-2xl">
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-300 text-sm">
                  Usuario
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Ingrese su usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoCapitalize="none"
                  autoComplete="username"
                  className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300 text-sm">
                  Contrasena
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showLoginPwd ? "text" : "password"}
                    placeholder="Ingrese su contrasena"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    onKeyDown={(e) => e.key === "Enter" && handleLogin(e)}
                    className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:ring-primary focus:border-primary pr-10"
                  />
                  <EyeButton show={showLoginPwd} onToggle={() => setShowLoginPwd(!showLoginPwd)} />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Ingresando...
                  </span>
                ) : (
                  "Iniciar Sesion"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-xs mt-6">
          MyeCommerce POS v2.9.56 &bull; Doble Moneda $/Bs
        </p>
      </div>

      {confirmUser?.business && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-sm border-slate-700 bg-slate-800 shadow-2xl">
            <CardContent className="p-6 space-y-4">
              {confirmUser.business.active ? (
                <>
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-3">
                      <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
                      </svg>
                    </div>
                    <p className="text-slate-400 text-sm">Este es su negocio</p>
                    <h2 className="text-xl font-bold text-white mt-1">{confirmUser.business.name}</h2>
                    <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/15 text-green-400">
                      Licencia activa
                    </span>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1 border-slate-600 text-slate-200" onClick={cancelLogin}>
                      Cancelar
                    </Button>
                    <Button className="flex-1" onClick={() => { const u = confirmUser; setConfirmUser(null); completeLogin(u); }}>
                      Aceptar
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/10 mb-3">
                      <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    </div>
                    <p className="text-slate-400 text-sm">Su negocio</p>
                    <h2 className="text-xl font-bold text-white mt-1">{confirmUser.business.name}</h2>
                    <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400">
                      Licencia vencida
                    </span>
                    <p className="text-slate-300 text-sm mt-3">{confirmUser.business.reason}</p>
                    <p className="text-slate-400 text-sm mt-2">Contacte a servicio tecnico para renovar su licencia.</p>
                  </div>
                  <a
                    href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
                      `Hola, mi negocio "${confirmUser.business.name}" tiene la licencia vencida y quiero renovarla.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full h-11 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12.031 5.999C8.148 5.999 5 9.147 5 13.03c0 1.406.42 2.796 1.2 3.976L5 22l5.144-1.174a7.98 7.98 0 001.887.229h.004c3.883 0 7.031-3.148 7.031-7.031A7.006 7.006 0 0012.031 5.999zm4.148 11.176a5.95 5.95 0 01-4.146 1.712h-.003a5.944 5.944 0 01-3.032-.83l-.218-.13-2.256.593.602-2.201-.142-.226a5.92 5.92 0 01-.908-3.16 5.949 5.949 0 011.702-4.191A5.95 5.95 0 0112.031 7c1.588 0 3.081.62 4.204 1.744a5.948 5.948 0 011.744 4.207c0 1.588-.62 3.081-1.8 4.224z"/>
                    </svg>
                    Contactar por WhatsApp
                  </a>
                  <Button variant="outline" className="w-full border-slate-600 text-slate-200" onClick={cancelLogin}>
                    Cerrar
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}