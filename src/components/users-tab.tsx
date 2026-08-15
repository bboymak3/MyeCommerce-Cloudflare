"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth-fetch";

export interface CurrentUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  permissions: Record<string, boolean>;
  avatar?: string;
}

interface UserRecord {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
  permissions: Record<string, boolean>;
  avatar: string;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

const PERMISSION_LABELS: Record<string, string> = {
  pos: "Punto de Venta",
  products: "Productos",
  clients: "Clientes",
  reports: "Informes",
  devolutions: "Devoluciones",
  cash_closing: "Cierre de Caja",
  config: "Configuracion",
  backup: "Respaldo",
};

const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS);

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  cajero: "Cajero",
  vendedor: "Vendedor",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800",
  cajero: "bg-blue-100 text-blue-800",
  vendedor: "bg-green-100 text-green-800",
};

interface UsersTabProps {
  currentUser: CurrentUser;
  onUserUpdate?: (user: CurrentUser) => void;
}

// Avatar component with initials fallback
function UserAvatar({ src, name, size = "md" }: { src?: string; name?: string; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-8 h-8 text-[10px]",
    md: "w-10 h-10 text-xs",
    lg: "w-20 h-20 text-2xl",
  };

  const initials = (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const [imgError, setImgError] = useState(false);

  if (src && !imgError) {
    return (
      <div className="relative">
        <img
          crossOrigin="anonymous"
          src={src}
          alt={name || "Avatar"}
          className={`${sizeClasses[size]} rounded-full object-cover border-2 border-primary/30`}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center text-primary font-bold`}>
      {initials}
    </div>
  );
}

export default function UsersTab({ currentUser, onUserUpdate }: UsersTabProps) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Create user dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState("cajero");
  const [newPermissions, setNewPermissions] = useState<Record<string, boolean>>({
    pos: true, products: false, clients: false, reports: false, devolutions: false, cash_closing: false,
  });
  const [newAvatar, setNewAvatar] = useState("");
  const [creating, setCreating] = useState(false);
  const [creatingAvatar, setCreatingAvatar] = useState(false);

  // Edit user dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({});
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState("cajero");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  // Change password dialog
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPasswordOwn, setNewPasswordOwn] = useState("");
  const [confirmPasswordOwn, setConfirmPasswordOwn] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Profile photo for current user
  const [showProfilePhotoDialog, setShowProfilePhotoDialog] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState(currentUser.avatar || "");
  const [savingProfileAvatar, setSavingProfileAvatar] = useState(false);

  // File input ref for gallery
  const createAvatarRef = useRef<HTMLInputElement>(null);
  const editAvatarRef = useRef<HTMLInputElement>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);

  // Role configs management
  const [roleConfigs, setRoleConfigs] = useState<Array<{id:string;roleName:string;label:string;permissions:Record<string,boolean>;color:string}>>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editRolePerms, setEditRolePerms] = useState<Record<string, boolean>>({});
  const [savingRolePerms, setSavingRolePerms] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const res = await authFetch("/api/users");
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch {
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const loadRoleConfigs = useCallback(async () => {
    try {
      const res = await authFetch("/api/roles");
      const data = await res.json();
      if (Array.isArray(data)) {
        setRoleConfigs(data.map((r: any) => ({ ...r, permissions: JSON.parse(r.permissions || '{}') })));
      }
    } catch { /* silent */ }
    finally { setLoadingRoles(false); }
  }, []);

  useEffect(() => { loadRoleConfigs(); }, [loadRoleConfigs]);

  const saveRolePerms = async (roleName: string) => {
    setSavingRolePerms(true);
    try {
      const res = await authFetch("/api/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleName, permissions: editRolePerms }),
      });
      if (!res.ok) throw new Error("Error al guardar permisos del rol");
      toast.success("Permisos del rol actualizados");
      setEditingRole(null);
      loadRoleConfigs();
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingRolePerms(false); }
  };

  const resetUserToRoleDefaults = async (user: UserRecord) => {
    const roleConfig = roleConfigs.find(rc => rc.roleName === user.role);
    if (!roleConfig) { toast.error("No hay configuracion para este rol"); return; }
    if (!confirm(`Restablecer permisos de "${user.username}" a los valores predeterminados del rol ${roleConfig.label}?`)) return;
    try {
      const res = await authFetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, permissions: roleConfig.permissions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Permisos restablecidos para "${user.username}"`);
      if (user.id === currentUser.id) {
        onUserUpdate?.({ ...currentUser, permissions: roleConfig.permissions });
      }
      loadUsers();
    } catch (e: any) { toast.error(e.message); }
  };

  // Auto-load role defaults when creating user changes role
  useEffect(() => {
    const rc = roleConfigs.find(r => r.roleName === newRole);
    if (rc) {
      setNewPermissions({ ...rc.permissions });
    } else {
      setNewPermissions({ pos: true, products: false, clients: false, reports: false, devolutions: false, cash_closing: false });
    }
  }, [newRole, roleConfigs]);

  // --- Process image file to small base64 (80px max, very compressed) ---
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject("El archivo debe ser una imagen");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        reject("La imagen es muy grande (maximo 10MB)");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Resize to max 80px for tiny base64
          const MAX = 80;
          let w = img.width;
          let h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = (h * MAX) / w; w = MAX; }
            else { w = (w * MAX) / h; h = MAX; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject("Error al procesar imagen"); return; }
          ctx.drawImage(img, 0, 0, w, h);
          // Heavy compression to keep base64 small
          const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
          resolve(dataUrl);
        };
        img.onerror = () => reject("Error al cargar imagen");
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject("Error al leer archivo");
      reader.readAsDataURL(file);
    });
  };

  // --- Upload avatar via dedicated endpoint (separate from user data) ---
  const uploadAvatar = async (userId: string, avatarData: string): Promise<boolean> => {
    try {
      const res = await authFetch("/api/users/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, avatar: avatarData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar foto");
      return true;
    } catch (error: any) {
      toast.error(error.message || "Error al guardar foto");
      return false;
    }
  };

  // --- Handle camera/gallery for create dialog ---
  const handleCreatePhoto = async (useCamera: boolean) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (useCamera) input.capture = "user";
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      try {
        creatingAvatar && toast("Procesando foto...", { icon: "📷" });
        const base64 = await processImageFile(file);
        setNewAvatar(base64);
        toast.success("Foto cargada correctamente");
      } catch (err: any) { toast.error(typeof err === "string" ? err : "Error al procesar imagen"); }
    };
    input.click();
  };

  // --- Handle camera/gallery for edit dialog ---
  const handleEditPhoto = async (useCamera: boolean) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (useCamera) input.capture = "user";
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      try {
        const base64 = await processImageFile(file);
        setEditAvatar(base64);
        toast.success("Foto cargada correctamente");
      } catch (err: any) { toast.error(typeof err === "string" ? err : "Error al procesar imagen"); }
    };
    input.click();
  };

  // --- Handle camera/gallery for profile photo ---
  const handleProfilePhoto = async (useCamera: boolean) => {
    if (useCamera) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.capture = "user";
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;
        try {
          const base64 = await processImageFile(file);
          setProfileAvatar(base64);
          toast.success("Foto cargada correctamente");
        } catch (err: any) { toast.error(typeof err === "string" ? err : "Error al procesar imagen"); }
      };
      input.click();
    } else {
      profilePhotoRef.current?.click();
    }
  };

  // --- Create User (cajero or admin) ---
  const handleCreate = async () => {
    if (!newUsername.trim()) { toast.error("Ingrese un nombre de usuario"); return; }
    if (newUsername.trim().length < 3) { toast.error("El usuario debe tener al menos 3 caracteres"); return; }
    if (!newPassword.trim()) { toast.error("Ingrese una contrasena"); return; }
    if (newPassword.length < 3) { toast.error("La contrasena debe tener al menos 3 caracteres"); return; }

    setCreating(true);
    try {
      const res = await authFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          fullName: newFullName.trim(),
          role: newRole,
          permissions: newPermissions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Upload avatar separately if exists
      if (newAvatar) {
        await uploadAvatar(data.id, newAvatar);
      }

      toast.success(`${ROLE_LABELS[newRole] || newRole} "${data.username}" creado correctamente`);
      setShowCreateDialog(false);
      setNewUsername("");
      setNewPassword("");
      setNewFullName("");
      setNewRole("cajero");
      setNewAvatar("");
      setNewPermissions({ pos: true, products: false, clients: false, reports: false, devolutions: false, cash_closing: false });
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || "Error al crear usuario");
    } finally {
      setCreating(false);
    }
  };

  // --- Edit User ---
  const openEditDialog = (user: UserRecord) => {
    setEditingUser(user);
    setEditFullName(user.fullName);
    setEditIsActive(user.isActive);
    setEditRole(user.role);
    setEditPermissions({ ...user.permissions });
    setEditNewPassword("");
    setEditAvatar(user.avatar || "");
    setShowEditDialog(true);
  };

  const handleEditSave = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      const body: any = {
        id: editingUser.id,
        fullName: editFullName,
        permissions: editPermissions,
        isActive: editIsActive,
        role: editRole,
      };
      // Only include password if user typed one
      if (editNewPassword.trim()) {
        if (editNewPassword.length < 3) {
          toast.error("La contrasena debe tener al menos 3 caracteres");
          setSaving(false);
          return;
        }
        body.password = editNewPassword;
      }

      const res = await authFetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Upload avatar SEPARATELY via dedicated endpoint
      if (editAvatar !== (editingUser.avatar || "")) {
        setSavingAvatar(true);
        const avatarOk = await uploadAvatar(editingUser.id, editAvatar);
        setSavingAvatar(false);
        if (!avatarOk) {
          toast.error("Datos guardados pero la foto no se pudo subir. Intentelo de nuevo.");
        }
      }

      toast.success(`Usuario "${data.username}" actualizado`);

      // If editing current user, update session
      if (editingUser.id === currentUser.id) {
        const updatedUser: CurrentUser = {
          ...currentUser,
          fullName: data.fullName,
          role: data.role,
          permissions: data.permissions,
          avatar: editAvatar,
        };
        onUserUpdate?.(updatedUser);
      }

      setShowEditDialog(false);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar usuario");
    } finally {
      setSaving(false);
    }
  };

  // --- Deactivate User (soft) ---
  const handleDeactivate = async (user: UserRecord) => {
    if (user.role === "admin") {
      toast.error("No se puede desactivar al administrador");
      return;
    }
    if (!confirm(`Desactivar a "${user.username}"? Podra activarlo luego.`)) return;
    try {
      const res = await authFetch(`/api/users?id=${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // --- Delete User (hard delete from database) ---
  const handleDelete = async (user: UserRecord) => {
    if (user.role === "admin") {
      toast.error("No se puede eliminar al administrador");
      return;
    }
    if (!confirm(`ELIMINAR PERMANENTEMENTE a "${user.username}"?\n\nEsta accion no se puede deshacer. Se borraran todos los datos del usuario.`)) return;
    try {
      const res = await authFetch(`/api/users?id=${user.id}&hard=true`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // --- Change Own Password ---
  const handleChangePassword = async () => {
    if (!currentPassword.trim()) { toast.error("Ingrese la contrasena actual"); return; }
    if (!newPasswordOwn.trim()) { toast.error("Ingrese la nueva contrasena"); return; }
    if (newPasswordOwn.length < 3) { toast.error("La nueva contrasena debe tener al menos 3 caracteres"); return; }
    if (newPasswordOwn !== confirmPasswordOwn) { toast.error("Las contrasenas no coinciden"); return; }

    setChangingPassword(true);
    try {
      const res = await authFetch("/api/auth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          currentPassword,
          newPassword: newPasswordOwn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      setShowPasswordDialog(false);
      setCurrentPassword("");
      setNewPasswordOwn("");
      setConfirmPasswordOwn("");
      if (onUserUpdate && data.user) {
        onUserUpdate(data.user);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setChangingPassword(false);
    }
  };

  // --- Save own profile photo ---
  const handleSaveProfilePhoto = async () => {
    setSavingProfileAvatar(true);
    try {
      const res = await authFetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentUser.id,
          fullName: currentUser.fullName,
        }),
      });
      // Upload avatar separately
      const avatarOk = await uploadAvatar(currentUser.id, profileAvatar);
      if (!avatarOk) {
        toast.error("Error al guardar foto");
        setSavingProfileAvatar(false);
        return;
      }
      toast.success("Foto actualizada");
      setShowProfilePhotoDialog(false);
      const updatedUser: CurrentUser = { ...currentUser, avatar: profileAvatar };
      onUserUpdate?.(updatedUser);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSavingProfileAvatar(false);
    }
  };

  const togglePermission = (key: string, setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) => {
    setter((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const adminUsers = users.filter((u) => u.role === "admin");
  const cajeroUsers = users.filter((u) => u.role === "cajero");
  const vendedorUsers = users.filter((u) => u.role === "vendedor");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* ===== MI CUENTA ===== */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <UserAvatar src={currentUser.avatar || ""} name={currentUser.fullName || currentUser.username} size="lg" />
              <div>
                <h3 className="text-base font-semibold">Mi Cuenta</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  <strong>{currentUser.username}</strong> &bull; {currentUser.fullName || "-"} &bull;{" "}
                  <Badge variant="default" className="text-[10px]">{ROLE_LABELS[currentUser.role] || currentUser.role}</Badge>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { setProfileAvatar(currentUser.avatar || ""); setShowProfilePhotoDialog(true); }}>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Foto
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowPasswordDialog(true)}>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Contrasena
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ===== CONFIGURACION DE ROLES (solo admin) ===== */}
      {currentUser.role === "admin" && (
        <Card className="border-primary/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Permisos por Rol
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure los permisos predeterminados de cada rol. Al crear un nuevo usuario, se aplicaran estos permisos automaticamente.
                </p>
              </div>
            </div>

            {loadingRoles ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                {roleConfigs.map((role) => (
                  <div key={role.roleName} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }} />
                        <span className="font-semibold text-sm">{role.label || role.roleName}</span>
                        <Badge variant="secondary" className="text-[10px]">{role.roleName}</Badge>
                        <span className="text-xs text-muted-foreground">
                          ({users.filter(u => u.role === role.roleName).length} usuario{users.filter(u => u.role === role.roleName).length !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingRole === role.roleName ? (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => saveRolePerms(role.roleName)} disabled={savingRolePerms}>
                              {savingRolePerms ? "Guardando..." : "Guardar"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingRole(null)}>Cancelar</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => { setEditingRole(role.roleName); setEditRolePerms({ ...role.permissions }); }}>
                            Editar Permisos
                          </Button>
                        )}
                      </div>
                    </div>

                    {editingRole === role.roleName ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {PERMISSION_KEYS.map((key) => (
                          <label key={key} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${editRolePerms[key] ? "border-primary bg-primary/5" : "border-muted hover:border-primary/30"}`}>
                            <input
                              type="checkbox"
                              checked={!!editRolePerms[key]}
                              onChange={() => setEditRolePerms(prev => ({ ...prev, [key]: !prev[key] }))}
                              className="rounded border-gray-300"
                            />
                            <span className="text-xs font-medium">{PERMISSION_LABELS[key]}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {PERMISSION_KEYS.filter(k => role.permissions[k]).map(k => (
                          <Badge key={k} variant="secondary" className="text-[10px] px-2 py-0.5">
                            <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            {PERMISSION_LABELS[k]}
                          </Badge>
                        ))}
                        {PERMISSION_KEYS.filter(k => !role.permissions[k]).map(k => (
                          <Badge key={k} variant="outline" className="text-[10px] px-2 py-0.5 text-muted-foreground line-through opacity-50">
                            {PERMISSION_LABELS[k]}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== ADMINISTRADORES ===== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Administradores ({adminUsers.length})</h3>
          <Button size="sm" variant="outline" onClick={() => { setNewRole("admin"); setShowCreateDialog(true); }}>
            + Nuevo Admin
          </Button>
        </div>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-2.5 font-medium w-12">Foto</th>
                <th className="text-left px-4 py-2.5 font-medium">Usuario</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Nombre</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Ultimo Acceso</th>
                <th className="text-left px-4 py-2.5 font-medium">Estado</th>
                <th className="text-right px-4 py-2.5 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {adminUsers.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Sin administradores</td></tr>
              ) : (
                adminUsers.map((user) => (
                  <tr key={user.id} className="border-t">
                    <td className="px-4 py-2.5">
                      <UserAvatar src={user.avatar} name={user.fullName || user.username} size="sm" />
                    </td>
                    <td className="px-4 py-2.5 font-medium">{user.username}</td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">{user.fullName || "-"}</td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleString("es-VE") : "Nunca"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={user.isActive ? "success" : "destructive"}>
                        {user.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== CAJEROS ===== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Cajeros ({cajeroUsers.length})</h3>
          <Button size="sm" onClick={() => { setNewRole("cajero"); setShowCreateDialog(true); }}>
            + Nuevo Cajero
          </Button>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium w-12">Foto</th>
                  <th className="text-left px-4 py-2.5 font-medium">Usuario</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Nombre</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Ultimo Acceso</th>
                  <th className="text-left px-4 py-2.5 font-medium">Permisos</th>
                  <th className="text-left px-4 py-2.5 font-medium">Estado</th>
                  <th className="text-right px-4 py-2.5 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cajeroUsers.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No hay cajeros registrados</td></tr>
                ) : (
                  cajeroUsers.map((user) => (
                    <tr key={user.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <UserAvatar src={user.avatar} name={user.fullName || user.username} size="sm" />
                      </td>
                      <td className="px-4 py-2.5 font-medium">{user.username}</td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">{user.fullName || "-"}</td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString("es-VE") : "Nunca"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {PERMISSION_KEYS.filter((k) => user.permissions[k]).map((k) => (
                            <Badge key={k} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {PERMISSION_LABELS[k]}
                            </Badge>
                          ))}
                          {PERMISSION_KEYS.filter((k) => !user.permissions[k]).length === PERMISSION_KEYS.length && (
                            <span className="text-xs text-muted-foreground">Sin permisos</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={user.isActive ? "success" : "destructive"}>
                          {user.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                            Editar
                          </Button>
                          {user.isActive && (
                            <Button variant="secondary" size="sm" onClick={() => handleDeactivate(user)}>
                              Desactivar
                            </Button>
                          )}
                          {!user.isActive && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const res = await authFetch("/api/users", {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ id: user.id, isActive: true }),
                                  });
                                  const data = await res.json();
                                  if (!res.ok) throw new Error(data.error);
                                  toast.success(`Usuario "${data.username}" activado`);
                                  loadUsers();
                                } catch (e: any) { toast.error(e.message); }
                              }}
                            >
                              Activar
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => resetUserToRoleDefaults(user)} title="Restablecer permisos del rol">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Rol
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(user)}>
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ===== VENDEDORES ===== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Vendedores ({vendedorUsers.length})</h3>
          <Button size="sm" onClick={() => { setNewRole("vendedor"); setShowCreateDialog(true); }}>
            + Nuevo Vendedor
          </Button>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium w-12">Foto</th>
                  <th className="text-left px-4 py-2.5 font-medium">Usuario</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Nombre</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Ultimo Acceso</th>
                  <th className="text-left px-4 py-2.5 font-medium">Permisos</th>
                  <th className="text-left px-4 py-2.5 font-medium">Estado</th>
                  <th className="text-right px-4 py-2.5 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {vendedorUsers.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No hay vendedores registrados</td></tr>
                ) : (
                  vendedorUsers.map((user) => (
                    <tr key={user.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <UserAvatar src={user.avatar} name={user.fullName || user.username} size="sm" />
                      </td>
                      <td className="px-4 py-2.5 font-medium">{user.username}</td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">{user.fullName || "-"}</td>
                      <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString("es-VE") : "Nunca"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {PERMISSION_KEYS.filter((k) => user.permissions[k]).map((k) => (
                            <Badge key={k} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {PERMISSION_LABELS[k]}
                            </Badge>
                          ))}
                          {PERMISSION_KEYS.filter((k) => !user.permissions[k]).length === PERMISSION_KEYS.length && (
                            <span className="text-xs text-muted-foreground">Sin permisos</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={user.isActive ? "success" : "destructive"}>
                          {user.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                            Editar
                          </Button>
                          {user.isActive && (
                            <Button variant="secondary" size="sm" onClick={() => handleDeactivate(user)}>
                              Desactivar
                            </Button>
                          )}
                          {!user.isActive && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const res = await authFetch("/api/users", {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ id: user.id, isActive: true }),
                                  });
                                  const data = await res.json();
                                  if (!res.ok) throw new Error(data.error);
                                  toast.success(`Usuario "${data.username}" activado`);
                                  loadUsers();
                                } catch (e: any) { toast.error(e.message); }
                              }}
                            >
                              Activar
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => resetUserToRoleDefaults(user)} title="Restablecer permisos del rol">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Rol
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(user)}>
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ============================== */}
      {/* DIALOG: MI FOTO DE PERFIL      */}
      {/* ============================== */}
      <Dialog open={showProfilePhotoDialog} onOpenChange={setShowProfilePhotoDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mi Foto de Perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <UserAvatar src={profileAvatar} name={currentUser.fullName || currentUser.username} size="lg" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="w-full" onClick={() => handleProfilePhoto(false)}>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Galeria
              </Button>
              <Button variant="outline" className="w-full" onClick={() => handleProfilePhoto(true)}>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Camara
              </Button>
            </div>
            <input type="file" ref={profilePhotoRef} accept="image/*" className="hidden" onChange={async (e: any) => {
              const file = e.target?.files?.[0]; if (!file) return;
              try { const b = await processImageFile(file); setProfileAvatar(b); toast.success("Foto cargada"); } catch (err: any) { toast.error(typeof err === "string" ? err : "Error"); }
            }} />
            {profileAvatar && (
              <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={() => setProfileAvatar("")}>
                Eliminar foto
              </Button>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowProfilePhotoDialog(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSaveProfilePhoto} disabled={savingProfileAvatar}>
                {savingProfileAvatar ? "Guardando..." : "Guardar Foto"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================== */}
      {/* DIALOG: CREAR USUARIO           */}
      {/* ============================== */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{`Nuevo ${ROLE_LABELS[newRole] || "Usuario"}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Role selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo de Usuario</Label>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setNewRole("admin")} className={`p-3 rounded-lg border-2 text-center transition-all ${newRole === "admin" ? "border-primary bg-primary/10 text-primary" : "border-muted hover:border-primary/50"}`}>
                  <div className="text-lg mb-1"><svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg></div>
                  <span className="text-sm font-medium">Admin</span>
                  <p className="text-[10px] text-muted-foreground">Acceso total</p>
                </button>
                <button type="button" onClick={() => setNewRole("vendedor")} className={`p-3 rounded-lg border-2 text-center transition-all ${newRole === "vendedor" ? "border-primary bg-primary/10 text-primary" : "border-muted hover:border-primary/50"}`}>
                  <div className="text-lg mb-1"><svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg></div>
                  <span className="text-sm font-medium">Vendedor</span>
                  <p className="text-[10px] text-muted-foreground">Puede cobrar</p>
                </button>
                <button type="button" onClick={() => setNewRole("cajero")} className={`p-3 rounded-lg border-2 text-center transition-all ${newRole === "cajero" ? "border-primary bg-primary/10 text-primary" : "border-muted hover:border-primary/50"}`}>
                  <div className="text-lg mb-1"><svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>
                  <span className="text-sm font-medium">Cajero</span>
                  <p className="text-[10px] text-muted-foreground">Puede cobrar</p>
                </button>
              </div>
            </div>

            {/* Avatar */}
            <div className="flex flex-col items-center gap-2">
              <UserAvatar src={newAvatar} name={newFullName || "Nuevo"} size="lg" />
              <div className="grid grid-cols-2 gap-2 w-full max-w-[220px]">
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => handleCreatePhoto(false)}>
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Galeria
                </Button>
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => handleCreatePhoto(true)}>
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Camara
                </Button>
              </div>
              {newAvatar && (
                <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => setNewAvatar("")}>Eliminar foto</Button>
              )}
            </div>

            <div className="space-y-2">
              <Label>Nombre de Usuario</Label>
              <Input placeholder="ej: juan, maria..." value={newUsername} onChange={(e) => setNewUsername(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input placeholder="ej: Juan Perez" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contrasena</Label>
              <Input type="password" placeholder="Minimo 3 caracteres" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>

            {/* Permissions (only for cajero or vendedor) */}
            {(newRole === "cajero" || newRole === "vendedor") && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Permisos</Label>
                  <div className="space-y-2">
                    {PERMISSION_KEYS.map((key) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={!!newPermissions[key]} onChange={() => togglePermission(key, setNewPermissions)} disabled={key === "pos"} className="rounded border-gray-300" />
                        <span className="text-sm">{PERMISSION_LABELS[key]}</span>
                        {key === "pos" && <span className="text-xs text-muted-foreground">(siempre activo)</span>}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleCreate} disabled={creating}>
                {creating ? "Creando..." : `Crear ${ROLE_LABELS[newRole] || newRole}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================== */}
      {/* DIALOG: EDITAR USUARIO          */}
      {/* ============================== */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar: {editingUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

            {/* Avatar */}
            <div className="flex flex-col items-center gap-2">
              <UserAvatar src={editAvatar} name={editFullName || editingUser?.username || "?"} size="lg" />
              <div className="grid grid-cols-2 gap-2 w-full max-w-[220px]">
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => handleEditPhoto(false)}>
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Galeria
                </Button>
                <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => handleEditPhoto(true)}>
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Camara
                </Button>
              </div>
              <input type="file" ref={editAvatarRef} accept="image/*" className="hidden" onChange={async (e: any) => {
                const file = e.target?.files?.[0]; if (!file) return;
                try { const b = await processImageFile(file); setEditAvatar(b); toast.success("Foto cargada"); } catch (err: any) { toast.error(typeof err === "string" ? err : "Error"); }
              }} />
              {editAvatar && (
                <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => setEditAvatar("")}>Eliminar foto</Button>
              )}
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Rol del Usuario</Label>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setEditRole("admin")} className={`p-3 rounded-lg border-2 text-center transition-all ${editRole === "admin" ? "border-primary bg-primary/10 text-primary" : "border-muted hover:border-primary/50"}`}>
                  <div className="text-lg mb-1"><svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg></div>
                  <span className="text-sm font-medium">Admin</span>
                  <p className="text-[10px] text-muted-foreground">Acceso total</p>
                </button>
                <button type="button" onClick={() => setEditRole("vendedor")} className={`p-3 rounded-lg border-2 text-center transition-all ${editRole === "vendedor" ? "border-primary bg-primary/10 text-primary" : "border-muted hover:border-primary/50"}`}>
                  <div className="text-lg mb-1"><svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg></div>
                  <span className="text-sm font-medium">Vendedor</span>
                  <p className="text-[10px] text-muted-foreground">Puede cobrar</p>
                </button>
                <button type="button" onClick={() => setEditRole("cajero")} className={`p-3 rounded-lg border-2 text-center transition-all ${editRole === "cajero" ? "border-primary bg-primary/10 text-primary" : "border-muted hover:border-primary/50"}`}>
                  <div className="text-lg mb-1"><svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>
                  <span className="text-sm font-medium">Cajero</span>
                  <p className="text-[10px] text-muted-foreground">Puede cobrar</p>
                </button>
              </div>
            </div>

            {/* Reset Password */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Nueva Contrasena <span className="text-xs text-muted-foreground">(dejar vacio para no cambiar)</span>
              </Label>
              <Input type="password" placeholder="Escriba nueva contrasena..." value={editNewPassword} onChange={(e) => setEditNewPassword(e.target.value)} />
              {editNewPassword && editNewPassword.length < 3 && (
                <p className="text-xs text-destructive">Minimo 3 caracteres</p>
              )}
            </div>

            {/* Active */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Estado</Label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} className="rounded border-gray-300" />
                <span className="text-sm">Usuario activo</span>
              </label>
            </div>

            {/* Permissions (only for cajero or vendedor) */}
            {(editRole === "cajero" || editRole === "vendedor") && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Permisos</Label>
                  <div className="space-y-2">
                    {PERMISSION_KEYS.map((key) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={!!editPermissions[key]} onChange={() => togglePermission(key, setEditPermissions)} disabled={key === "pos"} className="rounded border-gray-300" />
                        <span className="text-sm">{PERMISSION_LABELS[key]}</span>
                        {key === "pos" && <span className="text-xs text-muted-foreground">(siempre activo)</span>}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleEditSave} disabled={saving || savingAvatar}>
                {saving || savingAvatar ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================== */}
      {/* DIALOG: CAMBIAR CONTRASENA      */}
      {/* ============================== */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar Contrasena</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Contrasena Actual</Label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Nueva Contrasena</Label>
              <Input type="password" value={newPasswordOwn} onChange={(e) => setNewPasswordOwn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Confirmar Nueva Contrasena</Label>
              <Input type="password" value={confirmPasswordOwn} onChange={(e) => setConfirmPasswordOwn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleChangePassword()} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowPasswordDialog(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleChangePassword} disabled={changingPassword}>
                {changingPassword ? "Cambiando..." : "Cambiar Contrasena"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
