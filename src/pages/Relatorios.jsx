import React, { useState, useEffect, useMemo, useCallback } from "react";
// Removed direct imports for OrdemServico and Equipamento, using appApi.entities instead
import { appApi } from "@/api/appClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // Added DialogClose
// Preserved original comprehensive lucide-react import list as some icons are used in preserved components
import { Printer, ChevronDown, ChevronRight, Settings, Clock, Eye, Loader2, FileDown } from "lucide-react"; 
import { format, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import ModuleLabel from "@/components/ModuleLabel";
import { normalizeOrdemServico } from "@/utils/ordemServicoNormalizer";
// Added lodash

import { formatarData } from "@/components/utils/dateUtils";
import VisualizacaoSequencialModal from "../components/ordens/VisualizacaoSequencialModal";
import GestaoTerceirizados from "./GestaoTerceirizados";
import VisualizacaoParadasModal from "../components/ordens/VisualizacaoParadasModal"; // NEW IMPORT

// Função para calcular tempo parado em horas e minutos
const calcularTempoParado = (dataInicio, horaInicio, dataFim, horaFim) => {
  if (!dataInicio || !horaInicio || !dataFim || !horaFim) return 0;

  try {
    // Ensure dates are parsed as UTC to avoid timezone issues when calculating difference
    const startDateTimeStr = `${dataInicio}T${horaInicio}:00Z`; // Assuming HH:MM format for horaInicio
    const endDateTimeStr = `${dataFim}T${horaFim}:00Z`;       // Assuming HH:MM format for horaFim

    const inicio = new Date(startDateTimeStr);
    const fim = new Date(endDateTimeStr);
    
    if (fim <= inicio) return 0;
    
    const diffMinutes = differenceInMinutes(fim, inicio);
    return diffMinutes;
  } catch (error) {
    console.error("Erro ao calcular tempo parado:", error);
    return 0;
  }
};

const DetalhesOSModal = ({ os: rawOs, isOpen, onClose }) => {
  if (!rawOs) return null;
  const os = normalizeOrdemServico(rawOs);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da OS #{os.numero}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-slate-600">Equipamento</p>
              <p className="text-base font-semibold">{os.equipamento_nome || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Status</p>
              <Badge>{os.status_nome}</Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Tipo de Manutenção</p>
              <p className="text-base">{os.tipo_nome || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Data Programada</p>
              <p className="text-base">{formatarData(os.data_programada)}</p>
            </div>
          </div>

          {os.descricao_defeito && (
            <div>
              <p className="text-sm font-medium text-slate-600">Descrição do Defeito</p>
              <p className="text-base bg-slate-50 p-3 rounded">{os.descricao_defeito}</p>
            </div>
          )}

          {os.servicos && os.servicos.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-600 mb-2">Serviços Executados</p>
              <div className="space-y-2">
                {os.servicos.map((servico, idx) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded">
                    <p><strong>Mantenedor:</strong> {servico.mantenedor_nome || '-'}</p>
                    <p><strong>Atividade:</strong> {servico.atividade || '-'}</p>
                    <p><strong>Total Horas:</strong> {(servico.total_horas || 0).toFixed(2)}h</p>
                    <p><strong>Valor:</strong> {(servico.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {os.materiais && os.materiais.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-600 mb-2">Materiais Utilizados</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {os.materiais.map((mat, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{mat.nome}</TableCell>
                      <TableCell>{mat.quantidade} {mat.unidade}</TableCell>
                      <TableCell className="text-right">
                        {(mat.custo_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="pt-4 border-t">
            <p className="text-lg font-bold">
              Valor Total: {(os.valor_total_geral || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Componente da tabela de equipamentos REFORMULADO
const RelatorioEquipamentos = ({ ordensServico, equipamentos }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedOS, setSelectedOS] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [modoHierarquico, setModoHierarquico] = useState(true);
  const [filtroEquipamentoId, setFiltroEquipamentoId] = useState("");
  const [selectedOSByEquipment, setSelectedOSByEquipment] = useState({}); // New state for selection
  const [formatoImpressao, setFormatoImpressao] = useState("tabela"); // New state for print format
  const [showSequentialModal, setShowSequentialModal] = useState(false);
  const [selectedOSForModal, setSelectedOSForModal] = useState([]); // New state for sequential modal OS

  const toggleExpand = (id) => {
    if (!id) return;
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const idToEquip = useMemo(() => {
    const map = {};
    (equipamentos || []).forEach(e => { map[e.id] = e; });
    return map;
  }, [equipamentos]);

  const childrenMap = useMemo(() => {
    const map = {};
    (equipamentos || []).forEach(eq => {
      const pid = eq.parent_id || null;
      if (!map[pid]) map[pid] = [];
      map[pid].push(eq);
    });
    return map;
  }, [equipamentos]);

  const getDescendantIds = useCallback((id) => {
    const out = new Set();
    if (!id) return out;
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      out.add(cur);
      (childrenMap[cur] || []).forEach(ch => stack.push(ch.id));
    }
    return out;
  }, [childrenMap]);

  const getRootId = useCallback((id) => {
    let cur = idToEquip[id];
    let guard = 0;
    while (cur?.parent_id && guard < 50) {
      cur = idToEquip[cur.parent_id];
      guard++;
    }
    return cur?.id || id;
  }, [idToEquip]);

  const filteredData = useMemo(() => {
    let filteredOS = ordensServico || [];

    if (startDate) {
      filteredOS = filteredOS.filter(os => {
        if (!os) return false;
        const osDate = new Date(os.data_programada ? `${os.data_programada}T00:00:00Z` : `${os.created_date}T00:00:00Z`);
        return osDate >= new Date(`${startDate}T00:00:00Z`);
      });
    }

    if (endDate) {
      const end = new Date(`${endDate}T23:59:59Z`);
      filteredOS = filteredOS.filter(os => {
        if (!os) return false;
        const osDate = new Date(os.data_programada ? `${os.data_programada}T00:00:00Z` : `${os.created_date}T00:00:00Z`);
        return osDate <= end;
      });
    }

    if (searchTerm) {
      filteredOS = filteredOS.filter(os => {
        if (!os) return false;
        const equipamento = idToEquip[os.equipamento_id];
        return os.equipamento_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
               equipamento?.codigo?.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    if (filtroEquipamentoId) {
      const allowedDescendantIds = getDescendantIds(filtroEquipamentoId);
      // Verificar tanto equipamento_id quanto array equipamentos
      filteredOS = filteredOS.filter(os => {
        if (!os) return false;
        // Verifica no equipamento principal
        if (os.equipamento_id && allowedDescendantIds.has(os.equipamento_id)) return true;
        // Verifica no array de equipamentos
        if (os.equipamentos && Array.isArray(os.equipamentos)) {
          return os.equipamentos.some(eq => eq.equipamento_id && allowedDescendantIds.has(eq.equipamento_id));
        }
        return false;
      });
    }

    if (modoHierarquico) {
      const grouped = {};
      
      filteredOS.forEach(os => {
        // Processar OS com múltiplos equipamentos
        if (os.equipamentos && Array.isArray(os.equipamentos) && os.equipamentos.length > 0) {
          os.equipamentos.forEach(eq => {
            const rootId = getRootId(eq.equipamento_id);
            if (!grouped[rootId]) grouped[rootId] = [];
            grouped[rootId].push(os);
          });
        } 
        // Compatibilidade com equipamento único
        else if (os.equipamento_id) {
          const rootId = getRootId(os.equipamento_id);
          if (!grouped[rootId]) grouped[rootId] = [];
          grouped[rootId].push(os);
        }
      });

      return Object.entries(grouped).map(([rootId, oss]) => {
        const equipamento = idToEquip[rootId] || { id: rootId, codigo: 'N/A', descricao: 'Equipamento não encontrado' };
        // Remover duplicatas de OS (caso uma OS tenha múltiplos equipamentos do mesmo root)
        const uniqueOSS = Array.from(new Map(oss.map(os => [os.id, os])).values());
        return {
          equipamento: equipamento,
          ordensServico: (uniqueOSS || []).sort((a, b) => new Date(b?.created_date || 0) - new Date(a?.created_date || 0)),
          totalOS: (uniqueOSS || []).length,
          custoTotal: (uniqueOSS || []).reduce((sum, os) => sum + (os?.valor_total_geral || 0), 0)
        };
      }).sort((a, b) => (a.equipamento?.descricao || '').localeCompare(b.equipamento?.descricao || ''));
    } else {
      const groupedByEquipment = {};
      
      filteredOS.forEach(os => {
        // Processar OS com múltiplos equipamentos
        if (os.equipamentos && Array.isArray(os.equipamentos) && os.equipamentos.length > 0) {
          os.equipamentos.forEach(eq => {
            if (!eq.equipamento_id) return;
            if (!groupedByEquipment[eq.equipamento_id]) {
              groupedByEquipment[eq.equipamento_id] = [];
            }
            groupedByEquipment[eq.equipamento_id].push(os);
          });
        } 
        // Compatibilidade com equipamento único
        else if (os.equipamento_id) {
          if (!groupedByEquipment[os.equipamento_id]) {
            groupedByEquipment[os.equipamento_id] = [];
          }
          groupedByEquipment[os.equipamento_id].push(os);
        }
      });

      return Object.entries(groupedByEquipment).map(([equipamentoId, oss]) => {
        const equipamento = idToEquip[equipamentoId] || { id: equipamentoId, codigo: 'N/A', descricao: 'Equipamento não encontrado' };
        // Remover duplicatas de OS
        const uniqueOSS = Array.from(new Map(oss.map(os => [os.id, os])).values());
        return {
          equipamento: equipamento,
          ordensServico: (uniqueOSS || []).sort((a, b) => new Date(b?.created_date || 0) - new Date(a?.created_date || 0)),
          totalOS: (uniqueOSS || []).length,
          custoTotal: (uniqueOSS || []).reduce((sum, os) => sum + (os?.valor_total_geral || 0), 0)
        };
      }).sort((a, b) => (a.equipamento?.descricao || '').localeCompare(b.equipamento?.descricao || ''));
    }
  }, [ordensServico, searchTerm, startDate, endDate, filtroEquipamentoId, modoHierarquico, idToEquip, getRootId, getDescendantIds]);

  const clearFilters = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
    setFiltroEquipamentoId("");
    setModoHierarquico(true);
    setSelectedOSByEquipment({}); // Clears all selections
  };

  // Selection by equipment
  const handleSelectAllEquipment = (equipamentoId, ordensServico, checked) => {
    const osIds = ordensServico.map(os => os.id);
    if (checked) {
      setSelectedOSByEquipment(prev => ({ ...prev, [equipamentoId]: osIds }));
    } else {
      setSelectedOSByEquipment(prev => {
        const newState = { ...prev };
        delete newState[equipamentoId];
        return newState;
      });
    }
  };

  const handleSelectOSEquipment = (equipamentoId, osId, checked) => {
    setSelectedOSByEquipment(prev => {
      const current = prev[equipamentoId] || [];
      if (checked) {
        return { ...prev, [equipamentoId]: [...current, osId] };
      } else {
        return { ...prev, [equipamentoId]: current.filter(id => id !== osId) };
      }
    });
  };

  // Print and Export functions
  const handleImprimirTabelaEquipamento = (equipamento, ordensServico) => {
    const printWindow = window.open('', '_blank');
    const printContent = generateTabelaCompactaHTML(equipamento, ordensServico);
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  };

  const handleImprimirSelecionadasEquipamento = (equipamentoId, equipamento, ordensServico) => {
    const selectedIds = selectedOSByEquipment[equipamentoId] || [];
    const selectedOS = ordensServico.filter(os => selectedIds.includes(os.id));
    
    if (selectedOS.length === 0) {
      alert('Selecione pelo menos uma OS para imprimir');
      return;
    }

    if (formatoImpressao === "tabela") {
      handleImprimirTabelaEquipamento(equipamento, selectedOS);
    } else {
      // Modo por OS - abrir visualizador sequencial
      setSelectedOSForModal(selectedOS);
      setShowSequentialModal(true);
    }
  };

  const handleExportarCSV = (equipamento, ordensServico) => {
    const csv = [
      ['Número OS', 'Equipamento', 'Tipo', 'Custo', 'Data Fim', 'Status', 'Máquina Parada'],
      ...ordensServico.map(os => [
        os.numero,
        os.equipamento_nome,
        os.tipo_nome,
        (os.valor_total_geral || 0).toFixed(2),
        formatarData(os.data_finalizada) || 'Não finalizada',
        os.status_nome,
        os.maquina_parada ? 'Sim' : 'Não'
      ])
    ].map(row => row.join(';')).join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `OS_${equipamento.codigo || equipamento.id}_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  const handleVisualizarTodasEquipamento = (ordensServico) => {
    setSelectedOSForModal(ordensServico);
    setShowSequentialModal(true);
  };

  const generateTabelaCompactaHTML = (equipamento, ordensServico) => {
    const custoTotal = ordensServico.reduce((sum, os) => sum + (os.valor_total_geral || 0), 0);
    
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Relatório - ${equipamento.codigo || equipamento.descricao}</title>
        <style>
          @page { size: A4 landscape; margin: 15mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 9pt; color: #000; }
          .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
          .header h1 { font-size: 14pt; margin-bottom: 5px; }
          .header .info { font-size: 8pt; color: #333; }
          .resumo { background: #f5f5f5; padding: 8px; margin-bottom: 15px; border: 1px solid #000; }
          .resumo-item { display: inline-block; margin-right: 20px; font-size: 8pt; }
          .resumo-item strong { font-weight: 700; }
          table { width: 100%; border-collapse: collapse; font-size: 8pt; }
          thead { background: #e0e0e0; }
          th { padding: 6px 8px; text-align: left; font-weight: 700; border: 1px solid #000; }
          td { padding: 5px 8px; border: 1px solid #666; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: 700; }
          tbody tr:nth-child(even) { background: #f9f9f9; }
          .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #666; text-align: center; font-size: 7pt; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Relatório de Manutenção - Equipamento</h1>
          <div class="info">
            <strong>Equipamento:</strong> ${equipamento.codigo ? `${equipamento.codigo} - ` : ''}${equipamento.descricao}<br>
            ${equipamento.localizacao ? `<strong>Localização:</strong> ${equipamento.localizacao}<br>` : ''}
            <strong>Data do Relatório:</strong> ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        </div>

        <div class="resumo">
          <div class="resumo-item"><strong>Total de OS:</strong> ${ordensServico.length}</div>
          <div class="resumo-item"><strong>Custo Total:</strong> ${custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 10%">Número OS</th>
              <th style="width: 25%">Equipamento (OS)</th>
              <th style="width: 15%">Tipo de Manutenção</th>
              <th style="width: 12%" class="text-right">Custo da OS</th>
              <th style="width: 12%" class="text-center">Data Fim</th>
              <th style="width: 15%">Status</th>
              <th style="width: 11%" class="text-center">Máq. Parada</th>
            </tr>
          </thead>
          <tbody>
            ${ordensServico.map(os => `
              <tr>
                <td class="font-bold">#${os.numero}</td>
                <td>${os.equipamento_nome || '-'}</td>
                <td>${os.tipo_nome || '-'}</td>
                <td class="text-right font-bold">${(os.valor_total_geral || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td class="text-center">${formatarData(os.data_finalizada) === '-' ? 'Não finalizada' : formatarData(os.data_finalizada)}</td>
                <td>${os.status_nome || '-'}</td>
                <td class="text-center">${os.maquina_parada ? 'Sim' : 'Não'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>MaintenancePro - Sistema de Gerenciamento de Manutenção</p>
          <p>Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>
      </body>
      </html>
    `;
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden sm:gap-4">
      {/* Filtros Compactos */}
      <Card className="shrink-0 rounded-lg border bg-white shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Pesquisar equipamento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="min-w-[150px]">
              <Input
                type="date"
                placeholder="Data inicial"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-full"
              />
            </div>
            <div className="min-w-[150px]">
              <Input
                type="date"
                placeholder="Data final"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-full"
              />
            </div>
            <div className="flex-1 min-w-[250px]">
              <Select value={filtroEquipamentoId} onValueChange={setFiltroEquipamentoId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Filtrar por equipamento (e subníveis)" /> 
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos</SelectItem>
                  {equipamentos
                    .slice()
                    .sort((a,b)=> (a.descricao||"").localeCompare(b.descricao||""))
                    .map(eq => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.codigo ? `${eq.codigo} - ${eq.descricao}` : eq.descricao}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="hier" checked={modoHierarquico} onCheckedChange={setModoHierarquico} />
              <label htmlFor="hier" className="text-sm cursor-pointer select-none">Modo hierárquico</label>
            </div>
            <Button variant="outline" size="sm" onClick={clearFilters} className="h-9 ml-auto">
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Equipamentos */}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
        <CardHeader className="shrink-0 p-4 pb-3">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <CardTitle className="text-base sm:text-lg">Equipamentos com Manutenção ({filteredData.length})</CardTitle>
            
            <Badge variant="secondary" className="px-3 py-1.5 text-sm bg-green-50 text-green-700 border-green-200">
              Total: {filteredData.reduce((sum, item) => sum + (item?.custoTotal || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 pt-0">
          {filteredData.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              {searchTerm || startDate || endDate || filtroEquipamentoId ? 
                "Nenhum equipamento encontrado com os filtros aplicados." :
                "Nenhum equipamento com manutenção encontrado."
              }
            </div>
          ) : (
            <div className="space-y-2">
              {filteredData.map((item) => {
                const isExpanded = expandedRows[item.equipamento?.id];
                const selectedInEquip = selectedOSByEquipment[item.equipamento?.id] || [];
                const allSelectedInEquip = selectedInEquip.length === item.ordensServico?.length && item.ordensServico?.length > 0;

                return (
                  <div key={item.equipamento?.id || Math.random()} className="group">
                    {/* Card Compacto do Equipamento - REFORMULADO */}
                    <div 
                      className="bg-white border border-slate-200 rounded-lg transition-all duration-200 hover:shadow-md hover:border-slate-300 cursor-pointer"
                      onClick={() => toggleExpand(item.equipamento?.id)}
                    >
                      <div className="flex items-center gap-4 px-4 py-3 min-h-[68px]">
                        {/* Ícone/Identificador */}
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">
                          {(item.equipamento?.codigo || item.equipamento?.descricao || 'E').substring(0, 2).toUpperCase()}
                        </div>

                        {/* Nome e Localização */}
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <h3 
                            className="text-[15px] font-semibold text-slate-900 truncate hover:text-blue-600 transition-colors"
                            title={`${item.equipamento?.codigo || 'N/A'} - ${item.equipamento?.descricao || 'Equipamento não encontrado'}`}
                          >
                            {item.equipamento?.codigo || 'N/A'} - {item.equipamento?.descricao || 'Equipamento não encontrado'}
                          </h3>
                          {item.equipamento?.localizacao && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate" title={item.equipamento.localizacao}>
                              📍 {item.equipamento.localizacao}
                            </p>
                          )}
                        </div>

                        {/* Métricas - Desktop */}
                        <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                          {/* Total de OS */}
                          <div className="text-right">
                            <p className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">Total OS</p>
                            <p className="text-lg font-bold text-blue-600 leading-tight">{item.totalOS || 0}</p>
                          </div>

                          {/* Custo Total */}
                          <div className="text-right min-w-[140px]">
                            <p className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">Custo Total</p>
                            <p className="text-lg font-bold text-green-600 leading-tight">
                              {(item.custoTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>

                          {/* Botão Expandir */}
                          <button
                            className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all group-hover:bg-blue-50 group-hover:text-blue-600"
                            aria-label={isExpanded ? "Recolher" : "Expandir"}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(item.equipamento?.id);
                            }}
                          >
                            {isExpanded ? 
                              <ChevronDown className="w-5 h-5 transition-transform" /> : 
                              <ChevronRight className="w-5 h-5 transition-transform" />
                            }
                          </button>
                        </div>

                        {/* Métricas - Mobile (empilhadas) */}
                        <div className="flex md:hidden flex-col items-end gap-1 flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 uppercase">OS:</span>
                            <span className="text-sm font-bold text-blue-600">{item.totalOS || 0}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 uppercase">Custo:</span>
                            <span className="text-sm font-bold text-green-600">
                              {(item.custoTotal || 0).toLocaleString('pt-BR', { 
                                style: 'currency', 
                                currency: 'BRL',
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                              })}
                            </span>
                          </div>
                          <button
                            className="mt-1 w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all"
                            aria-label={isExpanded ? "Recolher" : "Expandir"}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(item.equipamento?.id);
                            }}
                          >
                            {isExpanded ? 
                              <ChevronDown className="w-4 h-4" /> : 
                              <ChevronRight className="w-4 h-4" />
                            }
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Tabela de OS (expandida) */}
                    {isExpanded && (
                      <div className="mt-2 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        {/* Cabeçalho com ações */}
                        <div className="mb-4 pb-4 border-b border-slate-300 flex justify-between items-center flex-wrap gap-3">
                          <div className="flex items-center gap-4">
                            <div className="text-sm text-slate-600">
                              <strong>Total de linhas:</strong> {item.ordensServico?.length || 0}
                            </div>
                            <div className="text-sm">
                              <strong>Soma Custo:</strong> 
                              <span className="ml-2 text-green-700 font-bold">
                                {(item.custoTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            </div>
                            {selectedInEquip.length > 0 && (
                              <Badge className="bg-blue-100 text-blue-800">
                                {selectedInEquip.length} selecionada{selectedInEquip.length > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 flex-wrap">
                            <Select value={formatoImpressao} onValueChange={setFormatoImpressao}>
                              <SelectTrigger className="w-[180px] h-9 text-sm">
                                <SelectValue placeholder="Formato Impressão" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="tabela">Tabela compacta</SelectItem>
                                <SelectItem value="por_os">Cada OS = 1 página A4</SelectItem>
                              </SelectContent>
                            </Select>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportarCSV(item.equipamento, item.ordensServico);
                              }}
                              className="gap-2"
                            >
                              <FileDown className="w-4 h-4" />
                              CSV
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleImprimirTabelaEquipamento(item.equipamento, item.ordensServico);
                              }}
                              className="gap-2"
                            >
                              <Printer className="w-4 h-4" />
                              Imprimir Tabela
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleImprimirSelecionadasEquipamento(item.equipamento.id, item.equipamento, item.ordensServico);
                              }}
                              disabled={selectedInEquip.length === 0}
                              className="gap-2"
                            >
                              <Printer className="w-4 h-4" />
                              Selecionadas ({selectedInEquip.length})
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVisualizarTodasEquipamento(item.ordensServico);
                              }}
                              className="gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              Visualizador
                            </Button>
                          </div>
                        </div>

                        {/* Tabela melhorada */}
                        <div className="overflow-x-auto rounded border border-slate-300 bg-white">
                          <Table>
                            <TableHeader className="sticky top-0 bg-slate-100 z-10">
                              <TableRow>
                                <TableHead className="w-12">
                                  <Checkbox 
                                    checked={allSelectedInEquip}
                                    onCheckedChange={(checked) => handleSelectAllEquipment(item.equipamento.id, item.ordensServico, checked)}
                                  />
                                </TableHead>
                                <TableHead className="font-semibold text-xs">Número da OS</TableHead>
                                <TableHead className="font-semibold text-xs">Equipamento (OS)</TableHead>
                                <TableHead className="font-semibold text-xs">Tipo de Manutenção</TableHead>
                                <TableHead className="font-semibold text-xs text-right">Custo da OS</TableHead>
                                <TableHead className="font-semibold text-xs text-center">Data Fim da OS</TableHead>
                                <TableHead className="font-semibold text-xs">Status</TableHead>
                                <TableHead className="font-semibold text-xs text-center w-24">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(item.ordensServico || []).map((os) => (
                                <TableRow key={os?.id || Math.random()} className="hover:bg-slate-50 transition-colors">
                                  <TableCell>
                                    <Checkbox 
                                      checked={selectedInEquip.includes(os.id)}
                                      onCheckedChange={(checked) => handleSelectOSEquipment(item.equipamento.id, os.id, checked)}
                                    />
                                  </TableCell>
                                  <TableCell className="font-semibold text-blue-600 text-sm">#{os?.numero || 'N/A'}</TableCell>
                                  <TableCell className="text-xs">{os?.equipamento_nome || '-'}</TableCell>
                                  <TableCell className="text-xs">{os?.tipo_nome || '-'}</TableCell>
                                  <TableCell className="font-bold text-right text-green-700 text-sm">
                                    {(os?.valor_total_geral || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </TableCell>
                                  <TableCell className="text-center text-xs">
                                    {formatarData(os?.data_finalizada) === '-' ? 
                                      <span className="text-slate-400 italic">Não finalizada</span> : 
                                      formatarData(os?.data_finalizada)
                                    }
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="border-slate-300 text-slate-700 bg-white text-xs">
                                      {os?.status_nome || 'N/A'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setSelectedOS(os)}
                                      className="h-8 w-8 p-0"
                                      title="Visualizar OS"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <DetalhesOSModal 
        os={selectedOS} 
        isOpen={!!selectedOS} 
        onClose={() => setSelectedOS(null)} 
      />

      <VisualizacaoSequencialModal
        isOpen={showSequentialModal}
        onClose={() => {
          setShowSequentialModal(false);
          setSelectedOSForModal([]);
        }}
        ordensServico={selectedOSForModal}
        currentIndex={0}
      />
    </div>
  );
};


// Componente para relatório de materiais
const RelatorioMateriais = ({ ordensServico }) => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedOS, setSelectedOS] = useState(null);

  const filteredData = useMemo(() => {
    let filtered = ordensServico.filter(os => 
      os.materiais && os.materiais.length > 0
    );

    if (startDate) {
      filtered = filtered.filter(os => {
        const osDate = new Date(os.data_programada ? `${os.data_programada}T00:00:00Z` : `${os.created_date}T00:00:00Z`);
        return osDate >= new Date(`${startDate}T00:00:00Z`);
      });
    }

    if (endDate) {
      const end = new Date(`${endDate}T23:59:59Z`);
      filtered = filtered.filter(os => {
        const osDate = new Date(os.data_programada ? `${os.data_programada}T00:00:00Z` : `${os.created_date}T00:00:00Z`);
        return osDate <= end;
      });
    }

    return filtered.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [ordensServico, startDate, endDate]);

  const totalMateriais = filteredData.reduce((sum, os) => 
    sum + (os.materiais || []).reduce((osSum, m) => osSum + (m.custo_total || 0), 0), 0
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden sm:gap-4">
      <Card className="shrink-0 rounded-lg border bg-white shadow-sm">
        <CardContent className="p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
        <CardHeader className="shrink-0 p-4 pb-3">
          <CardTitle className="flex flex-wrap justify-between items-center gap-3 text-base sm:text-lg">
            <span>Materiais Utilizados ({filteredData.length} OS)</span>
            <Badge variant="secondary" className="px-3 py-1.5 text-sm">
              Total: {totalMateriais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto p-0 sm:p-4 sm:pt-0">
          {filteredData.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Nenhuma OS com materiais utilizados encontrada no período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
                  <TableRow>
                    <TableHead>Número da OS</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Tipo de Manutenção</TableHead>
                    <TableHead>Valor Materiais</TableHead>
                    <TableHead>Data Fim da OS</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((os) => (
                    <TableRow key={os.id}>
                      <TableCell className="font-medium text-blue-600">#{os.numero}</TableCell>
                      <TableCell>{os.equipamento_nome}</TableCell>
                      <TableCell>{os.tipo_nome}</TableCell>
                      <TableCell className="font-semibold">
                        {((os.materiais || []).reduce((sum, m) => sum + (m.custo_total || 0), 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                      <TableCell>
                        {formatarData(os.data_finalizada) === '-' ? 'Não finalizada' : formatarData(os.data_finalizada)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedOS(os)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <DetalhesOSModal 
        os={selectedOS} 
        isOpen={!!selectedOS} 
        onClose={() => setSelectedOS(null)} 
      />
    </div>
  );
};

// Componente para relatório de tempo de máquina parada
const RelatorioTempoParada = ({ ordensServico, equipamentos }) => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedEquipamento, setSelectedEquipamento] = useState(null);
  const [selectedParadas, setSelectedParadas] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});

  const toggleExpand = (id) => {
    if (!id) return;
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const idToEquip = useMemo(() => {
    const map = {};
    (equipamentos || []).forEach(e => { map[e.id] = e; });
    return map;
  }, [equipamentos]);

  const filteredData = useMemo(() => {
    let filtered = ordensServico.filter(os => 
      os.maquina_parada && os.data_programada && os.hora_programada && os.data_finalizada && os.hora_finalizada
    );

    if (startDate) {
      filtered = filtered.filter(os => {
        const osDate = new Date(os.data_programada ? `${os.data_programada}T00:00:00Z` : `${os.created_date}T00:00:00Z`);
        return osDate >= new Date(`${startDate}T00:00:00Z`);
      });
    }

    if (endDate) {
      const end = new Date(`${endDate}T23:59:59Z`);
      filtered = filtered.filter(os => {
        const osDate = new Date(os.data_programada ? `${os.data_programada}T00:00:00Z` : `${os.created_date}T00:00:00Z`);
        return osDate <= end;
      });
    }

    // Agrupar por equipamento considerando múltiplos equipamentos por OS
    const groupedByEquipment = {};
    filtered.forEach(os => {
      const tempoParado = calcularTempoParado(os.data_programada, os.hora_programada, os.data_finalizada, os.hora_finalizada);
      
      // Se a OS tem múltiplos equipamentos
      if (os.equipamentos && Array.isArray(os.equipamentos) && os.equipamentos.length > 0) {
        os.equipamentos.forEach(eq => {
          const equipId = eq.equipamento_id || 'sem_equipamento';
          const equipNome = eq.equipamento_nome || 'Sem Equipamento';
          
          if (!groupedByEquipment[equipId]) {
            groupedByEquipment[equipId] = {
              equipamento_id: equipId,
              equipamento_nome: equipNome,
              paradas: []
            };
          }
          
          groupedByEquipment[equipId].paradas.push({
            ...os,
            tempo_parado: tempoParado
          });
        });
      } 
      // Compatibilidade com equipamento único
      else {
        const equipId = os.equipamento_id || 'sem_equipamento';
        const equipNome = os.equipamento_nome || 'Sem Equipamento';
        
        if (!groupedByEquipment[equipId]) {
          groupedByEquipment[equipId] = {
            equipamento_id: equipId,
            equipamento_nome: equipNome,
            paradas: []
          };
        }
        
        groupedByEquipment[equipId].paradas.push({
          ...os,
          tempo_parado: tempoParado
        });
      }
    });

    // Converter para array e calcular totais
    return Object.values(groupedByEquipment).map(group => ({
      ...group,
      totalParadas: group.paradas.length,
      tempoTotalMinutos: group.paradas.reduce((sum, p) => sum + (p.tempo_parado || 0), 0),
      tempoMedioMinutos: group.paradas.length > 0 ? 
        group.paradas.reduce((sum, p) => sum + (p.tempo_parado || 0), 0) / group.paradas.length : 0
    })).sort((a, b) => b.tempoTotalMinutos - a.tempoTotalMinutos);
  }, [ordensServico, startDate, endDate]);

  const estatisticas = useMemo(() => {
    const totalParadas = filteredData.reduce((sum, item) => sum + item.totalParadas, 0);
    const tempoTotalMinutos = filteredData.reduce((sum, item) => sum + item.tempoTotalMinutos, 0);
    const tempoMedioMinutos = totalParadas > 0 ? tempoTotalMinutos / totalParadas : 0;

    return { totalParadas, tempoTotalMinutos, tempoMedioMinutos };
  }, [filteredData]);

  const formatarTempo = (minutos) => {
    if (minutos === 0) return "0min";
    const horas = Math.floor(minutos / 60);
    const mins = Math.round(minutos % 60);
    let result = '';
    if (horas > 0) {
      result += `${horas}h `;
    }
    result += `${mins}min`;
    return result.trim();
  };

  const handleVisualizarParadas = (equipamento) => {
    setSelectedEquipamento({
      id: equipamento.equipamento_id,
      nome: equipamento.equipamento_nome
    });
    setSelectedParadas(equipamento.paradas);
    setModalOpen(true);
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden sm:gap-4">
      <Card className="shrink-0 rounded-lg border bg-white shadow-sm">
        <CardContent className="p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <div>
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <Button variant="outline" size="sm" onClick={clearFilters} className="h-9 w-full md:w-auto">
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas Gerais */}
      <div className="shrink-0 grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card className="rounded-lg border bg-white shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Settings className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-slate-600">Equipamentos com Paradas</p>
                <p className="text-2xl font-bold text-blue-600">{filteredData.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border bg-white shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="w-8 h-8 text-slate-600" />
              <div>
                <p className="text-sm text-slate-600">Total de Paradas</p>
                <p className="text-2xl font-bold text-slate-900">{estatisticas.totalParadas.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border bg-white shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-sm text-slate-600">Tempo Total Parado</p>
                <p className="text-2xl font-bold text-red-600">{formatarTempo(estatisticas.tempoTotalMinutos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border bg-white shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-sm text-slate-600">Tempo Médio por Parada</p>
                <p className="text-2xl font-bold text-orange-600">{formatarTempo(estatisticas.tempoMedioMinutos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
        <CardHeader className="shrink-0 p-4 pb-3">
          <CardTitle className="text-base sm:text-lg">Equipamentos com Paradas ({filteredData.length})</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 pt-0">
          {filteredData.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Nenhuma parada de máquina encontrada no período.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredData.map((item) => {
                const isExpanded = expandedRows[item.equipamento_id];
                
                return (
                  <div key={item.equipamento_id} className="group">
                    <div 
                      className="bg-white border border-slate-200 rounded-lg transition-all duration-200 hover:shadow-md hover:border-slate-300 cursor-pointer"
                      onClick={() => toggleExpand(item.equipamento_id)}
                    >
                      <div className="flex items-center gap-4 px-4 py-3 min-h-[68px]">
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">
                          {(item.equipamento_nome || 'E').substring(0, 2).toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0 overflow-hidden">
                          <h3 
                            className="text-[15px] font-semibold text-slate-900 truncate hover:text-red-600 transition-colors"
                            title={item.equipamento_nome}
                          >
                            {item.equipamento_nome}
                          </h3>
                          <p className="text-xs text-slate-500">{item.totalParadas} parada{item.totalParadas > 1 ? 's' : ''}</p>
                        </div>

                        <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">Total Paradas</p>
                            <p className="text-lg font-bold text-slate-900 leading-tight">{item.totalParadas}</p>
                          </div>

                          <div className="text-right min-w-[120px]">
                            <p className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">Tempo Total</p>
                            <p className="text-lg font-bold text-red-600 leading-tight">
                              {formatarTempo(item.tempoTotalMinutos)}
                            </p>
                          </div>

                          <div className="text-right min-w-[120px]">
                            <p className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">Tempo Médio</p>
                            <p className="text-lg font-bold text-orange-600 leading-tight">
                              {formatarTempo(item.tempoMedioMinutos)}
                            </p>
                          </div>

                          <button
                            className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all group-hover:bg-red-50 group-hover:text-red-600"
                            aria-label={isExpanded ? "Recolher" : "Expandir"}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(item.equipamento_id);
                            }}
                          >
                            {isExpanded ? 
                              <ChevronDown className="w-5 h-5 transition-transform" /> : 
                              <ChevronRight className="w-5 h-5 transition-transform" />
                            }
                          </button>
                        </div>

                        <div className="flex md:hidden flex-col items-end gap-1 flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 uppercase">Paradas:</span>
                            <span className="text-sm font-bold text-slate-900">{item.totalParadas}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 uppercase">Tempo:</span>
                            <span className="text-sm font-bold text-red-600">
                              {formatarTempo(item.tempoTotalMinutos)}
                            </span>
                          </div>
                          <button
                            className="mt-1 w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all"
                            aria-label={isExpanded ? "Recolher" : "Expandir"}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(item.equipamento_id);
                            }}
                          >
                            {isExpanded ? 
                              <ChevronDown className="w-4 h-4" /> : 
                              <ChevronRight className="w-4 h-4" />
                            }
                          </button>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="flex justify-center">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVisualizarParadas(item);
                            }}
                            className="gap-2 bg-blue-600 hover:bg-blue-700"
                          >
                            <Eye className="w-4 h-4" />
                            Visualizar Todas as Paradas ({item.totalParadas})
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <VisualizacaoParadasModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedEquipamento(null);
          setSelectedParadas([]);
        }}
        equipamento={selectedEquipamento}
        paradas={selectedParadas}
      />
    </div>
  );
};

export default function Relatorios() {
  const [ordensServico, setOrdensServico] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [osData, equipData] = await Promise.all([
        appApi.entities.OrdemServico.list('-created_date'),
        appApi.entities.Equipamento.list()
      ]);
      
      setOrdensServico(osData);
      setEquipamentos(equipData.sort((a, b) => (a.descricao || '').localeCompare(b.descricao || '')));
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center min-h-96">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden p-3 sm:p-4 lg:h-screen lg:p-6">
      <Tabs defaultValue="equipamentos" className="flex min-h-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 shrink-0 space-y-3 bg-background pb-3">
          <ModuleLabel>Relatórios</ModuleLabel>
        <TabsList className="h-auto min-h-10 w-full justify-start overflow-x-auto rounded-lg border bg-white p-1 text-slate-600 shadow-sm">
          <TabsTrigger value="equipamentos" className="h-8 flex-none px-3 text-xs sm:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Por Equipamento</TabsTrigger>
          <TabsTrigger value="terceirizados" className="h-8 flex-none px-3 text-xs sm:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Terceirizados</TabsTrigger>
          <TabsTrigger value="materiais" className="h-8 flex-none px-3 text-xs sm:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Materiais</TabsTrigger>
          <TabsTrigger value="tempo-parada" className="h-8 flex-none px-3 text-xs sm:text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">Tempo Parada</TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="equipamentos" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
          <RelatorioEquipamentos 
            ordensServico={ordensServico} 
            equipamentos={equipamentos} 
          />
        </TabsContent>

        <TabsContent value="terceirizados" className="mt-0 min-h-0 flex-1 overflow-y-auto">
          <GestaoTerceirizados embedded />
        </TabsContent>

        <TabsContent value="materiais" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
          <RelatorioMateriais ordensServico={ordensServico} />
        </TabsContent>

        <TabsContent value="tempo-parada" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
          <RelatorioTempoParada ordensServico={ordensServico} equipamentos={equipamentos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
