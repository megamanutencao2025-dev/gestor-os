import React, { useState, useEffect } from "react";
import { appApi } from "@/api/appClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save, X, ArrowLeft, Trash2, FileText, Edit, Building2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import EquipamentoSelector from "../components/EquipamentoSelector";
import TerceirizadoModal from "../components/modals/TerceirizadoModal";
import EquipamentoCard from "../components/ordens/EquipamentoCard";
import { format } from "date-fns";
import QuickCreateFields from "@/components/quick-create/QuickCreateFields";
import ModuleLabel from "@/components/ModuleLabel";
import { sortByText, upsertCreatedOption, validateQuickCreateFields } from "@/utils/quickCreate";

const equipamentoBaseQuickCreateFields = [
  { name: "codigo", label: "Código", required: true, placeholder: "Código do equipamento" },
  { name: "descricao", label: "Descrição", required: true, placeholder: "Descrição do equipamento" },
];

export default function NovaOSTerceirizado() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const osId = urlParams.get('id');

  const [equipamentos, setEquipamentos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [prestadoras, setPrestadoras] = useState([]);
  const [centrosCusto, setCentrosCusto] = useState([]);
  const [localizacoes, setLocalizacoes] = useState([]);

  const [formData, setFormData] = useState({
    numero: '',
    equipamento_id: '',
    equipamento_nome: '',
    equipamentos: [],
    localizacao_celula: '',
    localizacao_setor: '',
    tipo_id: '',
    tipo_nome: '',
    status_id: '',
    status_nome: '',
    observacoes: '',
    descricao_defeito: '',
    terceirizados: []
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEquipamentoSelector, setShowEquipamentoSelector] = useState(false);
  
  const [showTerceirizadoModal, setShowTerceirizadoModal] = useState(false);
  const [editingTerceirizado, setEditingTerceirizado] = useState(null);
  const [editingTerceirizadoIndex, setEditingTerceirizadoIndex] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [equipData, tiposData, statusData, prestData, centrosCustoData, localizacoesData, allOS] = await Promise.all([
          appApi.entities.Equipamento.list(),
          appApi.entities.TipoManutencao.list(),
          appApi.entities.StatusOS.list(),
          appApi.entities.PrestadoraServico.list(),
          appApi.entities.CentroCusto.list(),
          appApi.entities.Localizacao.list(),
          appApi.entities.OrdemServico.list('-created_date')
        ]);

        setEquipamentos((equipData || []).sort((a, b) => (a?.descricao || '').localeCompare(b?.descricao || '')));
        setTipos((tiposData || []).sort((a, b) => (a?.descricao || '').localeCompare(b?.descricao || '')));
        setStatusList((statusData || []).sort((a, b) => (a?.descricao || '').localeCompare(b?.descricao || '')));
        setPrestadoras((prestData || []).sort((a, b) => (a?.nome_empresa || '').localeCompare(b?.nome_empresa || '')));
        setCentrosCusto((centrosCustoData || []).sort((a, b) => (a?.descricao || '').localeCompare(b?.descricao || '')));
        setLocalizacoes((localizacoesData || []).sort((a, b) => (a?.descricao || '').localeCompare(b?.descricao || '')));
        
        // Se está editando, carregar dados da OS
        if (osId) {
          const osData = await appApi.entities.OrdemServico.get(osId);
          
          setFormData({
            numero: osData.numero || '',
            equipamento_id: osData.equipamento_id || '',
            equipamento_nome: osData.equipamento_nome || '',
            equipamentos: osData.equipamentos || [],
            localizacao_celula: osData.localizacao_celula || '',
            localizacao_setor: osData.localizacao_setor || '',
            tipo_id: osData.tipo_id || '',
            tipo_nome: osData.tipo_nome || '',
            status_id: osData.status_id || '',
            status_nome: osData.status_nome || '',
            observacoes: osData.observacoes || '',
            descricao_defeito: osData.descricao_defeito || '',
            terceirizados: osData.terceirizados || []
          });
        } else {
          // Modo criação - gerar número e definir padrões
          generateOSNumber(allOS || []);
          
          const tipoTerceirizado = (tiposData || []).find(t => t.descricao?.toLowerCase().includes('terceirizado'));
          const statusAberto = (statusData || []).find(s => s.descricao?.toLowerCase().includes('aberto') || s.descricao?.toLowerCase().includes('pendente'));
          
          if (tipoTerceirizado) {
            setFormData(prev => ({
              ...prev,
              tipo_id: tipoTerceirizado.id,
              tipo_nome: tipoTerceirizado.descricao
            }));
          }
          
          if (statusAberto) {
            setFormData(prev => ({
              ...prev,
              status_id: statusAberto.id,
              status_nome: statusAberto.descricao
            }));
          }
        }
      } catch (error) {
        setError("Erro ao carregar dados de referência");
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [osId]);

  const equipamentoQuickCreateFields = React.useMemo(() => [
    ...equipamentoBaseQuickCreateFields,
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
    setEquipamentos(prev => sortByText(upsertCreatedOption(prev, created), (item) => item.descricao || ""));
    return created;
  };

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
      localizacao: eq.localizacao || '',
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
      equipamento_id: novosEquipamentos[0]?.equipamento_id || '',
      equipamento_nome: novosEquipamentos[0]?.equipamento_nome || '',
      localizacao_celula: novosEquipamentos.length === 0 ? '' : prev.localizacao_celula,
      localizacao_setor: novosEquipamentos.length === 0 ? '' : prev.localizacao_setor,
    }));
  };

  const addTerceirizado = () => {
    const novoTerceirizado = {
      id: Date.now(),
      prestadora_id: '',
      prestadora_nome: '',
      data_servico: format(new Date(), 'yyyy-MM-dd'),
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validações
    if (!formData.equipamentos || formData.equipamentos.length === 0) {
      setError("Selecione pelo menos um equipamento.");
      return;
    }
    
    if (!formData.descricao_defeito?.trim()) {
      setError("Descrição do problema é obrigatória");
      return;
    }

    if (!formData.terceirizados || formData.terceirizados.length === 0) {
      setError("Adicione pelo menos um serviço terceirizado");
      return;
    }

    // Validar cada terceirizado
    for (let i = 0; i < formData.terceirizados.length; i++) {
      const terc = formData.terceirizados[i];
      if (!terc.prestadora_id) {
        setError(`Serviço terceirizado #${i + 1}: Selecione uma prestadora`);
        return;
      }
      if (!terc.descricao_servico?.trim()) {
        setError(`Serviço terceirizado #${i + 1}: Descrição é obrigatória`);
        return;
      }
      if (!terc.data_servico) {
        setError(`Serviço terceirizado #${i + 1}: Data do serviço é obrigatória`);
        return;
      }
    }

    setSaving(true);

    try {
      const terceirizadosNormalizados = (formData.terceirizados || []).map(terceirizado => ({
        prestadora_id: String(terceirizado.prestadora_id || ''),
        prestadora_nome: terceirizado.prestadora_nome || '',
        data_servico: terceirizado.data_servico || '',
        descricao_servico: terceirizado.descricao_servico || '',
        valor_servico: parseFloat(terceirizado.valor_servico) || 0,
        centro_custo_id: String(terceirizado.centro_custo_id || ''),
        centro_custo_nome: terceirizado.centro_custo_nome || '',
        anexos: (terceirizado.anexos || []).map(a => ({
          url: a.url, nome: a.nome || "", tipo: a.tipo || "", tamanho: a.tamanho || 0
        })),
        documentos: (terceirizado.documentos || []).map(d => ({
          url: d.url, nome: d.nome || "", tipo: d.tipo || "", tamanho: d.tamanho || 0
        }))
      }));

      const valorTotalTerceirizados = terceirizadosNormalizados.reduce((sum, t) => sum + (parseFloat(t.valor_servico) || 0), 0);

      // Montar o campo 'local' concatenando célula e setor
      let localFormatado = '';
      if (formData.localizacao_celula && formData.localizacao_setor) {
        localFormatado = `${formData.localizacao_celula} - ${formData.localizacao_setor}`;
      } else if (formData.localizacao_celula) {
        localFormatado = formData.localizacao_celula;
      } else if (formData.localizacao_setor) {
        localFormatado = formData.localizacao_setor;
      } else if (formData.equipamentos[0]?.localizacao) {
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
        local: localFormatado,
        localizacao_celula: formData.localizacao_celula || '',
        localizacao_setor: formData.localizacao_setor || '',
        tipo_id: String(formData.tipo_id),
        tipo_nome: formData.tipo_nome,
        status_id: String(formData.status_id),
        status_nome: formData.status_nome,
        observacoes: formData.observacoes || '',
        descricao_defeito: formData.descricao_defeito || '',
        terceirizados: terceirizadosNormalizados,
        valor_total_terceirizados: valorTotalTerceirizados,
        valor_total_geral: valorTotalTerceirizados,
        // Outros campos vazios
        servicos: [],
        materiais: [],
        outros: [],
        valor_total_servicos: 0,
        valor_total_materiais: 0,
        valor_total_outros: 0,
        maquina_parada: false,
        tempo_parado_em_minutos: 0
      };

      if (osId) {
        await appApi.entities.OrdemServico.update(osId, osData);
      } else {
        await appApi.entities.OrdemServico.create(osData);
      }
      navigate(createPageUrl("OrdemServico"));
    } catch (error) {
      console.error("Erro ao criar ordem de serviço:", error);
      setError("Erro ao criar ordem de serviço. Verifique os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

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
        <ModuleLabel>{osId ? 'Editar' : 'Registrar'} Serviços Terceirizados</ModuleLabel>
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
        <Tabs defaultValue="solicitacao" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-slate-100">
            <TabsTrigger value="solicitacao">Solicitação</TabsTrigger>
            <TabsTrigger value="terceirizados">Terceirizados</TabsTrigger>
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
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="numero">Número da OS</Label>
                      <Input
                        id="numero"
                        value={formData.numero}
                        readOnly
                        className="bg-slate-50"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-0 bg-white">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="w-5 h-5 text-orange-600" />
                    Equipamentos <span className="text-red-500">*</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
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
                    <FileText className="w-5 h-5 text-slate-600" />
                    Descrição do Problema
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="descricao_defeito">
                      Descrição do Problema <span className="text-red-500">*</span>
                    </Label>
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

          <TabsContent value="terceirizados">
            <Card className="shadow-sm border-0 bg-white">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Serviços Terceirizados</CardTitle>
                    <p className="text-sm text-slate-600 mt-1">Adicione os serviços prestados por empresas terceirizadas</p>
                  </div>
                  <Button type="button" onClick={addTerceirizado} className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Terceirizado
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(formData.terceirizados || []).length === 0 ? (
                  <div className="text-center py-16 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg">
                    <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 mb-4">Nenhum serviço terceirizado adicionado</p>
                    <Button type="button" onClick={addTerceirizado} className="bg-purple-600 hover:bg-purple-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Primeiro Serviço
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader className="bg-slate-100">
                          <TableRow>
                            <TableHead className="font-semibold">Prestadora</TableHead>
                            <TableHead className="font-semibold">Data</TableHead>
                            <TableHead className="font-semibold">Descrição</TableHead>
                            <TableHead className="font-semibold text-right">Valor</TableHead>
                            <TableHead className="w-24">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(formData.terceirizados || []).map((terceirizado, index) => (
                            <TableRow key={terceirizado.id} className="hover:bg-slate-50">
                              <TableCell className="font-medium">{terceirizado.prestadora_nome || '-'}</TableCell>
                              <TableCell>{terceirizado.data_servico ? new Date(terceirizado.data_servico + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</TableCell>
                              <TableCell className="text-sm text-slate-600 max-w-md truncate">
                                {terceirizado.descricao_servico || '-'}
                              </TableCell>
                              <TableCell className="text-right font-bold text-purple-700">
                                {(parseFloat(terceirizado.valor_servico) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => editTerceirizado(terceirizado, index)}
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeTerceirizado(index)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex justify-end pt-4 border-t">
                      <div className="text-right">
                        <p className="text-sm text-slate-600">Total de Terceirizados</p>
                        <p className="text-2xl font-bold text-purple-700">
                          {((formData.terceirizados || []).reduce((sum, t) => sum + (parseFloat(t.valor_servico) || 0), 0)).toLocaleString('pt-BR', {
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
                {osId ? 'Atualizar' : 'Salvar'} OS
              </>
            )}
          </Button>
        </div>
      </form>

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

      <EquipamentoSelector
        isOpen={showEquipamentoSelector}
        onClose={() => setShowEquipamentoSelector(false)}
        equipamentos={equipamentos || []}
        onSelectEquipamento={handleSelectEquipamentos}
        allowMultiple={true}
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
    </div>
  );
}
