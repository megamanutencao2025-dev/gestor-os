
import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import QuickCreateModal from "@/components/quick-create/QuickCreateModal";
import QuickCreateButton from "@/components/quick-create/QuickCreateButton";

export default function MaterialSelector({ 
  isOpen, 
  onClose, 
  materiais = [], 
  onAddMaterials,
  quickCreate = null,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState({});
  const [quantities, setQuantities] = useState({});
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const [createdMaterials, setCreatedMaterials] = useState([]);

  const effectiveMateriais = useMemo(() => {
    const existingIds = new Set((materiais || []).map(material => material.id));
    return [
      ...(materiais || []),
      ...createdMaterials.filter(material => material?.id && !existingIds.has(material.id)),
    ];
  }, [createdMaterials, materiais]);

  const filteredMaterials = useMemo(() => {
    if (!Array.isArray(effectiveMateriais)) return [];
    
    return effectiveMateriais.filter(material => {
      if (!material) return false;
      
      const codigo = material.codigo || '';
      const codigoCompra = material.codigo_compra || '';
      const nome = material.nome || '';
      const searchLower = (searchTerm || '').toLowerCase();
      
      return codigo.toLowerCase().includes(searchLower) ||
             codigoCompra.toLowerCase().includes(searchLower) ||
             nome.toLowerCase().includes(searchLower);
    });
  }, [effectiveMateriais, searchTerm]);

  const handleMaterialSelect = (materialId, isSelected) => {
    if (!materialId) return;
    
    setSelectedMaterials(prev => ({
      ...prev,
      [materialId]: isSelected
    }));
    
    // Se desmarcar, remover a quantidade também
    if (!isSelected) {
      setQuantities(prev => {
        const newQuantities = { ...prev };
        delete newQuantities[materialId];
        return newQuantities;
      });
    } else {
      // Se marcar, definir quantidade padrão como 1
      setQuantities(prev => ({
        ...prev,
        [materialId]: 1
      }));
    }
  };

  const handleQuantityChange = (materialId, quantity) => {
    if (!materialId) return;
    
    const numQuantity = parseFloat(String(quantity).replace(',', '.')) || 0;
    if (numQuantity > 0) {
      setQuantities(prev => ({
        ...prev,
        [materialId]: numQuantity
      }));
    } else {
      setQuantities(prev => {
        const newQuantities = { ...prev };
        delete newQuantities[materialId];
        return newQuantities;
      });
    }
  };

  const handleAddMaterials = () => {
    try {
      const materialsToAdd = [];
      
      Object.keys(selectedMaterials || {}).forEach(materialId => {
        if (selectedMaterials[materialId] && quantities[materialId] > 0) {
          const material = (effectiveMateriais || []).find(m => m?.id === materialId);
          if (material?.id) {
            const quantidade = quantities[materialId];
            const custoUnitario = parseFloat(material.custo) || 0;
            const custoTotal = quantidade * custoUnitario;
            
            materialsToAdd.push({
              id: Date.now() + Math.random(), // ID único para o item da OS
              material_id: String(material.id), // Garantir que seja string
              codigo: material.codigo || '',
              nome: material.nome || '',
              unidade: material.unidade_medida || '',
              custo_unitario: custoUnitario,
              quantidade: quantidade,
              custo_total: custoTotal
            });
          }
        }
      });

      if (materialsToAdd.length > 0) {
        onAddMaterials(materialsToAdd);
      }
      
      handleClose();
    } catch (error) {
      console.error("Erro ao adicionar materiais:", error);
    }
  };

  const handleClose = () => {
    setSearchTerm("");
    setSelectedMaterials({});
    setQuantities({});
    onClose();
  };

  const handleQuickCreated = async (created) => {
    if (created?.id) {
      setCreatedMaterials(prev => [...prev.filter(material => material.id !== created.id), created]);
      setSelectedMaterials(prev => ({
        ...prev,
        [created.id]: true,
      }));
      setQuantities(prev => ({
        ...prev,
        [created.id]: 1,
      }));
    }
    await quickCreate?.onCreated?.(created);
  };

  const selectedCount = Object.values(selectedMaterials || {}).filter(Boolean).length;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="w-[95vw] max-w-6xl h-[90vh] max-h-[700px] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Plus className="w-5 h-5" />
                Selecionar Materiais
              </DialogTitle>
              {quickCreate && (
                <QuickCreateButton
                  label={quickCreate.label || "Novo material"}
                  onClick={() => setQuickCreateOpen(true)}
                />
              )}
            </div>
          </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 px-6 pb-4">
          {/* Barra de Pesquisa */}
          <div className="relative py-4 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Pesquisar por código, código de compra ou nome do material..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabela de Materiais com ScrollArea */}
          <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
            <ScrollArea className="h-full">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="w-12">Sel.</TableHead>
                    <TableHead className="w-20">Código</TableHead>
                    <TableHead className="w-24">Cód. Compra</TableHead>
                    <TableHead className="min-w-[150px]">Nome</TableHead>
                    <TableHead className="w-16">Unidade</TableHead>
                    <TableHead className="w-24">Custo Unit.</TableHead>
                    <TableHead className="w-16">Qtd</TableHead>
                    <TableHead className="w-24">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(filteredMaterials || []).map(material => {
                    if (!material?.id) return null;
                    
                    const isSelected = selectedMaterials[material.id] || false;
                    const quantity = quantities[material.id] || 1;
                    const custoTotal = isSelected ? quantity * (material.custo || 0) : 0;
                    
                    return (
                      <TableRow key={material.id} className={isSelected ? 'bg-blue-50' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleMaterialSelect(material.id, checked)}
                          />
                        </TableCell>
                        <TableCell className="font-mono font-medium text-xs">
                          {material.codigo || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600">
                          {material.codigo_compra || '-'}
                        </TableCell>
                        <TableCell className="text-sm">{material.nome || '-'}</TableCell>
                        <TableCell className="text-xs">{material.unidade_medida || '-'}</TableCell>
                        <TableCell className="text-green-700 font-medium text-xs">
                          {(material.custo || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          })}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            value={isSelected ? String(quantity).replace('.', ',') : ''}
                            onChange={(e) => handleQuantityChange(material.id, e.target.value)}
                            disabled={!isSelected}
                            className="w-14 text-center text-xs h-8"
                            placeholder="1"
                          />
                        </TableCell>
                        <TableCell className="text-green-700 font-bold text-xs">
                          {isSelected ? custoTotal.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          }) : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(filteredMaterials || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                        {searchTerm ? "Nenhum material encontrado" : "Nenhum material cadastrado"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {/* Resumo da Seleção */}
          {selectedCount > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg mt-4 flex-shrink-0">
              <p className="text-sm font-medium text-blue-800">
                {selectedCount} material(is) selecionado(s)
              </p>
              <p className="text-xs text-blue-600">
                Total: {Object.keys(selectedMaterials || {}).reduce((total, materialId) => {
                  if (selectedMaterials[materialId] && quantities[materialId] > 0) {
                    const material = (effectiveMateriais || []).find(m => m?.id === materialId);
                    return total + (quantities[materialId] * (material?.custo || 0));
                  }
                  return total;
                }, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t flex-shrink-0 gap-2">
          <Button variant="outline" onClick={handleClose}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button 
            onClick={handleAddMaterials} 
            disabled={selectedCount === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar {selectedCount} Material(is)
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      {quickCreate && (
        <QuickCreateModal
          open={quickCreateOpen}
          onOpenChange={setQuickCreateOpen}
          title={quickCreate.title || "Novo material"}
          createForm={quickCreate.createForm}
          onCreate={quickCreate.onCreate}
          onCreated={handleQuickCreated}
        />
      )}
    </>
  );
}
