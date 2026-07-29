import React from "react";
import { ChevronRight, ChevronDown, Layers, Settings, Wrench, Edit, Trash2, Plus, QrCode, MapPin, Building2, Box, Package, Component } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Ícones baseados no nível hierárquico
const getLevelIcon = (level) => {
  switch(level) {
    case 3: return Settings;    // Equipamento
    case 4: return Box;          // Conjunto
    case 5: return Package;      // Subconjunto
    case 6: return Component;    // Componente
    default: return Wrench;
  }
};

// Labels baseados no nível hierárquico
const getLevelLabel = (level) => {
  switch(level) {
    case 3: return "Equipamento";
    case 4: return "Conjunto";
    case 5: return "Subconjunto";
    case 6: return "Componente";
    default: return "Item";
  }
};

// Cores baseadas no nível hierárquico
const getLevelColor = (level) => {
  switch(level) {
    case 3: return "text-indigo-600 bg-indigo-50";     // Equipamento
    case 4: return "text-purple-600 bg-purple-50";      // Conjunto
    case 5: return "text-pink-600 bg-pink-50";          // Subconjunto
    case 6: return "text-orange-600 bg-orange-50";      // Componente
    default: return "text-slate-600 bg-slate-50";
  }
};

// Função para construir a estrutura hierárquica agrupada por localização
function buildLocationHierarchy(equipamentos) {
  const hierarchy = {
    setores: {}
  };
  
  // Primeiro, agrupar equipamentos principais por localização
  const equipamentosPrincipais = equipamentos.filter(eq => !eq.parent_id);
  
  equipamentosPrincipais.forEach(eq => {
    const setor = eq.localizacao_setor || 'Sem Setor';
    const celula = eq.localizacao_celula || 'Sem Célula';
    
    if (!hierarchy.setores[setor]) {
      hierarchy.setores[setor] = {
        nome: setor,
        celulas: {}
      };
    }
    
    if (!hierarchy.setores[setor].celulas[celula]) {
      hierarchy.setores[setor].celulas[celula] = {
        nome: celula,
        equipamentos: []
      };
    }
    
    hierarchy.setores[setor].celulas[celula].equipamentos.push(eq);
  });
  
  // Ordenar setores, células e equipamentos
  Object.keys(hierarchy.setores).sort().forEach(setorKey => {
    const setor = hierarchy.setores[setorKey];
    Object.keys(setor.celulas).sort().forEach(celulaKey => {
      const celula = setor.celulas[celulaKey];
      celula.equipamentos.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
    });
  });
  
  return hierarchy;
}

// Função para construir mapa de filhos
function buildChildrenMap(equipamentos) {
  const map = {};
  (equipamentos || []).forEach(eq => {
    const pid = eq.parent_id || null;
    if (!map[pid]) map[pid] = [];
    map[pid].push(eq);
  });
  
  // Ordenar filhos
  Object.values(map).forEach(list => {
    list.sort((a, b) => {
      if (a.codigo && b.codigo) return a.codigo.localeCompare(b.codigo);
      if (a.codigo && !b.codigo) return -1;
      if (!a.codigo && b.codigo) return 1;
      return (a.descricao || "").localeCompare(b.descricao || "");
    });
  });
  
  return map;
}

// Função para calcular o nível hierárquico de um equipamento
function calculateLevel(equipamentoId, equipamentos) {
  const idToEquip = {};
  equipamentos.forEach(eq => { idToEquip[eq.id] = eq; });
  
  let level = 3; // Equipamentos principais começam no nível 3
  let current = idToEquip[equipamentoId];
  
  while (current && current.parent_id) {
    level++;
    current = idToEquip[current.parent_id];
    if (level > 10) break; // Proteção contra loops infinitos
  }
  
  return level;
}

export default function EquipamentoTree({ 
  equipamentos = [], 
  selectedId, 
  onSelect, 
  onEdit,
  onDelete,
  onAddChild,
  onShowQR,
  showActions = false,
  expandAll = false,
  searchTerm = ""
}) {
  const [expanded, setExpanded] = React.useState({});
  
  const hierarchy = React.useMemo(() => buildLocationHierarchy(equipamentos), [equipamentos]);
  const childrenMap = React.useMemo(() => buildChildrenMap(equipamentos), [equipamentos]);

  // Função para verificar se corresponde à pesquisa
  const matchesSearch = React.useCallback((equip) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      equip.codigo?.toLowerCase().includes(term) ||
      equip.descricao?.toLowerCase().includes(term) ||
      equip.marca?.toLowerCase().includes(term) ||
      equip.modelo?.toLowerCase().includes(term) ||
      equip.localizacao_setor?.toLowerCase().includes(term) ||
      equip.localizacao_celula?.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  // Função recursiva para verificar se algum filho corresponde
  const hasMatchingDescendant = React.useCallback((nodeId) => {
    const children = childrenMap[nodeId] || [];
    return children.some(child => 
      matchesSearch(child) || hasMatchingDescendant(child.id)
    );
  }, [childrenMap, matchesSearch]);

  // Expandir automaticamente quando necessário
  React.useEffect(() => {
    if (expandAll) {
      const allIds = {};
      // Expandir todos os setores e células
      Object.keys(hierarchy.setores).forEach(setor => {
        allIds[`setor-${setor}`] = true;
        Object.keys(hierarchy.setores[setor].celulas).forEach(celula => {
          allIds[`celula-${setor}-${celula}`] = true;
        });
      });
      // Expandir todos os equipamentos com filhos
      equipamentos.forEach(eq => {
        if (childrenMap[eq.id]?.length > 0) {
          allIds[eq.id] = true;
        }
      });
      setExpanded(allIds);
    } else if (searchTerm) {
      const toExpand = {};
      // Expandir setores e células que contêm resultados
      Object.keys(hierarchy.setores).forEach(setor => {
        const setorObj = hierarchy.setores[setor];
        let setorHasMatch = false;
        
        Object.keys(setorObj.celulas).forEach(celula => {
          const celulaObj = setorObj.celulas[celula];
          const celulaHasMatch = celulaObj.equipamentos.some(eq => 
            matchesSearch(eq) || hasMatchingDescendant(eq.id)
          );
          
          if (celulaHasMatch) {
            setorHasMatch = true;
            toExpand[`celula-${setor}-${celula}`] = true;
            
            // Expandir equipamentos que têm filhos correspondentes
            celulaObj.equipamentos.forEach(eq => {
              if (hasMatchingDescendant(eq.id)) {
                toExpand[eq.id] = true;
                // Expandir também os filhos recursivamente
                const expandChildren = (parentId) => {
                  const kids = childrenMap[parentId] || [];
                  kids.forEach(kid => {
                    if (matchesSearch(kid) || hasMatchingDescendant(kid.id)) {
                      toExpand[kid.id] = true;
                      expandChildren(kid.id);
                    }
                  });
                };
                expandChildren(eq.id);
              }
            });
          }
        });
        
        if (setorHasMatch) {
          toExpand[`setor-${setor}`] = true;
        }
      });
      
      setExpanded(prev => ({ ...prev, ...toExpand }));
    }
  }, [expandAll, searchTerm, hierarchy, equipamentos, childrenMap, matchesSearch, hasMatchingDescendant]);

  const toggle = (id, e) => {
    e?.stopPropagation();
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Componente para nó de equipamento/conjunto/subconjunto/componente
  const EquipamentoNode = ({ node, currentLevel }) => {
    const kids = (childrenMap[node.id] || []).filter(child => !searchTerm || matchesSearch(child) || hasMatchingDescendant(child.id));
    const isExpanded = !!expanded[node.id];
    const Icon = getLevelIcon(currentLevel);
    const levelLabel = getLevelLabel(currentLevel);
    const levelColor = getLevelColor(currentLevel);
    const nodeMatchesSearch = matchesSearch(node);
    const indentLevel = currentLevel - 3; // 0 para equipamento, 1 para conjunto, etc.

    return (
      <div className="relative">
        <div
          className={cn(
            "flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all hover:bg-slate-100 group",
            selectedId === node.id && "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200",
            indentLevel > 0 && "ml-6",
            nodeMatchesSearch && searchTerm && "bg-yellow-50 ring-1 ring-yellow-200"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(node.id);
          }}
        >
          {kids.length > 0 ? (
            <button
              className="p-1 rounded hover:bg-slate-200 transition-colors flex-shrink-0"
              onClick={(e) => toggle(node.id, e)}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-6 h-6 flex-shrink-0" />
          )}

          <div className={cn("p-1.5 rounded-md flex-shrink-0", levelColor)}>
            <Icon className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs flex-shrink-0">
                {levelLabel}
              </Badge>
              <span className="font-medium text-sm truncate">
                {node.codigo && (
                  <span className="text-xs font-mono text-slate-500">{node.codigo} - </span>
                )}
                {node.descricao}
              </span>
              {kids.length > 0 && (
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  {kids.length} {currentLevel === 3 ? "conjunto" + (kids.length !== 1 ? "s" : "") :
                   currentLevel === 4 ? "subconjunto" + (kids.length !== 1 ? "s" : "") :
                   currentLevel === 5 ? "componente" + (kids.length !== 1 ? "s" : "") : "item" + (kids.length !== 1 ? "s" : "")}
                </Badge>
              )}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {node.marca && `${node.marca} `}
              {node.modelo && `• ${node.modelo}`}
            </div>
          </div>

          {currentLevel === 3 && (
            <Badge 
              variant={node.status === 'Ativo' ? 'default' : 'secondary'}
              className={cn(
                "text-xs flex-shrink-0",
                node.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              )}
            >
              {node.status || 'Ativo'}
            </Badge>
          )}

          {showActions && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              {currentLevel < 6 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddChild?.(node);
                  }}
                  className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  title={`Adicionar ${currentLevel === 3 ? "conjunto" : currentLevel === 4 ? "subconjunto" : "componente"}`}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              )}
              {onShowQR && currentLevel === 3 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowQR(node);
                  }}
                  className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  title="Mostrar QR Code"
                >
                  <QrCode className="w-3 h-3" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(node);
                }}
                className="h-7 w-7 p-0 text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                title="Editar"
              >
                <Edit className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(node.id);
                }}
                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                title="Excluir"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {isExpanded && kids.length > 0 && (
          <div className="mt-1">
            {kids.map(child => <EquipamentoNode key={child.id} node={child} currentLevel={currentLevel + 1} />)}
          </div>
        )}
      </div>
    );
  };

  // Renderizar a hierarquia completa
  const setoresKeys = Object.keys(hierarchy.setores).sort();
  
  if (setoresKeys.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Layers className="w-8 h-8 mx-auto mb-2 text-slate-400" />
        <p className="text-sm">
          {searchTerm ? "Nenhum equipamento encontrado" : "Nenhum equipamento cadastrado"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {setoresKeys.map(setorKey => {
        const setor = hierarchy.setores[setorKey];
        const setorId = `setor-${setorKey}`;
        const setorExpanded = !!expanded[setorId];
        const celulasKeys = Object.keys(setor.celulas).sort();
        
        // Verificar se o setor tem resultados de pesquisa
        const setorHasMatch = !searchTerm || celulasKeys.some(celulaKey => {
          const celula = setor.celulas[celulaKey];
          return celula.equipamentos.some(eq => matchesSearch(eq) || hasMatchingDescendant(eq.id));
        });
        
        if (!setorHasMatch) return null;
        
        return (
          <div key={setorKey} className="mb-2">
            {/* Nível 1: Setor */}
            <div
              className="flex items-center gap-2 py-2.5 px-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-all border border-blue-200"
              onClick={(e) => toggle(setorId, e)}
            >
              {setorExpanded ? <ChevronDown className="w-4 h-4 text-blue-700" /> : <ChevronRight className="w-4 h-4 text-blue-700" />}
              <Building2 className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-blue-900">Setor: {setor.nome}</span>
              <Badge variant="outline" className="ml-auto bg-white">
                {celulasKeys.length} célula{celulasKeys.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {/* Nível 2: Células */}
            {setorExpanded && (
              <div className="ml-4 mt-1 space-y-1">
                {celulasKeys.map(celulaKey => {
                  const celula = setor.celulas[celulaKey];
                  const celulaId = `celula-${setorKey}-${celulaKey}`;
                  const celulaExpanded = !!expanded[celulaId];
                  
                  // Verificar se a célula tem resultados
                  const celulaHasMatch = !searchTerm || celula.equipamentos.some(eq => 
                    matchesSearch(eq) || hasMatchingDescendant(eq.id)
                  );
                  
                  if (!celulaHasMatch) return null;
                  
                  return (
                    <div key={celulaKey}>
                      {/* Célula */}
                      <div
                        className="flex items-center gap-2 py-2 px-3 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 transition-all border border-green-200"
                        onClick={(e) => toggle(celulaId, e)}
                      >
                        {celulaExpanded ? <ChevronDown className="w-4 h-4 text-green-700" /> : <ChevronRight className="w-4 h-4 text-green-700" />}
                        <MapPin className="w-4 h-4 text-green-600" />
                        <span className="font-semibold text-green-900">Célula: {celula.nome}</span>
                        <Badge variant="outline" className="ml-auto bg-white">
                          {celula.equipamentos.length} equipamento{celula.equipamentos.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>

                      {/* Nível 3-6: Equipamentos e sua hierarquia */}
                      {celulaExpanded && (
                        <div className="ml-4 mt-1 space-y-1">
                          {celula.equipamentos.map(eq => {
                            const shouldShow = !searchTerm || matchesSearch(eq) || hasMatchingDescendant(eq.id);
                            if (!shouldShow) return null;
                            return <EquipamentoNode key={eq.id} node={eq} currentLevel={3} />;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}