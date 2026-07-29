import React, { useState, useEffect, useMemo } from "react";
import { PrestadoraServico } from "@/entities/PrestadoraServico";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Save, Trash2, X, Search, Loader2, Globe } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InvokeLLM } from "@/integrations/Core";

// Modal de Cadastro/Edição de Prestadora
function PrestadoraModal({ isOpen, onClose, prestadora, onSave }) {
  const [formData, setFormData] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fetchingCnpj, setFetchingCnpj] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(prestadora || {});
      setError("");
    }
  }, [isOpen, prestadora]);

  const handleCnpjFetch = async () => {
    const cnpj = formData.cnpj?.replace(/\D/g, '');
    if (!cnpj || cnpj.length !== 14) {
      setError("Por favor, insira um CNPJ válido com 14 dígitos.");
      return;
    }
    setFetchingCnpj(true);
    setError("");
    try {
      const response = await InvokeLLM({
        prompt: `Busque informações da empresa com CNPJ ${cnpj}. Retorne dados como razão social, email, telefone se disponível.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            razao_social: { type: "string" },
            email: { type: "string" },
            telefone: { type: "string" },
            encontrado: { type: "boolean" }
          }
        }
      });

      if (response.encontrado) {
        setFormData(prev => ({
          ...prev,
          nome_empresa: response.razao_social || prev.nome_empresa,
          email: response.email || prev.email,
          contato1: response.telefone || prev.contato1,
        }));
      } else {
        setError("CNPJ não encontrado ou dados não disponíveis");
      }
    } catch (err) {
      setError("Erro ao buscar dados do CNPJ");
    } finally {
      setFetchingCnpj(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!formData.nome_empresa) {
      setError("Nome da Empresa é obrigatório.");
      return;
    }

    setSaving(true);
    try {
      await onSave(formData, prestadora);
      onClose();
    } catch (error) {
      setError("Erro ao salvar prestadora.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Edit className="w-5 h-5" />
            {prestadora ? "Editar Prestadora" : "Nova Prestadora de Serviço"}
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
              <Label htmlFor="nome_empresa">Nome da Empresa <span className="text-red-500">*</span></Label>
              <Input 
                id="nome_empresa" 
                value={formData.nome_empresa || ""} 
                onChange={(e) => setFormData(prev => ({ ...prev, nome_empresa: e.target.value }))} 
              />
            </div>
            <div>
              <Label htmlFor="cnpj">CNPJ</Label>
              <div className="flex gap-2">
                <Input 
                  id="cnpj" 
                  value={formData.cnpj || ""} 
                  onChange={(e) => setFormData(prev => ({ ...prev, cnpj: e.target.value }))} 
                  placeholder="00.000.000/0000-00" 
                />
                <Button type="button" variant="outline" onClick={handleCnpjFetch} disabled={fetchingCnpj}>
                  {fetchingCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input 
                id="email" 
                type="email" 
                value={formData.email || ""} 
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} 
              />
            </div>
            <div>
              <Label htmlFor="contato1">Contato 1</Label>
              <Input 
                id="contato1" 
                value={formData.contato1 || ""} 
                onChange={(e) => setFormData(prev => ({ ...prev, contato1: e.target.value }))} 
              />
            </div>
            <div>
              <Label htmlFor="contato2">Contato 2</Label>
              <Input 
                id="contato2" 
                value={formData.contato2 || ""} 
                onChange={(e) => setFormData(prev => ({ ...prev, contato2: e.target.value }))} 
              />
            </div>
          </div>
          <div>
            <Label htmlFor="servicos_prestados">Serviços Prestados</Label>
            <Textarea 
              id="servicos_prestados" 
              value={formData.servicos_prestados || ""} 
              onChange={(e) => setFormData(prev => ({ ...prev, servicos_prestados: e.target.value }))} 
              placeholder="Ex: Manutenção elétrica, Refrigeração..." 
            />
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

export default function PrestadorasTab() {
  const [prestadoras, setPrestadoras] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadPrestadoras();
  }, []);

  const loadPrestadoras = async () => {
    setLoading(true);
    try {
      const data = await PrestadoraServico.list();
      setPrestadoras(data);
    } catch (err) {
      setError("Erro ao carregar prestadoras de serviço.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData, editingItem) => {
    if (formData.cnpj) {
      const isDuplicate = prestadoras.some(p => p.cnpj === formData.cnpj && p.id !== editingItem?.id);
      if (isDuplicate) {
        throw new Error("Já existe uma empresa com este CNPJ.");
      }
    }

    if (editingItem) {
      await PrestadoraServico.update(editingItem.id, formData);
    } else {
      await PrestadoraServico.create(formData);
    }
    await loadPrestadoras();
  };

  const filteredData = useMemo(() => 
    prestadoras.filter(item => 
      item.nome_empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.cnpj?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.servicos_prestados?.toLowerCase().includes(searchTerm.toLowerCase())
    ), [prestadoras, searchTerm]);

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza? Esta ação não pode ser desfeita.")) {
      try {
        await PrestadoraServico.delete(id);
        await loadPrestadoras();
      } catch (err) {
        setError("Erro ao excluir.");
      }
    }
  };

  const handleNew = () => {
    setEditingItem(null);
    setShowModal(true);
    setError("");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end items-center">
        <Button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Nova Prestadora
        </Button>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <Card className="shadow-sm border-0 bg-white">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Lista de Prestadoras</CardTitle>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input placeholder="Pesquisar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10"/>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div>Carregando...</div> :
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Serviços</TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>{item.nome_empresa}</TableCell>
                    <TableCell>{item.cnpj}</TableCell>
                    <TableCell>{item.contato1 || item.email}</TableCell>
                    <TableCell className="max-w-xs truncate">{item.servicos_prestados}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(item)}><Edit className="w-3 h-3" /></Button>
                        <Button size="sm" variant="outline" onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-700"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredData.length === 0 && (
                  <TableRow><TableCell colSpan="5" className="text-center py-8 text-slate-500">Nenhum registro encontrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          }
        </CardContent>
      </Card>

      <PrestadoraModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingItem(null);
        }}
        prestadora={editingItem}
        onSave={handleSave}
      />
    </div>
  );
}
