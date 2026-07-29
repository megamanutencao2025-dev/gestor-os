import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, X, ChevronRight, ChevronDown, Package, Box, Component } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import QuickCreateModal from "@/components/quick-create/QuickCreateModal";
import QuickCreateButton from "@/components/quick-create/QuickCreateButton";

// Função para calcular o nível hierárquico
function calculateLevel(equipamentoId, equipamentos) {
  const idToEquip = {};
  equipamentos.forEach(eq => { idToEquip[eq.id] = eq; });
  
  let level = 3;
  let current = idToEquip[equipamentoId];
  
  while (current && current.parent_id) {
    level++;
    current = idToEquip[current.parent_id];
    if (level > 10) break;
  }
  
  return level;
}

// Função para obter caminho completo (hierarquia)
function getFullPath(equipamentoId, equipamentos) {
  const idToEquip = {};
  equipamentos.forEach(eq => { idToEquip[eq.id] = eq; });
  
  const path = [];
  let current = idToEquip[equipamentoId];
  
  while (current) {
    path.unshift({
      id: current.id,
      codigo: current.codigo,
      descricao: current.descricao,
      localizacao: current.localizacao_celula || current.localizacao_setor || ''
    });
    current = current.parent_id ? idToEquip[current.parent_id] : null;
  }
  
  return path;
}

// Ícone baseado no nível
function getLevelIcon(level) {
  switch(level) {
    case 3: return Package;
    case 4: return Box;
    default: return Component;
  }
}

// Label baseado no nível
function getLevelLabel(level) {
  switch(level) {
    case 3: return "Equipamento";
    case 4: return "Conjunto";
    case 5: return "Subconjunto";
    case 6: return "Componente";
    default: return "Item";
  }
}

// Função para destacar texto da pesquisa
function highlightText(text, searchTerm) {
  if (!searchTerm || !text) return text;
  
  const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === searchTerm.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 font-semibold">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// Componente de nó da árvore
function TreeNode({ 
  equipamento, 
  level,
  children, 
  isSelected, 
  onToggle, 
  isExpanded, 
  onExpand,
  searchTerm,
  hasMatchInSubtree
}) {
  const hasChildren = children && children.length > 0;
  const Icon = getLevelIcon(level);
  const label = getLevelLabel(level);
  
  // Verificar se este item corresponde à pesquisa
  const matchesSearch = !searchTerm || 
    equipamento.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    equipamento.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    equipamento.localizacao_celula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    equipamento.localizacao_setor?.toLowerCase().includes(searchTerm.toLowerCase());

  // Mostrar se: corresponde à pesquisa OU tem filhos que correspondem OU não há pesquisa
  if (!matchesSearch && !hasMatchInSubtree && searchTerm) return null;

  return (
    <div>
      <div 
        className={`flex items-center gap-2 py-2.5 px-3 hover:bg-slate-50 rounded transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''} ${matchesSearch ? 'bg-yellow-50' : ''}`}
        style={{ paddingLeft: `${level * 12}px` }}
      >
        {hasChildren ? (
          <button 
            onClick={(e) => { e.stopPropagation(); onExpand(); }}
            className="p-0 hover:bg-slate-200 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-600" />
            )}
          </button>
        ) : (
          <div className="w-4" />
        )}
        
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
        />
        
        <Icon className="w-4 h-4 text-slate-600" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {equipamento.codigo && (
              <span className="font-mono font-medium text-sm">
                {highlightText(equipamento.codigo, searchTerm)}
              </span>
            )}
            <span className="text-sm truncate">
              {highlightText(equipamento.descricao, searchTerm)}
            </span>
            <Badge variant="outline" className="text-xs">
              {label}
            </Badge>
          </div>
          {equipamento.localizacao_celula && (
            <div className="text-xs text-slate-500 truncate mt-0.5">
              {highlightText(
                `${equipamento.localizacao_celula}${equipamento.localizacao_setor ? ` - ${equipamento.localizacao_setor}` : ''}`,
                searchTerm
              )}
            </div>
          )}
        </div>
      </div>
      
      {hasChildren && isExpanded && (
        <div>
          {children}
        </div>
      )}
    </div>
  );
}

export default function EquipamentoSelector({ 
  isOpen, 
  onClose, 
  equipamentos = [], 
  onSelectEquipamento,
  allowMultiple = false,
  selectedEquipamentos = [],
  quickCreate = null,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState(
    new Set((selectedEquipamentos || []).map(eq => eq.equipamento_id || eq.id))
  );
  const [expanded, setExpanded] = useState({});
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [createdEquipamentos, setCreatedEquipamentos] = useState([]);

  const effectiveEquipamentos = useMemo(() => {
    const existingIds = new Set((equipamentos || []).map(eq => eq.id));
    return [
      ...(equipamentos || []),
      ...createdEquipamentos.filter(eq => eq?.id && !existingIds.has(eq.id)),
    ];
  }, [createdEquipamentos, equipamentos]);

  // Construir mapa de filhos
  const childrenMap = useMemo(() => {
    const map = {};
    effectiveEquipamentos.forEach(eq => {
      const pid = eq.parent_id || 'root';
      if (!map[pid]) map[pid] = [];
      map[pid].push(eq);
    });
    return map;
  }, [effectiveEquipamentos]);

  // Equipamentos principais (raiz)
  const equipamentosPrincipais = useMemo(() => {
    return (childrenMap['root'] || []).sort((a, b) => 
      (a.codigo || '').localeCompare(b.codigo || '')
    );
  }, [childrenMap]);

  // Verificar se um equipamento ou seus descendentes correspondem à pesquisa
  const checkMatchInSubtree = useMemo(() => {
    const cache = {};
    
    function hasMatch(equipamentoId) {
      if (cache[equipamentoId] !== undefined) return cache[equipamentoId];
      
      const equipamento = effectiveEquipamentos.find(eq => eq.id === equipamentoId);
      if (!equipamento) {
        cache[equipamentoId] = false;
        return false;
      }
      
      // Verificar se o próprio item corresponde
      const matchesSelf = !searchTerm ||
        equipamento.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        equipamento.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        equipamento.localizacao_celula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        equipamento.localizacao_setor?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (matchesSelf) {
        cache[equipamentoId] = true;
        return true;
      }
      
      // Verificar filhos
      const children = childrenMap[equipamentoId] || [];
      const hasMatchInChildren = children.some(child => hasMatch(child.id));
      
      cache[equipamentoId] = hasMatchInChildren;
      return hasMatchInChildren;
    }
    
    return hasMatch;
  }, [effectiveEquipamentos, childrenMap, searchTerm]);

  // Auto-expandir itens que contêm resultados da pesquisa
  useMemo(() => {
    if (searchTerm) {
      const newExpanded = {};
      effectiveEquipamentos.forEach(eq => {
        if (checkMatchInSubtree(eq.id)) {
          newExpanded[eq.id] = true;
        }
      });
      setExpanded(newExpanded);
    }
  }, [searchTerm, effectiveEquipamentos, checkMatchInSubtree]);

  const handleToggle = (equipamentoId) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(equipamentoId)) {
      newSelected.delete(equipamentoId);
    } else {
      if (!allowMultiple) {
        newSelected.clear();
      }
      newSelected.add(equipamentoId);
    }
    setSelectedIds(newSelected);
  };

  const handleExpand = (equipamentoId) => {
    setExpanded(prev => ({
      ...prev,
      [equipamentoId]: !prev[equipamentoId]
    }));
  };

  const handleConfirm = () => {
    const equipamentosToSelect = [];
    
    selectedIds.forEach(equipamentoId => {
      const equipamento = effectiveEquipamentos.find(e => e.id === equipamentoId);
      if (equipamento) {
        // Obter caminho completo (hierarquia)
        const fullPath = getFullPath(equipamentoId, effectiveEquipamentos);
        const level = calculateLevel(equipamentoId, effectiveEquipamentos);
        
        equipamentosToSelect.push({
          equipamento_id: equipamento.id,
          equipamento_nome: equipamento.descricao,
          equipamento_codigo: equipamento.codigo || '',
          localizacao: equipamento.localizacao_celula || equipamento.localizacao_setor || '',
          nivel: level,
          hierarquia: fullPath,
          hierarquia_texto: fullPath.map(p => p.codigo || p.descricao).join(' > ')
        });
      }
    });

    if (equipamentosToSelect.length > 0) {
      if (allowMultiple) {
        onSelectEquipamento(equipamentosToSelect);
      } else {
        onSelectEquipamento(equipamentosToSelect[0]);
      }
    }
    
    handleClose();
  };

  const handleClose = () => {
    setSearchTerm("");
    setSelectedIds(new Set((selectedEquipamentos || []).map(eq => eq.equipamento_id || eq.id)));
    onClose();
  };

  const handleQuickCreated = async (created) => {
    if (created?.id) {
      setCreatedEquipamentos(prev => [...prev.filter(eq => eq.id !== created.id), created]);
      setSelectedIds(prev => {
        const next = allowMultiple ? new Set(prev) : new Set();
        next.add(created.id);
        return next;
      });
    }
    await quickCreate?.onCreated?.(created);
  };

  // Renderizar árvore recursivamente
  const renderTree = (parentId, level = 0) => {
    const children = childrenMap[parentId] || [];
    
    return children.map(equipamento => {
      const equipChildren = childrenMap[equipamento.id] || [];
      const currentLevel = calculateLevel(equipamento.id, effectiveEquipamentos);
      const hasMatchInSubtree = checkMatchInSubtree(equipamento.id);
      
      return (
        <TreeNode
          key={equipamento.id}
          equipamento={equipamento}
          level={currentLevel}
          isSelected={selectedIds.has(equipamento.id)}
          onToggle={() => handleToggle(equipamento.id)}
          isExpanded={expanded[equipamento.id]}
          onExpand={() => handleExpand(equipamento.id)}
          searchTerm={searchTerm}
          hasMatchInSubtree={hasMatchInSubtree}
          children={equipChildren.length > 0 && renderTree(equipamento.id, level + 1)}
        />
      );
    });
  };

  const selectedCount = selectedIds.size;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl h-[95vh] max-h-[900px] flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Plus className="w-5 h-5" />
            Selecionar {allowMultiple ? 'Equipamentos ou Conjuntos' : 'Equipamento ou Conjunto'}
          </DialogTitle>
          <p className="text-sm text-slate-600 mt-2">
            Selecione o equipamento completo ou um conjunto/componente específico. A hierarquia será mantida na OS.
          </p>
          {quickCreate && (
            <QuickCreateButton
              label={quickCreate.label || "Novo equipamento"}
              className="mt-3"
              onClick={() => setQuickCreateOpen(true)}
            />
          )}
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 gap-4 py-4">
          {/* Barra de Pesquisa */}
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Pesquisar por código, descrição ou localização..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Árvore de Equipamentos */}
          <div className="flex-1 min-h-0 border rounded-lg">
            <ScrollArea className="h-full p-3">
              {equipamentosPrincipais.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  Nenhum equipamento cadastrado
                </div>
              ) : (
                <div className="space-y-1">
                  {renderTree('root')}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Resumo da Seleção */}
          {selectedCount > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg flex-shrink-0 border border-blue-200">
              <p className="text-sm font-medium text-blue-900 mb-2">
                {selectedCount} item(ns) selecionado(s)
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {Array.from(selectedIds).slice(0, 5).map(id => {
                  const path = getFullPath(id, effectiveEquipamentos);
                  return (
                    <div key={id} className="text-xs text-blue-700 truncate bg-white px-2 py-1 rounded">
                      {path.map(p => p.codigo || p.descricao).join(' > ')}
                    </div>
                  );
                })}
                {selectedCount > 5 && (
                  <div className="text-xs text-blue-600 font-medium px-2 py-1">
                    + {selectedCount - 5} mais...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t gap-2">
          <Button variant="outline" onClick={handleClose}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={selectedCount === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Confirmar Seleção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {quickCreate && (
      <QuickCreateModal
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        title={quickCreate.title || "Novo equipamento"}
        createForm={quickCreate.createForm}
        onCreate={quickCreate.onCreate}
        onCreated={handleQuickCreated}
      />
    )}
    </>
  );
}
