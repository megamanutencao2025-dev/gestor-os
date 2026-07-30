import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Save, X, Clock, Calendar } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ImageUploader from "../attachments/ImageUploader";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea"; // Added import for Textarea
import DurationInput from "../ui/DurationInput"; // Added import

export default function ServicoModal({ isOpen, onClose, servico, onSave, mantenedores, onSelectMantenedores }) {
  const [formData, setFormData] = useState({});
  const [error, setError] = useState("");
  const [modoApontamento, setModoApontamento] = useState("horarios"); // "horarios" ou "horas_diretas"
  const [horasIndividualizadas, setHorasIndividualizadas] = useState(false);
  const [horasParaTodos, setHorasParaTodos] = useState("");
  const [horasPorMantenedor, setHorasPorMantenedor] = useState({});

  useEffect(() => {
    if (isOpen && servico) {
      setFormData({ ...servico });
      setError("");
      setHorasIndividualizadas(false); // Reset to default on open
      setHorasParaTodos(""); // Reset
      setHorasPorMantenedor({}); // Reset
      
      // Detectar modo de apontamento baseado nos dados existentes
      if (servico.data_inicio && servico.hora_inicio && servico.hora_fim) {
        setModoApontamento("horarios");
      } else if (servico.total_horas || servico.horas_por_mantenedor) {
        setModoApontamento("horas_diretas");
        
        // Verificar se tem horas individualizadas
        if (servico.horas_por_mantenedor && Object.keys(servico.horas_por_mantenedor).length > 0) {
          setHorasIndividualizadas(true);
          // Converter para string para o DurationInput
          const horasConvertidas = {};
          Object.entries(servico.horas_por_mantenedor).forEach(([id, horas]) => {
            horasConvertidas[id] = String(horas);
          });
          setHorasPorMantenedor(horasConvertidas);
        } else if (servico.total_horas) {
          setHorasIndividualizadas(false);
          setHorasParaTodos(String(servico.total_horas));
        }
      } else {
        // Default to horarios if no specific hour data is present
        setModoApontamento("horarios");
      }
    }
  }, [isOpen, servico]);

  // Converter horas decimais para formato HH:MM
  const decimalToHHMM = (decimal) => {
    if (isNaN(decimal) || decimal < 0) return "00:00";
    const hours = Math.floor(decimal);
    const minutes = Math.round((decimal - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  // Converter formato HH:MM ou decimal para número
  const parseHorasInput = (input) => {
    if (!input) return 0;
    
    const str = String(input).trim();
    
    // Formato HH:MM
    if (str.includes(':')) {
      const [h, m] = str.split(':').map(n => parseInt(n) || 0);
      return h + (m / 60);
    }
    
    // Formato decimal (aceita vírgula ou ponto)
    return parseFloat(str.replace(',', '.')) || 0;
  };

  const handleSubmit = () => {
    setError("");

    if ((formData.mantenedores || []).length === 0) {
      setError("Selecione pelo menos um mantenedor");
      return;
    }

    let dataToSave = { ...formData };

    if (modoApontamento === "horarios") {
      // Modo tradicional - validar datas e horas
      if (!formData.data_inicio || !formData.hora_inicio || !formData.hora_fim) {
        setError("Data e horários são obrigatórios no modo de apontamento por horários");
        return;
      }

      // Calcular horas trabalhadas
      try {
        const inicio = new Date(`${formData.data_inicio}T${formData.hora_inicio}`);
        const fim = new Date(`${formData.data_inicio}T${formData.hora_fim}`);
        
        if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
          setError("Horários inválidos");
          return;
        }

        if (fim <= inicio) {
          setError("Hora fim deve ser posterior à hora início");
          return;
        }

        const diffHours = (fim - inicio) / (1000 * 60 * 60);
        const custoTotalPorHora = (formData.mantenedores || []).reduce(
          (sum, mant) => sum + (parseFloat(mant.custo_hora) || 0), 
          0
        );
        
        dataToSave.total_horas = diffHours;
        dataToSave.valor_total = diffHours * custoTotalPorHora;
        dataToSave.horas_por_mantenedor = null; // Clear individual hours if switching mode
        // Ensure other hora_fim related fields are cleared if they exist
        dataToSave.data_fim = null; 

      } catch (e) {
        setError("Erro ao calcular horas trabalhadas");
        return;
      }
    } else {
      // Modo horas diretas
      if (horasIndividualizadas) {
        // Validar que todos os mantenedores têm horas informadas
        const todasHorasInformadas = (formData.mantenedores || []).every(
          mant => {
            const mantId = String(mant.id || mant.mantenedor_id);
            const horas = horasPorMantenedor[mantId];
            return horas && parseHorasInput(horas) > 0;
          }
        );

        if (!todasHorasInformadas) {
          setError("Informe as horas trabalhadas para todos os mantenedores");
          return;
        }

        // Calcular valor total baseado nas horas individualizadas
        let valorTotal = 0;
        let totalHorasGeral = 0;
        const horasPorMantenedorSalvar = {}; // Store numeric values for saving
        
        (formData.mantenedores || []).forEach(mant => {
          const mantId = String(mant.id || mant.mantenedor_id);
          const horas = parseHorasInput(horasPorMantenedor[mantId]);
          const custo = parseFloat(mant.custo_hora) || 0;
          valorTotal += horas * custo;
          totalHorasGeral += horas;
          horasPorMantenedorSalvar[mantId] = horas; // Store numeric value
        });

        dataToSave.total_horas = totalHorasGeral;
        dataToSave.valor_total = valorTotal;
        dataToSave.horas_por_mantenedor = horasPorMantenedorSalvar;
        
        // Manter data_inicio, limpar apenas horários
        dataToSave.hora_inicio = null;
        dataToSave.data_fim = null;
        dataToSave.hora_fim = null;
      } else {
        // Mesmas horas para todos
        const horasTrabalhadas = parseHorasInput(horasParaTodos);
        
        if (horasTrabalhadas <= 0) {
          setError("Informe o total de horas trabalhadas");
          return;
        }

        const custoTotalPorHora = (formData.mantenedores || []).reduce(
          (sum, mant) => sum + (parseFloat(mant.custo_hora) || 0), 
          0
        );

        dataToSave.total_horas = horasTrabalhadas;
        dataToSave.valor_total = horasTrabalhadas * custoTotalPorHora;
        dataToSave.horas_por_mantenedor = null; // Clear individual hours
        
        // Manter data_inicio, limpar apenas horários
        dataToSave.hora_inicio = null;
        dataToSave.data_fim = null;
        dataToSave.hora_fim = null;
      }
    }

    console.log("Salvando serviço com dados:", dataToSave);
    onSave(dataToSave);
    onClose();
  };

  const updateMantenedorCustoHora = (mantenedorIndex, novoCusto) => {
    const newMantenedores = [...(formData.mantenedores || [])];
    newMantenedores[mantenedorIndex].custo_hora = parseFloat(novoCusto) || 0;
    setFormData(prev => ({ ...prev, mantenedores: newMantenedores }));
  };

  const updateField = (field, value) => {
    const updated = { ...formData, [field]: value };
    
    // Recalcular apenas se estiver no modo horários
    if (modoApontamento === "horarios" && (field === 'data_inicio' || field === 'hora_inicio' || field === 'hora_fim')) {
      if (updated.data_inicio && updated.hora_inicio && updated.hora_fim) {
        const inicio = new Date(`${updated.data_inicio}T${updated.hora_inicio}`);
        const fim = new Date(`${updated.data_inicio}T${updated.hora_fim}`);
        
        if (!isNaN(inicio.getTime()) && !isNaN(fim.getTime()) && fim > inicio) {
          const diffHours = (fim - inicio) / (1000 * 60 * 60);
          const custoTotalPorHora = (updated.mantenedores || []).reduce((sum, mant) => sum + (parseFloat(mant.custo_hora) || 0), 0);
          updated.total_horas = diffHours;
          updated.valor_total = diffHours * custoTotalPorHora;
        } else {
          updated.total_horas = 0;
          updated.valor_total = 0;
        }
      }
    }
    
    setFormData(updated);
  };

  const aplicarHorasParaTodos = () => {
    const horas = parseHorasInput(horasParaTodos);
    if (horas > 0) {
      const novasHoras = {};
      (formData.mantenedores || []).forEach(mant => {
        const mantId = String(mant.id || mant.mantenedor_id);
        novasHoras[mantId] = String(horas); // Store as string for DurationInput consistency
      });
      setHorasPorMantenedor(novasHoras);
    }
  };

  const calcularValorTotalHorasDiretas = () => {
    if (horasIndividualizadas) {
      let total = 0;
      (formData.mantenedores || []).forEach(mant => {
        const mantId = String(mant.id || mant.mantenedor_id);
        const horas = parseHorasInput(horasPorMantenedor[mantId] || "0"); // Parse from string state
        const custo = parseFloat(mant.custo_hora) || 0;
        total += horas * custo;
      });
      return total;
    } else {
      const horas = parseHorasInput(horasParaTodos);
      const custoTotalPorHora = (formData.mantenedores || []).reduce(
        (sum, mant) => sum + (parseFloat(mant.custo_hora) || 0), 
        0
      );
      return horas * custoTotalPorHora;
    }
  };

  const calcularTotalHorasDiretas = () => {
    if (horasIndividualizadas) {
      return (formData.mantenedores || []).reduce((sum, mant) => {
        const mantId = String(mant.id || mant.mantenedor_id);
        return sum + parseHorasInput(horasPorMantenedor[mantId] || "0"); // Parse from string state
      }, 0);
    } else {
      return parseHorasInput(horasParaTodos);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {servico?.id ? "Editar Serviço" : "Novo Serviço"}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Mantenedores */}
          <div>
            <Label className="mb-2 block">Mantenedores</Label>
            <div className="border rounded-lg p-3 bg-slate-50 space-y-3">
              {(formData.mantenedores || []).length === 0 ? (
                <p className="text-slate-500 text-sm">Nenhum mantenedor selecionado</p>
              ) : (
                <div className="space-y-2">
                  {(formData.mantenedores || []).map((mant, mantIndex) => (
                    <div key={mant.id || mantIndex} className="flex items-center gap-2 p-2 bg-white rounded border">
                      <div className="flex-1">
                        <span className="font-medium text-sm">{mant.nome || mant.mantenedor_nome}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">R$/h:</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={mant.custo_hora || 0}
                          onChange={(e) => updateMantenedorCustoHora(mantIndex, e.target.value)}
                          className="w-24 h-8 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSelectMantenedores(formData.mantenedores || [])}
              >
                <Plus className="w-3 h-3 mr-1" />
                {(formData.mantenedores || []).length === 0 ? 'Selecionar Mantenedores' : 'Alterar Mantenedores'}
              </Button>
            </div>
          </div>

          {/* Modo de Apontamento e Checkbox de Horas Individualizadas - LADO A LADO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Modo de Apontamento */}
            <div className="border rounded-lg p-4 bg-slate-50">
              <Label className="mb-3 block font-semibold">Modo de Apontamento de Horas</Label>
              <RadioGroup value={modoApontamento} onValueChange={setModoApontamento}>
                <div className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value="horarios" id="horarios" />
                  <Label htmlFor="horarios" className="cursor-pointer font-normal">
                    <Clock className="w-4 h-4 inline mr-2" />
                    Registrar por Data e Horários (Início e Fim)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="horas_diretas" id="horas_diretas" />
                  <Label htmlFor="horas_diretas" className="cursor-pointer font-normal">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Informar Total de Horas Diretamente
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Checkbox de Horas Individualizadas - Só aparece no modo horas_diretas */}
            {modoApontamento === "horas_diretas" && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <input
                    type="checkbox"
                    id="horas_individualizadas"
                    checked={horasIndividualizadas}
                    onChange={(e) => setHorasIndividualizadas(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="horas_individualizadas" className="cursor-pointer font-medium">
                    Informar horas diferentes para cada mantenedor
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {horasIndividualizadas 
                    ? "Você pode registrar tempos diferentes para cada trabalhador" 
                    : "Todas as pessoas trabalharão o mesmo total de horas"}
                </p>
              </div>
            )}
          </div>

          {/* Conteúdo baseado no modo */}
          {modoApontamento === "horarios" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Data do Serviço</Label>
                  <Input
                    type="date"
                    value={formData.data_inicio || ""}
                    onChange={(e) => updateField('data_inicio', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Hora Início</Label>
                  <Input
                    type="time"
                    value={formData.hora_inicio || ""}
                    onChange={(e) => updateField('hora_inicio', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Hora Fim</Label>
                  <Input
                    type="time"
                    value={formData.hora_fim || ""}
                    onChange={(e) => updateField('hora_fim', e.target.value)}
                  />
                </div>
              </div>

              {/* Totais calculados */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <Label className="text-xs text-blue-900">Total Horas</Label>
                  <div className="text-lg font-bold text-blue-700">
                    {(formData.total_horas || 0).toFixed(2)}h
                    {formData.total_horas > 0 && (
                      <span className="text-xs font-normal text-blue-600 ml-2">
                        ({decimalToHHMM(formData.total_horas)})
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-blue-900">Valor Total</Label>
                  <div className="text-lg font-bold text-green-700">
                    {(formData.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Campo de Data do Serviço para modo horas diretas */}
              <div>
                <Label>Data do Serviço</Label>
                <Input
                  type="date"
                  value={formData.data_inicio || ""}
                  onChange={(e) => updateField('data_inicio', e.target.value)}
                />
              </div>

              {!horasIndividualizadas ? (
                // Horas iguais para todos
                <div className="space-y-3">
                  <div>
                    <Label className="mb-3 block font-medium">Total de Horas Trabalhadas (para todos os mantenedores)</Label>
                    <DurationInput
                      value={parseHorasInput(horasParaTodos)}
                      onChange={(decimal) => setHorasParaTodos(String(decimal))}
                      minuteStep={15}
                    />
                  </div>
                </div>
              ) : (
                // Horas individualizadas
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex-1">
                      <Label className="mb-2 block text-sm font-medium">Aplicar mesma duração para todos:</Label>
                      <DurationInput
                        value={parseHorasInput(horasParaTodos)}
                        onChange={(decimal) => setHorasParaTodos(String(decimal))}
                        minuteStep={15}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="default"
                      onClick={aplicarHorasParaTodos}
                      disabled={!horasParaTodos || parseHorasInput(horasParaTodos) <= 0}
                      className="mt-8 bg-blue-600 hover:bg-blue-700"
                    >
                      Aplicar para Todos
                    </Button>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2 font-medium text-sm border-b">
                      Horas por Mantenedor
                    </div>
                    <div className="divide-y">
                      {(formData.mantenedores || []).map((mant) => {
                        const mantId = String(mant.id || mant.mantenedor_id);
                        return (
                          <div key={mantId} className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-sm">{mant.nome || mant.mantenedor_nome}</div>
                                <div className="text-xs text-slate-500">
                                  {(parseFloat(mant.custo_hora) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/h
                                </div>
                              </div>
                              {horasPorMantenedor[mantId] && parseHorasInput(horasPorMantenedor[mantId]) > 0 && (
                                <div className="text-right">
                                  <div className="text-sm font-medium text-green-700">
                                    {(parseHorasInput(horasPorMantenedor[mantId]) * (parseFloat(mant.custo_hora) || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </div>
                                  <div className="text-xs text-slate-500">Custo Individual</div>
                                </div>
                              )}
                            </div>
                            <DurationInput
                              value={parseHorasInput(horasPorMantenedor[mantId] || "0")}
                              onChange={(decimal) => setHorasPorMantenedor(prev => ({
                                ...prev,
                                [mantId]: String(decimal)
                              }))}
                              minuteStep={15}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Preview em tempo real */}
              {((horasParaTodos && parseHorasInput(horasParaTodos) > 0 && !horasIndividualizadas) || 
                (horasIndividualizadas && Object.keys(horasPorMantenedor).some(id => parseHorasInput(horasPorMantenedor[id]) > 0))) && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border-2 border-blue-200">
                  <h4 className="font-semibold text-sm text-slate-900 mb-3">📊 Preview do Serviço</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-slate-600">Tempo de Trabalho</Label>
                      <div className="text-xl font-bold text-blue-700">
                        {decimalToHHMM(calcularTotalHorasDiretas())} ({calcularTotalHorasDiretas().toFixed(2)} h)
                      </div>
                      {horasIndividualizadas && (formData.mantenedores || []).length > 0 && (
                        <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                          {(formData.mantenedores || []).map(mant => {
                            const mantId = String(mant.id || mant.mantenedor_id);
                            const horas = parseHorasInput(horasPorMantenedor[mantId] || "0");
                            if (horas > 0) {
                              return (
                                <div key={mantId}>
                                  • {mant.nome || mant.mantenedor_nome}: {horas.toFixed(2)}h
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Valor Total</Label>
                      <div className="text-xl font-bold text-green-700">
                        {calcularValorTotalHorasDiretas().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {(formData.mantenedores || []).length} mantenedor(es)
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Defeito Identificado</Label>
            <Textarea
              value={formData.defeito_identificado || ""}
              onChange={(e) => updateField('defeito_identificado', e.target.value)}
              placeholder="Descreva o defeito encontrado durante o diagnóstico"
              rows={3}
              className="resize-none"
            />
          </div>

          <div>
            <Label>Atividade Realizada</Label>
            <Textarea
              value={formData.atividade || ""}
              onChange={(e) => updateField('atividade', e.target.value)}
              placeholder="Descrição da atividade executada"
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Anexos */}
          <div>
            <Label>Anexos (Imagens)</Label>
            <ImageUploader
              value={formData.anexos || []}
              onChange={(list) => setFormData(prev => ({ ...prev, anexos: list }))}
              label="Adicionar imagens do serviço"
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            Salvar Serviço
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
