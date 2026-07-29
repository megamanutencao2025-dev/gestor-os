import React from "react";
import { appApi } from "@/api/appClient";
import CadastroGenerico from "./CadastroGenerico";

export default function LocalizacoesTab() {
  const campos = [
    { name: 'descricao', label: 'Descrição', required: true, placeholder: 'Ex: Setor A - Andar 1' },
    { name: 'setor', label: 'Setor', required: false, placeholder: 'Ex: Produção' },
    { name: 'observacoes', label: 'Observações', required: false, placeholder: 'Informações adicionais' }
  ];

  const validarDuplicidade = (item, lista, itemEditando) => {
    return lista.some(existente => 
      existente.id !== itemEditando?.id && 
      existente.descricao?.toLowerCase() === item.descricao?.toLowerCase()
    );
  };

  // Função para propagar mudanças recursivamente (incluindo todos os níveis de filhos)
  const propagarParaFilhos = async (equipamentoId, localizacaoCelula, localizacaoSetor, localizacaoId, equipamentos, processados = new Set()) => {
    // Evitar loops infinitos
    if (processados.has(equipamentoId)) return;
    processados.add(equipamentoId);

    // Buscar filhos diretos
    const filhos = equipamentos.filter(eq => eq.parent_id === equipamentoId);
    
    if (filhos.length > 0) {
      // Atualizar todos os filhos
      const updates = filhos.map(filho => 
        appApi.entities.Equipamento.update(filho.id, {
          localizacao_celula: localizacaoCelula,
          localizacao_setor: localizacaoSetor,
          localizacao_id: localizacaoId
        })
      );
      
      await Promise.all(updates);
      
      // Propagar recursivamente para os filhos dos filhos
      for (const filho of filhos) {
        await propagarParaFilhos(filho.id, localizacaoCelula, localizacaoSetor, localizacaoId, equipamentos, processados);
      }
    }
  };

  // Função customizada para salvar com propagação de mudanças
  const handleSaveWithPropagation = async (formData, itemEditando, Entity) => {
    // Se está editando, verificar se houve mudanças que precisam propagar
    if (itemEditando?.id) {
      const mudouDescricao = itemEditando.descricao !== formData.descricao;
      const mudouSetor = itemEditando.setor !== formData.setor;
      
      // Atualizar a localização
      await Entity.update(itemEditando.id, formData);
      
      // Se houve mudanças, propagar para TODOS os equipamentos (principais e filhos)
      if (mudouDescricao || mudouSetor) {
        try {
          // Buscar todos os equipamentos
          const todosEquipamentos = await appApi.entities.Equipamento.list();
          
          // Buscar equipamentos principais que usam esta localização
          const equipamentosAfetados = todosEquipamentos.filter(
            eq => eq.localizacao_id === itemEditando.id
          );
          
          if (equipamentosAfetados.length > 0) {
            // Atualizar equipamentos principais
            const updates = equipamentosAfetados.map(eq => 
              appApi.entities.Equipamento.update(eq.id, {
                localizacao_celula: formData.descricao || '',
                localizacao_setor: formData.setor || ''
              })
            );
            
            await Promise.all(updates);
            
            let totalAtualizados = equipamentosAfetados.length;
            
            // Propagar para todos os filhos de cada equipamento principal
            for (const eq of equipamentosAfetados) {
              const filhos = todosEquipamentos.filter(filho => filho.parent_id === eq.id);
              if (filhos.length > 0) {
                await propagarParaFilhos(
                  eq.id, 
                  formData.descricao || '', 
                  formData.setor || '',
                  itemEditando.id,
                  todosEquipamentos
                );
                totalAtualizados += filhos.length;
              }
            }
            
            console.log(`✅ ${totalAtualizados} equipamento(s) e sub-equipamento(s) atualizado(s) com a nova localização`);
          }
        } catch (error) {
          console.error("Erro ao propagar mudanças para equipamentos:", error);
          throw new Error("Localização atualizada, mas houve erro ao sincronizar com os equipamentos. Por favor, verifique os equipamentos manualmente.");
        }
      }
    } else {
      // Criar nova localização
      await Entity.create(formData);
    }
  };

  return (
    <CadastroGenerico
      titulo="Localizações"
      Entity={appApi.entities.Localizacao}
      campos={campos}
      validarDuplicidade={validarDuplicidade}
      onSaveCustom={handleSaveWithPropagation}
    />
  );
}