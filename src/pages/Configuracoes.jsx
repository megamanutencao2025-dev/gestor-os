import React, { useEffect, useMemo, useState } from "react";
import { appApi } from "@/api/appClient";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ModuleLabel from "@/components/ModuleLabel";
import { Check, Copy, Edit, Eye, EyeOff, KeyRound, Plus, RefreshCw, ShieldCheck, ToggleLeft, ToggleRight } from "lucide-react";

const PASSWORD_SYMBOLS = "!@#$%&*+?";

function generatePassword(length = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const randomIndex = (max) => {
    if (globalThis.crypto?.getRandomValues) {
      const values = new Uint32Array(1);
      globalThis.crypto.getRandomValues(values);
      return values[0] % max;
    }
    return Math.floor(Math.random() * max);
  };
  const required = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ"[randomIndex(24)],
    "abcdefghijkmnopqrstuvwxyz"[randomIndex(24)],
    "23456789"[randomIndex(8)],
    PASSWORD_SYMBOLS[randomIndex(PASSWORD_SYMBOLS.length)],
  ];
  const characters = [...required];
  while (characters.length < length) characters.push(alphabet[randomIndex(alphabet.length)]);
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join("");
}

const emptyForm = {
  username: "",
  email: "",
  full_name: "",
  role: "user",
  active: true,
  password: "",
};

export default function Configuracoes() {
  const { user: currentUser, refreshModules } = useAuth();
  const [users, setUsers] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [savingUser, setSavingUser] = useState(false);
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState("");

  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState(null);
  const [generatingTemporaryPassword, setGeneratingTemporaryPassword] = useState(false);

  const [permissionUser, setPermissionUser] = useState(null);
  const [permissionModules, setPermissionModules] = useState([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => (a.username || "").localeCompare(b.username || ""));
  }, [users]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [usersData, modulesData] = await Promise.all([
        appApi.admin.users.list(),
        appApi.admin.modules.list(),
      ]);
      setUsers(usersData || []);
      setModules(modulesData || []);
    } catch (err) {
      setError(err.message || "Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const openNewUser = () => {
    setEditingUser(null);
    setFormData({ ...emptyForm, password: generatePassword(12) });
    setShowInitialPassword(false);
    setCopiedPassword("");
    setError("");
    setSuccess("");
    setUserModalOpen(true);
  };

  const openEditUser = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username || "",
      email: user.email || "",
      full_name: user.full_name || user.fullName || "",
      role: user.role || "user",
      active: user.active !== false,
      password: "",
    });
    setShowInitialPassword(false);
    setCopiedPassword("");
    setError("");
    setSuccess("");
    setUserModalOpen(true);
  };

  const saveUser = async (event) => {
    event.preventDefault();
    setSavingUser(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        username: formData.username,
        email: formData.email || null,
        full_name: formData.full_name || null,
        role: formData.role,
        active: formData.active,
      };

      if (editingUser) {
        await appApi.admin.users.update(editingUser.id, payload);
        setSuccess("Usuário atualizado com sucesso.");
      } else {
        await appApi.admin.users.create({ ...payload, password: formData.password });
        setSuccess("Usuário criado com sucesso.");
      }

      setUserModalOpen(false);
      await loadData();
      await refreshModules();
    } catch (err) {
      setError(err.message || "Erro ao salvar usuário");
    } finally {
      setSavingUser(false);
    }
  };

  const toggleStatus = async (user) => {
    setError("");
    setSuccess("");
    try {
      await appApi.admin.users.setStatus(user.id, user.active === false);
      setSuccess(user.active === false ? "Usuário ativado." : "Usuário desativado.");
      await loadData();
    } catch (err) {
      setError(err.message || "Erro ao alterar status");
    }
  };

  const openPasswordModal = (user) => {
    setPasswordUser(user);
    setNewPassword(generatePassword(user.role === "admin" ? 14 : 12));
    setShowNewPassword(false);
    setTemporaryPassword(null);
    setCopiedPassword("");
    setError("");
    setSuccess("");
  };

  const generateTemporaryPassword = async () => {
    if (!passwordUser) return;
    setGeneratingTemporaryPassword(true);
    setError("");
    setSuccess("");
    try {
      const data = await appApi.admin.users.temporaryPassword(passwordUser.id);
      setTemporaryPassword(data);
      setNewPassword(data.temporaryPassword);
      setShowNewPassword(true);
      setCopiedPassword("");
    } catch (err) {
      setError(err.message || "Erro ao gerar senha temporária");
    } finally {
      setGeneratingTemporaryPassword(false);
    }
  };

  const copyPassword = async (value, target) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedPassword(target);
      window.setTimeout(() => setCopiedPassword(""), 1800);
    } catch {
      setError("Não foi possível copiar a senha automaticamente.");
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (!passwordUser) return;

    setSavingPassword(true);
    setError("");
    setSuccess("");
    try {
      await appApi.admin.users.changePassword(passwordUser.id, newPassword);
      setPasswordUser(null);
      setSuccess("Senha alterada com sucesso.");
    } catch (err) {
      setError(err.message || "Erro ao alterar senha");
    } finally {
      setSavingPassword(false);
    }
  };

  const openPermissionsModal = async (user) => {
    setPermissionUser(user);
    setError("");
    setSuccess("");
    try {
      const data = await appApi.admin.users.modules(user.id);
      setPermissionModules(data || []);
    } catch (err) {
      setError(err.message || "Erro ao carregar permissões");
      setPermissionUser(null);
    }
  };

  const togglePermission = (moduleKey, checked) => {
    setPermissionModules((prev) =>
      prev.map((module) =>
        module.key === moduleKey ? { ...module, canAccess: Boolean(checked) } : module
      )
    );
  };

  const savePermissions = async () => {
    if (!permissionUser) return;

    setSavingPermissions(true);
    setError("");
    setSuccess("");
    try {
      const moduleKeys = permissionModules
        .filter((module) => module.canAccess)
        .map((module) => module.key);
      await appApi.admin.users.updateModules(permissionUser.id, moduleKeys);
      setPermissionUser(null);
      setSuccess("Permissões atualizadas com sucesso.");
      await refreshModules();
    } catch (err) {
      setError(err.message || "Erro ao salvar permissões");
    } finally {
      setSavingPermissions(false);
    }
  };

  if (currentUser?.role !== "admin") {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertDescription>Acesso restrito a administradores.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <ModuleLabel>Configurações</ModuleLabel>
        <Button onClick={openNewUser} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card className="shadow-sm border-0 bg-white">
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-slate-500">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium text-slate-900">{user.username}</div>
                      <div className="text-xs text-slate-500">{user.full_name || user.email || "-"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === "admin" ? "default" : "outline"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={user.active === false ? "text-red-700 border-red-200" : "text-emerald-700 border-emerald-200"}>
                        {user.active === false ? "Inativo" : "Ativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditUser(user)} title="Editar usuário">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openPasswordModal(user)} title="Alterar senha">
                          <KeyRound className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openPermissionsModal(user)} title="Permissões">
                          <ShieldCheck className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleStatus(user)}
                          title={user.active === false ? "Ativar usuário" : "Desativar usuário"}
                        >
                          {user.active === false ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">Usuário</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(event) => setFormData((prev) => ({ ...prev, username: event.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="full_name">Nome</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(event) => setFormData((prev) => ({ ...prev, full_name: event.target.value }))}
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData((prev) => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">admin</SelectItem>
                    <SelectItem value="user">user</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!editingUser && (
                <div>
                  <Label htmlFor="password">Senha inicial</Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      type={showInitialPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
                      required
                      minLength={formData.role === "admin" ? 10 : 6}
                      className="pr-24"
                    />
                    <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowInitialPassword((visible) => !visible)} aria-label={showInitialPassword ? "Ocultar senha" : "Mostrar senha"} title={showInitialPassword ? "Ocultar senha" : "Mostrar senha"}>
                        {showInitialPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyPassword(formData.password, "initial")} aria-label="Copiar senha" title="Copiar senha">
                        {copiedPassword === "initial" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">{formData.role === "admin" ? "Administrador: mínimo de 10 caracteres." : "Usuário comum: mínimo de 6 caracteres."}</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => { setFormData((prev) => ({ ...prev, password: generatePassword(prev.role === "admin" ? 14 : 12) })); setCopiedPassword(""); }}>
                      <RefreshCw className="h-3.5 w-3.5" />
                      Gerar
                    </Button>
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 pt-6">
                <Checkbox
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, active: Boolean(checked) }))}
                />
                <span className="text-sm text-slate-700">Usuário ativo</span>
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUserModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingUser} className="bg-blue-600 hover:bg-blue-700">
                {savingUser ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(passwordUser)} onOpenChange={(open) => !open && setPasswordUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
          </DialogHeader>
          <form onSubmit={savePassword} className="space-y-4">
            <Alert>
              <AlertDescription>
                Senhas não podem ser recuperadas. A geração temporária substitui a senha atual e fica visível apenas para o administrador que criou este usuário.
              </AlertDescription>
            </Alert>
            {passwordUser?.created_by_id === currentUser?.id && (
              <Button
                type="button"
                variant="outline"
                onClick={generateTemporaryPassword}
                disabled={generatingTemporaryPassword}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4" />
                {generatingTemporaryPassword ? "Gerando..." : "Gerar senha temporária (substitui a atual)"}
              </Button>
            )}
            {temporaryPassword && (
              <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                <AlertDescription>
                  Senha temporária gerada para <strong>{temporaryPassword.username}</strong>. Copie e envie ao usuário; ela não será exibida novamente.
                </AlertDescription>
              </Alert>
            )}
            <div>
              <Label htmlFor="new-password">Nova senha para {passwordUser?.username}</Label>
              <div className="relative mt-1">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  minLength={passwordUser?.role === "admin" ? 10 : 6}
                  className="pr-24"
                />
                <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowNewPassword((visible) => !visible)} aria-label={showNewPassword ? "Ocultar senha" : "Mostrar senha"} title={showNewPassword ? "Ocultar senha" : "Mostrar senha"}>
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyPassword(newPassword, "change")} aria-label="Copiar senha" title="Copiar senha">
                    {copiedPassword === "change" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">{passwordUser?.role === "admin" ? "Administrador: mínimo de 10 caracteres." : "Usuário comum: mínimo de 6 caracteres."}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => { setNewPassword(generatePassword(passwordUser?.role === "admin" ? 14 : 12)); setCopiedPassword(""); }}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Gerar
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPasswordUser(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? "Salvando..." : "Alterar Senha"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(permissionUser)} onOpenChange={(open) => !open && setPermissionUser(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permissões de {permissionUser?.username}</DialogTitle>
          </DialogHeader>
          {permissionUser?.role === "admin" && (
            <Alert>
              <AlertDescription>Administradores sempre têm acesso total, mesmo sem permissões manuais.</AlertDescription>
            </Alert>
          )}
          <div className="space-y-3">
            {(permissionModules.length ? permissionModules : modules).map((module) => (
              <label key={module.key} className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  checked={permissionUser?.role === "admin" ? true : Boolean(module.canAccess)}
                  disabled={permissionUser?.role === "admin"}
                  onCheckedChange={(checked) => togglePermission(module.key, checked)}
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{module.name}</span>
                  <span className="block text-xs text-slate-500">{module.description || module.path}</span>
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionUser(null)}>
              Cancelar
            </Button>
            <Button
              onClick={savePermissions}
              disabled={savingPermissions || permissionUser?.role === "admin"}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {savingPermissions ? "Salvando..." : "Salvar Permissões"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
