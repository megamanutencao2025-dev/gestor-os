import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Save, Trash2, X, ArrowUpDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SortableHeader = ({ children, column, sortConfig, onSort }) => {
  const isSorted = sortConfig.key === column;
  const direction = isSorted ? sortConfig.direction : undefined;

  return (
    <TableHead onClick={() => onSort(column)} className="cursor-pointer hover:bg-slate-50">
      <div className="flex items-center gap-2">
        {children}
        {isSorted ? (
          direction === 'ascending' ? (
            <ArrowUpDown className="w-4 h-4" />
          ) : (
            <ArrowUpDown className="w-4 h-4" />
          )
        ) : (
          <ArrowUpDown className="w-4 h-4 text-slate-400" />
        )}
      </div>
    </TableHead>
  );
};

// Modal de Cadastro/Edição
function CadastroModal({ isOpen, onClose, item, titulo, campos, onSave }) {
  const [formData, setFormData] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(item || Object.fromEntries(
        campos
          .filter((campo) => campo.defaultValue !== undefined)
          .map((campo) => [campo.name, campo.defaultValue]),
      ));
      setError("");
    }
  }, [isOpen, item]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    for (const campo of campos) {
      if (campo.required && !formData[campo.name]?.trim()) {
        setError(`${campo.label} é obrigatório`);
        return;
      }
    }

    setSaving(true);
    try {
      await onSave(formData, item);
      onClose();
    } catch (error) {
      setError(error.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl flex items-center gap-2">
            <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
            {item ? "Editar" : "Novo"} {titulo.slice(0, -1)}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {campos.map(campo => (
            <div key={campo.name}>
              <Label htmlFor={campo.name}>
                {campo.label}
                {campo.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              {campo.type === "select" ? (
                <Select
                  value={formData[campo.name] || campo.defaultValue || ""}
                  onValueChange={(value) => setFormData((previous) => ({
                    ...previous,
                    [campo.name]: value,
                  }))}
                >
                  <SelectTrigger id={campo.name}>
                    <SelectValue placeholder={campo.placeholder || "Selecione"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(campo.options || []).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={campo.name}
                  value={formData[campo.name] || ""}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    [campo.name]: e.target.value
                  }))}
                  placeholder={campo.placeholder || `Digite ${campo.label.toLowerCase()}`}
                  maxLength={campo.maxLength || 255}
                />
              )}
            </div>
          ))}
          
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="w-full sm:w-auto">
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto" disabled={saving}>
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

export default function CadastroGenerico({ 
  titulo, 
  Entity, 
  campos = [{ name: 'descricao', label: 'Descrição', required: true }],
  validarDuplicidade = (item, lista, itemEditando) => {
    return lista.some(existente => 
      existente.id !== itemEditando?.id && 
      existente.descricao?.toLowerCase() === item.descricao?.toLowerCase()
    );
  },
  onSaveCustom = null // Nova prop para função de salvamento customizada
}) {
  const [items, setItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'descricao', direction: 'ascending' });

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await Entity.list();
      setItems(data);
    } catch (error) {
      setError("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [Entity]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);
  
  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        const aValue = typeof a[sortConfig.key] === 'string' ? a[sortConfig.key].toLowerCase() : a[sortConfig.key];
        const bValue = typeof b[sortConfig.key] === 'string' ? b[sortConfig.key].toLowerCase() : b[sortConfig.key];

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const handleSave = async (formData, editingItem) => {
    if (validarDuplicidade(formData, items, editingItem)) {
      throw new Error("Já existe um registro com essas informações");
    }

    // Se há função customizada de salvamento, usar ela
    if (onSaveCustom) {
      await onSaveCustom(formData, editingItem, Entity);
    } else {
      // Lógica padrão
      if (editingItem) {
        await Entity.update(editingItem.id, formData);
      } else {
        await Entity.create(formData);
      }
    }
    
    await loadItems();
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowModal(true);
    setError("");
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este item?")) {
      try {
        await Entity.delete(id);
        await loadItems();
      } catch (error) {
        setError("Erro ao excluir");
      }
    }
  };

  const handleNew = () => {
    setEditingItem(null);
    setShowModal(true);
    setError("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 sm:gap-6">
      <div className="shrink-0 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{titulo}</h2>
        <Button 
          onClick={handleNew}
          className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-sm border-0 bg-white">
        <CardHeader className="shrink-0 px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg">Lista de {titulo}</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 px-0 sm:px-6">
          {loading ? (
            <div className="py-8 text-center">Carregando...</div>
          ) : (
            <div className="-mx-4 h-full overflow-auto sm:mx-0">
              <Table>
                <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                  <TableRow>
                    {campos.map(campo => (
                      <SortableHeader key={campo.name} column={campo.name} sortConfig={sortConfig} onSort={handleSort}>
                        <span className="text-xs sm:text-sm">{campo.label}</span>
                      </SortableHeader>
                    ))}
                    <TableHead className="w-24 sm:w-32 text-xs sm:text-sm">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.map(item => (
                    <TableRow key={item.id}>
                      {campos.map(campo => (
                        <TableCell key={campo.name} className="text-xs sm:text-sm">
                          {campo.type === "select"
                            ? campo.options?.find((option) => option.value === item[campo.name])?.label || item[campo.name]
                            : item[campo.name]}
                        </TableCell>
                      ))}
                      <TableCell>
                        <div className="flex gap-1 sm:gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(item)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(item.id)}
                            className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={campos.length + 1} className="text-center py-8 text-slate-500 text-xs sm:text-sm">
                        Nenhum registro encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CadastroModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingItem(null);
        }}
        item={editingItem}
        titulo={titulo}
        campos={campos}
        onSave={handleSave}
      />
    </div>
  );
}
