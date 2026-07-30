import React, { useState, useEffect } from "react";
import { appApi } from "@/api/appClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save, X, ArrowLeft, Trash2, FileText, Settings, Calendar, Clock, Edit, CheckCircle2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import MaterialSelector from "../components/MaterialSelector";
import EquipamentoSelector from "../components/EquipamentoSelector";
import MantenedorMultipleSelector from "../components/MantenedorMultipleSelector";
import ImageUploader from "../components/attachments/ImageUploader";
import ServicoModal from "../components/modals/ServicoModal";
import TerceirizadoModal from "../components/modals/TerceirizadoModal";
import OutroModal from "../components/modals/OutroModal";
import EquipamentoCard from "../components/ordens/EquipamentoCard";
import RelatedEntitySelect from "@/components/RelatedEntitySelect";
import QuickCreateFields from "@/components/quick-create/QuickCreateFields";
import ModuleLabel from "@/components/ModuleLabel";
import { sortByText, upsertCreatedOption, validateQuickCreateFields } from "@/utils/quickCreate";

const descricaoQuickCreateFields = [
  { name: "descricao", label: "Descrição", required: true, placeholder: "Descrição" },
];

const prioridadeQuickCreateFields = [
  { name: "descricao", label: "Descrição", required: true, placeholder: "Descrição da prioridade" },
  { name: "cor", label: "Cor", placeholder: "#FF0000" },
  { name: "ordem", label: "Ordem", type: "number", min: "0", step: "1", placeholder: "1" },
];

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

// Função auxiliar para calcular nível e obter label
function calculateLevel(nivel) {
  return nivel || 3;
}

function getLevelLabel(level) {
  switch(level) {
    case 3: return "Equipamento";
    case 4: return "Conjunto";
    case 5: return "Subconjunto";
    case 6: return "Componente";
    default: return "Item";
  }
}

export default function NovaOS() {
  const navigate = useNavigate();

  const [equipamentos, setEquipamentos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [areas, setAreas] = useState([]);
  const [prioridades, setPrioridades] = useState([]);
  const [mantenedores, setMantenedores] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [prestadoras, setPrestadoras] = useState([]);
  const [centrosCusto, setCentrosCusto] = useState([]);
  const [localizacoes, setLocalizacoes] = useState([]);

  const [formData, setFormData] = useState({
    numero: '',
    equipamento_id: '', // ID do item principal selecionado (primeiro na lista)
    equipamento_nome: '', // Nome do item principal selecionado (primeiro na lista)
    equipamentos: [], // Agora pode conter múltiplos equipamentos/conjuntos/componentes com detalhes da hierarquia
    localizacao_celula: '', // Célula do equipamento principal
    localizacao_setor: '', // Setor do equipamento principal
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
    data_prazo: '',
    hora_prazo: '',
    responsavel_id: '',
    responsavel_nome: '',
    data_finalizada: '',
    hora_finalizada: '',
    maquina_parada: null,
    tempo_parada_manual: '',
    observacoes: '',
    descricao_defeito: '',
    servicos: [],
    materiais: [],
    outros: [],
    terceirizados: []
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMaterialSelector, setShowMaterialSelector] = useState(false);
  const [showEquipamentoSelector, setShowEquipamentoSelector] = useState(false);
  
  const [showServicoModal, setShowServicoModal] = useState(false);
  const [editingServico, setEditingServico] = useState(null);
  const [editingServicoIndex, setEditingServicoIndex] = useState(null);

  const [showTerceirizadoModal, setShowTerceirizadoModal] = useState(false);
  const [editingTerceirizado, setEditingTerceirizado] = useState(null);
  const [editingTerceirizadoIndex, setEditingTerceirizadoIndex] = useState(null);

  const [showOutroModal, setShowOutroModal] = useState(false);
  const [editingOutro, setEditingOutro] = useState(null);
  const [editingOutroIndex, setEditingOutroIndex] = useState(null);

  const [showMantenedorSelector, setShowMantenedorSelector] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [equipData, tiposData, statusData, areasData, prioridadesData, mantData, matData, prestData, centrosCustoData, localizacoesData, allOS] = await Promise.all([
          appApi.entities.Equipamento.list(),
          appApi.entities.TipoManutencao.list(),
          appApi.entities.StatusOS.list(),
          appApi.entities.AreaManutencao.list(),
          appApi.entities.Prioridade.list(),
          appApi.entities.Mantenedor.list(),
          appApi.entities.Material.list(),
          appApi.entities.PrestadoraServico.list(),
          appApi.entities.CentroCusto.list(),
          appApi.entities.Localizacao.list(),
          appApi.entities.OrdemServico.list('-created_date')
          ]);

        setEquipamentos((equipData || []).sort((a, b) => (a?.descricao || '').localeCompare(b?.descricao || '')));
        setTipos((tiposData || []).sort((a, b) => (a?.descricao || '').localeCompare(b?.descricao || '')));
        setStatusList((statusData || []).sort((a, b) => (a?.descricao || '').localeCompare(b?.descricao || '')));
        setAreas((areasData || []).sort((a, b) => (a?.descricao || '').localeCompare(b?.descricao || '')));
        setPrioridades((prioridadesData || []).sort((a, b) => (a?.ordem || 999) - (b?.ordem || 999) || (a?.descricao || '').localeCompare(b?.descricao || '')));
        setMantenedores((mantData || []).sort((a, b) => (a?.nome || '').localeCompare(b?.nome || '')));
        setMateriais((matData || []).sort((a, b) => (a?.nome || '').localeCompare(b?.nome || '')));
        setPrestadoras((prestData || []).sort((a, b) => (a?.nome_empresa || '').localeCompare(b?.nome_empresa || '')));
        setCentrosCusto((centrosCustoData || []).sort((a, b) => (a?.descricao || '').localeCompare(b?.descricao || '')));
        setLocalizacoes((localizacoesData || []).sort((a, b) => (a?.descricao || '').localeCompare(b?.descricao || '')));
        
        generateOSNumber(allOS || []);
      } catch (error) {
        setError("Erro ao carregar dados de referência");
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

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

  const generateOSNumber = (allOS) => {
    let nextNumber = 1;
    if (Array.isArray(allOS) && allOS.length > 0) {
        const latestOSNumber = allOS
            .map(os => {
                const match = os?.numero?.match(/^OS-(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            })
            .filter(num => num > 0)
            .sort((a, b) => b - a)[0];

        if (latestOSNumber) {
          nextNumber = latestOSNumber + 1;
        }
    }
    const formattedNumber = `OS-${String(nextNumber).padStart(3, '0')}`;
    setFormData(prev => ({ ...prev, numero: formattedNumber }));
  };

  const handleSelectEquipamentos = (equipamentosSelecionados) => {
    const equipamentosArray = Array.isArray(equipamentosSelecionados)
      ? equipamentosSelecionados
      : [equipamentosSelecionados];

    const equipamentosFormatados = equipamentosArray.map(eq => ({
      equipamento_id: String(eq.equipamento_id || eq.id),
      equipamento_nome: eq.equipamento_nome || eq.descricao,
      equipamento_codigo: eq.equipamento_codigo || eq.codigo || '',
      localizacao: eq.localizacao || '', // Localização completa do item selecionado
      nivel: eq.nivel || 3,
      hierarquia: eq.hierarquia || [],
      hierarquia_texto: eq.hierarquia_texto || ''
    }));

    const firstSelected = equipamentosFormatados[0];
    
    let celula = '';
    let setor = '';
    
    let mainEquipmentIdToLookup = firstSelected?.hierarquia && firstSelected.hierarquia.length > 0
                                ? firstSelected.hierarquia[0].id
                                : firstSelected?.equipamento_id; 

    const mainEquipmentDetails = equipamentos.find(eq => String(eq.id) === String(mainEquipmentIdToLookup));
    
    if (mainEquipmentDetails) {
      celula = mainEquipmentDetails.localizacao_celula || '';
      setor = mainEquipmentDetails.localizacao_setor || '';
    }

    setFormData(prev => ({
      ...prev,
      equipamentos: equipamentosFormatados,
      equipamento_id: firstSelected?.equipamento_id || '',
      equipamento_nome: firstSelected?.equipamento_nome || '',
      localizacao_celula: celula,
      localizacao_setor: setor
    }));
    
    setShowEquipamentoSelector(false);
  };

  const removeEquipamento = (index) => {
    const novosEquipamentos = formData.equipamentos.filter((_, i) => i !== index);
    
    setFormData(prev => ({
      ...prev,
      equipamentos: novosEquipamentos,
      // Atualiza os campos principais com base no primeiro equipamento restante, ou limpa se a lista estiver vazia.
      equipamento_id: novosEquipamentos[0]?.equipamento_id || '',
      equipamento_nome: novosEquipamentos[0]?.equipamento_nome || '',
      // Se a lista ficar vazia, limpa também celula/setor
      localizacao_celula: novosEquipamentos.length === 0 ? '' : prev.localizacao_celula,
      localizacao_setor: novosEquipamentos.length === 0 ? '' : prev.localizacao_setor,
    }));
  };

  const handleTipoChange = (tipoId) => {
    const tipo = (tipos || []).find(t => t.id === tipoId);
    setFormData(prev => ({
      ...prev,
      tipo_id: tipoId,
      tipo_nome: tipo?.descricao || ''
    }));
  };

  const handleStatusChange = (statusId) => {
    const status = (statusList || []).find(s => s.id === statusId);
    setFormData(prev => ({
      ...prev,
      status_id: statusId,
      status_nome: status?.descricao || ''
    }));
  };

  const handleAreaChange = (areaId) => {
    const area = (areas || []).find(a => a.id === areaId);
    setFormData(prev => ({
      ...prev,
      area_id: areaId,
      area_nome: area?.descricao || ''
    }));
  };

  const handlePrioridadeChange = (prioridadeId) => {
    const prioridade = (prioridades || []).find(p => p.id === prioridadeId);
    setFormData(prev => ({
      ...prev,
      prioridade_id: prioridadeId,
      prioridade_nome: prioridade?.descricao || ''
    }));
  };

  const updateCreatedList = (setter, created, getText) => {
    setter(prev => sortByText(upsertCreatedOption(prev, created), getText));
  };

  const createDescricaoEntity = async (entityClient, setter, data) => {
    validateQuickCreateFields(data, descricaoQuickCreateFields);
    const created = await entityClient.create(data);
    updateCreatedList(setter, created, (item) => item.descricao || "");
    return created;
  };

  const handleCreatePrioridade = async (data) => {
    validateQuickCreateFields(data, prioridadeQuickCreateFields);
    const payload = {
      ...data,
      ordem: data.ordem === "" || data.ordem === undefined ? null : Number(data.ordem),
    };
    const created = await appApi.entities.Prioridade.create(payload);
    setPrioridades(prev =>
      sortByText(upsertCreatedOption(prev, created), (item) => `${String(item.ordem || 999).padStart(4, "0")} ${item.descricao || ""}`)
    );
    return created;
  };

  const handleCreateEquipamento = async (data) => {
    validateQuickCreateFields(data, equipamentoQuickCreateFields);
    const localizacao = (localizacoes || []).find(loc => loc.id === data.localizacao_id);
    const payload = {
      ...data,
      status: data.status || "Ativo",
      parent_id: null,
      localizacao_celula: localizacao?.descricao || "",
      localizacao_setor: localizacao?.setor || "",
      imagens: [],
    };
    const created = await appApi.entities.Equipamento.create(payload);
    updateCreatedList(setEquipamentos, created, (item) => item.descricao || "");
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

  const addServico = () => {
    const novoServico = {
      id: Date.now(),
      mantenedores: [],
      data_inicio: '',
      hora_inicio: '',
      data_fim: '', // Adicionado para consistência
      hora_fim: '', // Adicionado para consistência
      defeito_identificado: '',
      atividade: '',
      total_horas: 0,
      valor_total: 0,
      horas_por_mantenedor: {}, // Inicializado para armazenar horas por mantenedor
      anexos: []
    };
    setEditingServico(novoServico);
    setEditingServicoIndex(null);
    setShowServicoModal(true);
  };

  const editServico = (servico, index) => {
    setEditingServico({ ...servico });
    setEditingServicoIndex(index);
    setShowServicoModal(true);
  };

  const saveServico = (servicoData) => {
    if (editingServicoIndex !== null) {
      const newServicos = [...(formData.servicos || [])];
      newServicos[editingServicoIndex] = servicoData;
      setFormData(prev => ({ ...prev, servicos: newServicos }));
    } else {
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
    setFormData(prev => ({
      ...prev,
      servicos: (prev.servicos || []).filter((_, i) => i !== index)
    }));
  };

  const handleMantenedorSelectorForModal = () => {
    setShowMantenedorSelector(true);
  };

  const handleMantenedorSelectorConfirmForModal = (mantenedoresSelecionados) => {
    setEditingServico(prev => {
      if (!prev) return prev;

      const custoTotalPorHora = mantenedoresSelecionados.reduce((sum, mant) => sum + (parseFloat(mant.custo_hora) || 0), 0);
      return {
        ...prev,
        mantenedores: mantenedoresSelecionados,
        // Mantido cálculo original; ServicoModal é esperado para calcular total_horas e valor_total
        valor_total: (prev.total_horas || 0) * custoTotalPorHora 
      };
    });
    setShowMantenedorSelector(false);
  };

  const updateMaterial = (index, field, value) => {
    const newMateriais = [...(formData.materiais || [])];
    const currentMaterial = { ...newMateriais[index] };

    if (field === 'quantidade') {
      const numericValue = String(value).replace(',', '.');
      currentMaterial[field] = numericValue;
    } else {
      currentMaterial[field] = value;
    }

    const quantidade = parseFloat(String(currentMaterial.quantidade || 0).replace(',', '.')) || 0;
    const custoUnitario = parseFloat(currentMaterial.custo_unitario || 0) || 0;
    currentMaterial.custo_total = quantidade * custoUnitario;
    
    newMateriais[index] = currentMaterial;
    setFormData(prev => ({ ...prev, materiais: newMateriais }));
  };

  const removeMaterial = (index) => {
    setFormData(prev => ({
      ...prev,
      materiais: (prev.materiais || []).filter((_, i) => i !== index)
    }));
  };

  const handleAddMaterialsFromSelector = (selectedRawMaterials) => {
    try {
      if (!Array.isArray(selectedRawMaterials)) {
        console.error("selectedRawMaterials deve ser um array");
        setError("Erro ao adicionar materiais: dados inválidos.");
        return;
      }

      const newMaterialsForForm = selectedRawMaterials.map(mat => {
        if (!mat?.id) {
          console.warn("Material sem ID encontrado:", mat);
          return null;
        }

        return {
          id: Date.now() + Math.random(),
          material_id: String(mat.id),
          codigo: mat.codigo || '',
          nome: mat.nome || '',
          unidade: mat.unidade_medida || '',
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
      setError("Erro ao adicionar materiais selecionados. Verifique o console para mais detalhes.");
    }
  };

  const addImagesToMaterial = async (materialIndex, list) => {
    const newMateriais = [...(formData.materiais || [])];
    newMateriais[materialIndex] = {
      ...newMateriais[materialIndex],
      anexos: list
    };
    setFormData(prev => ({ ...prev, materiais: newMateriais }));
  };

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
    if (editingTerceirizadoIndex !== null) {
      const newTerceirizados = [...(formData.terceirizados || [])];
      newTerceirizados[editingTerceirizadoIndex] = terceirizadoData;
      setFormData(prev => ({ ...prev, terceirizados: newTerceirizados }));
    } else {
      setFormData(prev => ({
        ...prev,
        terceirizados: [...(prev.terceirizados || []), terceirizadoData]
      }));
    }
    setShowTerceirizadoModal(false);
    setEditingTerceirizado(null);
    setEditingTerceirizadoIndex(null);
  };

  const removeTerceirizado = (index) => {
    setFormData(prev => ({
      ...prev,
      terceirizados: (prev.terceirizados || []).filter((_, i) => i !== index)
    }));
  };

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
    setFormData(prev => ({
      ...prev,
      outros: (prev.outros || []).filter((_, i) => i !== index)
    }));
  };

  const calcularTempoParado = () => {
    if (formData.maquina_parada === false && formData.tempo_parada_manual) {
      return parseInt(formData.tempo_parada_manual) || 0;
    }

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

  const calcularTotais = () => {
    const valorTotalServicos = (formData.servicos || []).reduce((sum, s) => sum + (parseFloat(s.valor_total) || 0), 0);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.equipamentos || formData.equipamentos.length === 0) {
      setError("Selecione pelo menos um equipamento, conjunto ou componente.");
      return;
    }
    if (!formData.tipo_id) {
      setError("Tipo de manutenção é obrigatório");
      return;
    }
    if (!formData.status_id) {
      setError("Status é obrigatório");
      return;
    }
    if (formData.maquina_parada === null) {
      setError("Informe se a máquina realmente parou com o defeito.");
      return;
    }
    if (
      formData.data_programada
      && formData.data_prazo
      && new Date(`${formData.data_prazo}T${formData.hora_prazo || "23:59"}`)
        < new Date(`${formData.data_programada}T${formData.hora_programada || "00:00"}`)
    ) {
      setError("O prazo da OS não pode ser anterior ao agendamento.");
      return;
    }

    setSaving(true);

    try {
      const totais = calcularTotais();
      const tempoParadoMinutos = calcularTempoParado();

      const materiaisNormalizados = (formData.materiais || []).map(material => ({
        material_id: String(material.material_id),
        codigo: material.codigo || '',
        nome: material.nome || '',
        unidade: material.unidade || '',
        custo_unitario: parseFloat(material.custo_unitario) || 0,
        quantidade: parseFloat(String(material.quantidade || 0).replace(',', '.')) || 0,
        custo_total: parseFloat(material.custo_total) || 0,
        anexos: (material.anexos || []).map(a => ({
          url: a.url, nome: a.nome || "", tipo: a.tipo || "", tamanho: a.tamanho || 0
        }))
      }));

      const servicosNormalizados = (formData.servicos || []).map(servico => ({
        mantenedores: (servico.mantenedores || []).map(m => ({
          mantenedor_id: String(m.id),
          mantenedor_nome: m.nome,
          custo_hora: parseFloat(m.custo_hora || 0)
        })),
        data_inicio: servico.data_inicio || '',
        hora_inicio: servico.hora_inicio || '',
        data_fim: servico.data_fim || servico.data_inicio || '',
        hora_fim: servico.hora_fim || '',
        defeito_identificado: servico.defeito_identificado || '',
        atividade: servico.atividade || '',
        total_horas: parseFloat(servico.total_horas) || 0,
        valor_total: parseFloat(servico.valor_total) || 0,
        horas_por_mantenedor: servico.horas_por_mantenedor || {},
        anexos: (servico.anexos || []).map(a => ({
          url: a.url, nome: a.nome || "", tipo: a.tipo || "", tamanho: a.tamanho || 0
        }))
      }));

      const terceirizadosNormalizados = (formData.terceirizados || []).map(terceirizado => ({
        prestadora_id: String(terceirizado.prestadora_id || ''),
        prestadora_nome: terceirizado.prestadora_nome || '',
        centro_custo_id: String(terceirizado.centro_custo_id || ''),
        centro_custo_nome: terceirizado.centro_custo_nome || '',
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
      } else if (formData.equipamentos[0]?.localizacao) {
        // Fallback para a localização do primeiro equipamento, se houver
        localFormatado = formData.equipamentos[0].localizacao;
      }

      const osData = {
        numero: formData.numero,
        equipamento_id: String(formData.equipamentos[0]?.equipamento_id || ''),
        equipamento_nome: formData.equipamentos[0]?.equipamento_nome || '',
        equipamentos: formData.equipamentos.map(eq => ({
          equipamento_id: String(eq.equipamento_id),
          equipamento_nome: eq.equipamento_nome,
          equipamento_codigo: eq.equipamento_codigo || '',
          localizacao: eq.localizacao || '',
          nivel: eq.nivel || 3,
          hierarquia: eq.hierarquia.map(h => ({
            id: String(h.id),
            codigo: h.codigo || '',
            descricao: h.descricao || ''
          })),
          hierarquia_texto: eq.hierarquia_texto || ''
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
        data_prazo: formData.data_prazo || '',
        hora_prazo: formData.hora_prazo || '',
        responsavel_id: String(formData.responsavel_id || ''),
        responsavel_nome: formData.responsavel_nome || '',
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

      await appApi.entities.OrdemServico.create(osData);
      navigate(createPageUrl("OrdemServico"));
    } catch (error) {
      console.error("Erro ao criar ordem de serviço:", error);
      setError("Erro ao criar ordem de serviço. Verifique os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const totais = calcularTotais();
  const tempoParado = calcularTempoParado();
  const maquinaParadaValue = formData.maquina_parada === true ? "sim" : formData.maquina_parada === false ? "nao" : "";

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-3">
        <ModuleLabel>Nova OS</ModuleLabel>
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl("OrdemServico"))}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="solicitacao" className="space-y-3 sm:space-y-4">
          <TabsList className="grid w-full grid-cols-5 bg-slate-100">
            <TabsTrigger value="solicitacao">Solicitação</TabsTrigger>
            <TabsTrigger value="servicos">Serviços</TabsTrigger>
            <TabsTrigger value="materiais">Materiais</TabsTrigger>
            <TabsTrigger value="terceirizados">Terceirizados</TabsTrigger>
            <TabsTrigger value="outros">Outros</TabsTrigger>
          </TabsList>

          <TabsContent value="solicitacao">
            <div className="space-y-6">
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
                      <RelatedEntitySelect
                        value={formData.prioridade_id}
                        onChange={handlePrioridadeChange}
                        options={prioridades || []}
                        optionLabel={(prioridade) => (
                          <div className="flex items-center gap-2">
                            {prioridade.cor && (
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: prioridade.cor }}
                              ></div>
                            )}
                            {prioridade.descricao}
                          </div>
                        )}
                        optionValue="id"
                        placeholder="Selecione a prioridade"
                        createButtonLabel="Nova prioridade"
                        modalTitle="Nova prioridade"
                        createForm={({ formData: quickData, setFormData: setQuickData, disabled }) => (
                          <QuickCreateFields
                            fields={prioridadeQuickCreateFields}
                            formData={quickData}
                            setFormData={setQuickData}
                            disabled={disabled}
                          />
                        )}
                        onCreate={handleCreatePrioridade}
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">
                        Status <span className="text-red-500">*</span>
                      </Label>
                      <RelatedEntitySelect
                        value={formData.status_id}
                        onChange={handleStatusChange}
                        options={statusList || []}
                        optionLabel="descricao"
                        optionValue="id"
                        placeholder="Selecione o status"
                        createButtonLabel="Novo status"
                        modalTitle="Novo status"
                        createForm={({ formData: quickData, setFormData: setQuickData, disabled }) => (
                          <QuickCreateFields
                            fields={descricaoQuickCreateFields}
                            formData={quickData}
                            setFormData={setQuickData}
                            disabled={disabled}
                          />
                        )}
                        onCreate={(data) => createDescricaoEntity(appApi.entities.StatusOS, setStatusList, data)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="tipo">
                        Tipo de Manutenção <span className="text-red-500">*</span>
                      </Label>
                      <RelatedEntitySelect
                        value={formData.tipo_id}
                        onChange={handleTipoChange}
                        options={tipos || []}
                        optionLabel="descricao"
                        optionValue="id"
                        placeholder="Selecione o tipo"
                        createButtonLabel="Novo tipo"
                        modalTitle="Novo tipo de manutenção"
                        createForm={({ formData: quickData, setFormData: setQuickData, disabled }) => (
                          <QuickCreateFields
                            fields={descricaoQuickCreateFields}
                            formData={quickData}
                            setFormData={setQuickData}
                            disabled={disabled}
                          />
                        )}
                        onCreate={(data) => createDescricaoEntity(appApi.entities.TipoManutencao, setTipos, data)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="area">Área de Manutenção</Label>
                      <RelatedEntitySelect
                        value={formData.area_id}
                        onChange={handleAreaChange}
                        options={areas || []}
                        optionLabel="descricao"
                        optionValue="id"
                        placeholder="Selecione a área"
                        createButtonLabel="Nova área"
                        modalTitle="Nova área de manutenção"
                        createForm={({ formData: quickData, setFormData: setQuickData, disabled }) => (
                          <QuickCreateFields
                            fields={descricaoQuickCreateFields}
                            formData={quickData}
                            setFormData={setQuickData}
                            disabled={disabled}
                          />
                        )}
                        onCreate={(data) => createDescricaoEntity(appApi.entities.AreaManutencao, setAreas, data)}
                      />
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
                    {formData.equipamentos.length === 0 ? (
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
                              equipamento={eq}
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
                    {formData.equipamentos.length > 0 && (
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
                    <div>
                      <Label htmlFor="data_prazo">Data limite</Label>
                      <Input
                        id="data_prazo"
                        type="date"
                        value={formData.data_prazo}
                        onChange={(e) => setFormData(prev => ({ ...prev, data_prazo: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="hora_prazo">Hora limite</Label>
                      <Input
                        id="hora_prazo"
                        type="time"
                        value={formData.hora_prazo}
                        onChange={(e) => setFormData(prev => ({ ...prev, hora_prazo: e.target.value }))}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="responsavel_os">Responsável pela OS</Label>
                      <Select
                        value={formData.responsavel_id || "none"}
                        onValueChange={(value) => {
                          const selected = mantenedores.find((item) => String(item.id) === value);
                          setFormData(prev => ({
                            ...prev,
                            responsavel_id: value === "none" ? "" : value,
                            responsavel_nome: selected?.nome || "",
                          }));
                        }}
                      >
                        <SelectTrigger id="responsavel_os">
                          <SelectValue placeholder="Não atribuído" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não atribuído</SelectItem>
                          {mantenedores.map((item) => (
                            <SelectItem key={item.id} value={String(item.id)}>
                              {item.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

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
                      const tempoDisplay = (() => {
                        if (servico.total_horas) {
                          const hours = Math.floor(servico.total_horas);
                          const minutes = Math.round((servico.total_horas - hours) * 60);
                          const hhmmFormat = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                          return hhmmFormat;
                        }
                        return '-';
                      })();

                      const horasDetalhadas = servico.horas_por_mantenedor ? (
                        <div className="text-xs text-slate-600 mt-1 space-y-1">
                          {(servico.mantenedores || []).map(mant => {
                            const horas = servico.horas_por_mantenedor[mant.id];
                            if (horas) {
                              const horasNum = parseFloat(horas);
                              const h = Math.floor(horasNum);
                              const m = Math.round((horasNum - h) * 60);
                              const hhmmFormat = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                              return (
                                <div key={mant.id}>
                                  • {mant.nome || mant.mantenedor_nome}: {hhmmFormat}
                                </div>
                              );
                            }
                            return null;
                          })}
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
                                💰 Valor: {(servico.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-24">Código</TableHead>
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
                              <TableCell className="text-sm font-medium text-green-700">
                                {(material.custo_unitario || 0).toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL'
                                })}
                              </TableCell>
                              <TableCell className="text-sm font-bold text-green-700">
                                {(material.custo_total || 0).toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL'
                                })}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <ImageUploader
                                    value={material.anexos || []}
                                    onChange={(list) => addImagesToMaterial(index, list)}
                                    label="Adicionar imagens"
                                  />
                                </div>
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
                        Total Terceirizados: {totais.valorTotalTerceirizados.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                    Nenhum item adicional. Clique em "Adicionar Item" para começar.
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
                              Total: {outro.custo_total.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL'
                              })}
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
                        Total Outros: {totais.valorTotalOutros.toLocaleString('pt-BR', {
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

        <div className="flex justify-end gap-3 pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(createPageUrl("OrdemServico"))}
            disabled={saving}
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar OS
              </>
            )}
          </Button>
        </div>
      </form>

      <ServicoModal
        isOpen={showServicoModal}
        onClose={() => {setShowServicoModal(false); setEditingServico(null); setEditingServicoIndex(null);}}
        servico={editingServico}
        onSave={saveServico}
        mantenedores={mantenedores}
        onSelectMantenedores={handleMantenedorSelectorForModal}
      />

      <TerceirizadoModal
        isOpen={showTerceirizadoModal}
        onClose={() => {setShowTerceirizadoModal(false); setEditingTerceirizado(null); setEditingTerceirizadoIndex(null);}}
        terceirizado={editingTerceirizado}
        onSave={saveTerceirizado}
        prestadoras={prestadoras}
        centrosCusto={centrosCusto || []}
        onPrestadorasChange={setPrestadoras}
        onCentrosCustoChange={setCentrosCusto}
      />

      <OutroModal
        isOpen={showOutroModal}
        onClose={() => {setShowOutroModal(false); setEditingOutro(null); setEditingOutroIndex(null);}}
        outro={editingOutro}
        onSave={saveOutro}
      />

      <EquipamentoSelector
        isOpen={showEquipamentoSelector}
        onClose={() => setShowEquipamentoSelector(false)}
        equipamentos={equipamentos || []}
        onSelectEquipamento={handleSelectEquipamentos}
        allowMultiple={true} // Allow multiple selection with hierarchy
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
        selectedMantenedores={editingServico?.mantenedores || []}
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
