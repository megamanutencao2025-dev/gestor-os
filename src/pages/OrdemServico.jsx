import React, { useState, useEffect, useMemo } from 'react';
import { OrdemServico } from '@/entities/OrdemServico';
import { appApi } from '@/api/appClient';
import { useAuth } from '@/lib/AuthContext';
import { Equipamento } from '@/entities/Equipamento';
import { TipoManutencao } from '@/entities/TipoManutencao';
import { StatusOS } from '@/entities/StatusOS';
import { AreaManutencao } from '@/entities/AreaManutencao';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Search, Download, Filter, Trash2, Upload, HelpCircle, ArrowUpDown, Eye, MoreHorizontal, Printer, CheckCircle, XCircle, ClipboardCheck, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { UploadFile, ExtractDataFromUploadedFile } from "@/integrations/Core";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import VisualizacaoOSModal from "../components/ordens/VisualizacaoOSModal";
import VisualizacaoSequencialModal from "../components/ordens/VisualizacaoSequencialModal";
import { ComboboxSelect } from "@/components/ui/ComboboxSelect";
import { formatarData } from "@/components/utils/dateUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { openBlankOrdemServicoPrint } from "@/utils/blankOrdemServicoPrint";

const SortableHeader = ({ children, column, sortConfig, onSort, className = "" }) => {
  const isSorted = sortConfig.key === column;
  const direction = isSorted ? sortConfig.direction : undefined;

  return (
    <TableHead onClick={() => onSort(column)} className={`cursor-pointer hover:bg-accent/40 ${className}`}>
      <div className="flex items-center gap-2">
        {children}
        {isSorted ? (
          direction === 'ascending' ? (
            <ArrowUpDown className="w-4 h-4" />
          ) : (
            <ArrowUpDown className="w-4 h-4" />
          )
        ) : (
          <ArrowUpDown className="w-4 h-4 text-slate-400" />
        )}
      </div>
    </TableHead>
  );
};

const ORDERING_FIELDS = {
  numero: "number",
  data_programada: "scheduled_at",
  prazo: "due_at",
  prioridade: "priority__order",
  tipo_nome: "maintenance_type__description",
  status_nome: "status__order",
  solicitante: "requester",
};

const QUICK_FILTERS = [
  ["", "Todas"],
  ["open", "Abertas"],
  ["overdue", "Vencidas"],
  ["due_today", "Vencem hoje"],
  ["unassigned", "Sem responsável"],
  ["waiting_parts", "Aguardando peça"],
  ["emergency", "Emergenciais"],
];

const toLegacyListOrder = (order) => {
  const equipamentos = Array.isArray(order.equipment)
    ? order.equipment.map((item) => ({
      equipamento_id: item.id,
      equipamento_nome: item.description,
      localizacao_celula: item.location || "",
    }))
    : [];
  const scheduled = order.scheduled_at ? new Date(order.scheduled_at) : null;
  const due = order.due_at ? new Date(order.due_at) : null;
  return {
    ...order,
    numero: order.number,
    solicitante: order.requester,
    tipo_nome: order.maintenance_type_name,
    status_nome: order.status_name,
    status_id: order.status,
    area_nome: order.area_name,
    prioridade_nome: order.priority_name,
    prioridade_severidade: order.priority_severity,
    responsavel_id: order.assigned_maintainer,
    responsavel_nome: order.assigned_maintainer_name,
    data_programada: scheduled?.toISOString().slice(0, 10) || "",
    hora_programada: scheduled?.toTimeString().slice(0, 5) || "",
    data_prazo: due?.toISOString().slice(0, 10) || "",
    hora_prazo: due?.toTimeString().slice(0, 5) || "",
    equipamentos,
    equipamento_nome: equipamentos[0]?.equipamento_nome || order.equipment_description,
    local: equipamentos[0]?.localizacao_celula || "",
  };
};

const formatDateTime = (date, time) => {
  if (!date) return "-";
  return `${formatarData(date)}${time ? ` ${time}` : ""}`;
};

const getDeadlineState = (order) => {
  if (["completed", "cancelled", "rejected"].includes(order.status_category)) {
    return null;
  }
  if (!order.due_at) return { label: "Sem prazo", className: "border-slate-500/40 text-slate-400" };
  const deadline = new Date(order.due_at);
  const now = new Date();
  if (deadline < now) return { label: "Vencida", className: "border-red-500/50 bg-red-500/10 text-red-300" };
  if (deadline.toDateString() === now.toDateString()) {
    return { label: "Vence hoje", className: "border-amber-500/50 bg-amber-500/10 text-amber-300" };
  }
  return { label: "No prazo", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" };
};

const formatOpenTime = (createdAt, statusCategory) => {
  if (!createdAt || ["completed", "cancelled", "rejected"].includes(statusCategory)) return "-";
  const hours = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 3600000));
  return hours < 24 ? `${hours} h` : `${Math.floor(hours / 24)} d`;
};


export default function OrdemServicoPage() {
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ordensServico, setOrdensServico] = useState([]);
  const [legacyOrders, setLegacyOrders] = useState([]);
  const [listMeta, setListMeta] = useState({ count: 0, next: null, previous: null });
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get("page_size")) || 25);
  const [pendingSolicitations, setPendingSolicitations] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [areas, setAreas] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [filters, setFilters] = useState({
    equipamento_id: searchParams.get("equipment") || "",
    status_id: searchParams.get("status") || "",
    data_inicio: searchParams.get("date_from") || "",
    data_fim: searchParams.get("date_to") || "",
    location: searchParams.get("location") || "",
    maintenance_type: searchParams.get("maintenance_type") || "",
    priority: searchParams.get("priority") || "",
    responsible: searchParams.get("responsible") || "",
    situation: searchParams.get("situation") || "",
  });
  const [sortConfig, setSortConfig] = useState({ key: 'created_date', direction: 'descending' });
  const [importStatus, setImportStatus] = useState({ type: '', message: '' });
  const [pageError, setPageError] = useState("");
  const [selectedOSForView, setSelectedOSForView] = useState(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [showSequentialModal, setShowSequentialModal] = useState(false);
  const [activeTab, setActiveTab] = useState("ordens");
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  const fileInputRef = React.useRef(null);


  useEffect(() => {
    loadData();
  }, [currentUser?.id]);

  useEffect(() => {
    const timeout = window.setTimeout(() => loadOrderPage(), 250);
    return () => window.clearTimeout(timeout);
  }, [searchTerm, filters, sortConfig, page, pageSize]);

  useEffect(() => {
    if (activeTab !== "terceirizados" || legacyOrders.length > 0) return;
    OrdemServico.list("-created_date")
      .then((records) => setLegacyOrders(Array.isArray(records) ? records : []))
      .catch((error) => setPageError(error?.message || "Não foi possível carregar os serviços terceirizados."));
  }, [activeTab, legacyOrders.length]);

  const loadOrderPage = async () => {
    setListLoading(true);
    setPageError("");
    try {
      const backendOrdering = ORDERING_FIELDS[sortConfig.key] || "created_at";
      const ordering = sortConfig.direction === "descending"
        ? `-${backendOrdering.replace(/^-/, "")}`
        : backendOrdering.replace(/^-/, "");
      const query = {
        page,
        page_size: pageSize,
        search: searchTerm.trim(),
        equipment: filters.equipamento_id,
        status: filters.status_id,
        date_from: filters.data_inicio,
        date_to: filters.data_fim,
        location: filters.location,
        maintenance_type: filters.maintenance_type,
        priority: filters.priority,
        responsible: filters.responsible,
        situation: filters.situation,
        ordering,
      };
      const response = await appApi.workOrders.list(query);
      setOrdensServico((response?.results || []).map(toLegacyListOrder));
      setListMeta({
        count: response?.count || 0,
        next: response?.next || null,
        previous: response?.previous || null,
      });
      const nextParams = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value && !(key === "page" && value === 1) && !(key === "page_size" && value === 25)) {
          nextParams.set(key, String(value));
        }
      });
      setSearchParams(nextParams, { replace: true });
    } catch (error) {
      if (error?.status === 404 && page > 1) {
        setPage(1);
        return;
      }
      setOrdensServico([]);
      setListMeta({ count: 0, next: null, previous: null });
      setPageError(error?.message || "Não foi possível carregar as ordens de serviço.");
    } finally {
      setListLoading(false);
    }
  };

  const loadData = async () => {
    setReferenceLoading(true);
    setPageError("");
    try {
      const pendingDataPromise = currentUser?.role === "admin"
        ? appApi.admin.workOrders.pendingSolicitations()
        : Promise.resolve([]);
      const [equipData, tiposData, areasData, statusData, pendingData] = await Promise.all([
        Equipamento.list(),
        TipoManutencao.list(),
        AreaManutencao.list(),
        StatusOS.list(),
        pendingDataPromise,
      ]);

      setEquipamentos(Array.isArray(equipData) ? equipData : []);
      setTipos(Array.isArray(tiposData) ? tiposData : []);
      setAreas(Array.isArray(areasData) ? areasData : []);
      setStatusList(Array.isArray(statusData) ? statusData : []);
      setPendingSolicitations(Array.isArray(pendingData) ? pendingData : []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setEquipamentos([]);
      setTipos([]);
      setAreas([]);
      setStatusList([]);
      setPendingSolicitations([]);
      setPageError(error?.message || "Não foi possível carregar as ordens de serviço.");
    } finally {
      setReferenceLoading(false);
    }
  };

  const approveSolicitation = async (solicitation) => {
    setReviewLoading(true);
    setPageError("");
    try {
      await appApi.admin.workOrders.decideSolicitation(solicitation.id, "approve");
      await Promise.all([loadData(), loadOrderPage()]);
      setActiveTab("ordens");
    } catch (error) {
      setPageError(error?.message || "Não foi possível aprovar a solicitação.");
    } finally {
      setReviewLoading(false);
    }
  };

  const openRejectDialog = (solicitation) => {
    setReviewTarget(solicitation);
    setReviewReason("");
  };

  const rejectSolicitation = async (event) => {
    event.preventDefault();
    if (!reviewTarget || !reviewReason.trim()) return;
    setReviewLoading(true);
    setPageError("");
    try {
      await appApi.admin.workOrders.decideSolicitation(
        reviewTarget.id,
        "reject",
        reviewReason.trim(),
      );
      setReviewTarget(null);
      setReviewReason("");
      await loadData();
    } catch (error) {
      setPageError(error?.message || "Não foi possível recusar a solicitação.");
    } finally {
      setReviewLoading(false);
    }
  };

  const getOsEquipamentos = (os) => Array.isArray(os?.equipamentos) ? os.equipamentos : [];

  const clientSortedAndFilteredOS = useMemo(() => {
    const osList = Array.isArray(legacyOrders) ? legacyOrders : [];
    let filtered = osList.filter(os => {
      const osEquipamentos = getOsEquipamentos(os);
      const matchesSearch =
        os.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        osEquipamentos.some(eq => eq.equipamento_nome?.toLowerCase().includes(searchTerm.toLowerCase())) || // Search multiple equipments
        os.equipamento_nome?.toLowerCase().includes(searchTerm.toLowerCase()) || // Search primary equipment (for legacy or single primary)
        os.solicitante?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilters =
        (!filters.equipamento_id || osEquipamentos.some(eq => eq.equipamento_id === filters.equipamento_id) || os.equipamento_id === filters.equipamento_id) && // Filter multiple equipments or primary
        (!filters.status_id || os.status_id === filters.status_id);

      // Filtro por período
      let matchesDateRange = true;
      if (filters.data_inicio || filters.data_fim) {
        const osDate = os.data_programada ? new Date(os.data_programada) : new Date(os.created_date);
        
        if (filters.data_inicio) {
          const startDate = new Date(filters.data_inicio);
          matchesDateRange = matchesDateRange && osDate >= startDate;
        }
        
        if (filters.data_fim) {
          const endDate = new Date(filters.data_fim);
          endDate.setHours(23, 59, 59, 999); // Incluir o dia completo
          matchesDateRange = matchesDateRange && osDate <= endDate;
        }
      }

      return matchesSearch && matchesFilters && matchesDateRange;
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        // Handle null/undefined values for sorting
        const valA = a[sortConfig.key] || '';
        const valB = b[sortConfig.key] || '';

        if (valA < valB) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
    }, [legacyOrders, searchTerm, filters, sortConfig]);

  const sortedAndFilteredOS = useMemo(
    () => (Array.isArray(ordensServico) ? ordensServico : []),
    [ordensServico],
  );
  const loading = listLoading || referenceLoading;
  const totalPages = Math.max(1, Math.ceil(listMeta.count / pageSize));
  const firstVisiblePage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const visiblePages = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => firstVisiblePage + index,
  );

    const servicosTerceirizados = useMemo(() => {
    let allServices = [];
    const osList = clientSortedAndFilteredOS;

    osList.forEach(os => {
      const terceirizados = Array.isArray(os.terceirizados) ? os.terceirizados : [];
      if (terceirizados.length > 0) {
        terceirizados.forEach(terc => {
          allServices.push({
            ...terc,
            os_numero: os.numero,
            os_id: os.id,
            equipamento_nome: os.equipamento_nome,
            status_nome: os.status_nome,
            data_programada: os.data_programada
          });
        });
      }
    });

    // Filtrar por pesquisa
    if (searchTerm) {
      allServices = allServices.filter(serv => 
        serv.prestadora_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        serv.os_numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        serv.equipamento_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        serv.descricao_servico?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrar por período
    if (filters.data_inicio || filters.data_fim) {
      allServices = allServices.filter(serv => {
        const servDate = serv.data_servico ? new Date(serv.data_servico) : new Date(serv.data_programada);
        let matches = true;

        if (filters.data_inicio) {
          const startDate = new Date(filters.data_inicio);
          matches = matches && servDate >= startDate;
        }

        if (filters.data_fim) {
          const endDate = new Date(filters.data_fim);
          endDate.setHours(23, 59, 59, 999);
          matches = matches && servDate <= endDate;
        }

        return matches;
      });
    }

    return allServices.sort((a, b) => new Date(b.data_servico || 0) - new Date(a.data_servico || 0));
    }, [legacyOrders, searchTerm, filters]);

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      equipamento_id: "",
      status_id: "",
      data_inicio: "",
      data_fim: "",
      location: "",
      maintenance_type: "",
      priority: "",
      responsible: "",
      situation: "",
    });
    setSearchTerm("");
    setPage(1);
  };

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(filterValue => filterValue && filterValue !== null);
  }, [filters]);

  // Função para determinar a cor do badge de status
  const getStatusBadgeColor = (statusNome) => {
    if (!statusNome) return "border border-slate-500/40 bg-slate-500/10 text-slate-300";
    
    const status = statusNome.toLowerCase();
    
    if (status.includes('concluída') || status.includes('concluida') || status.includes('finalizada')) {
      return "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    }
    
    if (status.includes('aguardando') && status.includes('peças')) {
      return "border border-orange-500/40 bg-orange-500/10 text-orange-300";
    }
    
    if (status.includes('aberta') || status.includes('pendente') || status.includes('em andamento')) {
      return "border border-blue-500/40 bg-blue-500/10 text-blue-300";
    }
    
    return "border border-slate-500/40 bg-slate-500/10 text-slate-300";
  };

  const handlePrintOS = async (osId) => {
    try {
      const osData = await OrdemServico.get(osId);

      const printWindow = window.open('', '_blank');
      const content = generatePrintContentForOS(osData);

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Ordem de Serviço - ${osData?.numero}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; font-size: 12px; }
            .header-table { width: 100%; border-collapse: collapse; border: 2px solid #333; margin-bottom: 0; }
            .header-table td { border: 1px solid #333; padding: 6px; vertical-align: middle; }
            .logo-cell { width: 120px; text-align: center; background: #f8f9fa; }
            .title-cell { text-align: center; font-size: 16px; font-weight: bold; background: #f8f9fa; padding: 6px; }
            .os-info-cell { width: 120px; background: #f8f9fa; }
            .os-number { font-size: 14px; font-weight: bold; color: #d63384; margin-bottom: 3px; }
            .section-table { width: 100%; border-collapse: collapse; border: 2px solid #333; margin-bottom: 0; }
            .section-header { background: #e9ecef; font-weight: bold; text-align: center; padding: 8px; border: 1px solid #333; }
            .section-table td, .section-table th { border: 1px solid #333; padding: 6px; vertical-align: top; }
            .field-label { font-weight: bold; background: #f8f9fa; }
            .services-table { width: 100%; border-collapse: collapse; border: 2px solid #333; }
            .services-table th { background: #e9ecef; font-weight: bold; text-align: center; padding: 8px; border: 1px solid #333; font-size: 11px; }
            .services-table td { border: 1px solid #333; padding: 6px; text-align: center; font-size: 11px; min-height: 20px; }
            .description-cell { text-align: left !important; background: #f8f9fa; min-height: 60px; }
            .total-row { font-weight: bold; background: #e9ecef; }
            .empty-row { height: 25px; }
            .dynamic-height { min-height: 40px; max-height: none; }
            .footer { position: fixed; bottom: 20px; width: 100%; text-align: center; font-size: 10px; border-top: 1px solid #333; padding-top: 10px; }
            @media print { body { margin: 0; padding: 15px; } .footer { position: fixed; bottom: 0; } }
          </style>
        </head>
        <body>
          ${content}
          <div class="footer">
            ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' })}, às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            &nbsp;&nbsp;&nbsp;&nbsp;Página 1 de 1
          </div>
        </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error("Erro ao imprimir OS:", error);
      alert("Erro ao carregar dados para impressão");
    }
  };

  const generatePrintContentForOS = (formData) => {
    if (!formData) return '<p>Carregando...</p>';

    const totais = {
      valorTotalServicos: (formData.servicos || []).reduce((sum, s) => sum + (s.valor_total || 0), 0),
      valorTotalMateriais: (formData.materiais || []).reduce((sum, m) => sum + (m.custo_total || 0), 0),
      valorTotalOutros: (formData.outros || []).reduce((sum, o) => sum + (o.custo_total || 0), 0)
    };
    totais.valorTotalGeral = totais.valorTotalServicos + totais.valorTotalMateriais + totais.valorTotalOutros;

    const getDynamicHeight = (content) => {
      if (!content) return '40px';
      const lines = Math.ceil(content.length / 80);
      return `${Math.max(40, lines * 20)}px`;
    };

    const servicosWithPadding = [...(formData.servicos || [])];
    while (servicosWithPadding.length < 5) {
      servicosWithPadding.push({ empty: true });
    }

    const materiaisWithPadding = [...(formData.materiais || [])];
    while (materiaisWithPadding.length < 5) {
      materiaisWithPadding.push({ empty: true });
    }

    const equipamentosList = formData.equipamentos && formData.equipamentos.length > 0
      ? formData.equipamentos
      : (formData.equipamento_id ? [{
          equipamento_id: formData.equipamento_id,
          equipamento_nome: formData.equipamento_nome,
          local: formData.local,
          marca: '' // Marca not directly available if only equip_id/name at root
        }] : []);

    return `
      <table class="header-table">
        <tr>
          <td class="logo-cell">
            <div style="font-size: 20px; font-weight: bold; color: #ff6b35;">🔧 MaintenancePro</div>
          </td>
          <td class="title-cell">ORDEM DE SERVIÇO</td>
          <td class="os-info-cell">
            <div class="os-number">Nº OS:<br/>${formData.numero}</div>
            <div><strong>Status OS:</strong><br/>${formData.status_nome}</div>
            <div><strong>Data final</strong><br/>${formatarData(formData.data_programada)}</div>
          </td>
        </tr>
      </table>
      <table class="section-table">
        <tr><td colspan="5" class="section-header">DESCRIÇÃO DA SOLICITAÇÃO</td></tr>
        <tr>
          <td class="field-label">Nome do solicitante</td>
          <td class="field-label">Tipo de manutenção:</td>
          <td class="field-label">Prioridade</td>
          <td class="field-label">Área de manutenção:</td>
          <td class="field-label">Data e hora prog.</td>
        </tr>
        <tr>
          <td>${formData.solicitante || '-'}</td>
          <td>${formData.tipo_nome || '-'}</td>
          <td>-</td>
          <td>${formData.area_nome || '-'}</td>
          <td>${formData.data_programada ? `${formatarData(formData.data_programada)} ${formData.hora_programada || ''}` : '-'}</td>
        </tr>
      </table>
      <table class="section-table">
        <tr><td colspan="5" class="section-header">DESCRIÇÃO DO EQUIPAMENTO</td></tr>
        <tr>
          <td class="field-label">Equipamento(s):</td>
          <td colspan="3" class="field-label">Localização(ões):</td>
          <td class="field-label">Marca(s):</td>
        </tr>
        <tr>
          <td>
            ${equipamentosList.length > 0 ?
              equipamentosList.map(eq => eq.equipamento_nome).join('<br/>') :
              '-'}
          </td>
          <td colspan="3">
            ${equipamentosList.length > 0 ?
              equipamentosList.map(eq => eq.local || '-').join('<br/>') :
              '-'}
          </td>
          <td>
            ${equipamentosList.length > 0 ?
              equipamentosList.map(eq => eq.marca || '-').join('<br/>') :
              '-'}
          </td>
        </tr>
      </table>
      <table class="section-table">
        <tr><td class="section-header">DESCRIÇÃO DA MANUTENÇÃO</td></tr>
        <tr><td class="field-label">Descrição do defeito</td></tr>
        <tr><td class="dynamic-height" style="height: ${getDynamicHeight(formData.descricao_defeito)}">${formData.descricao_defeito || ''}</td></tr>
        <tr><td class="field-label">Observações</td></tr>
        <tr><td class="dynamic-height" style="height: ${getDynamicHeight(formData.observacoes)}">${formData.observacoes || ''}</td></tr>
      </table>
    `;
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImportStatus({ type: 'info', message: 'Fazendo upload do arquivo...' });

    try {
      const { file_url } = await UploadFile({ file });
      setImportStatus({ type: 'info', message: 'Extraindo dados do arquivo... Isso pode levar um momento.' });

      const json_schema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            equipamento_codigo: { type: 'string' }, // Assuming single primary equipment for import
            tipo_nome: { type: 'string' },
            status_nome: { type: 'string' },
            area_nome: { type: 'string' },
            solicitante: { type: 'string' },
            data_programada: { type: 'string' },
            hora_programada: { type: 'string' },
            descricao_defeito: { type: 'string' },
          },
          required: ['equipamento_codigo', 'tipo_nome', 'status_nome']
        }
      };

      const extractionResult = await ExtractDataFromUploadedFile({ file_url, json_schema });

      if (extractionResult.status !== 'success' || !extractionResult.output) {
        throw new Error(extractionResult.details || "Falha ao extrair dados.");
      }

      setImportStatus({ type: 'info', message: 'Processando e salvando registros...' });

      const dataToCreate = [];
      const allOS = await OrdemServico.list('-created_date');
      const allOSList = Array.isArray(allOS) ? allOS : [];
      let latestOSNumber = allOSList.length > 0
        ? Math.max(...allOSList.map(os => parseInt(String(os.numero || '').split('-')[1] || 0, 10)).filter(n => !isNaN(n)))
        : 0;

      for (const item of extractionResult.output) {
        const equipamento = equipamentos.find(e => e.codigo === item.equipamento_codigo);
        const tipo = tipos.find(t => t.descricao === item.tipo_nome);
        const status = statusList.find(s => s.descricao === item.status_nome);
        const area = areas.find(a => a.descricao === item.area_nome);

        if (!equipamento || !tipo || !status) {
          console.warn("Registro ignorado por falta de dados:", item);
          continue;
        }
        latestOSNumber++;

        dataToCreate.push({
          numero: `OS-${String(latestOSNumber).padStart(3, '0')}`,
          equipamento_id: equipamento.id, // Keeping for backward compatibility or primary
          equipamento_nome: equipamento.descricao, // Keeping for backward compatibility or primary
          local: equipamento.localizacao, // Keeping for backward compatibility or primary
          equipamentos: [{ // Populating the new array structure
            equipamento_id: equipamento.id,
            equipamento_nome: equipamento.descricao,
            codigo: equipamento.codigo,
            local: equipamento.localizacao,
            marca: equipamento.marca || '' // Assuming marca exists in Equipamento entity
          }],
          tipo_id: tipo.id,
          tipo_nome: tipo.descricao,
          status_id: status.id,
          status_nome: status.descricao,
          area_id: area?.id || null,
          area_nome: area?.descricao || null,
          solicitante: item.solicitante,
          data_programada: item.data_programada,
          hora_programada: item.hora_programada,
          descricao_defeito: item.descricao_defeito,
          servicos: [],
          materiais: [],
          outros: []
        });
      }

      if (dataToCreate.length > 0) {
        await OrdemServico.bulkCreate(dataToCreate);
      }

      setImportStatus({ type: 'success', message: `${dataToCreate.length} de ${extractionResult.output.length} registros importados com sucesso!` });
      await Promise.all([loadData(), loadOrderPage()]);

    } catch (error) {
      setImportStatus({ type: 'error', message: `Erro na importação: ${error.message}` });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExport = () => {
    const headers = ["Número", "Equipamento", "Tipo", "Status", "Solicitante", "Data Programada"];
    const rows = sortedAndFilteredOS.map(os => [
      `"${os.numero || ''}"`,
      `"${getOsEquipamentos(os).length > 0 ? getOsEquipamentos(os).map(eq => eq.equipamento_nome).join('; ') : os.equipamento_nome || ''}"`, // Export all equipments
      `"${os.tipo_nome || ''}"`,
      `"${os.status_nome || ''}"`,
      `"${os.solicitante || ''}"`,
      `"${os.data_programada ? formatarData(os.data_programada) : ''}"` // Using formatarData
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ordens_de_servico.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintList = () => {
    window.print();
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir esta Ordem de Serviço? A ação não pode ser desfeita.")) {
      try {
        await OrdemServico.delete(id);
        if (sortedAndFilteredOS.length === 1 && page > 1) {
          setPage((current) => current - 1);
        } else {
          await loadOrderPage();
        }
      } catch (error) {
        console.error("Erro ao excluir OS:", error);
        alert("Não foi possível excluir a Ordem de Serviço.");
      }
    }
  };

  const handleViewOS = async (os) => {
    setSelectedOSForView(os);

    try {
      setSelectedOSForView(await OrdemServico.get(os.id));
    } catch (error) {
      console.error("Erro ao carregar os detalhes da OS:", error);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden p-3 printable-area sm:p-4 lg:h-screen lg:p-6 print:h-auto print:overflow-visible">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <div className="no-print sticky top-0 z-20 shrink-0 space-y-3 bg-background pb-3">
          <h1 className="text-lg font-semibold leading-none text-foreground">Ordens de Serviço</h1>

          {pageError && (
            <Alert variant="destructive">
              <AlertDescription>{pageError}</AlertDescription>
            </Alert>
          )}

        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-md bg-muted p-1 sm:w-fit">
          <TabsTrigger value="ordens">
            Ordens de Serviço ({listMeta.count})
          </TabsTrigger>
          {currentUser?.role === "admin" && (
            <TabsTrigger value="solicitacoes" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Solicitacoes ({pendingSolicitations.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="terceirizados">
            Serviços Terceirizados ({servicosTerceirizados.length})
          </TabsTrigger>
        </TabsList>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input type="file" ref={fileInputRef} onChange={handleImport} accept=".csv" className="hidden" />

          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Pesquisar por OS, equipamento, local, solicitante ou responsável"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="h-9 pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="relative gap-2">
                  <Filter className="w-4 h-4" />
                  Filtros
                  {hasActiveFilters && (
                    <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-blue-600 text-white text-xs">
                      {Object.values(filters).filter(Boolean).length}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Filtrar Ordens de Serviço</DialogTitle>
                  <DialogDescription>
                    Selecione os filtros desejados para refinar a listagem
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="equipamento_filter">Equipamento</Label>
                      <ComboboxSelect
                        value={filters.equipamento_id}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, equipamento_id: value }))}
                        placeholder="Todos os equipamentos"
                        emptyMessage="Nenhum equipamento encontrado"
                        searchPlaceholder="Pesquisar equipamento..."
                        items={equipamentos}
                        getItemValue={(item) => item.id}
                        getItemLabel={(item) => `${item.codigo} - ${item.descricao}`}
                        getItemSearchText={(item) => `${item.codigo} ${item.descricao}`.toLowerCase()}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="status_filter">Status</Label>
                      <Select
                        value={filters.status_id}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, status_id: value }))}
                      >
                        <SelectTrigger id="status_filter" className="mt-1">
                          <SelectValue placeholder="Todos os status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>Todos os status</SelectItem>
                          {statusList.map(status => (
                            <SelectItem key={status.id} value={status.id}>
                              {status.descricao}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="data_inicio_filter">Data Inicial</Label>
                      <Input
                        id="data_inicio_filter"
                        type="date"
                        value={filters.data_inicio}
                        onChange={(e) => setFilters(prev => ({ ...prev, data_inicio: e.target.value }))}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="data_fim_filter">Data Final</Label>
                      <Input
                        id="data_fim_filter"
                        type="date"
                        value={filters.data_fim}
                        onChange={(e) => setFilters(prev => ({ ...prev, data_fim: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={clearFilters}>
                    Limpar Filtros
                  </Button>
                  <DialogClose asChild>
                    <Button>Aplicar Filtros</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <MoreHorizontal className="w-4 h-4" />
                  Mais ações
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={() => setShowSequentialModal(true)}>
                  <Eye className="w-4 h-4" />
                  Visualizador OS
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={openBlankOrdemServicoPrint}>
                  <Printer className="w-4 h-4" />
                  Imprimir OS em branco
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4" />
                  Importar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExport}>
                  <Download className="w-4 h-4" />
                  Exportar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setIsHelpDialogOpen(true)}>
                  <HelpCircle className="w-4 h-4" />
                  Ajuda
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link to={createPageUrl("NovaOS")} className="ml-auto sm:ml-0">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                <Plus className="w-4 h-4" />
                Nova OS
              </Button>
            </Link>
          </div>
        </div>

          {activeTab === "ordens" && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {QUICK_FILTERS.map(([value, label]) => (
                <Button
                  key={value || "all"}
                  type="button"
                  size="sm"
                  variant={filters.situation === value ? "secondary" : "ghost"}
                  className="shrink-0"
                  onClick={() => {
                    setFilters((current) => ({ ...current, situation: value }));
                    setPage(1);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}

          {importStatus.message && (
            <Alert variant={importStatus.type === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{importStatus.message}</AlertDescription>
            </Alert>
          )}
        </div>

        <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajuda para Importação de OS</DialogTitle>
              <DialogDescription>
                Para importar Ordens de Serviço, crie um arquivo CSV com as seguintes colunas:
              </DialogDescription>
            </DialogHeader>
            <div className="text-sm">
              <p className="font-bold">Colunas Obrigatórias:</p>
              <ul className="list-disc list-inside">
                <li>`equipamento_codigo`: O código exato do equipamento já cadastrado.</li>
                <li>`tipo_nome`: A descrição exata do Tipo de Manutenção.</li>
                <li>`status_nome`: A descrição exata do Status da OS.</li>
              </ul>
              <p className="font-bold mt-4">Colunas Opcionais:</p>
              <ul className="list-disc list-inside">
                <li>`area_nome`: A descrição da Área de Manutenção.</li>
                <li>`solicitante`: Nome do solicitante.</li>
                <li>`data_programada`: Formato AAAA-MM-DD.</li>
                <li>`hora_programada`: Formato HH:MM.</li>
                <li>`descricao_defeito`: Texto descrevendo o problema.</li>
              </ul>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button>Fechar</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(reviewTarget)} onOpenChange={(open) => !open && setReviewTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Recusar solicitacao</DialogTitle>
              <DialogDescription>
                Informe o motivo que ficara registrado para a solicitacao de {reviewTarget?.solicitante || "usuario"}.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={rejectSolicitation} className="space-y-4">
              <div>
                <Label htmlFor="rejection-reason">Motivo da recusa *</Label>
                <Textarea
                  id="rejection-reason"
                  value={reviewReason}
                  onChange={(event) => setReviewReason(event.target.value)}
                  placeholder="Descreva por que a solicitacao foi recusada"
                  required
                  minLength={3}
                  className="mt-1"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setReviewTarget(null)} disabled={reviewLoading}>
                  Cancelar
                </Button>
                <Button type="submit" variant="destructive" disabled={reviewLoading || reviewReason.trim().length < 3}>
                  {reviewLoading ? "Salvando..." : "Confirmar recusa"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {currentUser?.role === "admin" && (
          <TabsContent value="solicitacoes" className="mt-0 min-h-0 flex-1 overflow-auto data-[state=active]:flex data-[state=active]:flex-col">
            <Card className="border-0 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ClipboardCheck className="h-5 w-5 text-orange-500" />
                  Solicitacoes aguardando aprovacao
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Aprove uma solicitacao para coloca-la na lista de OS. Em caso de recusa, informe o motivo para manter o historico da decisao.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingSolicitations.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
                    Nao ha solicitacoes pendentes.
                  </div>
                ) : (
                  pendingSolicitations.map((solicitation) => (
                    <article key={solicitation.id} className="rounded-lg border border-orange-200 bg-orange-50/50 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <p className="text-xs text-slate-500">Solicitante</p>
                            <p className="font-medium text-slate-900">{solicitation.solicitante || "Nao informado"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Equipamento</p>
                            <p className="font-medium text-slate-900">{solicitation.equipamento_nome || "Nao informado"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Tipo / area</p>
                            <p className="font-medium text-slate-900">{solicitation.tipo_nome || "-"} {solicitation.area_nome ? `- ${solicitation.area_nome}` : ""}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Parada completa</p>
                            <Badge variant="outline" className={solicitation.maquina_parada ? "border-red-300 text-red-700" : "border-emerald-300 text-emerald-700"}>
                              {solicitation.maquina_parada ? "Sim" : "Nao"}
                            </Badge>
                          </div>
                          <div className="sm:col-span-2 lg:col-span-4">
                            <p className="text-xs text-slate-500">Defeito relatado</p>
                            <p className="whitespace-pre-wrap text-sm text-slate-800">{solicitation.descricao_defeito || "Nao informado"}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2 lg:flex-col">
                          <Button type="button" size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => approveSolicitation(solicitation)} disabled={reviewLoading}>
                            <CheckCircle className="h-4 w-4" />
                            Aprovar
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => openRejectDialog(solicitation)} disabled={reviewLoading}>
                            <XCircle className="h-4 w-4" />
                            Recusar
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="ordens" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
          {/* Lista de OS */}
          <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-md">
        <CardHeader className="shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg">Lista de Ordens de Serviço ({listMeta.count})</CardTitle>
              {hasActiveFilters && (
                <p className="text-sm text-slate-500 mt-1">
                  Filtros ativos: {[
                    filters.equipamento_id && `Equipamento: ${equipamentos.find(eq => eq.id === filters.equipamento_id)?.descricao}`,
                    filters.status_id && `Status: ${statusList.find(s => s.id === filters.status_id)?.descricao}`,
                    filters.data_inicio && `Data Inicial: ${formatarData(filters.data_inicio)}`,
                    filters.data_fim && `Data Final: ${formatarData(filters.data_fim)}`
                  ].filter(Boolean).join(' • ')}
                  <Button variant="link" size="sm" onClick={clearFilters} className="h-auto p-0 ml-2 text-blue-600 hover:text-blue-700">
                    Limpar
                  </Button>
                </p>
              )}
              {Object.entries(filters).some(([, value]) => value) && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(filters)
                    .filter(([, value]) => value)
                    .map(([key, value]) => {
                      const labels = {
                        equipamento_id: equipamentos.find((item) => item.id === value)?.descricao || "Equipamento",
                        status_id: statusList.find((item) => item.id === value)?.descricao || "Status",
                        data_inicio: `Desde ${formatarData(value)}`,
                        data_fim: `Até ${formatarData(value)}`,
                        location: "Local",
                        maintenance_type: tipos.find((item) => item.id === value)?.descricao || "Tipo",
                        priority: "Prioridade",
                        responsible: "Responsável",
                        situation: QUICK_FILTERS.find(([filter]) => filter === value)?.[1] || "Situação",
                      };
                      return (
                        <Button
                          key={key}
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-7 gap-1 text-xs"
                          onClick={() => {
                            setFilters((current) => ({ ...current, [key]: "" }));
                            setPage(1);
                          }}
                        >
                          {labels[key]}
                          <X className="h-3 w-3" />
                        </Button>
                      );
                    })}
                </div>
              )}
            </div>
            {/* Search input was moved to the controls div above */}
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse flex items-center space-x-4">
                  <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/6"></div>
                </div>
              ))}
            </div>
          ) : (
            <>
            <Table containerClassName="min-h-0 flex-1 px-3 sm:px-6">
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
                <TableRow>
                  <SortableHeader column="numero" sortConfig={sortConfig} onSort={handleSort}>Nº OS</SortableHeader>
                  <TableHead>Equipamento</TableHead>
                  <SortableHeader className="hidden lg:table-cell" column="prioridade" sortConfig={sortConfig} onSort={handleSort}>Prioridade</SortableHeader>
                  <SortableHeader className="hidden xl:table-cell" column="tipo_nome" sortConfig={sortConfig} onSort={handleSort}>Tipo</SortableHeader>
                  <SortableHeader column="status_nome" sortConfig={sortConfig} onSort={handleSort}>Status</SortableHeader>
                  <SortableHeader column="prazo" sortConfig={sortConfig} onSort={handleSort}>Prazo</SortableHeader>
                  <TableHead className="hidden md:table-cell">Responsável</TableHead>
                  <TableHead className="hidden xl:table-cell">Em aberto</TableHead>
                  <SortableHeader className="hidden 2xl:table-cell" column="data_programada" sortConfig={sortConfig} onSort={handleSort}>Programada</SortableHeader>
                  <SortableHeader className="hidden lg:table-cell" column="solicitante" sortConfig={sortConfig} onSort={handleSort}>Solicitante / local</SortableHeader>
                  <TableHead className="w-32 no-print">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAndFilteredOS.map(os => (
                  <TableRow
                    key={os.id}
                    className="cursor-pointer"
                    onClick={(event) => {
                      if (!event.target.closest("button,a")) handleViewOS(os);
                    }}
                  >
                    <TableCell className="font-mono font-semibold">{os.numero}</TableCell>
                    <TableCell>
                      {getOsEquipamentos(os).length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {getOsEquipamentos(os).slice(0, 2).map((eq, idx) => (
                            <Badge key={idx} variant="outline" className="w-fit">
                              {eq.equipamento_nome}
                            </Badge>
                          ))}
                          {getOsEquipamentos(os).length > 2 && (
                            <Badge variant="secondary" className="w-fit text-xs">
                              +{getOsEquipamentos(os).length - 2} mais
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground md:hidden">
                            {os.responsavel_nome || "Sem responsável"}
                          </span>
                          <span className="text-xs text-muted-foreground lg:hidden">
                            {os.prioridade_nome || "Sem prioridade"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">{os.equipamento_nome || "-"}</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm font-medium">{os.prioridade_nome || "-"}</span>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">{os.tipo_nome}</TableCell>
                    <TableCell>
                      <Badge className={`${getStatusBadgeColor(os.status_nome)}`}>
                        {os.status_nome}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className="block text-sm">{formatDateTime(os.data_prazo, os.hora_prazo)}</span>
                        {getDeadlineState(os) && (
                          <Badge variant="outline" className={getDeadlineState(os).className}>
                            {getDeadlineState(os).label}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{os.responsavel_nome || "Não atribuído"}</TableCell>
                    <TableCell className="hidden text-sm xl:table-cell">{formatOpenTime(os.created_at, os.status_category)}</TableCell>
                    <TableCell className="hidden text-sm 2xl:table-cell">{formatDateTime(os.data_programada, os.hora_programada)}</TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">
                      <span className="block">{os.solicitante || "-"}</span>
                      <span className="block text-xs text-muted-foreground">{os.local || "-"}</span>
                    </TableCell>
                    <TableCell className="no-print">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleViewOS(os)} title="Visualizar">
                          <Eye className="w-3 h-3" />
                        </Button>
                        <Link to={createPageUrl(`EditarOS?id=${os.id}`)}>
                          <Button size="sm" variant="outline" title="Editar">
                            <Edit className="w-3 h-3" />
                          </Button>
                        </Link>
                        {/* Removed Print Button as per instruction */}
                        <Button size="sm" variant="outline" onClick={() => handleDelete(os.id)} className="text-red-600 hover:text-red-700" title="Excluir">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {sortedAndFilteredOS.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-slate-500">
                      {searchTerm || hasActiveFilters ? "Nenhuma ordem de serviço encontrada" : "Nenhuma ordem de serviço cadastrada"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="flex shrink-0 flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <span className="text-xs text-muted-foreground">
                {listMeta.count === 0
                  ? "Nenhuma ordem"
                  : `Exibindo ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, listMeta.count)} de ${listMeta.count} ordens`}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-24" aria-label="Registros por página">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[25, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>{size} / pág.</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  title="Página anterior"
                  aria-label="Página anterior"
                  disabled={!listMeta.previous}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="hidden items-center gap-1 sm:flex">
                  {visiblePages.map((pageNumber) => (
                    <Button
                      key={pageNumber}
                      type="button"
                      size="icon"
                      variant={pageNumber === page ? "default" : "outline"}
                      className="h-8 w-8"
                      aria-label={`Ir para a página ${pageNumber}`}
                      aria-current={pageNumber === page ? "page" : undefined}
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  title="Próxima página"
                  aria-label="Próxima página"
                  disabled={!listMeta.next}
                  onClick={() => setPage((current) => current + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="terceirizados" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
      <Card className="flex h-full min-h-0 flex-col overflow-hidden shadow-sm border-0 bg-white">
      <CardHeader className="shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg">Lista de Serviços Terceirizados ({servicosTerceirizados.length})</CardTitle>
            {hasActiveFilters && (
              <p className="text-sm text-slate-500 mt-1">
                Filtros ativos aplicados
                <Button variant="link" size="sm" onClick={clearFilters} className="h-auto p-0 ml-2 text-blue-600 hover:text-blue-700">
                  Limpar
                </Button>
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0 [&>div]:box-border [&>div]:h-full [&>div]:px-6 [&>div]:pb-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse flex items-center space-x-4">
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
              <TableRow>
                <TableHead>OS</TableHead>
                <TableHead>Equipamento</TableHead>
                <TableHead>Prestadora</TableHead>
                <TableHead>Descrição do Serviço</TableHead>
                <TableHead>Data Serviço</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status OS</TableHead>
                <TableHead className="w-32 no-print">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
              {servicosTerceirizados.map((servico, index) => (
                <TableRow key={`${servico.os_id}-${index}`}>
                  <TableCell className="font-mono font-semibold text-blue-600">
                    #{servico.os_numero}
                  </TableCell>
                  <TableCell className="text-sm">{servico.equipamento_nome || "-"}</TableCell>
                  <TableCell className="font-medium">{servico.prestadora_nome || "-"}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate" title={servico.descricao_servico}>
                    {servico.descricao_servico || "-"}
                  </TableCell>
                  <TableCell>{formatarData(servico.data_servico)}</TableCell>
                  <TableCell className="text-right font-semibold text-green-700">
                    {(servico.valor_servico || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${getStatusBadgeColor(servico.status_nome)}`}>
                      {servico.status_nome}
                    </Badge>
                  </TableCell>
                  <TableCell className="no-print">
                    <div className="flex gap-2">
                      <Link to={createPageUrl(`NovaOSTerceirizado?id=${servico.os_id}`)}>
                        <Button size="sm" variant="outline" title="Editar">
                          <Edit className="w-3 h-3" />
                        </Button>
                      </Link>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(servico.os_id)} className="text-red-600 hover:text-red-700" title="Excluir">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                  </TableRow>
              ))}
              {servicosTerceirizados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    {searchTerm || hasActiveFilters ? "Nenhum serviço terceirizado encontrado" : "Nenhum serviço terceirizado cadastrado"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
      </Card>
      </TabsContent>
      </Tabs>

      {/* Modal de Visualização */}
      <VisualizacaoOSModal
        isOpen={!!selectedOSForView}
        onClose={() => setSelectedOSForView(null)}
        os={selectedOSForView}
      />

      {/* Modal de Visualização Sequencial */}
      <VisualizacaoSequencialModal
        isOpen={showSequentialModal}
        onClose={() => setShowSequentialModal(false)}
        ordensServico={sortedAndFilteredOS}
        currentIndex={0}
      />
    </div>
  );
}
