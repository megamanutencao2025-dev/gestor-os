
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, X, Trash2, AlertCircle, Settings, FileText, MapPin } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { appApi } from "@/api/appClient";
import ModuleLabel from "@/components/ModuleLabel";
import EquipamentoSelector from "../components/EquipamentoSelector";

export default function PlanejamentoManutencao() {
  const [equipamentos, setEquipamentos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedEquipamentos, setSelectedEquipamentos] = useState([]);
  const [showEquipamentoSelector, setShowEquipamentoSelector] = useState(false);
  const [formData, setFormData] = useState({
    tipo_id: '',
    tipo_nome: '',
    status_id: '',
    status_nome: '',
    area_id: '',
    area_nome: '',
    solicitante: '',
    data_programada: '',
    hora_programada: '',
    observacoes: '',
    descricao_defeito: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [equipData, tiposData, statusData, areasData] = await Promise.all([
        appApi.entities.Equipamento.list(),
        appApi.entities.TipoManutencao.list(),
        appApi.entities.StatusOS.list(),
        appApi.entities.AreaManutencao.list()
      ]);

      setEquipamentos(equipData);
      setTipos(tiposData);
      setStatusList(statusData);
      setAreas(areasData);
    } catch (error) {
      setError("Erro ao carregar dados de referência");
    } finally {
      setLoading(false);
    }
  };

  const handleTipoChange = (tipoId) => {
    const tipo = tipos.find(t => t.id === tipoId);
    setFormData(prev => ({ ...prev, tipo_id: tipoId, tipo_nome: tipo?.descricao || '' }));
  };

  const handleStatusChange = (statusId) => {
    const status = statusList.find(s => s.id === statusId);
    setFormData(prev => ({ ...prev, status_id: statusId, status_nome: status?.descricao || '' }));
  };

  const handleAreaChange = (areaId) => {
    const area = areas.find(a => a.id === areaId);
    setFormData(prev => ({ ...prev, area_id: areaId, area_nome: area?.descricao || '' }));
  };

  const handleSelectEquipamentos = (equipamentosSelecionados) => {
    // Recebe um array de equipamentos
    const equipamentosComLocalizacao = equipamentosSelecionados.map(eq => ({
      id: eq.id,
      codigo: eq.codigo,
      descricao: eq.descricao,
      localizacao_celula: eq.localizacao_celula || '',
      localizacao_setor: eq.localizacao_setor || '',
      localizacao: eq.localizacao_celula && eq.localizacao_setor 
        ? `${eq.localizacao_celula} - ${eq.localizacao_setor}` 
        : (eq.localizacao_celula || eq.localizacao_setor || '')
    }));
    
    setSelectedEquipamentos(equipamentosComLocalizacao);
    setShowEquipamentoSelector(false);
  };

  const removeEquipamento = (equipamentoId) => {
    setSelectedEquipamentos(prev => prev.filter(eq => eq.id !== equipamentoId));
  };

  const generateOSNumbers = async (count) => {
    const allOS = await appApi.entities.OrdemServico.list('-created_date');
    let nextNumber = 1;
    
    if (allOS && allOS.length > 0) {
      const latestOSNumber = allOS
        .map(os => {
          const match = os.numero?.match(/^OS-(\d+)$/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(num => num > 0)
        .sort((a, b) => b - a)[0];

      if (latestOSNumber) {
        nextNumber = latestOSNumber + 1;
      }
    }

    const numbers = [];
    for (let i = 0; i < count; i++) {
      numbers.push(`OS-${String(nextNumber + i).padStart(3, '0')}`);
    }
    return numbers;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.tipo_id || !formData.status_id || selectedEquipamentos.length === 0) {
      setError("Tipo de manutenção, status e pelo menos um equipamento são obrigatórios");
      return;
    }

    setSaving(true);

    try {
      const osNumbers = await generateOSNumbers(selectedEquipamentos.length);
      const ordensToCreate = [];

      selectedEquipamentos.forEach((equipamento, index) => {
        const celula = equipamento.localizacao_celula || '';
        const setor = equipamento.localizacao_setor || '';
        const localCompleto = celula && setor ? `${celula} - ${setor}` : (celula || setor || '');

        ordensToCreate.push({
          numero: osNumbers[index],
          equipamento_id: equipamento.id,
          equipamento_nome: equipamento.descricao,
          equipamentos: [{
            equipamento_id: equipamento.id,
            equipamento_nome: equipamento.descricao,
            localizacao: equipamento.localizacao || ''
          }],
          local: localCompleto,
          localizacao_celula: celula,
          localizacao_setor: setor,
          tipo_id: formData.tipo_id,
          tipo_nome: formData.tipo_nome,
          status_id: formData.status_id,
          status_nome: formData.status_nome,
          area_id: formData.area_id,
          area_nome: formData.area_nome,
          solicitante: formData.solicitante,
          data_programada: formData.data_programada,
          hora_programada: formData.hora_programada,
          observacoes: formData.observacoes,
          descricao_defeito: formData.descricao_defeito,
          servicos: [],
          materiais: [],
          outros: [],
          terceirizados: [],
          valor_total_servicos: 0,
          valor_total_materiais: 0,
          valor_total_outros: 0,
          valor_total_terceirizados: 0,
          valor_total_geral: 0
        });
      });

      await appApi.entities.OrdemServico.bulkCreate(ordensToCreate);
      
      setSuccess(`${ordensToCreate.length} ordens de serviço criadas com sucesso!`);
      
      // Limpar formulário
      setFormData({
        tipo_id: '',
        tipo_nome: '',
        status_id: '',
        status_nome: '',
        area_id: '',
        area_nome: '',
        solicitante: '',
        data_programada: '',
        hora_programada: '',
        observacoes: '',
        descricao_defeito: ''
      });
      setSelectedEquipamentos([]);

    } catch (error) {
      console.error("Erro ao criar ordens de serviço:", error);
      setError("Erro ao criar ordens de serviço. Verifique os dados e tente novamente.");
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
      <ModuleLabel>Planejamento</ModuleLabel>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 text-green-900 border-green-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
        <div className="rounded-lg border bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="px-3 py-1.5">
                {selectedEquipamentos.length} equipamento{selectedEquipamentos.length === 1 ? '' : 's'}
              </Badge>
              <span className="text-sm text-slate-600">
                Tipo e status são obrigatórios para gerar as OS.
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedEquipamentos([]);
                  setFormData({
                    tipo_id: '',
                    tipo_nome: '',
                    status_id: '',
                    status_nome: '',
                    area_id: '',
                    area_nome: '',
                    solicitante: '',
                    data_programada: '',
                    hora_programada: '',
                    observacoes: '',
                    descricao_defeito: ''
                  });
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Limpar
              </Button>
              <Button 
                type="submit" 
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={saving || selectedEquipamentos.length === 0}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Criando OS...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Criar {selectedEquipamentos.length} OS
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Dados Comuns das OS */}
          <div>
            <Card className="rounded-lg border bg-white shadow-sm">
              <CardHeader className="p-4 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Dados Comuns das OS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tipo">
                      Tipo de Manutenção <span className="text-red-500">*</span>
                    </Label>
                    <Select value={formData.tipo_id} onValueChange={handleTipoChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {tipos.map(tipo => (
                          <SelectItem key={tipo.id} value={tipo.id}>
                            {tipo.descricao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="status">
                      Status <span className="text-red-500">*</span>
                    </Label>
                    <Select value={formData.status_id} onValueChange={handleStatusChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusList.map(status => (
                          <SelectItem key={status.id} value={status.id}>
                            {status.descricao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="area">Área de Manutenção</Label>
                    <Select value={formData.area_id} onValueChange={handleAreaChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a área" />
                      </SelectTrigger>
                      <SelectContent>
                        {areas.map(area => (
                          <SelectItem key={area.id} value={area.id}>
                            {area.descricao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

                <div>
                  <Label htmlFor="descricao_defeito">Descrição do Defeito/Manutenção</Label>
                  <Textarea
                    id="descricao_defeito"
                    value={formData.descricao_defeito}
                    onChange={(e) => setFormData(prev => ({ ...prev, descricao_defeito: e.target.value }))}
                    placeholder="Descreva o problema ou manutenção a ser realizada..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                    placeholder="Observações gerais..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Seleção de Equipamentos */}
          <div>
            <Card className="rounded-lg border bg-white shadow-sm">
              <CardHeader className="p-4 pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings className="w-5 h-5 text-orange-600" />
                    Equipamentos
                    {selectedEquipamentos.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {selectedEquipamentos.length} selecionados
                      </Badge>
                    )}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-4">
                  {/* Botão de Seleção */}
                  <Button
                    type="button"
                    onClick={() => setShowEquipamentoSelector(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white justify-center"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {selectedEquipamentos.length > 0 ? 'Adicionar Mais Equipamentos' : 'Selecionar Equipamentos'}
                  </Button>

                  {/* Lista de Equipamentos Selecionados */}
                  {selectedEquipamentos.length > 0 && (
                    <div className="border rounded-lg">
                      <ScrollArea className="h-[360px]">
                        <div className="divide-y">
                          {selectedEquipamentos.map(eq => (
                            <div key={eq.id} className="p-3 hover:bg-slate-50 transition-colors">
                              <div className="flex items-start gap-3">
                                <Settings className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-slate-900 truncate">
                                        {eq.codigo && <span className="text-blue-600 font-mono">{eq.codigo}</span>}
                                        {eq.codigo && ' - '}
                                        {eq.descricao}
                                      </p>
                                      {eq.localizacao && (
                                        <p className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                                          <MapPin className="w-3 h-3" />
                                          {eq.localizacao}
                                        </p>
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeEquipamento(eq.id)}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-100 flex-shrink-0"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {selectedEquipamentos.length === 0 && (
                    <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-lg">
                      <Settings className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p className="text-sm">Nenhum equipamento selecionado</p>
                      <p className="text-xs mt-1">Clique no botão acima para selecionar</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>

      <EquipamentoSelector
        isOpen={showEquipamentoSelector}
        onClose={() => setShowEquipamentoSelector(false)}
        equipamentos={equipamentos}
        onSelectEquipamento={handleSelectEquipamentos}
        allowMultiple={true}
      />
    </div>
  );
}
