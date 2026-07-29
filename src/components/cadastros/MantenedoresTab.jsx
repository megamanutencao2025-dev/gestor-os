import React, { useState, useEffect, useMemo } from "react";
import { Mantenedor } from "@/entities/Mantenedor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Save, Trash2, X, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Modal de Cadastro/Edição de Mantenedor
function MantenedorModal({ isOpen, onClose, mantenedor, onSave }) {
  const [formData, setFormData] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(mantenedor || {});
      setError("");
    }
  }, [isOpen, mantenedor]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.nome?.trim() || !formData.cargo?.trim() || !formData.custo_hora) {
      setError("Todos os campos são obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        ...formData,
        custo_hora: parseFloat(formData.custo_hora) || 0
      };

      await onSave(dataToSave, mantenedor);
      onClose();
    } catch (error) {
      setError("Erro ao salvar mantenedor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Edit className="w-5 h-5" />
            {mantenedor ? "Editar Mantenedor" : "Novo Mantenedor"}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">
                Nome <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nome"
                value={formData.nome || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Nome do mantenedor"
              />
            </div>

            <div>
              <Label htmlFor="cargo">
                Cargo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cargo"
                value={formData.cargo || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, cargo: e.target.value }))}
                placeholder="Cargo/função"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="custo_hora">
                Custo por Hora <span className="text-red-500">*</span>
              </Label>
              <Input
                id="custo_hora"
                type="number"
                step="0.01"
                min="0"
                value={formData.custo_hora || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, custo_hora: e.target.value }))}
                placeholder="0,00"
              />
            </div>
          </div>
          
          <DialogFooter className="gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MantenedoresTab() {
  const [mantenedores, setMantenedores] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadMantenedores();
  }, []);

  const loadMantenedores = async () => {
    try {
      const data = await Mantenedor.list();
      setMantenedores(data);
    } catch (error) {
      setError("Erro ao carregar mantenedores");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData, editingItem) => {
    // Validar duplicidade: nome + cargo
    const duplicado = mantenedores.some(mant => 
      mant.id !== editingItem?.id && 
      mant.nome?.toLowerCase() === formData.nome?.toLowerCase() &&
      mant.cargo?.toLowerCase() === formData.cargo?.toLowerCase()
    );

    if (duplicado) {
      throw new Error("Já existe um mantenedor com este nome e cargo");
    }

    if (editingItem) {
      await Mantenedor.update(editingItem.id, formData);
    } else {
      await Mantenedor.create(formData);
    }
    
    await loadMantenedores();
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowModal(true);
    setError("");
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este mantenedor?")) {
      try {
        await Mantenedor.delete(id);
        await loadMantenedores();
      } catch (error) {
        setError("Erro ao excluir mantenedor");
      }
    }
  };

  const handleNew = () => {
    setEditingItem(null);
    setShowModal(true);
    setError("");
  };

  const filteredMantenedores = useMemo(() => {
    return mantenedores.filter(mant =>
      mant.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mant.cargo?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [mantenedores, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end items-center">
        <Button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Mantenedor
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="shadow-sm border-0 bg-white">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Lista de Mantenedores</CardTitle>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Pesquisar mantenedores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse flex items-center space-x-4">
                  <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Custo por Hora</TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMantenedores.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nome}</TableCell>
                    <TableCell>{item.cargo}</TableCell>
                    <TableCell className="font-medium text-green-700">
                      {(item.custo_hora || 0).toLocaleString('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL' 
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(item)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredMantenedores.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                      {searchTerm ? "Nenhum mantenedor encontrado" : "Nenhum mantenedor cadastrado"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MantenedorModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingItem(null);
        }}
        mantenedor={editingItem}
        onSave={handleSave}
      />
    </div>
  );
}
