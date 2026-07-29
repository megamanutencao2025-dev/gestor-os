import React, { useState, useEffect } from "react";
import { appApi } from "@/api/appClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Save, X, ArrowLeft, Trash2, Printer, Plus, FileText, Settings, Calendar, Clock, Edit, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react";
import MaterialSelector from "../components/MaterialSelector";
import EquipamentoSelector from "../components/EquipamentoSelector";
import MantenedorMultipleSelector from "../components/MantenedorMultipleSelector";
import ImageUploader from "../components/attachments/ImageUploader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ServicoModal from "../components/modals/ServicoModal";
import TerceirizadoModal from "../components/modals/TerceirizadoModal";
import OutroModal from "../components/modals/OutroModal";
import EquipamentoCard from "../components/ordens/EquipamentoCard";
import QuickCreateFields from "@/components/quick-create/QuickCreateFields";
import ModuleLabel from "@/components/ModuleLabel";
import { sortByText, upsertCreatedOption, validateQuickCreateFields } from "@/utils/quickCreate";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const mantenedorQuickCreateFields = [
  { name: "nome", label: "Nome", required: true, placeholder: "Nome do mantenedor" },
  { name: "cargo", label: "Cargo", required: true, placeholder: "Cargo/função" },
  { name: "custo_hora", label: "Custo por hora", type: "number", required: true, min: "0", step: "0.01", placeholder: "0,00" },
];

const materialQuickCreateFields = [
  { name: "codigo", label: "Código do produto", required: true, placeholder: "Código do produto" },
  { name: "codigo_compra", label: "Código de compra", placeholder: "Código de compra" },
  { name: "nome", label: "Nome do produto", required: true, placeholder: "Nome do produto" },
  {
    name: "unidade_medida",
    label: "Unidade de medida",
    type: "select",
    required: true,
    placeholder: "Selecione a unidade",
    options: [
      { value: "Kg", label: "Kg" },
      { value: "Unidade", label: "Unidade" },
      { value: "Litro", label: "Litro" },
      { value: "Metro", label: "Metro" },
      { value: "Metro Quadrado", label: "Metro Quadrado" },
      { value: "Metro Cúbico", label: "Metro Cúbico" },
      { value: "Hora", label: "Hora" },
    ],
  },
  { name: "custo", label: "Custo", type: "number", required: true, min: "0", step: "0.01", placeholder: "0,00" },
];

export default function EditarOS() {
  const navigate = useNavigate();
  const location = useLocation();
  const [osId, setOsId] = useState(null);

  // Estados dos dados de referência
  const [allEquipamentos, setAllEquipamentos] = useState([]); // Renamed from equipamentosRef
  const [tipos, setTipos] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [areas, setAreas] = useState([]);
  const [mantenedores, setMantenedores] = useState([]); // Full list of mantenedores
  const [materiais, setMateriais] = useState([]);
  const [prestadoras, setPrestadoras] = useState([]);
  const [prioridades, setPrioridades] = useState([]);
  const [centrosCusto, setCentrosCusto] = useState([]);
  const [localizacoes, setLocalizacoes] = useState([]);

  // Estado do formulário
  const [formData, setFormData] = useState({
    numero: '',
    equipamentos: [], // Array de equipamentos
    equipamento_id: '', // For backward compatibility/primary display
    equipamento_nome: '', // For backward compatibility/primary display
    equipamento_codigo: '', // For backward compatibility/primary display
    local: '',
    localizacao_celula: '', // NEW
    localizacao_setor: '', // NEW
    tipo_id: '',
    tipo_nome: '',
    status_id: '',
    status_nome: '',
    area_id: '',
    area_nome: '',
    prioridade_id: '',
    prioridade_nome: '',
    solicitante: '',
    data_programada: '',
    hora_programada: '',
    data_finalizada: '',
    hora_finalizada: '',
    maquina_parada: null,
    tempo_parada_manual: '', // NEW: Added for manual downtime input
    observacoes: '',
    descricao_defeito: '',
    servicos: [],
    materiais: [],
    terceirizados: [],
    outros: []
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); // Changed initial state to false
  const [showMaterialSelector, setShowMaterialSelector] = useState(false);
  const [showEquipamentoSelector, setShowEquipamentoSelector] = useState(false);
  
  // Navigation states
  const [allOSIds, setAllOSIds] = useState([]);
  const [currentOSIndex, setCurrentOSIndex] = useState(-1); // Ensured useState is used here
  
  // Modals states
  const [showServicoModal, setShowServicoModal] = useState(false);
  const [editingServico, setEditingServico] = useState(null);
  const [editingServicoIndex, setEditingServicoIndex] = useState(null);
  
  const [showTerceirizadoModal, setShowTerceirizadoModal] = useState(false);
  const [editingTerceirizado, setEditingTerceirizado] = useState(null);
  const [editingTerceirizadoIndex, setEditingTerceirizadoIndex] = useState(null);
  
  const [showOutroModal, setShowOutroModal] = useState(false);
  const [editingOutro, setEditingOutro] = useState(null);
  const [editingOutroIndex, setEditingOutroIndex] = useState(null);

  // This state is now used by ServicoModal to open MantenedorMultipleSelector
  const [showMantenedorSelector, setShowMantenedorSelector] = useState(false); 
  // State to pass to MantenedorMultipleSelector from ServicoModal
  const [mantenedoresForSelector, setMantenedoresForSelector] = useState([]);

  // Helper function to get level label
  const getLevelLabel = (level) => {
    switch (level) {
      case 1: return "Empresa";
      case 2: return "Unidade";
      case 3: return "Equipamento";
      case 4: return "Conjunto";
      case 5: return "Componente";
      default: return `Nível ${level}`;
    }
  };

  const equipamentoQuickCreateFields = React.useMemo(() => [
    { name: "codigo", label: "Código", required: true, placeholder: "Código do equipamento" },
    { name: "descricao", label: "Descrição", required: true, placeholder: "Descrição do equipamento" },
    {
      name: "localizacao_id",
      label: "Localização",
      type: "select",
      required: true,
      placeholder: "Selecione uma localização",
      options: (localizacoes || []).map(loc => ({
        value: loc.id,
        label: loc.setor ? `${loc.descricao} - ${loc.setor}` : loc.descricao,
      })),
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      placeholder: "Selecione o status",
      options: [
        { value: "Ativo", label: "Ativo" },
        { value: "Inativo", label: "Inativo" },
      ],
    },
  ], [localizacoes]);

  const updateCreatedList = (setter, created, getText) => {
    setter(prev => sortByText(upsertCreatedOption(prev, created), getText));
  };

  const handleCreateEquipamento = async (data) => {
    validateQuickCreateFields(data, equipamentoQuickCreateFields);
    const localizacao = (localizacoes || []).find(loc => loc.id === data.localizacao_id);
    const created = await appApi.entities.Equipamento.create({
      ...data,
      status: data.status || "Ativo",
      parent_id: null,
      localizacao_celula: localizacao?.descricao || "",
      localizacao_setor: localizacao?.setor || "",
      imagens: [],
    });
    updateCreatedList(setAllEquipamentos, created, (item) => item.descricao || "");
    return created;
  };

  const handleCreateMantenedor = async (data) => {
    validateQuickCreateFields(data, mantenedorQuickCreateFields);
    const created = await appApi.entities.Mantenedor.create({
      ...data,
      custo_hora: parseFloat(String(data.custo_hora || 0).replace(",", ".")) || 0,
    });
    updateCreatedList(setMantenedores, created, (item) => item.nome || "");
    return created;
  };

  const handleCreateMaterial = async (data) => {
    validateQuickCreateFields(data, materialQuickCreateFields);
    const created = await appApi.entities.Material.create({
      ...data,
      custo: parseFloat(String(data.custo || 0).replace(",", ".")) || 0,
    });
    updateCreatedList(setMateriais, created, (item) => item.nome || "");
    return created;
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const id = searchParams.get('id');
    if (id) {
      setOsId(id);
      loadAllOSIds(id);
      loadData(id);
    } else {
      setError("ID da Ordem de Serviço não encontrado.");
      setLoading(false);
      setSaving(false);
    }
  }, [location.search]);

  const loadAllOSIds = async (currentId) => {
    try {
      const allOS = await appApi.entities.OrdemServico.list('-numero');
      const ids = allOS.map(os => os.id);
      setAllOSIds(ids);
      const currentIndex = ids.indexOf(currentId);
      setCurrentOSIndex(currentIndex);
    } catch (error) {
      console.error("Erro ao carregar lista de OSs:", error);
    }
  };

  const navigateToOS = (direction) => {
    if (allOSIds.length === 0) return;
    
    let newIndex = currentOSIndex;
    if (direction === 'next') {
      newIndex = (currentOSIndex + 1) % allOSIds.length;
    } else if (direction === 'prev') {
      newIndex = (currentOSIndex - 1 + allOSIds.length) % allOSIds.length;
    }
    
    const newOSId = allOSIds[newIndex];
    navigate(createPageUrl("EditarOS") + `?id=${newOSId}`);
  };

  const loadData = async (id) => {
    try {
      const [osData, equipData, tiposData, statusData, areasData, mantData, matData, prestData, centrosCustoData, localizacoesData, priorData] = await Promise.all([
        appApi.entities.OrdemServico.get(id),
        appApi.entities.Equipamento.list(),
        appApi.entities.TipoManutencao.list(),
        appApi.entities.StatusOS.list(),
        appApi.entities.AreaManutencao.list(),
        appApi.entities.Mantenedor.list(),
        appApi.entities.Material.list(),
        appApi.entities.PrestadoraServico.list(),
        appApi.entities.CentroCusto.list(),
        appApi.entities.Localizacao.list(),
        appApi.entities.Prioridade.list()
      ]);

      // Order all reference data
      const equipamentosOrdenados = (equipData || []).sort((a, b) => (a?.descricao || '').localeCompare(b?.descricao || ''));
      const tiposOrdenados = (tiposData || []).sort((a, b) => (a?.descricao || '').localeCompare(b?.descricao || ''));
      const statusOrdenados = (statusData || []).sort((a, b) => (a?.descricao || '').localeCompare(b?.descricao || ''));
      const areasOrdenadas = (areasData || []).sort((a, b) => (a?.descricao || '').localeCompare(b?.descricao || ''));
      const mantenedoresOrdenados = (mantData || []).sort((a, b) => (a?.nome || '').localeCompare(b?.nome || ''));
      const materiaisOrdenados = (matData || []).sort((a, b) => (a?.nome || '').localeCompare(b?.nome || ''));
      const prestadorasOrdenadas = (prestData || []).sort((a, b) => (a?.nome_empresa || '').localeCompare(b?.nome_empresa || ''));
      const centrosCustoOrdenados = (centrosCustoData || []).sort((a, b) => (a?.descricao || '').localeCompare(b?.descricao || ''));
      const localizacoesOrdenadas = (localizacoesData || []).sort((a, b) => (a?.descricao || '').localeCompare(b?.descricao || ''));
      const prioridadesOrdenadas = (priorData || []).sort((a, b) => (a?.ordem || 999) - (b?.ordem || 999) || (a?.descricao || '').localeCompare(b?.descricao || ''));

      // Normalize equipment data for the new 'equipamentos' array
      let equipamentosArray = [];
      let primaryCelula = '';
      let primarySetor = '';

      if (osData.equipamentos && Array.isArray(osData.equipamentos) && osData.equipamentos.length > 0) {
        equipamentosArray = osData.equipamentos.map(eq => {
          const fullEquip = equipamentosOrdenados.find(e => String(e.id) === String(eq.equipamento_id));
          return {
            equipamento_id: String(eq.equipamento_id),
            equipamento_nome: eq.equipamento_nome || fullEquip?.descricao || '',
            equipamento_codigo: eq.equipamento_codigo || fullEquip?.codigo || '',
            localizacao: eq.localizacao || fullEquip?.localizacao || '',
            nivel: eq.nivel || fullEquip?.nivel || 3,
            hierarquia: eq.hierarquia || fullEquip?.hierarquia || [],
            hierarquia_texto: eq.hierarquia_texto || fullEquip?.hierarquia_texto || '',
            localizacao_celula: eq.localizacao_celula || fullEquip?.localizacao_celula || '',
            localizacao_setor: eq.localizacao_setor || fullEquip?.localizacao_setor || '',
          };
        });
        if (equipamentosArray[0]) {
          primaryCelula = equipamentosArray[0].localizacao_celula;
          primarySetor = equipamentosArray[0].localizacao_setor;
        }
      } else if (osData.equipamento_id) {
        // Migrate old format (single equipment) to new array format
        const primaryEquip = equipamentosOrdenados.find(e => String(e.id) === String(osData.equipamento_id));
        if (primaryEquip) {
          equipamentosArray.push({
            equipamento_id: String(primaryEquip.id),
            equipamento_nome: primaryEquip.descricao,
            equipamento_codigo: primaryEquip.codigo || '',
            localizacao: primaryEquip.localizacao || '',
            nivel: primaryEquip.nivel || 3,
            hierarquia: primaryEquip.hierarquia || [],
            hierarquia_texto: primaryEquip.hierarquia_texto || primaryEquip.descricao,
            localizacao_celula: primaryEquip.localizacao_celula || '',
            localizacao_setor: primaryEquip.localizacao_setor || '',
          });
          primaryCelula = primaryEquip.localizacao_celula;
          primarySetor = primaryEquip.localizacao_setor;
        }
      }

      // Normalize material data
      const materiaisNormalizados = (osData.materiais || []).map(material => ({
        id: material.id || Date.now() + Math.random(),
        material_id: String(material.material_id || material.id),
        codigo: material.codigo || '',
        codigo_compra: material.codigo_compra || '',
        nome: material.nome || '',
        unidade: material.unidade || material.unidade_medida || '',
        custo_unitario: parseFloat(material.custo_unitario || material.custo || 0),
        quantidade: parseFloat(String(material.quantidade || 0).replace(',', '.')) || 0,
        custo_total: parseFloat(material.custo_total || 0) || 0,
        anexos: material.anexos || []
      }));

      const materiaisComCustoAtualizado = materiaisNormalizados.map(material => ({
        ...material,
        custo_total: material.quantidade * material.custo_unitario
      }));

      // Normalize servicos - CORRIGIDO para preservar horas diretas
      const servicosNormalizadosLoad = (osData.servicos || []).map(servico => {
        let mantenedoresForService = [];
        if (servico.mantenedores && Array.isArray(servico.mantenedores)) {
          mantenedoresForService = servico.mantenedores.map(m => ({
            id: String(m.id || m.mantenedor_id),
            nome: m.nome || m.mantenedor_nome,
            custo_hora: parseFloat(m.custo_hora || 0)
          }));
        } else if (servico.mantenedor_id) {
          const mantenedorFound = mantenedoresOrdenados.find(m => String(m.id) === String(servico.mantenedor_id));
          if (mantenedorFound) {
            mantenedoresForService.push({
              id: String(mantenedorFound.id),
              nome: mantenedorFound.nome,
              custo_hora: parseFloat(mantenedorFound.custo_hora || 0)
            });
          }
        }

        const custoTotalPorHora = mantenedoresForService.reduce((sum, mant) => sum + (parseFloat(mant.custo_hora) || 0), 0);

        // CORREÇÃO: Verificar se já tem total_horas salvo (modo horas diretas)
        let totalHoras = 0;
        let valorTotal = 0;

        if (servico.total_horas && servico.total_horas > 0) {
          // Serviço foi salvo com horas diretas - usar o valor já calculado
          totalHoras = parseFloat(servico.total_horas);
          valorTotal = parseFloat(servico.valor_total) || (totalHoras * custoTotalPorHora);
        } else if (servico.data_inicio && servico.hora_inicio && servico.hora_fim) {
          // Serviço foi salvo com horários - calcular baseado nas datas
          const dataFimForCalc = servico.data_fim || servico.data_inicio;
          const inicio = new Date(`${servico.data_inicio}T${servico.hora_inicio}`);
          const fim = new Date(`${dataFimForCalc}T${servico.hora_fim}`);
          
          if (!isNaN(inicio.getTime()) && !isNaN(fim.getTime()) && fim > inicio) {
            totalHoras = (fim - inicio) / (1000 * 60 * 60);
            valorTotal = totalHoras * custoTotalPorHora;
          }
        }

        return {
          id: servico.id || Date.now() + Math.random(),
          mantenedores: mantenedoresForService,
          data_inicio: servico.data_inicio || '',
          hora_inicio: servico.hora_inicio || '',
          data_fim: servico.data_fim || servico.data_inicio || '', // Ensure data_fim is also loaded
          hora_fim: servico.hora_fim || '',
          defeito_identificado: servico.defeito_identificado || '',
          atividade: servico.atividade || '',
          total_horas: totalHoras,
          valor_total: valorTotal,
          anexos: servico.anexos || [],
          horas_por_mantenedor: servico.horas_por_mantenedor || {}
        };
      });

      // Normalize terceirizados for initial load
      const terceirizadosNormalizadosLoad = (osData.terceirizados || []).map(terceirizado => ({
        id: terceirizado.id || Date.now() + Math.random(),
        prestadora_id: String(terceirizado.prestadora_id || ''),
        prestadora_nome: terceirizado.prestadora_nome || '',
        centro_custo_id: String(terceirizado.centro_custo_id || ''),
        centro_custo_nome: terceirizado.centro_custo_nome || '',
        data_servico: terceirizado.data_servico || '',
        descricao_servico: terceirizado.descricao_servico || '',
        valor_servico: parseFloat(terceirizado.valor_servico) || 0,
        anexos: terceirizado.anexos || [],
        documentos: terceirizado.documentos || []
      }));

      // Ensure arrays always exist and add new fields
      const normalizedOSData = {
        ...osData,
        data_programada: osData.data_programada ? osData.data_programada.substring(0, 10) : '',
        data_finalizada: osData.data_finalizada ? osData.data_finalizada.substring(0, 10) : '',
        hora_programada: osData.hora_programada || '',
        hora_finalizada: osData.hora_finalizada || '',
        maquina_parada:
          osData.maquina_parada === true || osData.maquina_parada === 1
            ? true
            : osData.maquina_parada === false || osData.maquina_parada === 0
              ? false
              : null,
        tempo_parada_manual: osData.tempo_parada_manual || '',
        prioridade_id: String(osData.prioridade_id || ''),
        prioridade_nome: osData.prioridade_nome || '',
        servicos: servicosNormalizadosLoad,
        materiais: materiaisComCustoAtualizado,
        terceirizados: terceirizadosNormalizadosLoad,
        outros: Array.isArray(osData.outros) ? osData.outros : [],
        equipamentos: equipamentosArray,
        equipamento_id: equipamentosArray[0]?.equipamento_id || '',
        equipamento_nome: equipamentosArray[0]?.equipamento_nome || '',
        equipamento_codigo: equipamentosArray[0]?.equipamento_codigo || '',
        local: osData.local || equipamentosArray[0]?.localizacao || '',
        localizacao_celula: primaryCelula,
        localizacao_setor: primarySetor,
      };

      setFormData(normalizedOSData);
      setAllEquipamentos(equipamentosOrdenados);
      setTipos(tiposOrdenados);
      setStatusList(statusOrdenados);
      setAreas(areasOrdenadas);
      setMantenedores(mantenedoresOrdenados);
      setMateriais(materiaisOrdenados);
      setPrestadoras(prestadorasOrdenadas);
      setCentrosCusto(centrosCustoOrdenados);
      setLocalizacoes(localizacoesOrdenadas);
      setPrioridades(prioridadesOrdenadas);
    } catch (error) {
      setError("Erro ao carregar dados da Ordem de Serviço");
      console.error("Erro no carregamento:", error);
    } finally {
      setLoading(false);
      setSaving(false);
    }
  };

  const handleSelectEquipamentos = (equipamentosSelecionados) => {
    const equipamentosArray = Array.isArray(equipamentosSelecionados)
      ? equipamentosSelecionados
      : [equipamentosSelecionados];

    const equipamentosFormatados = equipamentosArray.map(eqSelecionado => {
      // Buscar dados completos do equipamento na lista
      const equipamentoCompleto = allEquipamentos.find(
        eq => String(eq.id) === String(eqSelecionado.equipamento_id || eqSelecionado.id)
      );

      if (!equipamentoCompleto) {
        console.warn("Equipamento não encontrado na lista completa:", eqSelecionado);
        return {
          equipamento_id: String(eqSelecionado.equipamento_id || eqSelecionado.id),
          equipamento_nome: eqSelecionado.equipamento_nome || eqSelecionado.descricao || '',
          equipamento_codigo: eqSelecionado.equipamento_codigo || eqSelecionado.codigo || '',
          localizacao: eqSelecionado.localizacao || '',
          nivel: eqSelecionado.nivel || 3,
          hierarquia: eqSelecionado.hierarquia || [],
          hierarquia_texto: eqSelecionado.hierarquia_texto || '',
          localizacao_celula: eqSelecionado.localizacao_celula || '',
          localizacao_setor: eqSelecionado.localizacao_setor || ''
        };
      }

      // Buscar o equipamento principal (raiz) da hierarquia para pegar célula e setor
      let equipamentoPrincipal = equipamentoCompleto;
      
      if (equipamentoCompleto.hierarquia && equipamentoCompleto.hierarquia.length > 0) {
        // O primeiro item da hierarquia é o equipamento principal
        const primeiroId = equipamentoCompleto.hierarquia[0].id;
        const principal = allEquipamentos.find(eq => String(eq.id) === String(primeiroId));
        if (principal) {
          equipamentoPrincipal = principal;
        }
      } else if (equipamentoCompleto.parent_id) {
        // Se não tem hierarquia mas tem parent_id, buscar recursivamente até a raiz
        let atual = equipamentoCompleto;
        while (atual.parent_id) {
          const pai = allEquipamentos.find(eq => String(eq.id) === String(atual.parent_id));
          if (pai) {
            atual = pai;
          } else {
            break;
          }
        }
        equipamentoPrincipal = atual;
      }

      return {
        equipamento_id: String(equipamentoCompleto.id),
        equipamento_nome: equipamentoCompleto.descricao || '',
        equipamento_codigo: equipamentoCompleto.codigo || '',
        localizacao: equipamentoCompleto.localizacao || equipamentoPrincipal.localizacao || '',
        nivel: eqSelecionado.nivel || equipamentoCompleto.nivel || 3,
        hierarquia: eqSelecionado.hierarquia || equipamentoCompleto.hierarquia || [],
        hierarquia_texto: eqSelecionado.hierarquia_texto || equipamentoCompleto.hierarquia_texto || equipamentoCompleto.descricao,
        localizacao_celula: equipamentoPrincipal.localizacao_celula || '',
        localizacao_setor: equipamentoPrincipal.localizacao_setor || ''
      };
    });

    // Pegar célula e setor do primeiro equipamento (principal)
    const firstSelected = equipamentosFormatados[0];
    const newPrimaryCelula = firstSelected?.localizacao_celula || '';
    const newPrimarySetor = firstSelected?.localizacao_setor || '';

    setFormData(prev => ({
      ...prev,
      equipamentos: equipamentosFormatados,
      equipamento_id: firstSelected?.equipamento_id || '',
      equipamento_nome: firstSelected?.equipamento_nome || '',
      equipamento_codigo: firstSelected?.equipamento_codigo || '',
      localizacao_celula: newPrimaryCelula,
      localizacao_setor: newPrimarySetor,
      local: firstSelected?.localizacao || prev.local
    }));
    
    setShowEquipamentoSelector(false);
  };

  const removeEquipamento = (index) => {
    const novosEquipamentos = formData.equipamentos.filter((_, i) => i !== index);
    
    // Se ainda houver equipamentos, atualizar com o novo primeiro
    const newPrimaryCelula = novosEquipamentos[0]?.localizacao_celula || '';
    const newPrimarySetor = novosEquipamentos[0]?.localizacao_setor || '';
    
    setFormData(prev => ({
      ...prev,
      equipamentos: novosEquipamentos,
      equipamento_id: novosEquipamentos[0]?.equipamento_id || '',
      equipamento_nome: novosEquipamentos[0]?.equipamento_nome || '',
      equipamento_codigo: novosEquipamentos[0]?.equipamento_codigo || '',
      localizacao_celula: newPrimaryCelula,
      localizacao_setor: newPrimarySetor,
    }));
  };

  const handleTipoChange = (tipoId) => {
    const tipo = (tipos || []).find(t => t.id === tipoId);
    setFormData(prev => ({ ...prev, tipo_id: tipoId, tipo_nome: tipo?.descricao || '' }));
  };

  const handleStatusChange = (statusId) => {
    const status = (statusList || []).find(s => s.id === statusId);
    setFormData(prev => ({ ...prev, status_id: statusId, status_nome: status?.descricao || '' }));
  };

  const handleAreaChange = (areaId) => {
    const area = (areas || []).find(a => a.id === areaId);
    setFormData(prev => ({ ...prev, area_id: areaId, area_nome: area?.descricao || '' }));
  };

  const handlePrioridadeChange = (prioridadeId) => {
    const prioridade = (prioridades || []).find(p => p.id === prioridadeId);
    setFormData(prev => ({
      ...prev,
      prioridade_id: prioridadeId,
      prioridade_nome: prioridade?.descricao || ""
    }));
  };

  // Funções para Serviços com Modal
  const addServico = () => {
    const novoServico = {
      id: Date.now(),
      mantenedores: [],
      data_inicio: '',
      hora_inicio: '',
      data_fim: '', // Added data_fim for consistency
      hora_fim: '',
      defeito_identificado: '',
      atividade: '',
      total_horas: 0,
      valor_total: 0,
      anexos: [],
      horas_por_mantenedor: {} // Initialize for new service
    };
    setEditingServico(novoServico);
    setEditingServicoIndex(null); // Indicates it's a new service
    setShowServicoModal(true);
  };

  const editServico = (servico, index) => {
    setEditingServico({ ...servico });
    setEditingServicoIndex(index); // Indicates it's an existing service at this index
    setShowServicoModal(true);
  };

  const saveServico = (servicoData) => {
    if (editingServicoIndex !== null) {
      // Editing existing service
      const newServicos = [...(formData.servicos || [])];
      newServicos[editingServicoIndex] = servicoData;
      setFormData(prev => ({ ...prev, servicos: newServicos }));
    } else {
      // Adding new service
      setFormData(prev => ({
        ...prev,
        servicos: [...(prev.servicos || []), servicoData]
      }));
    }
    setShowServicoModal(false);
    setEditingServico(null);
    setEditingServicoIndex(null);
  };

  const removeServico = (index) => {
    if (window.confirm("Deseja realmente remover este serviço?")) {
      setFormData(prev => ({
        ...prev,
        servicos: (prev.servicos || []).filter((_, i) => i !== index)
      }));
    }
  };

  const handleMantenedorSelectorForModal = (mantenedoresAtuais) => {
    setMantenedoresForSelector(mantenedoresAtuais); // Set the current mantenedores for the selector
    setShowMantenedorSelector(true);
  };

  const handleMantenedorSelectorConfirmForModal = (mantenedoresSelecionados) => {
    // Update the mantenedores in the currently editing service within the ServicoModal
    if (editingServico) {
      const custoTotalPorHora = mantenedoresSelecionados.reduce((sum, mant) => sum + (parseFloat(mant.custo_hora) || 0), 0);
      const updatedServico = {
        ...editingServico,
        mantenedores: mantenedoresSelecionados,
        // Recalculate valor_total if total_horas is already set
        valor_total: (editingServico.total_horas || 0) * custoTotalPorHora
      };
      setEditingServico(updatedServico); // Update the state in the parent
    }
    setShowMantenedorSelector(false);
  };

  // Funções para gerenciar materiais
  const updateMaterial = (index, field, value) => {
    const newMateriais = [...(formData.materiais || [])];
    const currentMaterial = { ...newMateriais[index] };

    if (field === 'quantidade') {
      const numericValue = String(value).replace(',', '.');
      currentMaterial[field] = numericValue;
    } else {
      currentMaterial[field] = value;
    }

    if (field === 'quantidade' || field === 'custo_unitario') {
      const quantidade = parseFloat(String(currentMaterial.quantidade || 0).replace(',', '.')) || 0;
      const custoUnitario = parseFloat(currentMaterial.custo_unitario || 0) || 0;
      currentMaterial.custo_total = quantidade * custoUnitario;
    }

    newMateriais[index] = currentMaterial;
    setFormData(prev => ({ ...prev, materiais: newMateriais }));
  };

  const removeMaterial = (index) => {
    setFormData(prev => ({
      ...prev,
      materiais: (prev.materiais || []).filter((_, i) => i !== index)
    }));
  };

  // Attachment handlers for Materiais
  const addImagesToMaterial = (materialIndex, list) => {
    const mats = [...(formData.materiais || [])];
    if (mats[materialIndex]) {
      mats[materialIndex] = { ...mats[materialIndex], anexos: list };
      setFormData(prev => ({ ...prev, materiais: mats }));
    }
  };

  // Nova função para adicionar materiais em lote via modal
  const handleAddMaterialsFromSelector = (selectedRawMaterials) => {
    try {
      if (!Array.isArray(selectedRawMaterials)) {
        console.error("selectedRawMaterials deve ser um array");
        setError("Erro: Dados de materiais inválidos recebidos.");
        return;
      }

      const newMaterialsForForm = selectedRawMaterials.map(mat => {
        if (!mat?.material_id && !mat?.id) {
          console.warn("Material sem ID encontrado e ignorado:", mat);
          return null;
        }

        return {
          id: Date.now() + Math.random(),
          material_id: String(mat.material_id || mat.id),
          codigo: mat.codigo || '',
          codigo_compra: mat.codigo_compra || '',
          nome: mat.nome || '',
          unidade: mat.unidade || '',
          custo_unitario: parseFloat(mat.custo_unitario) || 0,
          quantidade: parseFloat(String(mat.quantidade || 1).replace(',', '.')) || 1,
          custo_total: (parseFloat(mat.custo_unitario) || 0) * (parseFloat(String(mat.quantidade || 1).replace(',', '.')) || 1),
          anexos: []
        };
      }).filter(Boolean);

      const uniqueMaterials = newMaterialsForForm.filter(newMat =>
        !(formData.materiais || []).some(existingMat => existingMat.material_id === newMat.material_id)
      );

      if (uniqueMaterials.length > 0) {
        setFormData(prev => ({
          ...prev,
          materiais: [...(prev.materiais || []), ...uniqueMaterials]
        }));
      }
      setShowMaterialSelector(false);
    } catch (error) {
      console.error("Erro ao adicionar materiais:", error);
      setError("Erro ao adicionar materiais selecionados");
    }
  };

  // Funções para Terceirizados com Modal
  const addTerceirizado = () => {
    const novoTerceirizado = {
      id: Date.now(),
      prestadora_id: '',
      prestadora_nome: '',
      data_servico: '',
      descricao_servico: '',
      valor_servico: 0,
      anexos: [],
      documentos: []
    };
    setEditingTerceirizado(novoTerceirizado);
    setEditingTerceirizadoIndex(null);
    setShowTerceirizadoModal(true);
  };

  const editTerceirizado = (terceirizado, index) => {
    setEditingTerceirizado({ ...terceirizado });
    setEditingTerceirizadoIndex(index);
    setShowTerceirizadoModal(true);
  };

  const saveTerceirizado = (terceirizadoData) => {
    // When saving, find the prestadora name if ID is present
    const prestadora = prestadoras.find(p => p.id === terceirizadoData.prestadora_id);
    const updatedTerceirizadoData = {
      ...terceirizadoData,
      prestadora_nome: prestadora ? prestadora.nome_empresa : (terceirizadoData.prestadora_nome || '')
    };

    if (editingTerceirizadoIndex !== null) {
      const newTerceirizados = [...(formData.terceirizados || [])];
      newTerceirizados[editingTerceirizadoIndex] = updatedTerceirizadoData;
      setFormData(prev => ({ ...prev, terceirizados: newTerceirizados }));
    } else {
      setFormData(prev => ({
        ...prev,
        terceirizados: [...(prev.terceirizados || []), updatedTerceirizadoData]
      }));
    }
    setShowTerceirizadoModal(false);
    setEditingTerceirizado(null);
    setEditingTerceirizadoIndex(null);
  };

  const removeTerceirizado = (index) => {
    if (window.confirm("Deseja realmente remover este terceirizado?")) {
      setFormData(prev => ({
        ...prev,
        terceirizados: (prev.terceirizados || []).filter((_, i) => i !== index)
      }));
    }
  };

  // Funções para Outros com Modal
  const addOutro = () => {
    const novoOutro = {
      id: Date.now(),
      descricao: '',
      unidade: '',
      custo_unitario: 0,
      quantidade: 1,
      custo_total: 0
    };
    setEditingOutro(novoOutro);
    setEditingOutroIndex(null);
    setShowOutroModal(true);
  };

  const editOutro = (outro, index) => {
    setEditingOutro({ ...outro });
    setEditingOutroIndex(index);
    setShowOutroModal(true);
  };

  const saveOutro = (outroData) => {
    if (editingOutroIndex !== null) {
      const newOutros = [...(formData.outros || [])];
      newOutros[editingOutroIndex] = outroData;
      setFormData(prev => ({ ...prev, outros: newOutros }));
    } else {
      setFormData(prev => ({
        ...prev,
        outros: [...(prev.outros || []), outroData]
      }));
    }
    setShowOutroModal(false);
    setEditingOutro(null);
    setEditingOutroIndex(null);
  };

  const removeOutro = (index) => {
    if (window.confirm("Deseja realmente remover este item?")) {
      setFormData(prev => ({
        ...prev,
        outros: (prev.outros || []).filter((_, i) => i !== index)
      }));
    }
  };

  // Calcular totais
  const calcularTotais = () => {
    const valorTotalServicos = (formData.servicos || []).reduce((sum, s) => sum + (s.valor_total || 0), 0);
    const valorTotalMateriais = (formData.materiais || []).reduce((sum, m) => sum + (parseFloat(m.custo_total) || 0), 0);
    const valorTotalOutros = (formData.outros || []).reduce((sum, o) => sum + (parseFloat(o.custo_total) || 0), 0);
    const valorTotalTerceirizados = (formData.terceirizados || []).reduce((sum, t) => sum + (parseFloat(t.valor_servico) || 0), 0);
    const valorTotalGeral = valorTotalServicos + valorTotalMateriais + valorTotalOutros + valorTotalTerceirizados;

    return {
      valorTotalServicos,
      valorTotalMateriais,
      valorTotalOutros,
      valorTotalTerceirizados,
      valorTotalGeral
    };
  };

  // Calcular tempo parado (em minutos)
  const calcularTempoParado = () => {
    // Se máquina não ficou parada E tem tempo manual informado, usar o tempo manual
    if (formData.maquina_parada === false && formData.tempo_parada_manual) {
      return parseInt(formData.tempo_parada_manual) || 0;
    }

    // Se máquina ficou parada, calcular o tempo baseado nas datas
    if (formData.maquina_parada === true) {
      if (!formData.data_programada || !formData.hora_programada || !formData.data_finalizada || !formData.hora_finalizada) {
        return 0;
      }

      try {
        const inicio = new Date(`${formData.data_programada}T${formData.hora_programada}`);
        const fim = new Date(`${formData.data_finalizada}T${formData.hora_finalizada}`);

        if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
          return 0;
        }

        const diffMs = fim.getTime() - inicio.getTime();
        if (diffMs < 0) {
          return 0;
        }

        const diffMinutes = diffMs / (1000 * 60);
        return Math.round(diffMinutes);
      } catch (e) {
        console.error("Erro ao calcular tempo parado:", e);
        return 0;
      }
    }

    return 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.equipamentos || formData.equipamentos.length === 0) {
      setError("Selecione pelo menos um equipamento.");
      return;
    }
    if (!formData.tipo_id) {
      setError("Tipo de manutenção é obrigatório.");
      return;
    }
    if (!formData.status_id) {
      setError("Status é obrigatório.");
      return;
    }
    if (formData.maquina_parada === null) {
      setError("Informe se a máquina realmente parou com o defeito.");
      return;
    }

    setSaving(true);

    try {
      const totais = calcularTotais();
      const tempoParadoMinutos = calcularTempoParado();

      const materiaisNormalizados = (formData.materiais || []).map(material => ({
        material_id: String(material.material_id || material.id || ''), // Robust handling of material_id
        codigo: material.codigo || '',
        codigo_compra: material.codigo_compra || '',
        nome: material.nome || '',
        unidade: material.unidade || material.unidade_medida || '', // Robust handling of unit
        custo_unitario: parseFloat(material.custo_unitario || material.custo || 0) || 0, // Robust handling of cost
        quantidade: parseFloat(String(material.quantidade || 0).replace(',', '.')) || 0,
        custo_total: parseFloat(material.custo_total || 0) || (parseFloat(material.custo_unitario || 0) * (parseFloat(String(material.quantidade || 0).replace(',', '.')) || 0)), // Robust handling of total cost
        anexos: (material.anexos || []).map(a => ({
          url: a.url, nome: a.nome || "", tipo: a.tipo || "", tamanho: a.tamanho || 0
        }))
      }));

      // CORREÇÃO: Preserve o modo de apontamento ao normalizar serviços
      const servicosNormalizados = (formData.servicos || []).map(servico => {
        const servicoNormalizado = {
          mantenedores: (servico.mantenedores || []).map(m => ({
            mantenedor_id: String(m.id || m.mantenedor_id || ""), // Robust ID handling
            mantenedor_nome: m.nome || m.mantenedor_nome || "", // Robust name handling
            custo_hora: parseFloat(m.custo_hora || 0)
          })),
          defeito_identificado: servico.defeito_identificado || '',
          atividade: servico.atividade || '',
          total_horas: parseFloat(servico.total_horas) || 0,
          valor_total: parseFloat(servico.valor_total) || 0,
          anexos: (servico.anexos || []).map(a => ({
            url: a.url, nome: a.nome || "", tipo: a.tipo || "", tamanho: a.tamanho || 0
          })),
          horas_por_mantenedor: servico.horas_por_mantenedor || {}
        };

        // Se tem datas/horários preenchidos, incluir (modo horários)
        if (servico.data_inicio && servico.hora_inicio && servico.hora_fim) {
          servicoNormalizado.data_inicio = servico.data_inicio;
          servicoNormalizado.hora_inicio = servico.hora_inicio;
          servicoNormalizado.data_fim = servico.data_fim || servico.data_inicio; // Preserve data_fim if present, else fallback to data_inicio
          servicoNormalizado.hora_fim = servico.hora_fim;
        }

        return servicoNormalizado;
      });

      const terceirizadosNormalizados = (formData.terceirizados || []).map(terceirizado => ({
        prestadora_id: String(terceirizado.prestadora_id || ''),
        prestadora_nome: terceirizado.prestadora_nome || '',
        data_servico: terceirizado.data_servico || '',
        descricao_servico: terceirizado.descricao_servico || '',
        valor_servico: parseFloat(terceirizado.valor_servico) || 0,
        anexos: (terceirizado.anexos || []).map(a => ({
          url: a.url, nome: a.nome || "", tipo: a.tipo || "", tamanho: a.tamanho || 0
        })),
        documentos: (terceirizado.documentos || []).map(d => ({
          url: d.url, nome: d.nome || "", tipo: d.tipo || "", tamanho: d.tamanho || 0
        }))
      }));

      const outrosNormalizados = (formData.outros || []).map(outro => ({
        descricao: outro.descricao || '',
        unidade: outro.unidade || '',
        custo_unitario: parseFloat(outro.custo_unitario) || 0,
        quantidade: parseInt(outro.quantidade) || 0,
        custo_total: parseFloat(outro.custo_total) || 0
      }));

      // Montar o campo 'local' concatenando célula e setor
      let localFormatado = '';
      if (formData.localizacao_celula && formData.localizacao_setor) {
        localFormatado = `${formData.localizacao_celula} - ${formData.localizacao_setor}`;
      } else if (formData.localizacao_celula) {
        localFormatado = formData.localizacao_celula;
      } else if (formData.localizacao_setor) {
        localFormatado = formData.localizacao_setor;
      } else if (formData.equipamentos && formData.equipamentos.length > 0 && formData.equipamentos[0]?.localizacao) {
        localFormatado = formData.equipamentos[0].localizacao;
      }

      const osData = {
        numero: formData.numero,
        equipamento_id: String(formData.equipamentos[0]?.equipamento_id || ''),
        equipamento_nome: formData.equipamentos[0]?.equipamento_nome || '',
        equipamento_codigo: formData.equipamentos[0]?.equipamento_codigo || '',
        equipamentos: formData.equipamentos.map(eq => ({
          equipamento_id: String(eq.equipamento_id),
          equipamento_nome: eq.equipamento_nome,
          equipamento_codigo: eq.equipamento_codigo || '',
          localizacao: eq.localizacao || '',
          nivel: eq.nivel || 3,
          hierarquia: (eq.hierarquia || []).map(h => ({
            id: String(h.id),
            codigo: h.codigo || '',
            descricao: h.descricao || ''
          })),
          hierarquia_texto: eq.hierarquia_texto || '',
          localizacao_celula: eq.localizacao_celula || '',
          localizacao_setor: eq.localizacao_setor || ''
        })),
        local: localFormatado, // CORREÇÃO: incluir o campo local formatado
        localizacao_celula: formData.localizacao_celula || '',
        localizacao_setor: formData.localizacao_setor || '',
        tipo_id: String(formData.tipo_id),
        tipo_nome: formData.tipo_nome,
        status_id: String(formData.status_id),
        status_nome: formData.status_nome,
        area_id: String(formData.area_id || ''),
        area_nome: formData.area_nome || '',
        prioridade_id: String(formData.prioridade_id || ''),
        prioridade_nome: formData.prioridade_nome || '',
        solicitante: formData.solicitante || '',
        data_programada: formData.data_programada || '',
        hora_programada: formData.hora_programada || '',
        data_finalizada: formData.data_finalizada || '',
        hora_finalizada: formData.hora_finalizada || '',
        maquina_parada: formData.maquina_parada === true,
        tempo_parada_manual: formData.tempo_parada_manual ? parseInt(formData.tempo_parada_manual) : null,
        observacoes: formData.observacoes || '',
        descricao_defeito: formData.descricao_defeito || '',
        servicos: servicosNormalizados,
        materiais: materiaisNormalizados,
        terceirizados: terceirizadosNormalizados,
        outros: outrosNormalizados,
        valor_total_servicos: totais.valorTotalServicos,
        valor_total_materiais: totais.valorTotalMateriais,
        valor_total_outros: totais.valorTotalOutros,
        valor_total_terceirizados: totais.valorTotalTerceirizados,
        valor_total_geral: totais.valorTotalGeral,
        tempo_parado_em_minutos: tempoParadoMinutos
      };

      await appApi.entities.OrdemServico.update(osId, osData);
      setError("Ordem de serviço atualizada com sucesso!");
      await loadData(osId); // Reload data after successful update
    } catch (error) {
      setError("Erro ao atualizar ordem de serviço");
      console.error("Erro ao salvar:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Tem certeza que deseja excluir esta Ordem de Serviço? A ação não pode ser desfeita.")) {
      setSaving(true);
      try {
        await appApi.entities.OrdemServico.delete(osId);
        navigate(createPageUrl("OrdemServico"));
      } catch (error) {
        setError("Erro ao excluir Ordem de Serviço.");
        setSaving(false);
      }
    }
  };

  const handleCloseOS = () => {
    navigate(createPageUrl("OrdemServico"));
  };

  const maquinaParadaValue = formData.maquina_parada === true ? "sim" : formData.maquina_parada === false ? "nao" : "";

  const generateHierarchyStringForPrint = (hierarchy, selectedNivel, selectedDescription, selectedCodigo) => {
    // If hierarchy_texto is available, use it directly as it's pre-formatted.
    // This function can be simplified if `hierarchy_texto` is always present in eq object.
    // For now, let's keep it flexible.
    
    if (!hierarchy || hierarchy.length === 0) {
      return selectedCodigo ? `${selectedCodigo} - ${selectedDescription}` : selectedDescription;
    }
    
    // Check if the selected item itself is the deepest in the provided hierarchy array.
    // If not, it means the hierarchy provided might be parent elements, and the selected item is just the one at the end.
    const deepestInHierarchy = hierarchy[hierarchy.length - 1];
    let fullPath = hierarchy.map(item => `${item.codigo ? item.codigo + ' - ' : ''}${item.descricao}`).join(' > ');
    
    // If the selected item itself is not the deepest part of the hierarchy array
    // (e.g. if the hierarchy only includes parents and the selected item is a child not yet added to parent hierarchy)
    // this logic might need refinement based on how the `hierarquia` is stored.
    // For now, assuming `hierarquia` contains the path *up to and including* the selected item.
    
    return fullPath;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const content = generatePrintContent();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ordem de Serviço - ${formData?.numero}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            font-size: 12px;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            border: 2px solid #333;
            margin-bottom: 0;
          }
          .header-table td {
            border: 1px solid #333;
            padding: 6px;
            vertical-align: middle;
          }
          .logo-cell {
            width: 120px;
            text-align: center;
            background: #f8f9fa;
          }
          .title-cell {
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            background: #f8f9fa;
            padding: 6px;
          }
          .os-info-cell {
            width: 120px;
            background: #f8f9fa;
          }
          .os-number {
            font-size: 14px;
            font-weight: bold;
            color: #d63384;
            margin-bottom: 3px;
          }
          .section-table {
            width: 100%;
            border-collapse: collapse;
            border: 2px solid #333;
            margin-bottom: 0;
          }
          .section-header {
            background: #e9ecef;
            font-weight: bold;
            text-align: center;
            padding: 8px;
            border: 1px solid #333;
          }
          .section-table td, .section-table th {
            border: 1px solid #333;
            padding: 6px;
            vertical-align: top;
          }
          .field-label {
            font-weight: bold;
            background: #f8f9fa;
          }
          .services-table {
            width: 100%;
            border-collapse: collapse;
            border: 2px solid #333;
          }
          .services-table th {
            background: #e9ecef;
            font-weight: bold;
            text-align: center;
            padding: 8px;
            border: 1px solid #333;
            font-size: 11px;
          }
          .services-table td {
            border: 1px solid #333;
            padding: 6px;
            text-align: center;
            font-size: 11px;
            min-height: 20px;
          }
          .description-cell {
            text-align: left !important;
            background: #f8f9fa;
            min-height: 60px;
          }
          .total-row {
            font-weight: bold;
            background: #e9ecef;
          }
          .empty-row {
            height: 25px;
          }
          .dynamic-height {
            min-height: 40px;
            max-height: none;
          }
          .footer {
            position: fixed;
            bottom: 20px;
            width: 100%;
            text-align: center;
            font-size: 10px;
            border-top: 1px solid #333;
            padding-top: 10px;
          }
          @media print {
            body { margin: 0; padding: 15px; }
            .footer { position: fixed; bottom: 0; }
          }
        </style>
      </head>
      <body>
        ${content}
        <div class="footer">
          ${new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}, às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          &nbsp;&nbsp;&nbsp;&nbsp;Página 1 de 1
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  const generatePrintContent = () => {
    if (!formData) return '<p>Carregando...</p>';

    const totais = calcularTotais();

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

    const equipamentosDisplay = (formData.equipamentos || []).map(eq => {
      // Use hierarquia_texto if available, otherwise generate it
      return eq.hierarquia_texto || generateHierarchyStringForPrint(eq.hierarquia, eq.nivel, eq.equipamento_nome, eq.equipamento_codigo);
    }).join('; ');
    
    // For print, consolidate location info
    const printLocation = (formData.localizacao_celula && formData.localizacao_setor)
      ? `${formData.localizacao_celula} - ${formData.localizacao_setor}`
      : (formData.localizacao_celula || formData.localizacao_setor || formData.local || '-');


    return `
      <table class="header-table">
        <tr>
          <td class="logo-cell">
            <div style="font-size: 20px; font-weight: bold; color: #ff6b35;">
              🔧 MaintenancePro
            </div>
          </td>
          <td class="title-cell">
            ORDEM DE SERVIÇO
          </td>
          <td class="os-info-cell">
            <div class="os-number">Nº OS:<br/>${formData.numero}</div>
            <div><strong>Status OS:</strong><br/>${formData.status_nome}</div>
            <div><strong>Data final</strong><br/>${formData.data_finalizada ? new Date(formData.data_finalizada).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-'}</div>
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
          <td>${formData.prioridade_nome || '-'}</td>
          <td>${formData.area_nome || '-'}</td>
          <td>${formData.data_programada ? `${new Date(formData.data_programada).toLocaleDateString('pt-BR', {timeZone: 'UTC'})} ${formData.hora_programada || ''}` : '-'}</td>
        </tr>
      </table>

      <table class="section-table">
        <tr><td colspan="4" class="section-header">DESCRIÇÃO DO(S) EQUIPAMENTO(S)</td></tr>
        <tr>
          <td class="field-label">Equipamento(s):</td>
          <td colspan="2" class="field-label">Local(is):</td>
          <td class="field-label">Marca:</td>
        </tr>
        <tr>
          <td>${equipamentosDisplay || '-'}</td>
          <td colspan="2">${printLocation}</td>
          <td>-</td>
        </tr>
      </table>

      <table class="section-table">
        <tr><td class="section-header">DESCRIÇÃO DA MANUTENÇÃO</td></tr>
        <tr><td class="field-label">Descrição do defeito</td></tr>
        <tr><td class="dynamic-height" style="height: ${getDynamicHeight(formData.descricao_defeito)}">${formData.descricao_defeito || ''}</td></tr>
        <tr><td class="field-label">Observações</td></tr>
        <tr><td class="dynamic-height" style="height: ${getDynamicHeight(formData.observacoes)}">${formData.observacoes || ''}</td></tr>
      </table>

      <table class="services-table">
        <tr><td colspan="5" class="section-header">DESCRIÇÃO DOS SERVIÇOS</td></tr>
        <tr>
          <th>Mantenedor(es)</th>
          <th>Data do Serviço</th>
          <th>Hora inicial</th>
          <th>Hora final</th>
          <th>Tempo total</th>
        </tr>
        ${servicosWithPadding.map(servico => {
          if (servico.empty) {
            return `
              <tr class="empty-row">
                <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
              </tr>
              <tr>
                <td colspan="5" class="description-cell"><strong>Serviço realizado</strong><br/>&nbsp;</td>
              </tr>
            `;
          }
          return `
            <tr>
              <td style="text-align: left;">${(servico.mantenedores || []).map(m => m.nome).join(', ') || '-'}</td>
              <td>${servico.data_inicio ? new Date(servico.data_inicio).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-'}</td>
              <td>${servico.hora_inicio || '-'}</td>
              <td>${servico.hora_fim || '-'}</td>
              <td>${servico.total_horas ? `${servico.total_horas.toFixed(2)}h` : '-'}</td>
            </tr>
            <tr>
              <td colspan="5" class="description-cell">
                <strong>Defeito identificado</strong><br/>
                ${servico.defeito_identificado || ''}
              </td>
            </tr>
            <tr>
              <td colspan="5" class="description-cell">
                <strong>Serviço realizado</strong><br/>
                ${servico.atividade || ''}
              </td>
            </tr>
          `;
        }).join('')}
      </table>

      <table class="services-table" style="margin-top: 20px;">
        <tr><td colspan="5" class="section-header">MATERIAIS</td></tr>
        <tr>
          <th style="width: 40%;">Descrição do material</th>
          <th>Unid. Medida</th>
          <th>Quantidade</th>
          <th>Preço unitário</th>
          <th>Valor total</th>
        </tr>
        ${materiaisWithPadding.map(material => {
          if (material.empty) {
            return '<tr class="empty-row"><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>';
          }
          return `
            <tr>
              <td style="text-align: left;">${material.nome || '-'}</td>
              <td>${material.unidade || '-'}</td>
              <td>${material.quantidade || 0}</td>
              <td>R$ ${(material.custo_unitario || 0).toFixed(2).replace('.', ',')}</td>
              <td>R$ ${(material.custo_total || 0).toFixed(2).replace('.', ',')}</td>
            </tr>
          `;
        }).join('')}
        <tr class="total-row">
          <td colspan="4" style="text-align: right;">Total</td>
          <td>R$ ${totais.valorTotalMateriais.toFixed(2).replace('.', ',')}</td>
        </tr>
      </table>

      <table class="services-table">
        <tr><td colspan="5" class="section-header">OUTROS</td></tr>
        <tr>
          <th style="width: 40%;">Descrição de outros</th>
          <th>Unid. Medida</th>
          <th>Quantidade</th>
          <th>Preço unitário</th>
          <th>Valor total</th>
        </tr>
        ${(formData.outros || []).length > 0 ?
          (formData.outros || []).map(outro => `
            <tr>
              <td style="text-align: left;">${outro.descricao || '-'}</td>
              <td>${outro.unidade || '-'}</td>
              <td>${outro.quantidade}</td>
              <td>R$ ${(outro.custo_unitario || 0).toFixed(2).replace('.', ',')}</td>
              <td>R$ ${(outro.custo_total || 0).toFixed(2).replace('.', ',')}</td>
            </tr>
          `).join('')
          : '<tr><td colspan="5" style="height: 40px;">-</td></tr>'
        }
        <tr class="total-row">
          <td colspan="4" style="text-align: right;"><strong>TOTAL GERAL</strong></td>
          <td><strong>R$ ${totais.valorTotalGeral.toFixed(2).replace('.', ',')}</strong></td>
        </tr>
      </table>
    `;
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !error.includes("sucesso")) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertDescription>{error || "Não foi possível carregar a OS."}</AlertDescription>
        </Alert>
      </div>
    );
  }
  
  const totais = calcularTotais();
  const tempoParado = calcularTempoParado(); // Call the function here

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={handleCloseOS}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <ModuleLabel>Editar OS</ModuleLabel>
            <p className="mt-1 text-sm text-slate-600 font-mono">OS: {formData.numero}</p>
          </div>
          {/* Botões de Navegação */}
          {allOSIds.length > 1 && (
            <div className="flex items-center gap-2 ml-4">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => navigateToOS('prev')}
                title="OS Anterior"
                disabled={saving}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-slate-600 px-2">
                {currentOSIndex + 1} / {allOSIds.length}
              </span>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => navigateToOS('next')}
                title="Próxima OS"
                disabled={saving}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleDelete} className="text-red-600 hover:text-red-700" disabled={saving}>
            <Trash2 className="w-4 h-4 mr-2"/>Excluir
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={saving}>
            <Printer className="w-4 h-4 mr-2"/>Imprimir OS
          </Button>
        </div>
      </div>

      {error && error !== "" && !error.includes("sucesso") && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {error && error.includes("sucesso") && (
        <Alert className="border-green-500 text-green-700 bg-green-50">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="solicitacao" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-slate-100">
            <TabsTrigger value="solicitacao">Solicitação</TabsTrigger>
            <TabsTrigger value="servicos">Serviços</TabsTrigger>
            <TabsTrigger value="materiais">Materiais</TabsTrigger>
            <TabsTrigger value="terceirizados">Terceirizados</TabsTrigger>
            <TabsTrigger value="outros">Outros</TabsTrigger>
          </TabsList>

          <TabsContent value="solicitacao">
            <div className="space-y-6">
              {/* Card de Identificação da OS */}
              <Card className="shadow-sm border-0 bg-white">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Identificação da OS
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="numero">Número da OS</Label>
                      <Input
                        id="numero"
                        value={formData.numero}
                        readOnly
                        className="bg-slate-50"
                      />
                    </div>
                    <div>
                      <Label htmlFor="solicitante">Solicitante</Label>
                      <Input
                        id="solicitante"
                        value={formData.solicitante}
                        onChange={(e) => setFormData(prev => ({ ...prev, solicitante: e.target.value }))}
                        placeholder="Nome do solicitante"
                      />
                    </div>
                    <div>
                      <Label htmlFor="prioridade">Grau de Prioridade</Label>
                      <Select
                        value={formData.prioridade_id || ""}
                        onValueChange={handlePrioridadeChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a prioridade" />
                        </SelectTrigger>
                        <SelectContent>
                          {(prioridades || []).map(prioridade => (
                            <SelectItem key={prioridade.id} value={prioridade.id}>
                              <div className="flex items-center gap-2">
                                {prioridade.cor && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: prioridade.cor }}></div>}
                                {prioridade.descricao}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="status">
                        Status <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.status_id}
                        onValueChange={handleStatusChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                        <SelectContent>
                          {(statusList || []).map(status => (
                            <SelectItem key={status.id} value={status.id}>
                              {status.descricao}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="tipo">
                        Tipo de Manutenção <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.tipo_id}
                        onValueChange={handleTipoChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {(tipos || []).map(tipo => (
                            <SelectItem key={tipo.id} value={tipo.id}>
                              {tipo.descricao}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="area">Área de Manutenção</Label>
                      <Select
                        value={formData.area_id}
                        onValueChange={handleAreaChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a área" />
                        </SelectTrigger>
                        <SelectContent>
                          {(areas || []).map(area => (
                            <SelectItem key={area.id} value={area.id}>
                              {area.descricao}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Equipamentos */}
              <Card className="shadow-sm border-0 bg-white">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings className="w-5 h-5 text-orange-600" />
                    Equipamentos <span className="text-red-500">*</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Botão de adicionar */}
                    {(!formData.equipamentos || formData.equipamentos.length === 0) ? (
                      <div className="text-center py-8 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg">
                        <p className="text-slate-600 mb-4">Nenhum equipamento selecionado</p>
                        <Button
                          type="button"
                          onClick={() => setShowEquipamentoSelector(true)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Selecionar Equipamentos
                        </Button>
                        <p className="text-xs text-slate-500 mt-3">
                          💡 Você pode selecionar o equipamento completo ou um conjunto/componente específico
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center">
                          <Label className="text-sm font-medium">
                            Equipamentos/Conjuntos Selecionados
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowEquipamentoSelector(true)}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Adicionar Mais
                          </Button>
                        </div>

                        {/* Lista de equipamentos com EquipamentoCard */}
                        <div className="space-y-2">
                          {formData.equipamentos.map((eq, index) => (
                            <EquipamentoCard
                              key={eq.equipamento_id + '-' + index}
                              equipamento={{
                                id: eq.equipamento_id,
                                descricao: eq.equipamento_nome,
                                codigo: eq.equipamento_codigo,
                                localizacao: eq.localizacao,
                                nivel: eq.nivel,
                                hierarquia: eq.hierarquia,
                                hierarquia_texto: eq.hierarquia_texto,
                                localizacao_celula: eq.localizacao_celula,
                                localizacao_setor: eq.localizacao_setor,
                              }}
                              onRemove={() => removeEquipamento(index)}
                              onEdit={() => {
                                setShowEquipamentoSelector(true);
                              }}
                              showEdit={true}
                            />
                          ))}
                        </div>
                      </>
                    )}

                    {/* Campos de Célula e Setor - Somente Leitura */}
                    {formData.equipamentos && formData.equipamentos.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border mt-4">
                        <div>
                          <Label htmlFor="localizacao_celula" className="text-sm font-medium text-slate-700">
                            Célula (Equipamento Principal)
                          </Label>
                          <Input
                            id="localizacao_celula"
                            value={formData.localizacao_celula || '-'}
                            readOnly
                            className="bg-white border-slate-200 mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="localizacao_setor" className="text-sm font-medium text-slate-700">
                            Setor (Equipamento Principal)
                          </Label>
                          <Input
                            id="localizacao_setor"
                            value={formData.localizacao_setor || '-'}
                            readOnly
                            className="bg-white border-slate-200 mt-1"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Planejamento */}
              <Card className="shadow-sm border-0 bg-white">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="w-5 h-5 text-green-600" />
                    Planejamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="data_programada">Data Programada</Label>
                      <Input
                        id="data_programada"
                        type="date"
                        value={formData.data_programada}
                        onChange={(e) => setFormData(prev => ({ ...prev, data_programada: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="hora_programada">Hora Programada</Label>
                      <Input
                        id="hora_programada"
                        type="time"
                        value={formData.hora_programada}
                        onChange={(e) => setFormData(prev => ({ ...prev, hora_programada: e.target.value }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Execução */}
              <Card className="shadow-sm border-0 bg-white">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="w-5 h-5 text-purple-600" />
                    Execução
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="data_finalizada">Data Finalizada</Label>
                        <Input
                          id="data_finalizada"
                          type="date"
                          value={formData.data_finalizada}
                          onChange={(e) => setFormData(prev => ({ ...prev, data_finalizada: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="hora_finalizada">Hora Finalizada</Label>
                        <Input
                          id="hora_finalizada"
                          type="time"
                          value={formData.hora_finalizada}
                          onChange={(e) => setFormData(prev => ({ ...prev, hora_finalizada: e.target.value }))}
                        />
                      </div>
                    </div>
                    
                    <div className={`rounded-xl border p-4 transition-colors ${formData.maquina_parada === null ? "border-red-300 bg-red-50/60" : "border-slate-200 bg-slate-50"}`}>
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <Label className="text-sm font-semibold text-slate-900">
                            A máquina está realmente parada por causa do defeito? <span className="text-red-500">*</span>
                          </Label>
                          <p className="mt-1 text-xs text-slate-500">
                            Marque uma opção para registrar corretamente o tempo de parada.
                          </p>
                        </div>
                        {formData.maquina_parada === null && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-700">
                            Obrigatório
                          </span>
                        )}
                      </div>

                      <RadioGroup
                        value={maquinaParadaValue}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev,
                          maquina_parada: value === "sim",
                          tempo_parada_manual: value === "sim" ? "" : prev.tempo_parada_manual
                        }))}
                        className="grid gap-3 md:grid-cols-2"
                      >
                        <div className="space-y-2">
                          <RadioGroupItem id="maquina_parada_sim" value="sim" className="peer sr-only" />
                          <Label
                            htmlFor="maquina_parada_sim"
                            className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-emerald-300 peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-50"
                          >
                            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                            <div className="space-y-1">
                              <div className="font-medium text-slate-900">Sim, a máquina parou</div>
                              <p className="text-xs text-slate-500">O defeito interrompeu a operação normalmente.</p>
                            </div>
                          </Label>
                        </div>

                        <div className="space-y-2">
                          <RadioGroupItem id="maquina_parada_nao" value="nao" className="peer sr-only" />
                          <Label
                            htmlFor="maquina_parada_nao"
                            className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-amber-300 peer-data-[state=checked]:border-amber-500 peer-data-[state=checked]:bg-amber-50"
                          >
                            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                            <div className="space-y-1">
                              <div className="font-medium text-slate-900">Não, ela continuou operando</div>
                              <p className="text-xs text-slate-500">Use o tempo manual se a parada foi parcial.</p>
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {formData.maquina_parada === false && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <Label htmlFor="tempo_parada_manual" className="text-sm font-medium text-amber-900">
                          Tempo de Parada Real da Máquina (minutos)
                        </Label>
                        <Input
                          id="tempo_parada_manual"
                          type="number"
                          min="0"
                          value={formData.tempo_parada_manual}
                          onChange={(e) => setFormData(prev => ({ ...prev, tempo_parada_manual: e.target.value }))}
                          placeholder="Ex: 120"
                          className="mt-2 bg-white"
                        />
                        <p className="text-xs text-amber-700 mt-2">
                          💡 Como a máquina não ficou totalmente parada, informe o tempo real (em minutos) que ela ficou parada para execução do serviço.
                        </p>
                      </div>
                    )}

                    {tempoParado > 0 && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <Label className="text-sm font-medium text-blue-900">Tempo Total de Parada</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-4 h-4 text-blue-600" />
                          <span className="text-lg font-bold text-blue-700">
                            {tempoParado} minutos
                            {tempoParado >= 60 && (
                              <span className="text-sm font-normal text-blue-600 ml-2">
                                ({Math.floor(tempoParado / 60)}h {tempoParado % 60}min)
                              </span>
                            )}
                          </span>
                        </div>
                        {formData.maquina_parada === false && formData.tempo_parada_manual && (
                          <p className="text-xs text-blue-600 mt-1">
                            ℹ️ Tempo informado manualmente
                          </p>
                        )}
                        {formData.maquina_parada === true && (
                          <p className="text-xs text-blue-600 mt-1">
                            ℹ️ Calculado automaticamente entre data/hora programada e finalizada
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Descrições */}
              <Card className="shadow-sm border-0 bg-white">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="w-5 h-5 text-slate-600" />
                    Descrições
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="descricao_defeito">Descrição do Defeito</Label>
                    <Textarea
                      id="descricao_defeito"
                      value={formData.descricao_defeito}
                      onChange={(e) => setFormData(prev => ({ ...prev, descricao_defeito: e.target.value }))}
                      placeholder="Descreva o problema encontrado..."
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                      placeholder="Observações gerais..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="servicos">
            <Card className="shadow-sm border-0 bg-white">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Serviços de Manutenção</CardTitle>
                  <Button type="button" variant="outline" onClick={addServico}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Serviço
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(formData.servicos || []).length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    Nenhum serviço adicionado. Clique em "Adicionar Serviço" para começar.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(formData.servicos || []).map((servico, index) => {
                      // Determinar como exibir o tempo e valor
                      const tempoDisplay = (() => {
                        if (servico.total_horas && servico.total_horas > 0) {
                          const hours = Math.floor(servico.total_horas);
                          const minutes = Math.round((servico.total_horas - hours) * 60);
                          const hhmmFormat = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                          return hhmmFormat;
                        }
                        return '-';
                      })();

                      // Calcular valor correto
                      const valorDisplay = (() => {
                        // Se já tem valor_total salvo, usar ele
                        if (servico.valor_total && servico.valor_total > 0) {
                          return servico.valor_total;
                        }
                        
                        // Caso contrário, recalcular
                        if (servico.total_horas && servico.total_horas > 0 && servico.mantenedores) {
                          const custoTotal = (servico.mantenedores || []).reduce(
                            (sum, m) => sum + (parseFloat(m.custo_hora || m.mantenedor_custo_hora || 0)), 
                            0
                          );
                          return servico.total_horas * custoTotal;
                        }
                        
                        return 0;
                      })();

                      // Exibir detalhes de horas individualizadas
                      const horasDetalhadas = servico.horas_por_mantenedor && Object.keys(servico.horas_por_mantenedor).length > 0 ? (
                        <div className="text-xs text-slate-600 mt-1 space-y-1">
                          {(servico.mantenedores || []).map(mant => {
                            const mantId = String(mant.id || mant.mantenedor_id);
                            const horas = servico.horas_por_mantenedor[mantId];
                            if (horas !== undefined && horas !== null) {
                              const horasNum = parseFloat(horas);
                              const h = Math.floor(horasNum);
                              const m = Math.round((horasNum - h) * 60);
                              const hhmmFormat = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                              return (
                                <div key={mantId}>
                                  • {mant.nome || mant.mantenedor_nome}: {hhmmFormat}
                                </div>
                              );
                            }
                            return null;
                          }).filter(Boolean)}
                        </div>
                      ) : null;

                      return (
                        <div key={servico.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium text-lg">Serviço #{index + 1}</h4>
                              <p className="text-sm text-slate-600 mt-1">
                                <strong>Mantenedores:</strong> {(servico.mantenedores || []).map(m => m.nome || m.mantenedor_nome).join(', ') || 'Nenhum'}
                              </p>
                              
                              {/* Tempo de Trabalho */}
                              <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-sm font-semibold text-blue-900">
                                  ⏱️ Tempo de Trabalho: <span className="text-blue-700">{tempoDisplay}</span>
                                </p>
                                {horasDetalhadas}
                                {servico.data_inicio && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    📅 Data: {new Date(servico.data_inicio).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                                    {servico.hora_inicio && servico.hora_fim && ` • ${servico.hora_inicio} às ${servico.hora_fim}`}
                                  </p>
                                )}
                              </div>

                              <p className="text-sm text-slate-600 mt-2">
                                <strong>Defeito identificado:</strong> {servico.defeito_identificado || '-'}
                              </p>
                              <p className="text-sm text-slate-600 mt-1">
                                <strong>Atividade:</strong> {servico.atividade || '-'}
                              </p>
                              <p className="text-sm font-semibold text-green-700 mt-2">
                                💰 Valor: {valorDisplay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" size="sm" onClick={() => editServico(servico, index)}>
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => removeServico(index)} className="text-red-600">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="text-right pt-4 border-t">
                      <span className="text-xl font-bold text-green-700">
                        Total Serviços: {calcularTotais().valorTotalServicos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="materiais">
            <Card className="shadow-sm border-0 bg-white">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Materiais Utilizados</CardTitle>
                  <Button
                    type="button"
                    onClick={() => setShowMaterialSelector(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Materiais
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(formData.materiais || []).length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    Nenhum material adicionado. Clique em "Adicionar Materiais" para começar.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Tabela de Materiais Simplificada */}
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-24">Código</TableHead>
                            <TableHead className="w-24">Cód. Compra</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="w-24">Unidade</TableHead>
                            <TableHead className="w-28">Quantidade</TableHead>
                            <TableHead className="w-32">Valor Unit.</TableHead>
                            <TableHead className="w-32">Total</TableHead>
                            <TableHead className="w-40">Anexos</TableHead>
                            <TableHead className="w-16">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(formData.materiais || []).map((material, index) => (
                            <TableRow key={material.id || `material-${index}`}>
                              <TableCell className="font-mono text-sm">
                                {material.codigo || '-'}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {material.codigo_compra || '-'}
                              </TableCell>
                              <TableCell className="text-sm">
                                {material.nome || '-'}
                              </TableCell>
                              <TableCell className="text-sm">
                                {material.unidade || '-'}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="text"
                                  value={material.quantidade || ''}
                                  onChange={(e) => updateMaterial(index, 'quantidade', e.target.value)}
                                  className="w-20 text-center text-sm"
                                  placeholder="0"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={material.custo_unitario}
                                  onChange={(e) => updateMaterial(index, 'custo_unitario', e.target.value)}
                                  className="w-24 text-sm"
                                  placeholder="0,00"
                                />
                              </TableCell>
                              <TableCell className="text-sm font-bold text-green-700">
                                {(material.custo_total || 0).toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL'
                                })}
                              </TableCell>
                              <TableCell>
                                <ImageUploader
                                  value={material.anexos || []}
                                  onChange={(list) => addImagesToMaterial(index, list)}
                                  label="Adicionar imagens"
                                  variant="minimal"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeMaterial(index)}
                                  className="text-red-600 hover:text-red-700 p-2"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Total de Materiais */}
                    <div className="flex justify-end pt-4 border-t">
                      <div className="text-right">
                        <p className="text-sm text-slate-600">Total de Materiais</p>
                        <p className="text-xl font-bold text-green-600">
                          {((formData.materiais || []).reduce((sum, m) => sum + (parseFloat(m.custo_total) || 0), 0)).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="terceirizados">
            <Card className="shadow-sm border-0 bg-white">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Serviços Terceirizados</CardTitle>
                  <Button type="button" variant="outline" onClick={addTerceirizado}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Terceirizado
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(formData.terceirizados || []).length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    Nenhum serviço terceirizado adicionado.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(formData.terceirizados || []).map((terceirizado, index) => (
                      <div key={terceirizado.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-lg">Terceirizado #{index + 1}</h4>
                            <p className="text-sm text-slate-600 mt-1">
                              <strong>Prestadora:</strong> {terceirizado.prestadora_nome || '-'}
                            </p>
                            <p className="text-sm text-slate-600">
                              <strong>Data:</strong> {terceirizado.data_servico ? new Date(terceirizado.data_servico).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-'}
                            </p>
                            <p className="text-sm text-slate-600">
                              <strong>Serviço:</strong> {terceirizado.descricao_servico || '-'}
                            </p>
                            <p className="text-sm font-semibold text-purple-700 mt-2">
                              {(parseFloat(terceirizado.valor_servico) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => editTerceirizado(terceirizado, index)}>
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => removeTerceirizado(index)} className="text-red-600">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="text-right pt-4 border-t">
                      <span className="text-xl font-bold text-purple-700">
                        Total Terceirizados: {calcularTotais().valorTotalTerceirizados.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="outros">
            <Card className="shadow-sm border-0 bg-white">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Outros Custos</CardTitle>
                  <Button type="button" variant="outline" onClick={addOutro}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(formData.outros || []).length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    Nenhum item adicional.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(formData.outros || []).map((outro, index) => (
                      <div key={outro.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-lg">Item #{index + 1}</h4>
                            <p className="text-sm text-slate-600 mt-1">
                              <strong>Descrição:</strong> {outro.descricao || '-'}
                            </p>
                            <p className="text-sm text-slate-600">
                              <strong>Quantidade:</strong> {outro.quantidade} {outro.unidade} x {(parseFloat(outro.custo_unitario) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-sm font-semibold text-green-700 mt-2">
                              Total: {(parseFloat(outro.custo_total) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => editOutro(outro, index)}>
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => removeOutro(index)} className="text-red-600">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="text-right pt-4 border-t">
                      <span className="text-xl font-bold text-green-700">
                        Total Outros: {calcularTotais().valorTotalOutros.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        })}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Resumo de Totais */}
        <Card className="shadow-sm border-0 bg-white">
          <CardHeader>
            <CardTitle>Resumo Financeiro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="text-center">
                <p className="text-sm text-slate-500">Total Serviços</p>
                <p className="text-lg font-semibold text-blue-600">
                  {totais.valorTotalServicos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500">Total Materiais</p>
                <p className="text-lg font-semibold text-purple-600">
                  {totais.valorTotalMateriais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500">Total Terceirizados</p>
                <p className="text-lg font-semibold text-orange-600">
                  {totais.valorTotalTerceirizados.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500">Total Outros</p>
                <p className="text-lg font-semibold text-amber-600">
                  {totais.valorTotalOutros.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500">Total Geral</p>
                <p className="text-2xl font-bold text-green-600">
                  {totais.valorTotalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-6">
          <Button type="button" variant="outline" onClick={handleCloseOS} disabled={saving}>
            <X className="w-4 h-4 mr-2" />Cancelar
          </Button>
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Modals */}
      <ServicoModal
        isOpen={showServicoModal}
        onClose={() => setShowServicoModal(false)}
        servico={editingServico}
        onSave={saveServico}
        mantenedores={mantenedores}
        onSelectMantenedores={handleMantenedorSelectorForModal}
      />

      <TerceirizadoModal
        isOpen={showTerceirizadoModal}
        onClose={() => setShowTerceirizadoModal(false)}
        terceirizado={editingTerceirizado}
        onSave={saveTerceirizado}
        prestadoras={prestadoras}
        centrosCusto={centrosCusto}
        onPrestadorasChange={setPrestadoras}
        onCentrosCustoChange={setCentrosCusto}
      />

      <OutroModal
        isOpen={showOutroModal}
        onClose={() => setShowOutroModal(false)}
        outro={editingOutro}
        onSave={saveOutro}
      />

      <EquipamentoSelector
        isOpen={showEquipamentoSelector}
        onClose={() => setShowEquipamentoSelector(false)}
        equipamentos={allEquipamentos || []} // This list is just for reference, the selector might fetch its own detailed list.
        onSelectEquipamento={handleSelectEquipamentos}
        allowMultiple={true}
        // Pass already selected equipments to show them pre-selected in the modal
        selectedEquipamentos={formData.equipamentos.map(eq => ({
          id: eq.equipamento_id,
          descricao: eq.equipamento_nome,
          codigo: eq.equipamento_codigo,
          localizacao: eq.localizacao,
          nivel: eq.nivel,
          hierarquia: eq.hierarquia,
          hierarquia_texto: eq.hierarquia_texto, // Ensure this is passed
          localizacao_celula: eq.localizacao_celula, // Ensure this is passed
          localizacao_setor: eq.localizacao_setor, // Ensure this is passed
        }))}
        quickCreate={{
          label: "Novo equipamento",
          title: "Novo equipamento",
          createForm: ({ formData: quickData, setFormData: setQuickData, disabled }) => (
            <QuickCreateFields
              fields={equipamentoQuickCreateFields}
              formData={quickData}
              setFormData={setQuickData}
              disabled={disabled}
            />
          ),
          onCreate: handleCreateEquipamento,
        }}
      />

      <MaterialSelector
        isOpen={showMaterialSelector}
        onClose={() => setShowMaterialSelector(false)}
        materiais={materiais || []}
        onAddMaterials={handleAddMaterialsFromSelector}
        quickCreate={{
          label: "Novo material",
          title: "Novo material",
          createForm: ({ formData: quickData, setFormData: setQuickData, disabled }) => (
            <QuickCreateFields
              fields={materialQuickCreateFields}
              formData={quickData}
              setFormData={setQuickData}
              disabled={disabled}
            />
          ),
          onCreate: handleCreateMaterial,
        }}
      />

      <MantenedorMultipleSelector
        isOpen={showMantenedorSelector}
        onClose={() => setShowMantenedorSelector(false)}
        mantenedores={mantenedores || []}
        selectedMantenedores={mantenedoresForSelector}
        onConfirm={handleMantenedorSelectorConfirmForModal}
        quickCreate={{
          label: "Novo mantenedor",
          title: "Novo mantenedor",
          createForm: ({ formData: quickData, setFormData: setQuickData, disabled }) => (
            <QuickCreateFields
              fields={mantenedorQuickCreateFields}
              formData={quickData}
              setFormData={setQuickData}
              disabled={disabled}
            />
          ),
          onCreate: handleCreateMantenedor,
        }}
      />
    </div>
  );
}
