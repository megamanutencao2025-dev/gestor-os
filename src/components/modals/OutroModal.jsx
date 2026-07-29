import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function OutroModal({ isOpen, onClose, outro, onSave }) {
  const [formData, setFormData] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && outro) {
      setFormData({ ...outro });
      setError("");
    }
  }, [isOpen, outro]);

  const handleSubmit = () => {
    setError("");

    if (!formData.descricao?.trim()) {
      setError("Descrição é obrigatória");
      return;
    }

    const quantidade = parseInt(formData.quantidade) || 0;
    const custoUnitario = parseFloat(formData.custo_unitario) || 0;
    
    const dataToSave = {
      ...formData,
      quantidade,
      custo_unitario: custoUnitario,
      custo_total: quantidade * custoUnitario
    };

    onSave(dataToSave);
    onClose();
  };

  const updateField = (field, value) => {
    const updated = { ...formData, [field]: value };
    
    // Recalcular custo total
    if (field === 'quantidade' || field === 'custo_unitario') {
      const quantidade = parseInt(field === 'quantidade' ? value : updated.quantidade) || 0;
      const custoUnitario = parseFloat(field === 'custo_unitario' ? value : updated.custo_unitario) || 0;
      updated.custo_total = quantidade * custoUnitario;
    }
    
    setFormData(updated);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {outro?.id ? "Editar Outro Item" : "Novo Outro Item"}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label>Descrição</Label>
            <Input
              value={formData.descricao || ""}
              onChange={(e) => updateField('descricao', e.target.value)}
              placeholder="Descrição do item"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Unidade</Label>
              <Input
                value={formData.unidade || ""}
                onChange={(e) => updateField('unidade', e.target.value)}
                placeholder="Un, Kg, etc."
              />
            </div>

            <div>
              <Label>Quantidade</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={formData.quantidade || ""}
                onChange={(e) => updateField('quantidade', e.target.value)}
              />
            </div>

            <div>
              <Label>Custo Unitário (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.custo_unitario || ""}
                onChange={(e) => updateField('custo_unitario', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Custo Total</Label>
            <Input
              value={(formData.custo_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              readOnly
              className="bg-slate-50 font-semibold text-green-700"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}