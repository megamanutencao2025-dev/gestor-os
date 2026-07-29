
import React, { useState, useEffect, useMemo } from "react";
import { appApi } from "@/api/appClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Search, 
  Filter, 
  Download, 
  Calendar,
  Building2,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  X,
  FileDown,
  Loader2,
  AlertCircle,
  Printer
} from "lucide-react";
import { formatarData } from "@/components/utils/dateUtils";
import ModuleLabel from "@/components/ModuleLabel";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function GestaoTerceirizados({ embedded = false }) {
  const [ordensServico, setOrdensServico] = useState([]);
  const [prestadoras, setPrestadoras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("equipamento");
  
  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedPrestadora, setSelectedPrestadora] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [osData, prestadorasData] = await Promise.all([
        appApi.entities.OrdemServico.list('-created_date'),
        appApi.entities.PrestadoraServico.list()
      ]);
      
      setOrdensServico(osData);
      setPrestadoras(prestadorasData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Função para imprimir serviços terceirizados
  const handleImprimirServicos = (titulo, servicos, activeTab) => {
    const printWindow = window.open('', '_blank');
    const printContent = generateServicosHTML(titulo, servicos, activeTab);

    printWindow.document.write(printContent);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  };

  // Gerar HTML para impressão dos serviços
  const generateServicosHTML = (titulo, servicos, tipoRelatorio) => {
    const totalValor = servicos.reduce((sum, s) => sum + (s.valor_servico || 0), 0);
    const totalServicos = servicos.length;

    // Definir cabeçalhos baseado no tipo de relatório
    const colunaEsquerda = tipoRelatorio === "equipamento" ? "Prestadora" : "Equipamento";
    const colunaDados = tipoRelatorio === "equipamento" ? "prestadora_nome" : "equipamento_nome";

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Relatório de Serviços Terceirizados - ${titulo}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 18mm; }
          body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.4; color: #000; background: #fff; }
          .container { max-width: 100%; }
          .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; page-break-inside: avoid; }
          .header h1 { font-size: 16pt; font-weight: bold; margin-bottom: 6px; color: #000; }
          .header .info { font-size: 9pt; color: #333; margin-top: 4px; }
          .resumo { background: #f5f5f5; padding: 10px; margin-bottom: 15px; border: 1px solid #000; border-radius: 4px; }
          .resumo-item { display: inline-block; margin-right: 25px; font-size: 9pt; }
          .resumo-item strong { font-weight: 700; }
          table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 10px; }
          thead { background: #e0e0e0; }
          th { padding: 8px 10px; text-align: left; font-weight: 700; border: 1px solid #000; }
          td { padding: 6px 10px; border: 1px solid #666; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: 700; }
          tbody tr:nth-child(even) { background: #f9f9f9; }
          .footer { margin-top: 25px; padding-top: 10px; border-top: 1px solid #666; text-align: center; font-size: 8pt; color: #666; }
          .total-row { background: #e8f5e9 !important; font-weight: 700; border-top: 2px solid #000; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Relatório de Serviços Terceirizados</h1>
            <div class="info">
              <strong>${tipoRelatorio === "equipamento" ? "Equipamento" : "Prestadora"}:</strong> ${titulo}<br>
              <strong>Data do Relatório:</strong> ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}<br>
              ${startDate || endDate ? `<strong>Período:</strong> ${startDate ? formatarData(startDate) : 'Início'} até ${endDate ? formatarData(endDate) : 'Hoje'}` : ''}
            </div>
          </div>

          <div class="resumo">
            <div class="resumo-item"><strong>Total de Serviços:</strong> ${totalServicos}</div>
            <div class="resumo-item"><strong>Valor Total:</strong> ${totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 30%">${colunaEsquerda}</th>
                <th style="width: 15%" class="text-center">Data do Serviço</th>
                <th style="width: 40%">Descrição do Serviço</th>
                <th style="width: 15%" class="text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${servicos.map((servico, idx) => `
                <tr>
                  <td>${servico[colunaDados] || '-'}</td>
                  <td class="text-center">${formatarData(servico.data_servico)}</td>
                  <td>${servico.descricao_servico || '-'}</td>
                  <td class="text-right font-bold">${(servico.valor_servico || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="3" class="text-right">TOTAL GERAL:</td>
                <td class="text-right font-bold">${totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <p>MaintenancePro - Sistema de Gerenciamento de Manutenção</p>
            <p>Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Filtros aplicados como chips
  const activeFilters = useMemo(() => {
    const filters = [];
    if (searchTerm) filters.push({ key: 'search', label: `Busca: ${searchTerm}`, value: searchTerm });
    if (startDate) filters.push({ key: 'startDate', label: `De: ${formatarData(startDate)}`, value: startDate });
    if (endDate) filters.push({ key: 'endDate', label: `Até: ${formatarData(endDate)}`, value: endDate });
    if (selectedPrestadora) {
      const prest = prestadoras.find(p => p.id === selectedPrestadora);
      filters.push({ key: 'prestadora', label: `Prestadora: ${prest?.nome_empresa || ''}`, value: selectedPrestadora });
    }
    return filters;
  }, [searchTerm, startDate, endDate, selectedPrestadora, prestadoras]);

  const removeFilter = (filterKey) => {
    switch(filterKey) {
      case 'search': setSearchTerm(""); break;
      case 'startDate': setStartDate(""); break;
      case 'endDate': setEndDate(""); break;
      case 'prestadora': setSelectedPrestadora(""); break;
    }
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
    setSelectedPrestadora("");
  };

  // Dados agrupados por equipamento
  const dataByEquipment = useMemo(() => {
    let filtered = ordensServico.filter(os => 
      os.terceirizados && os.terceirizados.length > 0
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

    if (selectedPrestadora) {
      filtered = filtered.filter(os => 
        os.terceirizados.some(t => t.prestadora_id === selectedPrestadora)
      );
    }

    const grouped = {};
    filtered.forEach(os => {
      const equipId = os.equipamento_id || 'sem_equipamento';
      const equipNome = os.equipamento_nome || 'Sem Equipamento';
      
      if (!grouped[equipId]) {
        grouped[equipId] = {
          equipamento_id: equipId,
          equipamento_nome: equipNome,
          servicos: []
        };
      }
      
      os.terceirizados.forEach(terceirizado => {
        if (!selectedPrestadora || terceirizado.prestadora_id === selectedPrestadora) {
          grouped[equipId].servicos.push({
            ...terceirizado,
            data_os: os.data_programada || os.created_date,
            equipamento_nome: os.equipamento_nome // Adicionado para o relatório de prestadora que pode precisar do nome do equipamento
          });
        }
      });
    });

    let result = Object.values(grouped).map(group => ({
      ...group,
      totalServicos: group.servicos.length,
      valorTotal: group.servicos.reduce((sum, s) => sum + (s.valor_servico || 0), 0)
    }));

    if (searchTerm) {
      result = result.filter(item => 
        item.equipamento_nome.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return result.sort((a, b) => a.equipamento_nome.localeCompare(b.equipamento_nome));
  }, [ordensServico, startDate, endDate, selectedPrestadora, searchTerm]);

  // Dados agrupados por prestadora
  const dataByPrestadora = useMemo(() => {
    let filtered = ordensServico.filter(os => 
      os.terceirizados && os.terceirizados.length > 0
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

    const grouped = {};
    filtered.forEach(os => {
      os.terceirizados.forEach(terceirizado => {
        const prestId = terceirizado.prestadora_id || 'sem_prestadora';
        const prestNome = terceirizado.prestadora_nome || 'Sem Prestadora';
        
        if (!grouped[prestId]) {
          grouped[prestId] = {
            prestadora_id: prestId,
            prestadora_nome: prestNome,
            servicos: []
          };
        }
        
        grouped[prestId].servicos.push({
          ...terceirizado,
          equipamento_nome: os.equipamento_nome, // Necessário para a tabela de detalhes da prestadora
          data_os: os.data_programada || os.created_date
        });
      });
    });

    let result = Object.values(grouped).map(group => ({
      ...group,
      totalServicos: group.servicos.length,
      valorTotal: group.servicos.reduce((sum, s) => sum + (s.valor_servico || 0), 0)
    }));

    if (selectedPrestadora) {
      result = result.filter(item => item.prestadora_id === selectedPrestadora);
    }

    if (searchTerm) {
      result = result.filter(item => 
        item.prestadora_nome.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return result.sort((a, b) => a.prestadora_nome.localeCompare(b.prestadora_nome));
  }, [ordensServico, startDate, endDate, selectedPrestadora, searchTerm]);

  const currentData = activeTab === "equipamento" ? dataByEquipment : dataByPrestadora;
  const totalGeral = currentData.reduce((sum, item) => sum + (item.valorTotal || 0), 0);
  const totalServicos = currentData.reduce((sum, item) => sum + (item.totalServicos || 0), 0);

  const handleExportCSV = () => {
    const data = activeTab === "equipamento" ? dataByEquipment : dataByPrestadora;
    const headers = activeTab === "equipamento" 
      ? ['Equipamento', 'Total Serviços', 'Valor Total']
      : ['Prestadora', 'Total Serviços', 'Valor Total'];
    
    const rows = data.map(item => [
      activeTab === "equipamento" ? item.equipamento_nome : item.prestadora_nome,
      item.totalServicos,
      (item.valorTotal || 0).toFixed(2)
    ]);

    const csv = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `terceirizados_${activeTab}_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header compacto */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className={`flex items-center justify-between ${embedded ? 'mb-3' : 'mb-4'}`}>
          {!embedded && <ModuleLabel>Gestão de Terceirizados</ModuleLabel>}
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV}>
            <FileDown className="w-4 h-4" />
            Exportar
          </Button>
        </div>

        {/* Filtros compactos em linha */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Busca rápida */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={activeTab === "equipamento" ? "Buscar equipamento..." : "Buscar prestadora..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Período */}
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4 text-slate-500" />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-[140px] text-sm"
              placeholder="Data inicial"
            />
            <span className="text-slate-400 text-sm">até</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-[140px] text-sm"
              placeholder="Data final"
            />
          </div>

          {/* Filtros avançados */}
          <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                Filtros
                <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="absolute mt-2 bg-white border rounded-lg shadow-lg p-4 z-20 min-w-[300px]">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 mb-1 block">Prestadora</label>
                  <Select value={selectedPrestadora} onValueChange={setSelectedPrestadora}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Todas</SelectItem>
                      {prestadoras.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nome_empresa}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {activeFilters.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAllFilters}
              className="text-slate-500 hover:text-slate-700"
            >
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Chips de filtros ativos */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {activeFilters.map(filter => (
              <Badge key={filter.key} variant="secondary" className="gap-1 pr-1">
                <span className="text-xs">{filter.label}</span>
                <button
                  onClick={() => removeFilter(filter.key)}
                  className="ml-1 hover:bg-slate-300 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-600 font-medium">Total de {activeTab === "equipamento" ? "Equipamentos" : "Prestadoras"}</p>
                <p className="text-2xl font-bold text-slate-900">{currentData.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-600 font-medium">Total de Serviços</p>
                <p className="text-2xl font-bold text-slate-900">{totalServicos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Download className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-600 font-medium">Valor Total</p>
                <p className="text-2xl font-bold text-green-600">
                  {totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs e Conteúdo */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white border shadow-sm">
          <TabsTrigger value="equipamento" className="gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
            <Building2 className="w-4 h-4" />
            Por Equipamento
          </TabsTrigger>
          <TabsTrigger value="prestadora" className="gap-2 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700">
            <Building2 className="w-4 h-4" />
            Por Prestadora
          </TabsTrigger>
        </TabsList>

        <TabsContent value="equipamento" className="mt-0">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {currentData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <AlertCircle className="w-12 h-12 mb-4 text-slate-300" />
                  <p className="text-lg font-medium">Nenhum equipamento encontrado</p>
                  <p className="text-sm">Ajuste os filtros ou verifique os dados</p>
                </div>
              ) : (
                <div className="space-y-2 p-4">
                  {currentData.map((item) => {
                    const isExpanded = expandedRows[item.equipamento_id];
                    
                    return (
                      <div key={item.equipamento_id} className="group">
                        <div 
                          className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                          onClick={() => toggleExpand(item.equipamento_id)}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">
                              {(item.equipamento_nome || 'E').substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-900">{item.equipamento_nome}</h3>
                              <p className="text-xs text-slate-500">{item.totalServicos} serviço{item.totalServicos !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-lg font-bold text-green-600">
                                {(item.valorTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                            </div>
                            {isExpanded ? 
                              <ChevronDown className="w-5 h-5 text-slate-400" /> : 
                              <ChevronRight className="w-5 h-5 text-slate-400" />
                            }
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-2 ml-14 mr-2 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                            {/* Cabeçalho com botão de impressão */}
                            <div className="bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center">
                              <div className="text-sm text-slate-600">
                                <strong>Total:</strong> {item.totalServicos} serviço{item.totalServicos !== 1 ? 's' : ''} • 
                                <strong className="ml-2">Valor:</strong> 
                                <span className="ml-1 text-green-700 font-bold">
                                  {(item.valorTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleImprimirServicos(item.equipamento_nome, item.servicos, "equipamento");
                                }}
                                className="gap-2"
                              >
                                <Printer className="w-4 h-4" />
                                Imprimir
                              </Button>
                            </div>

                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader className="bg-slate-100 sticky top-0">
                                  <TableRow>
                                    <TableHead className="text-xs font-semibold">Prestadora</TableHead>
                                    <TableHead className="text-xs font-semibold">Data</TableHead>
                                    <TableHead className="text-xs font-semibold">Descrição</TableHead>
                                    <TableHead className="text-xs font-semibold text-right">Valor</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {item.servicos.map((servico, idx) => (
                                    <TableRow key={idx} className="hover:bg-white">
                                      <TableCell className="text-sm">{servico.prestadora_nome || '-'}</TableCell>
                                      <TableCell className="text-sm">{formatarData(servico.data_servico)}</TableCell>
                                      <TableCell className="text-sm text-slate-600">{servico.descricao_servico || '-'}</TableCell>
                                      <TableCell className="text-sm font-bold text-green-700 text-right">
                                        {(servico.valor_servico || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
        </TabsContent>

        <TabsContent value="prestadora" className="mt-0">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {currentData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <AlertCircle className="w-12 h-12 mb-4 text-slate-300" />
                  <p className="text-lg font-medium">Nenhuma prestadora encontrada</p>
                  <p className="text-sm">Ajuste os filtros ou verifique os dados</p>
                </div>
              ) : (
                <div className="space-y-2 p-4">
                  {currentData.map((item) => {
                    const isExpanded = expandedRows[item.prestadora_id];
                    
                    return (
                      <div key={item.prestadora_id} className="group">
                        <div 
                          className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:shadow-md hover:border-orange-300 transition-all cursor-pointer"
                          onClick={() => toggleExpand(item.prestadora_id)}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">
                              {(item.prestadora_nome || 'P').substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-900">{item.prestadora_nome}</h3>
                              <p className="text-xs text-slate-500">{item.totalServicos} serviço{item.totalServicos !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-lg font-bold text-green-600">
                                {(item.valorTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                            </div>
                            {isExpanded ? 
                              <ChevronDown className="w-5 h-5 text-slate-400" /> : 
                              <ChevronRight className="w-5 h-5 text-slate-400" />
                            }
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-2 ml-14 mr-2 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                            {/* Cabeçalho com botão de impressão */}
                            <div className="bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center">
                              <div className="text-sm text-slate-600">
                                <strong>Total:</strong> {item.totalServicos} serviço{item.totalServicos !== 1 ? 's' : ''} • 
                                <strong className="ml-2">Valor:</strong> 
                                <span className="ml-1 text-green-700 font-bold">
                                  {(item.valorTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleImprimirServicos(item.prestadora_nome, item.servicos, "prestadora");
                                }}
                                className="gap-2"
                              >
                                <Printer className="w-4 h-4" />
                                Imprimir
                              </Button>
                            </div>

                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader className="bg-slate-100 sticky top-0">
                                  <TableRow>
                                    <TableHead className="text-xs font-semibold">Equipamento</TableHead>
                                    <TableHead className="text-xs font-semibold">Data</TableHead>
                                    <TableHead className="text-xs font-semibold">Descrição</TableHead>
                                    <TableHead className="text-xs font-semibold text-right">Valor</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {item.servicos.map((servico, idx) => (
                                    <TableRow key={idx} className="hover:bg-white">
                                      <TableCell className="text-sm">{servico.equipamento_nome || '-'}</TableCell>
                                      <TableCell className="text-sm">{formatarData(servico.data_servico)}</TableCell>
                                      <TableCell className="text-sm text-slate-600">{servico.descricao_servico || '-'}</TableCell>
                                      <TableCell className="text-sm font-bold text-green-700 text-right">
                                        {(servico.valor_servico || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
