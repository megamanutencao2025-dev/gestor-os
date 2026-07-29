
import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, X, ChevronLeft, ChevronRight, FileDown, List } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatarData } from "@/components/utils/dateUtils";
import { normalizeOrdemServicoList } from "@/utils/ordemServicoNormalizer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export default function VisualizacaoSequencialModal({ isOpen, onClose, ordensServico, currentIndex = 0 }) {
  const [currentOSIndex, setCurrentOSIndex] = useState(currentIndex);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const contentRefs = useRef([]);
  const normalizedOrdensServico = normalizeOrdemServicoList(ordensServico);

  useEffect(() => {
    setCurrentOSIndex(currentIndex);
  }, [currentIndex, isOpen]);

  useEffect(() => {
    if (isOpen && contentRefs.current[currentOSIndex]) {
      contentRefs.current[currentOSIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, [currentOSIndex, isOpen]);

  if (normalizedOrdensServico.length === 0) return null;

  const currentOS = normalizedOrdensServico[currentOSIndex];

  const formatCurrency = (value) => {
    return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Função para converter horas decimais em formato Xh Ym
  const formatHoras = (horasDecimal) => {
    if (!horasDecimal || horasDecimal === 0) return '0h 0m';

    const horas = Math.floor(horasDecimal);
    const minutos = Math.round((horasDecimal - horas) * 60);

    return `${horas}h ${minutos}m`;
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

  const goToNext = () => {
    if (currentOSIndex < normalizedOrdensServico.length - 1) {
      setCurrentOSIndex(currentOSIndex + 1);
    }
  };

  const goToPrev = () => {
    if (currentOSIndex > 0) {
      setCurrentOSIndex(currentOSIndex - 1);
    }
  };

  const handlePrintCurrent = () => {
    const printWindow = window.open('', '_blank');
    const printContent = generatePrintHTML(currentOS);

    printWindow.document.write(printContent);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  };

  const handlePrintAll = () => {
    const printWindow = window.open('', '_blank');
    const allContent = normalizedOrdensServico.map(os => generatePrintHTML(os, true)).join('<div style="page-break-after: always;"></div>');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Múltiplas OS - Impressão</title>
        <style>
          @page { size: A4; margin: 18mm; }
          body { margin: 0; padding: 0; }
          .page-break { page-break-after: always; }
        </style>
      </head>
      <body>
        ${allContent}
      </body>
      </html>
    `);

    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  };

  const handleExportCurrent = () => {
    // Simula exportação individual - futuramente pode chamar API
    setIsGeneratingPDF(true);
    setTimeout(() => {
      handlePrintCurrent();
      setIsGeneratingPDF(false);
    }, 300);
  };

  const handleExportAll = () => {
    // Simula exportação múltipla - futuramente pode chamar API
    setIsGeneratingPDF(true);
    setTimeout(() => {
      handlePrintAll();
      setIsGeneratingPDF(false);
    }, 500);
  };

  const generatePrintHTML = (os, isMultiple = false) => {
    return `
      ${!isMultiple ? '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>OS ' + os.numero + ' - Impressão</title>' : ''}
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; margin: 18mm; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; line-height: 1.3; color: #000; background: #fff; }
        .container { max-width: 100%; }
        .header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; page-break-inside: avoid; }
        .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 8pt; line-height: 1.4; }
        .header h1 { font-size: 16pt; font-weight: bold; margin-bottom: 6px; color: #000; }
        .header-left, .header-right { display: flex; flex-direction: column; gap: 3px; }
        .header-item { display: flex; gap: 4px; }
        .header-item strong { font-weight: 600; min-width: 70px; }
        .section { margin-bottom: 10px; page-break-inside: avoid; }
        .section-title { font-size: 10pt; font-weight: bold; color: #000; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 6px; }
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 12px; font-size: 8pt; margin-bottom: 8px; }
        .info-item { display: flex; gap: 4px; }
        .info-item strong { font-weight: 600; color: #000; }
        .equipamento-item { border: 1px solid #000; padding: 6px; margin-bottom: 6px; page-break-inside: avoid; }
        .equipamento-header { font-size: 8pt; font-weight: 600; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px solid #666; }
        .hierarquia-tree { font-family: 'Courier New', monospace; font-size: 7pt; line-height: 1.6; }
        .hierarquia-line { display: flex; align-items: center; gap: 4px; padding: 1px 0; }
        .tree-prefix { color: #666; white-space: pre; }
        .nivel-badge { display: inline-block; padding: 1px 4px; border: 1px solid #000; font-size: 6pt; font-weight: 600; white-space: nowrap; }
        .equipamento-codigo { font-family: 'Courier New', monospace; font-weight: 700; color: #000; }
        .item-da-os { font-weight: 700; }
        .equipamento-local { font-size: 7pt; color: #333; margin-top: 3px; }
        .descricao-box { border: 1px solid #666; padding: 6px; font-size: 8pt; line-height: 1.4; white-space: pre-wrap; }
        table { width: 100%; border-collapse: collapse; font-size: 7pt; margin-top: 6px; page-break-inside: avoid; }
        thead { background: #f0f0f0; }
        th { padding: 4px 6px; text-align: left; font-weight: 600; border: 1px solid #000; background: #e0e0e0; }
        td { padding: 3px 6px; border: 1px solid #666; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .servico-card { border: 1px solid #000; padding: 6px; margin-bottom: 6px; page-break-inside: avoid; }
        .servico-header { font-weight: 600; font-size: 8pt; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px solid #666; }
        .servico-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 8px; font-size: 7pt; margin-bottom: 4px; }
        .servico-item { display: flex; gap: 4px; }
        .servico-item strong { font-weight: 600; }
        .servico-atividade { border: 1px solid #666; padding: 4px; font-size: 7pt; margin-top: 4px; }
        .servico-atividade-title { font-weight: 600; margin-bottom: 2px; }
        .resumo-financeiro { border: 2px solid #000; padding: 8px; margin-top: 12px; page-break-inside: avoid; }
        .resumo-title { font-size: 10pt; font-weight: bold; margin-bottom: 6px; text-align: center; }
        .resumo-item { display: flex; justify-content: space-between; padding: 3px 0; font-size: 8pt; }
        .resumo-item.total { border-top: 2px solid #000; padding-top: 6px; margin-top: 6px; font-size: 10pt; font-weight: bold; }
        .resumo-item .label { font-weight: 600; }
        .resumo-item .value { font-weight: 600; text-align: right; }
        .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #666; text-align: center; font-size: 7pt; color: #666; }
        .font-bold { font-weight: bold; }
        .mb-4 { margin-bottom: 4px; }
        .mb-6 { margin-bottom: 6px; }
        .no-break { page-break-inside: avoid; }
        .break-before { page-break-before: always; }
        @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
      </style>
      ${!isMultiple ? '</head><body>' : ''}
      <div class="container">
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
                  </div>
                `;
              }

              return `
                <div class="equipamento-item">
                  ${os.equipamentos.length > 1 ? `<div class="equipamento-header">Equipamento ${idx + 1}</div>` : ''}
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
                </div>
              `;
            }).join('') :
            `<div class="equipamento-item">
              ${os.equipamento_nome || 'Não especificado'}
            </div>`
          }
        </div>

        ${os.descricao_defeito ? `
        <div class="section">
          <div class="section-title">DESCRIÇÃO DO PROBLEMA</div>
          <div class="descricao-box">${os.descricao_defeito}</div>
        </div>` : ''}

        ${os.observacoes ? `
        <div class="section">
          <div class="section-title">OBSERVAÇÕES</div>
          <div class="descricao-box">${os.observacoes}</div>
        </div>` : ''}

        ${os.servicos && os.servicos.length > 0 ? `
        <div class="section">
          <div class="section-title">SERVIÇOS EXECUTADOS</div>
          ${os.servicos.map((servico, idx) => {
            const horasFormatadas = formatHoras(servico.total_horas || 0);
            return `
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
                  <span>${horasFormatadas}</span>
                </div>
                <div class="servico-item">
                  <strong>Valor:</strong>
                  <span>${formatCurrency(servico.valor_total)}</span>
                </div>
              </div>
              ${servico.atividade ? `
              <div class="servico-atividade">
                <div class="servico-atividade-title">Atividade:</div>
                <div>${servico.atividade}</div>
              </div>` : ''}
            </div>
          `;
          }).join('')}
        </div>` : ''}

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
            <span class="value">${Math.floor(os.tempo_parado_em_minutos / 60)}h ${os.tempo_parado_em_minutos % 60}m</span>
          </div>` : ''}
        </div>

        <div class="footer">
          <p>Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          <p>MaintenancePro - Sistema de Gerenciamento de Manutenção</p>
        </div>
      </div>
      ${!isMultiple ? '</body></html>' : ''}
    `;
  };

  // Renderiza conteúdo visual da OS para o modal
  const renderOSContent = (os, index) => {
    return (
      <div
        key={os.id}
        ref={el => contentRefs.current[index] = el}
        className="min-h-screen p-8 bg-white"
        style={{ scrollMarginTop: '80px' }}
        dangerouslySetInnerHTML={{
          __html: `
            <style>
              .modal-os-content * { margin: 0; padding: 0; box-sizing: border-box; }
              .modal-os-content .header { border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 16px; }
              .modal-os-content .header h1 { font-size: 22px; font-weight: bold; margin-bottom: 8px; color: #1e293b; }
              .modal-os-content .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; line-height: 1.5; }
              .modal-os-content .header-item { display: flex; gap: 6px; }
              .modal-os-content .header-item strong { font-weight: 600; min-width: 80px; }
              .modal-os-content .section { margin-bottom: 16px; }
              .modal-os-content .section-title { font-size: 16px; font-weight: bold; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; }
              .modal-os-content .equipamento-item { border: 1px solid #cbd5e1; padding: 12px; margin-bottom: 8px; border-radius: 8px; background: #f8fafc; }
              .modal-os-content .equipamento-header { font-size: 13px; font-weight: 600; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #cbd5e1; }
              .modal-os-content .hierarquia-tree { font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.8; }
              .modal-os-content .hierarquia-line { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
              .modal-os-content .tree-prefix { color: #64748b; white-space: pre; }
              .modal-os-content .nivel-badge { display: inline-block; padding: 2px 6px; border: 1px solid #475569; background: #f1f5f9; font-size: 10px; font-weight: 600; border-radius: 4px; }
              .modal-os-content .equipamento-codigo { font-family: 'Courier New', monospace; font-weight: 700; color: #1e293b; }
              .modal-os-content .item-da-os { font-weight: 700; background: #fef3c7; padding: 2px 4px; border-radius: 3px; }
              .modal-os-content .equipamento-local { font-size: 12px; color: #64748b; margin-top: 6px; font-style: italic; }
              .modal-os-content .descricao-box { border: 1px solid #cbd5e1; background: #f8fafc; padding: 12px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; border-radius: 6px; }
              .modal-os-content table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
              .modal-os-content thead { background: #f1f5f9; }
              .modal-os-content th { padding: 8px; text-align: left; font-weight: 600; border: 1px solid #cbd5e1; }
              .modal-os-content td { padding: 6px 8px; border: 1px solid #e2e8f0; }
              .modal-os-content .text-right { text-align: right; }
              .modal-os-content .text-center { text-align: center; }
              .modal-os-content .servico-card { border: 1px solid #cbd5e1; padding: 12px; margin-bottom: 10px; border-radius: 8px; background: #f8fafc; }
              .modal-os-content .servico-header { font-weight: 600; font-size: 14px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #cbd5e1; }
              .modal-os-content .servico-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 12px; font-size: 12px; margin-bottom: 8px; }
              .modal-os-content .servico-item { display: flex; gap: 6px; }
              .modal-os-content .servico-item strong { font-weight: 600; }
              .modal-os-content .servico-atividade { border: 1px solid #cbd5e1; background: white; padding: 8px; font-size: 12px; margin-top: 8px; border-radius: 4px; }
              .modal-os-content .servico-atividade-title { font-weight: 600; margin-bottom: 4px; }
              .modal-os-content .resumo-financeiro { border: 2px solid #1e293b; padding: 16px; margin-top: 20px; border-radius: 8px; background: #f8fafc; }
              .modal-os-content .resumo-title { font-size: 16px; font-weight: bold; margin-bottom: 12px; text-align: center; }
              .modal-os-content .resumo-item { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
              .modal-os-content .resumo-item.total { border-top: 2px solid #1e293b; padding-top: 12px; margin-top: 12px; font-size: 16px; font-weight: bold; }
              .modal-os-content .resumo-item .label { font-weight: 600; }
              .modal-os-content .resumo-item .value { font-weight: 600; text-align: right; }
              .modal-os-content .font-bold { font-weight: bold; }
            </style>
            <div class="modal-os-content">
              ${generatePrintHTML(os, true).replace('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>OS', '').replace('</head><body>', '').replace('</body></html>', '')}
            </div>
            ${index < normalizedOrdensServico.length - 1 ? '<div style="margin-top: 60px; margin-bottom: 40px; border-top: 3px dashed #cbd5e1;"></div>' : ''}
          `
        }}
      />
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[95vh] p-0 overflow-hidden">
        {/* Cabeçalho fixo */}
        <DialogHeader className="px-6 py-4 border-b bg-white z-10 sticky top-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <DialogTitle className="text-xl">
                Visualização de OS ({currentOSIndex + 1} / {normalizedOrdensServico.length})
              </DialogTitle>
              <Badge variant="outline" className="text-sm">
                {normalizedOrdensServico.length} OS selecionada{normalizedOrdensServico.length > 1 ? 's' : ''}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              {/* Navegação */}
              <div className="flex items-center gap-1 border-r pr-2 mr-2">
                <Button
                  onClick={goToPrev}
                  disabled={currentOSIndex === 0}
                  variant="outline"
                  size="sm"
                  title="OS Anterior (←)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  onClick={goToNext}
                  disabled={currentOSIndex === normalizedOrdensServico.length - 1}
                  variant="outline"
                  size="sm"
                  title="Próxima OS (→)"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Ações de Impressão/Exportação */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Printer className="w-4 h-4" />
                    Imprimir
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handlePrintCurrent}>
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir OS Atual
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handlePrintAll}>
                    <List className="w-4 h-4 mr-2" />
                    Imprimir Todas ({normalizedOrdensServico.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2" disabled={isGeneratingPDF}>
                    <FileDown className="w-4 h-4" />
                    Exportar PDF
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportCurrent} disabled={isGeneratingPDF}>
                    <FileDown className="w-4 h-4 mr-2" />
                    Exportar OS Atual
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportAll} disabled={isGeneratingPDF}>
                    <List className="w-4 h-4 mr-2" />
                    Exportar Todas ({normalizedOrdensServico.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button onClick={onClose} variant="ghost" size="sm">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Conteúdo scrollável */}
        <div className="overflow-y-auto flex-1 bg-slate-100">
          {normalizedOrdensServico.map((os, index) => renderOSContent(os, index))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
