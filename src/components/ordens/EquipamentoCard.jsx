import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, MapPin, Edit2 } from "lucide-react";

/**
 * Card compacto para exibir equipamento selecionado
 */
export default function EquipamentoCard({ 
  equipamento, 
  onRemove, 
  onEdit,
  showEdit = true,
  className = "" 
}) {
  if (!equipamento) return null;

  // Determinar label do nível
  const getNivelLabel = (nivel) => {
    switch(nivel) {
      case 3: return "Equipamento";
      case 4: return "Conjunto";
      case 5: return "Subconjunto";
      case 6: return "Componente";
      default: return "Item";
    }
  };

  // Determinar cor do badge baseado no nível
  const getNivelColor = (nivel) => {
    switch(nivel) {
      case 3: return "bg-blue-600 text-white";
      case 4: return "bg-purple-600 text-white";
      case 5: return "bg-orange-600 text-white";
      case 6: return "bg-green-600 text-white";
      default: return "bg-slate-600 text-white";
    }
  };

  const nivel = equipamento.nivel || 3;
  const nivelLabel = getNivelLabel(nivel);
  const nivelColor = getNivelColor(nivel);
  
  const hasHierarchy = equipamento.hierarquia && equipamento.hierarquia.length > 1;
  
  // Nome do equipamento (último da hierarquia ou o próprio)
  const nomeEquipamento = equipamento.equipamento_nome || equipamento.descricao || equipamento.nome;
  const codigoEquipamento = equipamento.equipamento_codigo || equipamento.codigo;
  
  // Localização
  const localizacao = equipamento.localizacao || 
                      (equipamento.localizacao_celula && equipamento.localizacao_setor 
                        ? `${equipamento.localizacao_celula} - ${equipamento.localizacao_setor}`
                        : equipamento.localizacao_celula || equipamento.localizacao_setor || '');

  return (
    <div className={`border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow ${className}`}>
      <div className="p-3 space-y-2">
        {/* Linha 1: Badge + Nome + Ações */}
        <div className="flex items-start gap-2">
          <Badge className={`${nivelColor} text-xs px-2 py-0.5 flex-shrink-0`}>
            {nivelLabel}
          </Badge>
          
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 text-sm truncate">
              {codigoEquipamento && <span className="font-mono mr-1">{codigoEquipamento}</span>}
              {nomeEquipamento}
            </p>
          </div>
          
          <div className="flex gap-1 flex-shrink-0">
            {showEdit && onEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onEdit}
                className="h-7 w-7 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                title="Editar seleção"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
            )}
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRemove}
                className="h-7 w-7 text-slate-600 hover:text-red-600 hover:bg-red-50"
                title="Remover"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Linha 2: Hierarquia (se houver) */}
        {hasHierarchy && (
          <div className="pl-1 space-y-1">
            {equipamento.hierarquia.map((item, idx) => {
              const isLast = idx === equipamento.hierarquia.length - 1;
              return (
                <div 
                  key={item.id} 
                  className="flex items-center gap-1 text-xs"
                  style={{ paddingLeft: `${idx * 12}px` }}
                >
                  {idx > 0 && <span className="text-slate-400">└─</span>}
                  <Badge 
                    variant={isLast ? "default" : "outline"} 
                    className={`text-[10px] h-4 px-1.5 ${isLast ? 'bg-blue-600' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {getNivelLabel(3 + idx)}
                  </Badge>
                  <span className={`${isLast ? 'font-semibold text-slate-900' : 'text-slate-600'} truncate`}>
                    {item.codigo && `${item.codigo} - `}{item.descricao}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Linha 3: Localização */}
        {localizacao && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 pl-1">
            <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <span className="truncate">{localizacao}</span>
          </div>
        )}
      </div>
    </div>
  );
}