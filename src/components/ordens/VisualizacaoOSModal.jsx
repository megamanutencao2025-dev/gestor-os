
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, X, ChevronDown, ChevronRight, Layers } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatarData } from "@/components/utils/dateUtils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { normalizeOrdemServico } from "@/utils/ordemServicoNormalizer";

export default function VisualizacaoOSModal({ isOpen, onClose, os: rawOs }) {
  const [expandedEquipamentos, setExpandedEquipamentos] = useState({});

  if (!rawOs) return null;
  const os = normalizeOrdemServico(rawOs);

  const formatCurrency = (value) => {
    return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getNivelColor = (nivel) => {
    switch(nivel) {
      case 3: return "bg-blue-100 text-blue-800";
      case 4: return "bg-purple-100 text-purple-800";
      case 5: return "bg-orange-100 text-orange-800";
      case 6: return "bg-green-100 text-green-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  const getNivelLabel = (nivel) => {
    switch(nivel) {
      case 3: return "Equipamento";
      case 4: return "Conjunto";
      case 5: return "Subconjunto";
      case 6: return "Componente";
      default: return "Item";
    }
  };

  const toggleEquipamento = (index) => {
    setExpandedEquipamentos(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Componente para exibir hierarquia de um equipamento
  const EquipamentoHierarquia = ({ equipamento, index }) => {
    const hasHierarchy = equipamento.hierarquia && equipamento.hierarquia.length > 1;
    const isExpanded = expandedEquipamentos[index];

    if (!hasHierarchy) {
      // Equipamento simples sem hierarquia
      return (
        <div className="bg-slate-50 p-4 rounded-lg border">
          <div className="flex items-center gap-2">
            <Badge className={`${getNivelColor(equipamento.nivel || 3)} text-xs px-2 py-0.5`}>
              {getNivelLabel(equipamento.nivel || 3)}
            </Badge>
            {equipamento.equipamento_codigo && (
              <span className="font-mono text-sm font-semibold text-slate-700">
                {equipamento.equipamento_codigo}
              </span>
            )}
            <span className="font-medium text-sm">{equipamento.equipamento_nome}</span>
            {equipamento.localizacao && (
              <>
                <span className="text-slate-400">•</span>
                <span className="text-slate-600 text-xs italic">📍 {equipamento.localizacao}</span>
              </>
            )}
          </div>
        </div>
      );
    }

    // Equipamento com hierarquia - visualização em árvore
    return (
      <Collapsible open={isExpanded} onOpenChange={() => toggleEquipamento(index)}>
        <div className="bg-slate-50 p-4 rounded-lg border">
          {/* Cabeçalho com botão de expandir */}
          <div className="flex items-center gap-2 mb-3">
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 hover:bg-slate-200"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 mr-1" />
                ) : (
                  <ChevronRight className="w-4 h-4 mr-1" />
                )}
                <span className="text-xs font-medium">
                  {isExpanded ? 'Ocultar estrutura hierárquica' : 'Ver estrutura hierárquica'}
                </span>
              </Button>
            </CollapsibleTrigger>
          </div>

          {/* Breadcrumb compacto (sempre visível) */}
          <div className="flex items-center gap-1 flex-wrap mb-2">
            {equipamento.hierarquia.map((item, idx) => {
              const isLast = idx === equipamento.hierarquia.length - 1;
              const itemNivel = 3 + idx;
              
              return (
                <React.Fragment key={item.id}>
                  <Badge 
                    className={`${getNivelColor(itemNivel)} text-[10px] px-2 py-0.5`}
                    title={getNivelLabel(itemNivel)}
                  >
                    {item.codigo || item.descricao}
                  </Badge>
                  {!isLast && (
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Localização */}
          {equipamento.localizacao && (
            <div className="text-xs text-slate-600 italic">
              📍 {equipamento.localizacao}
            </div>
          )}

          {/* Visão expandida - Árvore visual completa */}
          <CollapsibleContent>
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Estrutura Hierárquica Completa
              </div>
              
              {/* Árvore com linhas de conexão */}
              <div className="font-mono text-sm space-y-1">
                {equipamento.hierarquia.map((item, idx) => {
                  const itemNivel = 3 + idx;
                  const isLast = idx === equipamento.hierarquia.length - 1;
                  const isFirst = idx === 0;
                  
                  // Calcular prefixo da linha da árvore
                  let prefix = '';
                  if (isFirst) {
                    prefix = '';
                  } else if (isLast) {
                    prefix = '      └─ ';
                  } else {
                    prefix = '      ├─ ';
                  }
                  
                  // Adicionar indentação extra para níveis mais profundos
                  // Cada nível adicional a partir do segundo (idx 1) adiciona 6 espaços de indentação.
                  const extraIndent = Math.max(0, idx - 1) * 6;
                  const indentSpaces = ' '.repeat(extraIndent);
                  
                  return (
                    <div 
                      key={item.id}
                      className={`flex items-center gap-2 py-1.5 px-2 rounded transition-colors ${
                        isLast ? 'bg-blue-50 font-semibold' : 'hover:bg-slate-100'
                      }`}
                    >
                      {/* Prefixo da árvore */}
                      <span className="text-slate-400 select-none whitespace-pre">
                        {indentSpaces}{prefix}
                      </span>
                      
                      {/* Badge do nível */}
                      <Badge 
                        className={`${getNivelColor(itemNivel)} text-[9px] px-1.5 py-0 h-5 shrink-0`}
                      >
                        {getNivelLabel(itemNivel)}
                      </Badge>
                      
                      {/* Código (se houver) */}
                      {item.codigo && (
                        <span className="font-mono text-xs font-semibold text-slate-700 shrink-0">
                          {item.codigo}
                        </span>
                      )}
                      
                      {/* Separador */}
                      {item.codigo && <span className="text-slate-400">-</span>}
                      
                      {/* Descrição */}
                      <span className={`text-xs ${isLast ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
                        {item.descricao}
                      </span>
                      
                      {/* Indicador de item da OS */}
                      {isLast && (
                        <Badge variant="secondary" className="ml-auto text-[8px] h-5">
                          ← Item da OS
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const printContent = generatePrintHTML();
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  };

  const generatePrintHTML = () => {
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>OS ${os.numero} - Impressão</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          @page {
            size: A4;
            margin: 18mm;
          }
          
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9pt;
            line-height: 1.3;
            color: #000;
            background: #fff;
          }
          
          .container {
            max-width: 100%;
          }
          
          /* Cabeçalho compacto */
          .header {
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            margin-bottom: 12px;
            page-break-inside: avoid;
          }
          
          .header-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            font-size: 8pt;
            line-height: 1.4;
          }
          
          .header h1 {
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 6px;
            color: #000;
          }
          
          .header-left, .header-right {
            display: flex;
            flex-direction: column;
            gap: 3px;
          }
          
          .header-item {
            display: flex;
            gap: 4px;
          }
          
          .header-item strong {
            font-weight: 600;
            min-width: 70px;
          }
          
          /* Seções compactas */
          .section {
            margin-bottom: 10px;
            page-break-inside: avoid;
          }
          
          .section-title {
            font-size: 10pt;
            font-weight: bold;
            color: #000;
            border-bottom: 1px solid #000;
            padding-bottom: 3px;
            margin-bottom: 6px;
          }
          
          /* Grade de informações */
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 6px 12px;
            font-size: 8pt;
            margin-bottom: 8px;
          }
          
          .info-item {
            display: flex;
            gap: 4px;
          }
          
          .info-item strong {
            font-weight: 600;
            color: #000;
          }
          
          /* Equipamentos */
          .equipamento-item {
            border: 1px solid #000;
            padding: 6px;
            margin-bottom: 6px;
            page-break-inside: avoid;
          }
          
          .equipamento-header {
            font-size: 8pt;
            font-weight: 600;
            margin-bottom: 4px;
            padding-bottom: 3px;
            border-bottom: 1px solid #666;
          }
          
          .hierarquia-tree {
            font-family: 'Courier New', monospace;
            font-size: 7pt;
            line-height: 1.6;
          }
          
          .hierarquia-line {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 1px 0;
          }
          
          .tree-prefix {
            color: #666;
            white-space: pre;
          }
          
          .nivel-badge {
            display: inline-block;
            padding: 1px 4px;
            border: 1px solid #000;
            font-size: 6pt;
            font-weight: 600;
            white-space: nowrap;
          }
          
          .equipamento-codigo {
            font-family: 'Courier New', monospace;
            font-weight: 700;
            color: #000;
          }
          
          .item-da-os {
            font-weight: 700;
          }
          
          .equipamento-local {
            font-size: 7pt;
            color: #333;
            margin-top: 3px;
          }
          
          /* Descrição */
          .descricao-box {
            border: 1px solid #666;
            padding: 6px;
            font-size: 8pt;
            line-height: 1.4;
            white-space: pre-wrap;
          }
          
          /* Tabelas compactas */
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 7pt;
            margin-top: 6px;
            page-break-inside: avoid;
          }
          
          thead {
            background: #f0f0f0;
          }
          
          th {
            padding: 4px 6px;
            text-align: left;
            font-weight: 600;
            border: 1px solid #000;
            background: #e0e0e0;
          }
          
          td {
            padding: 3px 6px;
            border: 1px solid #666;
          }
          
          .text-right {
            text-align: right;
          }
          
          .text-center {
            text-align: center;
          }
          
          /* Serviços compactos */
          .servico-card {
            border: 1px solid #000;
            padding: 6px;
            margin-bottom: 6px;
            page-break-inside: avoid;
          }
          
          .servico-header {
            font-weight: 600;
            font-size: 8pt;
            margin-bottom: 4px;
            padding-bottom: 3px;
            border-bottom: 1px solid #666;
          }
          
          .servico-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 4px 8px;
            font-size: 7pt;
            margin-bottom: 4px;
          }
          
          .servico-item {
            display: flex;
            gap: 4px;
          }
          
          .servico-item strong {
            font-weight: 600;
          }
          
          .servico-atividade {
            border: 1px solid #666;
            padding: 4px;
            font-size: 7pt;
            margin-top: 4px;
          }
          
          .servico-atividade-title {
            font-weight: 600;
            margin-bottom: 2px;
          }
          
          /* Resumo financeiro */
          .resumo-financeiro {
            border: 2px solid #000;
            padding: 8px;
            margin-top: 12px;
            page-break-inside: avoid;
          }
          
          .resumo-title {
            font-size: 10pt;
            font-weight: bold;
            margin-bottom: 6px;
            text-align: center;
          }
          
          .resumo-item {
            display: flex;
            justify-content: space-between;
            padding: 3px 0;
            font-size: 8pt;
          }
          
          .resumo-item.total {
            border-top: 2px solid #000;
            padding-top: 6px;
            margin-top: 6px;
            font-size: 10pt;
            font-weight: bold;
          }
          
          .resumo-item .label {
            font-weight: 600;
          }
          
          .resumo-item .value {
            font-weight: 600;
            text-align: right;
          }
          
          /* Rodapé */
          .footer {
            margin-top: 20px;
            padding-top: 8px;
            border-top: 1px solid #666;
            text-align: center;
            font-size: 7pt;
            color: #666;
          }
          
          /* Utilitários */
          .font-bold {
            font-weight: bold;
          }
          
          .mb-4 {
            margin-bottom: 4px;
          }
          
          .mb-6 {
            margin-bottom: 6px;
          }
          
          /* Controle de quebra de página */
          .no-break {
            page-break-inside: avoid;
          }
          
          .break-before {
            page-break-before: always;
          }
          
          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Cabeçalho compacto em grade 2 colunas -->
          <div class="header">
            <h1>ORDEM DE SERVIÇO #${os.numero}</h1>
            <div class="header-grid">
              <div class="header-left">
                <div class="header-item">
                  <strong>Status:</strong>
                  <span>${os.status_nome || 'Sem Status'}</span>
                </div>
                ${os.prioridade_nome ? `
                <div class="header-item">
                  <strong>Prioridade:</strong>
                  <span>${os.prioridade_nome}</span>
                </div>` : ''}
                <div class="header-item">
                  <strong>Tipo:</strong>
                  <span>${os.tipo_nome || '-'}</span>
                </div>
                ${os.area_nome ? `
                <div class="header-item">
                  <strong>Área:</strong>
                  <span>${os.area_nome}</span>
                </div>` : ''}
              </div>
              <div class="header-right">
                <div class="header-item">
                  <strong>Criação:</strong>
                  <span>${formatarData(os.created_date)}</span>
                </div>
                ${os.data_programada ? `
                <div class="header-item">
                  <strong>Programada:</strong>
                  <span>${formatarData(os.data_programada)}${os.hora_programada ? ` ${os.hora_programada}` : ''}</span>
                </div>` : ''}
                ${os.data_finalizada ? `
                <div class="header-item">
                  <strong>Finalizada:</strong>
                  <span>${formatarData(os.data_finalizada)}${os.hora_finalizada ? ` ${os.hora_finalizada}` : ''}</span>
                </div>` : ''}
                <div class="header-item">
                  <strong>Solicitante:</strong>
                  <span>${os.solicitante || '-'}</span>
                </div>
                ${os.local ? `
                <div class="header-item">
                  <strong>Local:</strong>
                  <span>${os.local}</span>
                </div>` : ''}
              </div>
            </div>
          </div>

          <!-- Equipamentos com hierarquia -->
          <div class="section">
            <div class="section-title">EQUIPAMENTO(S)</div>
            ${os.equipamentos && os.equipamentos.length > 0 ? 
              os.equipamentos.map((eq, idx) => {
                const hasHierarchy = eq.hierarquia && eq.hierarquia.length > 1;
                
                if (!hasHierarchy) {
                  return `
                    <div class="equipamento-item">
                      <div>
                        <span class="nivel-badge">${getNivelLabel(eq.nivel || 3)}</span>
                        ${eq.equipamento_codigo ? `<span class="equipamento-codigo">${eq.equipamento_codigo}</span> - ` : ''}
                        <span>${eq.equipamento_nome}</span>
                      </div>
                      ${eq.localizacao ? `<div class="equipamento-local">Local: ${eq.localizacao}</div>` : ''}
                    </div>
                  `;
                }
                
                return `
                  <div class="equipamento-item">
                    ${os.equipamentos.length > 1 ? `<div class="equipamento-header">Equipamento ${idx + 1}${eq.localizacao ? ` • Local: ${eq.localizacao}` : ''}</div>` : ''}
                    <div class="hierarquia-tree">
                      ${eq.hierarquia.map((item, hierIdx) => {
                        const itemNivel = 3 + hierIdx;
                        const isLast = hierIdx === eq.hierarquia.length - 1;
                        const isFirst = hierIdx === 0;
                        
                        let prefix = '';
                        if (!isFirst) {
                          prefix = isLast ? '      └─ ' : '      ├─ ';
                        }
                        
                        const extraIndent = Math.max(0, hierIdx - 1) * 6;
                        const indentSpaces = '&nbsp;'.repeat(extraIndent);
                        
                        return `
                          <div class="hierarquia-line ${isLast ? 'item-da-os' : ''}">
                            <span class="tree-prefix">${indentSpaces}${prefix}</span>
                            <span class="nivel-badge">${getNivelLabel(itemNivel)}</span>
                            ${item.codigo ? `<span class="equipamento-codigo">${item.codigo}</span> -` : ''}
                            <span>${item.descricao}</span>
                            ${isLast ? ' <strong>(OS)</strong>' : ''}
                          </div>
                        `;
                      }).join('')}
                    </div>
                    ${!os.equipamentos.length > 1 && eq.localizacao ? `<div class="equipamento-local">Local: ${eq.localizacao}</div>` : ''}
                  </div>
                `;
              }).join('') : 
              `<div class="equipamento-item">
                ${os.equipamento_nome || 'Não especificado'}
                ${os.local ? `<div class="equipamento-local">Local: ${os.local}</div>` : ''}
              </div>`
            }
          </div>

          <!-- Descrição do Problema -->
          ${os.descricao_defeito ? `
          <div class="section">
            <div class="section-title">DESCRIÇÃO DO PROBLEMA</div>
            <div class="descricao-box">${os.descricao_defeito}</div>
          </div>` : ''}

          <!-- Observações -->
          ${os.observacoes ? `
          <div class="section">
            <div class="section-title">OBSERVAÇÕES</div>
            <div class="descricao-box">${os.observacoes}</div>
          </div>` : ''}

          <!-- Serviços Executados -->
          ${os.servicos && os.servicos.length > 0 ? `
          <div class="section">
            <div class="section-title">SERVIÇOS EXECUTADOS</div>
            ${os.servicos.map((servico, idx) => `
              <div class="servico-card">
                <div class="servico-header">Serviço ${idx + 1}</div>
                <div class="servico-grid">
                  ${servico.mantenedores && servico.mantenedores.length > 0 ? `
                  <div class="servico-item">
                    <strong>Mantenedores:</strong>
                    <span>${servico.mantenedores.map(m => m.mantenedor_nome).join(', ')}</span>
                  </div>` : ''}
                  ${servico.data_inicio ? `
                  <div class="servico-item">
                    <strong>Data Início:</strong>
                    <span>${formatarData(servico.data_inicio)}${servico.hora_inicio ? ` ${servico.hora_inicio}` : ''}</span>
                  </div>` : ''}
                  ${servico.data_fim ? `
                  <div class="servico-item">
                    <strong>Data Fim:</strong>
                    <span>${formatarData(servico.data_fim)}${servico.hora_fim ? ` ${servico.hora_fim}` : ''}</span>
                  </div>` : ''}
                  <div class="servico-item">
                    <strong>Total Horas:</strong>
                    <span>${servico.total_horas || 0} h</span>
                  </div>
                  <div class="servico-item">
                    <strong>Valor:</strong>
                    <span>${formatCurrency(servico.valor_total)}</span>
                  </div>
                </div>
                ${servico.defeito_identificado ? `
                <div class="servico-atividade">
                  <div class="servico-atividade-title">Defeito identificado:</div>
                  <div>${servico.defeito_identificado}</div>
                </div>` : ''}
                ${servico.atividade ? `
                <div class="servico-atividade">
                  <div class="servico-atividade-title">Atividade:</div>
                  <div>${servico.atividade}</div>
                </div>` : ''}
              </div>
            `).join('')}
          </div>` : ''}

          <!-- Materiais Utilizados -->
          ${os.materiais && os.materiais.length > 0 ? `
          <div class="section">
            <div class="section-title">MATERIAIS UTILIZADOS</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 15%">Código</th>
                  <th style="width: 40%">Material</th>
                  <th style="width: 10%" class="text-center">Unidade</th>
                  <th style="width: 10%" class="text-right">Qtd</th>
                  <th style="width: 12%" class="text-right">Custo Unit.</th>
                  <th style="width: 13%" class="text-right">Custo Total</th>
                </tr>
              </thead>
              <tbody>
                ${os.materiais.map(material => `
                  <tr>
                    <td>${material.codigo || '-'}</td>
                    <td>${material.nome}</td>
                    <td class="text-center">${material.unidade}</td>
                    <td class="text-right">${material.quantidade}</td>
                    <td class="text-right">${formatCurrency(material.custo_unitario)}</td>
                    <td class="text-right font-bold">${formatCurrency(material.custo_total)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>` : ''}

          <!-- Serviços Terceirizados -->
          ${os.terceirizados && os.terceirizados.length > 0 ? `
          <div class="section">
            <div class="section-title">SERVIÇOS TERCEIRIZADOS</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 25%">Prestadora</th>
                  <th style="width: 15%">Data</th>
                  <th style="width: 45%">Descrição</th>
                  <th style="width: 15%" class="text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                ${os.terceirizados.map(terceirizado => `
                  <tr>
                    <td>${terceirizado.prestadora_nome}</td>
                    <td>${formatarData(terceirizado.data_servico)}</td>
                    <td>${terceirizado.descricao_servico || '-'}</td>
                    <td class="text-right font-bold">${formatCurrency(terceirizado.valor_servico)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>` : ''}

          <!-- Outros Custos -->
          ${os.outros && os.outros.length > 0 ? `
          <div class="section">
            <div class="section-title">OUTROS CUSTOS</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 50%">Descrição</th>
                  <th style="width: 15%" class="text-center">Unidade</th>
                  <th style="width: 10%" class="text-right">Qtd</th>
                  <th style="width: 12%" class="text-right">Custo Unit.</th>
                  <th style="width: 13%" class="text-right">Custo Total</th>
                </tr>
              </thead>
              <tbody>
                ${os.outros.map(outro => `
                  <tr>
                    <td>${outro.descricao}</td>
                    <td class="text-center">${outro.unidade}</td>
                    <td class="text-right">${outro.quantidade}</td>
                    <td class="text-right">${formatCurrency(outro.custo_unitario)}</td>
                    <td class="text-right font-bold">${formatCurrency(outro.custo_total)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>` : ''}

          <!-- Resumo Financeiro -->
          <div class="resumo-financeiro">
            <div class="resumo-title">RESUMO FINANCEIRO</div>
            ${os.valor_total_servicos > 0 ? `
            <div class="resumo-item">
              <span class="label">Serviços:</span>
              <span class="value">${formatCurrency(os.valor_total_servicos)}</span>
            </div>` : ''}
            ${os.valor_total_materiais > 0 ? `
            <div class="resumo-item">
              <span class="label">Materiais:</span>
              <span class="value">${formatCurrency(os.valor_total_materiais)}</span>
            </div>` : ''}
            ${os.valor_total_terceirizados > 0 ? `
            <div class="resumo-item">
              <span class="label">Terceirizados:</span>
              <span class="value">${formatCurrency(os.valor_total_terceirizados)}</span>
            </div>` : ''}
            ${os.valor_total_outros > 0 ? `
            <div class="resumo-item">
              <span class="label">Outros:</span>
              <span class="value">${formatCurrency(os.valor_total_outros)}</span>
            </div>` : ''}
            <div class="resumo-item total">
              <span class="label">VALOR TOTAL DA OS:</span>
              <span class="value">${formatCurrency(os.valor_total_geral)}</span>
            </div>
            ${os.tempo_parado_em_minutos > 0 ? `
            <div class="resumo-item" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #666;">
              <span class="label">Tempo de Parada:</span>
              <span class="value">${Math.floor(os.tempo_parado_em_minutos / 60)}h ${os.tempo_parado_em_minutos % 60}min</span>
            </div>` : ''}
          </div>

          <!-- Rodapé -->
          <div class="footer">
            <p>Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            <p>MaintenancePro - Sistema de Gerenciamento de Manutenção</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b no-print">
          <div className="flex justify-between items-center">
            <DialogTitle className="text-2xl">Visualização da OS</DialogTitle>
            <div className="flex gap-2">
              <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
              <Button onClick={onClose} variant="outline">
                <X className="w-4 h-4 mr-2" />
                Fechar
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Conteúdo para visualização no modal */}
        <div className="overflow-y-auto max-h-[calc(95vh-100px)] p-6">
          <div className="space-y-6">
            {/* Cabeçalho da OS */}
            <div className="border-b-2 border-slate-900 pb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">
                    Ordem de Serviço #{os.numero}
                  </h1>
                  <div className="space-y-1 text-sm">
                    <p><strong>Data de Criação:</strong> {formatarData(os.created_date)}</p>
                    {os.data_programada && (
                      <p><strong>Data Programada:</strong> {formatarData(os.data_programada)} {os.hora_programada && `às ${os.hora_programada}`}</p>
                    )}
                    {os.data_finalizada && (
                      <p><strong>Data de Conclusão:</strong> {formatarData(os.data_finalizada)} {os.hora_finalizada && `às ${os.hora_finalizada}`}</p>
                    )}
                  </div>
                </div>
                <div className="text-right space-y-2">
                  <div>
                    <Badge className="text-base px-3 py-1 bg-blue-600">
                      {os.status_nome || 'Sem Status'}
                    </Badge>
                  </div>
                  {os.prioridade_nome && (
                    <div>
                      <Badge variant="outline" className="text-sm">
                        Prioridade: {os.prioridade_nome}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Informações Gerais */}
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b">
                Informações Gerais
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-600 font-medium">Tipo de Manutenção:</p>
                  <p className="text-slate-900 font-semibold">{os.tipo_nome || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-600 font-medium">Área de Manutenção:</p>
                  <p className="text-slate-900 font-semibold">{os.area_nome || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-600 font-medium">Solicitante:</p>
                  <p className="text-slate-900 font-semibold">{os.solicitante || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-600 font-medium">Local:</p>
                  <p className="text-slate-900 font-semibold">{os.local || '-'}</p>
                </div>
              </div>
            </div>

            {/* Equipamentos com Hierarquia */}
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b flex items-center gap-2">
                <Layers className="w-5 h-5" />
                Equipamento(s)
              </h2>
              {os.equipamentos && os.equipamentos.length > 0 ? (
                <div className="space-y-3">
                  {os.equipamentos.map((eq, idx) => (
                    <EquipamentoHierarquia key={idx} equipamento={eq} index={idx} />
                  ))}
                </div>
              ) : (
                <div className="bg-slate-50 p-3 rounded border text-sm">
                  <p className="font-semibold text-slate-900">{os.equipamento_nome || 'Não especificado'}</p>
                  {os.local && <p className="text-slate-600 text-xs mt-1">Local: 📍 {os.local}</p>}
                </div>
              )}
            </div>

            {/* Descrição do Defeito */}
            {os.descricao_defeito && (
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b">
                  Descrição do Problema
                </h2>
                <div className="bg-slate-50 p-4 rounded border text-sm">
                  <p className="text-slate-900 whitespace-pre-wrap">{os.descricao_defeito}</p>
                </div>
              </div>
            )}

            {/* Serviços Executados */}
            {os.servicos && os.servicos.length > 0 && (
              <div className="page-break-inside-avoid">
                <h2 className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b">
                  Serviços Executados
                </h2>
                <div className="space-y-4">
                  {os.servicos.map((servico, idx) => (
                    <div key={idx} className="border rounded-lg p-4 bg-slate-50">
                      <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                        <div>
                          <p className="text-slate-600 font-medium">Mantenedor(es):</p>
                          <p className="text-slate-900 font-semibold">
                            {servico.mantenedores && servico.mantenedores.length > 0
                              ? servico.mantenedores.map(m => m.mantenedor_nome || m.nome).join(', ')
                              : servico.mantenedor_nome || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-600 font-medium">Total de Horas:</p>
                          <p className="text-slate-900 font-semibold">
                            {(servico.total_horas || 0).toFixed(2)}h
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-600 font-medium">Período:</p>
                          <p className="text-slate-900">
                            {servico.data_inicio ? formatarData(servico.data_inicio) : ''} {servico.hora_inicio || ''}
                            {servico.hora_fim ? ` até ${servico.hora_fim}` : ''}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-600 font-medium">Valor do Serviço:</p>
                          <p className="text-slate-900 font-semibold text-green-700">
                            {formatCurrency(servico.valor_total)}
                          </p>
                        </div>
                      </div>
                      {servico.defeito_identificado && (
                        <div className="text-sm mb-3">
                          <p className="text-slate-600 font-medium mb-1">Defeito Identificado:</p>
                          <p className="text-slate-900 bg-white p-2 rounded border">
                            {servico.defeito_identificado}
                          </p>
                        </div>
                      )}
                      {servico.atividade && (
                        <div className="text-sm">
                          <p className="text-slate-600 font-medium mb-1">Atividade Realizada:</p>
                          <p className="text-slate-900 bg-white p-2 rounded border">
                            {servico.atividade}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Serviços Terceirizados */}
            {os.terceirizados && os.terceirizados.length > 0 && (
              <div className="page-break-inside-avoid">
                <h2 className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b">
                  Serviços Terceirizados
                </h2>
                <div className="space-y-3">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border p-2 text-left">Prestadora</th>
                        <th className="border p-2 text-left">Data do Serviço</th>
                        <th className="border p-2 text-left">Descrição</th>
                        <th className="border p-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {os.terceirizados.map((terc, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="border p-2">{terc.prestadora_nome || '-'}</td>
                          <td className="border p-2">{formatarData(terc.data_servico)}</td>
                          <td className="border p-2">{terc.descricao_servico || '-'}</td>
                          <td className="border p-2 text-right font-semibold text-green-700">
                            {formatCurrency(terc.valor_servico)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Materiais Utilizados */}
            {os.materiais && os.materiais.length > 0 && (
              <div className="page-break-inside-avoid">
                <h2 className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b">
                  Materiais Utilizados
                </h2>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border p-2 text-left">Código</th>
                      <th className="border p-2 text-left">Material</th>
                      <th className="border p-2 text-center">Unidade</th>
                      <th className="border p-2 text-center">Quantidade</th>
                      <th className="border p-2 text-right">Valor Unit.</th>
                      <th className="border p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {os.materiais.map((mat, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="border p-2">{mat.codigo || '-'}</td>
                        <td className="border p-2">{mat.nome || '-'}</td>
                        <td className="border p-2 text-center">{mat.unidade || '-'}</td>
                        <td className="border p-2 text-center">{mat.quantidade || 0}</td>
                        <td className="border p-2 text-right">{formatCurrency(mat.custo_unitario)}</td>
                        <td className="border p-2 text-right font-semibold">{formatCurrency(mat.custo_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Outros Custos */}
            {os.outros && os.outros.length > 0 && (
              <div className="page-break-inside-avoid">
                <h2 className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b">
                  Outros Custos
                </h2>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border p-2 text-left">Descrição</th>
                      <th className="border p-2 text-center">Unidade</th>
                      <th className="border p-2 text-center">Quantidade</th>
                      <th className="border p-2 text-right">Valor Unit.</th>
                      <th className="border p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {os.outros.map((outro, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="border p-2">{outro.descricao || '-'}</td>
                        <td className="border p-2 text-center">{outro.unidade || '-'}</td>
                        <td className="border p-2 text-center">{outro.quantidade || 0}</td>
                        <td className="border p-2 text-right">{formatCurrency(outro.custo_unitario)}</td>
                        <td className="border p-2 text-right font-semibold">{formatCurrency(outro.custo_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Observações */}
            {os.observacoes && (
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b">
                  Observações
                </h2>
                <div className="bg-slate-50 p-4 rounded border text-sm">
                  <p className="text-slate-900 whitespace-pre-wrap">{os.observacoes}</p>
                </div>
              </div>
            )}

            {/* Resumo Financeiro */}
            <div className="border-t-2 border-slate-900 pt-6 mt-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                Resumo Financeiro
              </h2>
              <div className="bg-slate-50 p-4 rounded border">
                <div className="space-y-2 text-sm">
                  {os.valor_total_servicos > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Serviços:</span>
                      <span className="font-semibold">{formatCurrency(os.valor_total_servicos)}</span>
                    </div>
                  )}
                  {os.valor_total_materiais > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Materiais:</span>
                      <span className="font-semibold">{formatCurrency(os.valor_total_materiais)}</span>
                    </div>
                  )}
                  {os.valor_total_terceirizados > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Terceirizados:</span>
                      <span className="font-semibold">{formatCurrency(os.valor_total_terceirizados)}</span>
                    </div>
                  )}
                  {os.valor_total_outros > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Outros:</span>
                      <span className="font-semibold">{formatCurrency(os.valor_total_outros)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t-2 border-slate-300 text-lg">
                    <span className="font-bold text-slate-900">Total Geral:</span>
                    <span className="font-bold text-green-700">{formatCurrency(os.valor_total_geral)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Rodapé */}
            <div className="mt-8 pt-4 border-t text-center text-xs text-slate-500">
              <p>Documento gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              <p className="mt-1">MaintenancePro - Sistema de Gerenciamento de Manutenção</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
