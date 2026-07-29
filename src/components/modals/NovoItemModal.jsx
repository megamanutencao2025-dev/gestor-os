import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function NovoItemModal({ 
  isOpen, 
  onClose, 
  onSave, 
  tipo, // 'material', 'mantenedor', 'prestadora'
  titulo 
}) {
  const [formData, setFormData] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      await onSave(formData);
      setFormData({});
      onClose();
    } catch (err) {
      setError("Erro ao salvar item");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({});
    setError("");
    onClose();
  };

  const renderFields = () => {
    switch (tipo) {
      case 'material':
        return (
          <>
            <div>
              <Label htmlFor="codigo">Código <span className="text-red-500">*</span></Label>
              <Input
                id="codigo"
                value={formData.codigo || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                placeholder="Código do material"
              />
            </div>
            <div>
              <Label htmlFor="nome">Nome <span className="text-red-500">*</span></Label>
              <Input
                id="nome"
                value={formData.nome || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Nome do material"
              />
            </div>
            <div>
              <Label htmlFor="unidade_medida">Unidade <span className="text-red-500">*</span></Label>
              <Select
                value={formData.unidade_medida || ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, unidade_medida: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kg">Kg</SelectItem>
                  <SelectItem value="Unidade">Unidade</SelectItem>
                  <SelectItem value="Litro">Litro</SelectItem>
                  <SelectItem value="Metro">Metro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="custo">Custo <span className="text-red-500">*</span></Label>
              <Input
                id="custo"
                type="number"
                step="0.01"
                min="0"
                value={formData.custo || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, custo: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </>
        );
      
      case 'mantenedor':
        return (
          <>
            <div>
              <Label htmlFor="nome">Nome <span className="text-red-500">*</span></Label>
              <Input
                id="nome"
                value={formData.nome || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Nome do mantenedor"
              />
            </div>
            <div>
              <Label htmlFor="cargo">Cargo <span className="text-red-500">*</span></Label>
              <Input
                id="cargo"
                value={formData.cargo || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, cargo: e.target.value }))}
                placeholder="Cargo do mantenedor"
              />
            </div>
            <div>
              <Label htmlFor="custo_hora">Custo/Hora <span className="text-red-500">*</span></Label>
              <Input
                id="custo_hora"
                type="number"
                step="0.01"
                min="0"
                value={formData.custo_hora || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, custo_hora: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </>
        );
      
      case 'prestadora':
        return (
          <>
            <div>
              <Label htmlFor="nome_empresa">Nome da Empresa <span className="text-red-500">*</span></Label>
              <Input
                id="nome_empresa"
                value={formData.nome_empresa || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, nome_empresa: e.target.value }))}
                placeholder="Nome da empresa"
              />
            </div>
            <div>
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, cnpj: e.target.value }))}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div>
              <Label htmlFor="contato1">Contato</Label>
              <Input
                id="contato1"
                value={formData.contato1 || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, contato1: e.target.value }))}
                placeholder="Telefone ou email"
              />
            </div>
          </>
        );
      
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo {titulo}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {renderFields()}
          
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
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
            <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}