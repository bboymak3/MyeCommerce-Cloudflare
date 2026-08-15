"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { CurrentUser } from "./users-tab";

interface LoginScreenProps {
  onLogin: (user: CurrentUser & { token?: string }) => void;
  storeName?: string;
}

export default function LoginScreen({ onLogin, storeName = "MyeCommerce" }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Estado para forzar cambio de contraseña
  const [showForceChange, setShowForceChange] = useState(false);
  const [pendingUser, setPendingUser] = useState<CurrentUser | null>(null);
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

      const data = await res.json();

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

      // Store token JWT and user data
      if (data.token) {
        localStorage.setItem("myecommerce_token", data.token);
      }
      localStorage.setItem("myecommerce_user", JSON.stringify(data));
      onLogin(data);
      toast.success(`Bienvenido, ${data.fullName || data.username}`);
    } catch {
      toast.error("Error de conexion con el servidor");
    } finally {
      setLoading(false);
    }
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

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Error al cambiar la contrasena");
        return;
      }

      // Contraseña cambiada — guardar nuevo token si viene
      if (pendingUser) {
        if (data.token) {
          localStorage.setItem("myecommerce_token", data.token);
        }
        localStorage.setItem("myecommerce_user", JSON.stringify(pendingUser));
        onLogin(pendingUser);
        toast.success("Contrasena actualizada correctamente");
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
                  autoFocus
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
    </div>
  );
}