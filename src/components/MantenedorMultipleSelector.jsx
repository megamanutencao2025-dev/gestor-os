import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import QuickCreateModal from "@/components/quick-create/QuickCreateModal";
import QuickCreateButton from "@/components/quick-create/QuickCreateButton";

export default function MantenedorMultipleSelector({ 
  isOpen, 
  onClose, 
  mantenedores = [],
  selectedMantenedores = [],
  onConfirm,
  quickCreate = null,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set((selectedMantenedores || []).map(m => m?.id).filter(Boolean)));
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [createdMantenedores, setCreatedMantenedores] = useState([]);

  const effectiveMantenedores = [
    ...(mantenedores || []),
    ...createdMantenedores.filter(mant => mant?.id && !(mantenedores || []).some(item => item.id === mant.id)),
  ];

  const filteredMantenedores = (effectiveMantenedores || []).filter(mant =>
    mant?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mant?.cargo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleMantenedor = (mantenedor) => {
    if (!mantenedor?.id) return;
    
    const newSelected = new Set(selectedIds);
    if (newSelected.has(mantenedor.id)) {
      newSelected.delete(mantenedor.id);
    } else {
      newSelected.add(mantenedor.id);
    }
    setSelectedIds(newSelected);
  };

  const handleConfirm = () => {
    try {
      const selectedMantenedoresList = (effectiveMantenedores || []).filter(mant => mant?.id && selectedIds.has(mant.id));
      onConfirm(selectedMantenedoresList);
      onClose();
    } catch (error) {
      console.error("Erro ao confirmar seleção de mantenedores:", error);
    }
  };

  const handleClose = () => {
    setSelectedIds(new Set((selectedMantenedores || []).map(m => m?.id).filter(Boolean)));
    setSearchTerm("");
    onClose();
  };

  const handleQuickCreated = async (created) => {
    if (created?.id) {
      setCreatedMantenedores(prev => [...prev.filter(mant => mant.id !== created.id), created]);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.add(created.id);
        return next;
      });
    }
    await quickCreate?.onCreated?.(created);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="w-[95vw] max-w-2xl h-[90vh] max-h-[600px] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Plus className="w-5 h-5" />
                Selecionar Mantenedores
              </DialogTitle>
              {quickCreate && (
                <QuickCreateButton
                  label={quickCreate.label || "Novo mantenedor"}
                  onClick={() => setQuickCreateOpen(true)}
                />
              )}
            </div>
          </DialogHeader>
        
        <div className="flex flex-col flex-1 min-h-0 px-6 pb-6">
          {/* Busca */}
          <div className="relative py-4 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Pesquisar mantenedores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Mantenedores Selecionados */}
          {selectedIds.size > 0 && (
            <Card className="mb-4 flex-shrink-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Selecionados ({selectedIds.size})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="max-h-20">
                  <div className="flex flex-wrap gap-2">
                    {(effectiveMantenedores || [])
                      .filter(mant => mant?.id && selectedIds.has(mant.id))
                      .map(mant => (
                        <Badge 
                          key={mant.id} 
                          variant="secondary" 
                          className="flex items-center gap-1 text-xs"
                        >
                          <span className="truncate max-w-[120px]">{mant.nome}</span>
                          <button
                            onClick={() => handleToggleMantenedor(mant)}
                            className="ml-1 text-slate-500 hover:text-slate-700 flex-shrink-0"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Lista de Mantenedores */}
          <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
            <ScrollArea className="h-full">
              {filteredMantenedores.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  {searchTerm ? "Nenhum mantenedor encontrado" : "Nenhum mantenedor cadastrado"}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredMantenedores.map(mantenedor => {
                    if (!mantenedor?.id) return null;
                    
                    return (
                      <div
                        key={mantenedor.id}
                        className="flex items-center space-x-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => handleToggleMantenedor(mantenedor)}
                      >
                        <div className="flex-shrink-0">
                          <Checkbox
                            checked={selectedIds.has(mantenedor.id)}
                            onChange={() => handleToggleMantenedor(mantenedor)}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{mantenedor.nome || 'Nome não informado'}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {mantenedor.cargo || 'Cargo não informado'} - {((mantenedor.custo_hora || 0)).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            })}/h
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 pt-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
              Confirmar ({selectedIds.size})
            </Button>
          </div>
        </div>
        </DialogContent>
      </Dialog>

      {quickCreate && (
        <QuickCreateModal
          open={quickCreateOpen}
          onOpenChange={setQuickCreateOpen}
          title={quickCreate.title || "Novo mantenedor"}
          createForm={quickCreate.createForm}
          onCreate={quickCreate.onCreate}
          onCreated={handleQuickCreated}
        />
      )}
    </>
  );
}
