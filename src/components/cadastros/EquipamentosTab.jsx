import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from 'react-router-dom';
import { Equipamento } from "@/entities/Equipamento";
import { Localizacao } from "@/entities/Localizacao";
import { FamiliaEquipamento } from "@/entities/FamiliaEquipamento";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ComboboxSelect } from "@/components/ui/ComboboxSelect";
import { 
  Plus, Edit, Save, Trash2, X, Search, Upload, Download, HelpCircle, 
  ArrowUp, ArrowDown, ArrowUpDown, QrCode, PackageOpen, Layers, 
  Expand, Shrink, ChevronLeft, ChevronRight, ListOrdered
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DialogClose, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { UploadFile, ExtractDataFromUploadedFile } from "@/integrations/Core";
import QRCodeModal from "../equipamentos/QRCodeModal";
import EquipamentoTree from "../equipamentos/EquipamentoTree";
import ImageUploader from "../attachments/ImageUploader";
import RelatedEntitySelect from "@/components/RelatedEntitySelect";
import QuickCreateFields from "@/components/quick-create/QuickCreateFields";
import { sortByText, upsertCreatedOption, validateQuickCreateFields } from "@/utils/quickCreate";
import { createPageUrl } from '@/utils';

const SortableHeader = ({ children, column, sortConfig, onSort }) => {
  const isSorted = sortConfig.key === column;
  const direction = isSorted ? sortConfig.direction : undefined;

  return (
    <TableHead onClick={() => onSort(column)} className="cursor-pointer hover:bg-slate-50">
      <div className="flex items-center gap-2">
        {children}
        {isSorted ? (
          direction === 'ascending' ? (
            <ArrowUp className="w-4 h-4" />
          ) : (
            <ArrowDown className="w-4 h-4" />
          )
        ) : (
          <ArrowUpDown className="w-4 h-4 text-slate-400" />
        )}
      </div>
    </TableHead>
  );
};

// Modal de Cadastro/Edição
const localizacaoQuickCreateFields = [
  { name: "descricao", label: "Descrição", required: true, placeholder: "Ex: Setor A - Andar 1" },
  { name: "setor", label: "Setor", placeholder: "Ex: Produção" },
  { name: "observacoes", label: "Observações", type: "textarea", placeholder: "Informações adicionais" },
];

const familiaQuickCreateFields = [
  { name: "descricao", label: "Descrição", required: true, placeholder: "Ex: Bombas" },
  { name: "observacoes", label: "Observações", type: "textarea", placeholder: "Informações adicionais" },
];

function EquipamentoModal({
  isOpen,
  onClose,
  equipamento,
  localizacoes,
  familias,
  equipamentos,
  onSave,
  onNavigate,
  onLocalizacoesChange,
  onFamiliasChange,
}) {
  const [formData, setFormData] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (equipamento) {
        // Edição - sempre buscar localização atualizada
        let itemToEdit = { ...equipamento };
        if (itemToEdit.localizacao_id) {
          const foundLocation = localizacoes.find(loc => loc.id === itemToEdit.localizacao_id);
          if (foundLocation) {
            itemToEdit.localizacao_celula = foundLocation.descricao || '';
            itemToEdit.localizacao_setor = foundLocation.setor || '';
          }
        } else {
            itemToEdit.localizacao_celula = '';
            itemToEdit.localizacao_setor = '';
        }
        if (itemToEdit.familia_id) {
          const foundFamily = (familias || []).find(familia => familia.id === itemToEdit.familia_id);
          if (foundFamily) itemToEdit.familia_nome = foundFamily.descricao || '';
        }
        setFormData(itemToEdit);
      } else {
        // Novo
        setFormData({ 
          status: 'Ativo', 
          localizacao_id: null, 
          localizacao_celula: '', 
          localizacao_setor: '',
          familia_id: null,
          familia_nome: '',
          parent_id: null,
          imagens: [],
          pecas_por_hora: null
        });
      }
      setError("");
    }
  }, [isOpen, equipamento, localizacoes, familias]);

  const idToEquip = useMemo(() => {
    const map = {};
    (equipamentos || []).forEach(e => { map[e.id] = e; });
    return map;
  }, [equipamentos]);

  const getDescendantIds = React.useCallback((id) => {
    const out = new Set();
    if (!id) return out;
    const childrenMap = {};
    (equipamentos || []).forEach(eq => {
      const pid = eq.parent_id || null;
      if (!childrenMap[pid]) childrenMap[pid] = [];
      childrenMap[pid].push(eq);
    });
    
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      out.add(cur);
      (childrenMap[cur] || []).forEach(ch => stack.push(ch.id));
    }
    return out;
  }, [equipamentos]);

  const getPathStringById = React.useCallback((id) => {
    if (!id) return "Nenhum (raiz)";
    const parts = [];
    let cur = idToEquip[id];
    let guard = 0;
    while (cur && guard < 50) {
      parts.unshift(cur.codigo ? `${cur.codigo} - ${cur.descricao}` : (cur.descricao || cur.codigo || "Sem nome"));
      cur = cur.parent_id ? idToEquip[cur.parent_id] : null;
      guard++;
    }
    return parts.join(" > ");
  }, [idToEquip]);

  const invalidParentIds = useMemo(() => {
    if (!equipamento?.id) return new Set();
    const s = getDescendantIds(equipamento.id);
    s.add(equipamento.id);
    return s;
  }, [equipamento, getDescendantIds]);

  // Preparar lista de equipamentos válidos para serem pai
  const availableParentEquipments = useMemo(() => {
    return equipamentos
      .filter(eq => !invalidParentIds.has(eq.id))
      .sort((a, b) => (a.descricao || "").localeCompare(b.descricao || ""));
  }, [equipamentos, invalidParentIds]);

  const handleCreateLocalizacao = async (data) => {
    validateQuickCreateFields(data, localizacaoQuickCreateFields);
    const created = await Localizacao.create(data);
    onLocalizacoesChange((current) =>
      sortByText(upsertCreatedOption(current, created), (item) => `${item.descricao || ""} ${item.setor || ""}`)
    );
    return created;
  };

  const handleCreateFamilia = async (data) => {
    validateQuickCreateFields(data, familiaQuickCreateFields);
    const created = await FamiliaEquipamento.create(data);
    onFamiliasChange((current) =>
      sortByText(upsertCreatedOption(current, created), (item) => item.descricao || "")
    );
    return created;
  };

  const handleSubmit = async (e, navigateDirection = null) => {
    if (e) e.preventDefault();
    setError("");

    // Validação condicional do código
    if (!formData.parent_id) {
      if (!formData.codigo?.trim()) {
        setError("Código é obrigatório para equipamentos principais (sem pai).");
        return;
      }
      if (!formData.localizacao_id) {
        setError("Localização é obrigatória para equipamentos principais.");
        return;
      }
    }
    
    if (!formData.descricao?.trim()) {
      setError("Descrição é obrigatória.");
      return;
    }

    // Valida unicidade do código apenas se ele for preenchido
    if (formData.codigo?.trim()) {
      const codigoExiste = equipamentos.some(eq => 
        eq.id !== equipamento?.id && 
        eq.codigo?.toLowerCase() === formData.codigo?.toLowerCase()
      );
      if (codigoExiste) {
        setError("Já existe um equipamento com este código.");
        return;
      }
    }

    setSaving(true);
    try {
      let dataToSave = { ...formData };
      
      // Lógica de localização: sub-equipamentos herdam do pai
      if (formData.parent_id) {
        const parent = idToEquip[formData.parent_id];
        if (parent) {
            // Buscar localização atualizada do pai
            if (parent.localizacao_id) {
              const parentLocation = localizacoes.find(l => l.id === parent.localizacao_id);
              if (parentLocation) {
                dataToSave.localizacao_celula = parentLocation.descricao || '';
                dataToSave.localizacao_setor = parentLocation.setor || '';
                dataToSave.localizacao_id = parent.localizacao_id;
              }
            } else {
              dataToSave.localizacao_celula = parent.localizacao_celula;
              dataToSave.localizacao_setor = parent.localizacao_setor;
              dataToSave.localizacao_id = parent.localizacao_id;
            }
            dataToSave.fabricante = null;
            dataToSave.pecas_por_hora = null;
            dataToSave.imagens = [];
        }
      } else if (formData.localizacao_id) {
        // Principal equipment - sempre buscar dados atualizados da localização
        const localizacao = localizacoes.find(l => l.id === formData.localizacao_id);
        if (localizacao) {
          dataToSave.localizacao_celula = localizacao.descricao || '';
          dataToSave.localizacao_setor = localizacao.setor || '';
        }
      } else {
        dataToSave.localizacao_id = null;
        dataToSave.localizacao_celula = '';
        dataToSave.localizacao_setor = '';
      }

      dataToSave.parent_id = formData.parent_id || null;

      // Salvar equipamento
      if (equipamento?.id && formData.id) {
        // Edição - tem ID válido
        // Buscar o equipamento original para comparar localização
        const originalEquipamento = equipamentos.find(eq => eq.id === equipamento.id);

        await Equipamento.update(equipamento.id, dataToSave);
        
        // Propagar mudanças para todos os filhos (sub-equipamentos) se a localização mudou
        if (originalEquipamento && (
            originalEquipamento.localizacao_id !== dataToSave.localizacao_id ||
            originalEquipamento.localizacao_celula !== dataToSave.localizacao_celula ||
            originalEquipamento.localizacao_setor !== dataToSave.localizacao_setor
        )) {
          // Função recursiva para propagar para todos os descendentes
          const propagarParaTodosFilhos = async (parentId) => {
            const filhosDirectos = equipamentos.filter(eq => eq.parent_id === parentId);
            if (filhosDirectos.length > 0) {
              const updates = filhosDirectos.map(filho => 
                Equipamento.update(filho.id, {
                  localizacao_celula: dataToSave.localizacao_celula,
                  localizacao_setor: dataToSave.localizacao_setor,
                  localizacao_id: dataToSave.localizacao_id
                })
              );
              await Promise.all(updates);
              
              // Propagar recursivamente para os filhos dos filhos
              for (const filho of filhosDirectos) {
                await propagarParaTodosFilhos(filho.id);
              }
            }
          };
          
          await propagarParaTodosFilhos(equipamento.id);
          console.log(`✅ Localização propagada para todos os sub-equipamentos`);
        }
      } else {
        // Criação - não tem ID ou ID é undefined/null
        await Equipamento.create(dataToSave);
      }
      
      await onSave();
      
      // Se houver navegação, navegar para próximo/anterior
      if (navigateDirection && equipamento?.id) {
        onNavigate(equipamento.id, navigateDirection);
      } else if (!navigateDirection) {
        // Apenas fecha se não for navegação
        onClose();
      }
    } catch (error) {
      setError("Erro ao salvar equipamento");
      console.error("Erro ao salvar equipamento:", error);
    } finally {
      setSaving(false);
    }
  };

  const isEquipamentoPrincipal = !formData.parent_id;

  // Verificar se há próximo/anterior equipamento para navegação
  const currentIndex = equipamento ? equipamentos.findIndex(eq => eq.id === equipamento.id) : -1;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < equipamentos.length - 1; // Corrected 'equipments' to 'equipamentos'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Edit className="w-5 h-5" />
            {equipamento ? "Editar Equipamento" : "Novo Equipamento"}
            {equipamento && (
              <span className="text-sm text-slate-500 font-normal ml-2">
                ({currentIndex + 1} de {equipamentos.length})
              </span>
            )}
          </DialogTitle>
          {formData.parent_id && (
            <DialogDescription className="text-sm text-slate-600 bg-blue-50 p-2 rounded-md">
              <strong>Equipamento Pai:</strong> {getPathStringById(formData.parent_id)}
            </DialogDescription>
          )}
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="codigo">
                Código {formData.parent_id ? '(Opcional)' : <span className="text-red-500">*</span>}
              </Label>
              <Input
                id="codigo"
                value={formData.codigo || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                placeholder="Ex: UD-42"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="descricao">
                Descrição <span className="text-red-500">*</span>
              </Label>
              <Input
                id="descricao"
                value={formData.descricao || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Ex: Prensa Hidráulica SILME"
              />
            </div>

            {/* Equipamento Pai com ComboboxSelect */}
            <div className="col-span-full md:col-span-2">
              <Label htmlFor="parent_id">Equipamento Pai (opcional)</Label>
              <div className="flex flex-col gap-2">
                <ComboboxSelect
                  value={formData.parent_id || ""}
                  onValueChange={(value) =>
                    setFormData(prev => ({ ...prev, parent_id: value === "" ? null : value }))
                  }
                  placeholder="Selecione o equipamento pai (ou deixe vazio para raiz)"
                  emptyMessage="Nenhum equipamento encontrado"
                  searchPlaceholder="Pesquisar equipamento..."
                  items={[
                    { id: "", descricao: "Nenhum (raiz)", codigo: "" },
                    ...availableParentEquipments
                  ]}
                  getItemValue={(item) => item.id}
                  getItemLabel={(item) => {
                    if (item.id === "") return item.descricao;
                    return item.codigo ? `${item.codigo} - ${item.descricao}` : item.descricao;
                  }}
                  getItemSearchText={(item) => {
                    if (item.id === "") return "nenhum raiz";
                    return `${item.codigo || ''} ${item.descricao || ''}`.toLowerCase();
                  }}
                  disabled={equipamento?.id && (invalidParentIds.size > 1 && invalidParentIds.has(formData.parent_id))}
                  className="w-full"
                />
                <p className="text-xs text-slate-600">
                  Pai selecionado: <span className="font-medium">{getPathStringById(formData.parent_id)}</span>
                </p>
              </div>
            </div>

            {/* Campos que só aparecem para equipamentos principais */}
            {isEquipamentoPrincipal && (
              <>
                <div className="col-span-full">
                  <Label htmlFor="localizacao_id">
                    Localização <span className="text-red-500">*</span>
                  </Label>
                  <RelatedEntitySelect
                    value={formData.localizacao_id || ""}
                    onChange={(value, createdOrSelected) => {
                      const selectedLoc = createdOrSelected || localizacoes.find(loc => loc.id === value);
                      setFormData(prev => ({
                        ...prev,
                        localizacao_id: value || null,
                        localizacao_celula: selectedLoc?.descricao || '',
                        localizacao_setor: selectedLoc?.setor || '',
                      }));
                    }}
                    options={localizacoes}
                    optionLabel={(loc) => loc.setor ? `${loc.descricao} - ${loc.setor}` : loc.descricao}
                    optionValue="id"
                    placeholder="Selecione uma localização"
                    createButtonLabel="Nova localização"
                    modalTitle="Nova localização"
                    createForm={({ formData: quickData, setFormData: setQuickData, disabled }) => (
                      <QuickCreateFields
                        fields={localizacaoQuickCreateFields}
                        formData={quickData}
                        setFormData={setQuickData}
                        disabled={disabled}
                      />
                    )}
                    onCreate={handleCreateLocalizacao}
                  />
                  {/* Display derived location info */}
                  {(formData.localizacao_celula || formData.localizacao_setor) && (
                    <p className="text-xs text-slate-600 mt-1">
                      <strong>Célula:</strong> {formData.localizacao_celula || '-'} | <strong>Setor:</strong> {formData.localizacao_setor || '-'}
                    </p>
                  )}
                </div>

                <div className="col-span-full">
                  <RelatedEntitySelect
                    label="Família de equipamento"
                    value={formData.familia_id || ""}
                    onChange={(value, createdOrSelected) => {
                      const selectedFamily = createdOrSelected || (familias || []).find(familia => familia.id === value);
                      setFormData(prev => ({
                        ...prev,
                        familia_id: value || null,
                        familia_nome: selectedFamily?.descricao || '',
                      }));
                    }}
                    options={familias || []}
                    optionLabel="descricao"
                    optionValue="id"
                    placeholder="Selecione uma família"
                    createButtonLabel="Nova família"
                    modalTitle="Nova família de equipamento"
                    createForm={({ formData: quickData, setFormData: setQuickData, disabled }) => (
                      <QuickCreateFields
                        fields={familiaQuickCreateFields}
                        formData={quickData}
                        setFormData={setQuickData}
                        disabled={disabled}
                      />
                    )}
                    onCreate={handleCreateFamilia}
                  />
                </div>

                <div>
                  <Label htmlFor="pecas_por_hora">Peças por Hora</Label>
                  <Input
                    id="pecas_por_hora"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.pecas_por_hora || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, pecas_por_hora: e.target.value ? parseInt(e.target.value) : null }))}
                    placeholder="Quantidade de peças produzidas por hora"
                  />
                </div>

                <div>
                  <Label htmlFor="numero_serie">Número de Série</Label>
                  <Input
                    id="numero_serie"
                    value={formData.numero_serie || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, numero_serie: e.target.value }))}
                    placeholder="Número de série"
                  />
                </div>

                <div>
                  <Label htmlFor="fabricante">Fabricante</Label>
                  <Input
                    id="fabricante"
                    value={formData.fabricante || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, fabricante: e.target.value }))}
                    placeholder="Fabricante do equipamento"
                  />
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status || "Ativo"}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="marca">Marca</Label>
              <Input
                id="marca"
                value={formData.marca || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, marca: e.target.value }))}
                placeholder="Marca do equipamento"
              />
            </div>

            <div>
              <Label htmlFor="modelo">Modelo</Label>
              <Input
                id="modelo"
                value={formData.modelo || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, modelo: e.target.value }))}
                placeholder="Modelo do equipamento"
              />
            </div>
          </div>

          {/* Campo de imagens apenas para equipamentos principais */}
          {isEquipamentoPrincipal && (
            <div>
              <Label>Imagens do Equipamento</Label>
              <ImageUploader
                value={formData.imagens || []}
                onChange={(imagens) => setFormData(prev => ({ ...prev, imagens }))}
                label="Adicionar fotos do equipamento"
              />
            </div>
          )}
          
          <DialogFooter className="gap-3 pt-4 border-t">
            <div className="flex gap-2 w-full">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              
              <div className="ml-auto flex gap-2">
                {equipamento && hasPrevious && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => handleSubmit(null, 'previous')}
                    disabled={saving}
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Anterior
                  </Button>
                )}
                
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
                      Salvar
                    </>
                  )}
                </Button>
                
                {equipamento && hasNext && (
                  <Button 
                    type="button" 
                    className="bg-blue-600 hover:bg-blue-700" 
                    onClick={() => handleSubmit(null, 'next')}
                    disabled={saving}
                  >
                    Próximo
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function EquipamentosTab() {
  const [equipamentos, setEquipamentos] = useState([]);
  const [localizacoes, setLocalizacoes] = useState([]);
  const [familias, setFamilias] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [treeSearchTerm, setTreeSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'codigo', direction: 'ascending' });
  const [treeSortConfig, setTreeSortConfig] = useState({ key: 'descricao', direction: 'ascending' });
  const [importStatus, setImportStatus] = useState({ type: '', message: '' });
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedEquipamento, setSelectedEquipamento] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [expandAll, setExpandAll] = useState(false);
  const [activeView, setActiveView] = useState('principais'); // 'principais', 'subequipamentos', 'arvore'
  const [showCodigosModal, setShowCodigosModal] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [equipamentosData, localizacoesData, familiasData] = await Promise.all([
        Equipamento.list(),
        Localizacao.list(),
        FamiliaEquipamento.list()
      ]);
      setEquipamentos(equipamentosData);
      setLocalizacoes(localizacoesData.sort((a, b) => (a.descricao || '').localeCompare(b.descricao || '')));
      setFamilias((familiasData || []).sort((a, b) => (a.descricao || '').localeCompare(b.descricao || '')));
    } catch (error) {
      setError("Erro ao carregar dados");
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  // Separar equipamentos principais de subequipamentos
  const equipamentosPrincipais = useMemo(() => 
    equipamentos.filter(eq => !eq.parent_id), [equipamentos]);
  
  const subequipamentos = useMemo(() => 
    equipamentos.filter(eq => !!eq.parent_id), [equipamentos]);

  // Agrupar códigos por setor
  const codigosPorSetor = useMemo(() => {
    const grupos = {};
    
    equipamentos.forEach(eq => {
      if (!eq.codigo) return; // Ignorar equipamentos sem código
      
      const setor = eq.localizacao_setor || 'Sem Setor';
      
      if (!grupos[setor]) {
        grupos[setor] = [];
      }
      
      grupos[setor].push({
        codigo: eq.codigo,
        descricao: eq.descricao,
        celula: eq.localizacao_celula || '-'
      });
    });
    
    // Ordenar códigos dentro de cada setor
    Object.keys(grupos).forEach(setor => {
      grupos[setor].sort((a, b) => a.codigo.localeCompare(b.codigo));
    });
    
    return grupos;
  }, [equipamentos]);

  // Helpers for hierarchy
  const childrenMap = useMemo(() => {
    const map = {};
    (equipamentos || []).forEach(eq => {
      const pid = eq.parent_id || null;
      if (!map[pid]) map[pid] = [];
      map[pid].push(eq);
    });
    return map;
  }, [equipamentos]);

  const getPathStringById = React.useCallback((id) => {
    if (!id) return "Nenhum (raiz)";
    const idToEquip = {};
    (equipamentos || []).forEach(e => { idToEquip[e.id] = e; });
    
    const parts = [];
    let cur = idToEquip[id];
    let guard = 0;
    while (cur && guard < 50) {
      parts.unshift(cur.codigo ? `${cur.codigo} - ${cur.descricao}` : (cur.descricao || cur.codigo || "Sem nome"));
      cur = cur.parent_id ? idToEquip[cur.parent_id] : null;
      guard++;
    }
    return parts.join(" > ");
  }, [equipamentos]);

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleTreeSort = (key) => {
    let direction = 'ascending';
    if (treeSortConfig.key === key && treeSortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setTreeSortConfig({ key, direction });
  };
  
  const sortedAndFilteredPrincipais = useMemo(() => {
    let filtered = equipamentosPrincipais.filter(eq =>
      eq.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.localizacao_celula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.localizacao_setor?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key] || '';
        const bValue = b[sortConfig.key] || '';
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    
    return filtered;
  }, [equipamentosPrincipais, searchTerm, sortConfig]);

  const sortedAndFilteredSubequipamentos = useMemo(() => {
    let filtered = subequipamentos.filter(eq =>
      eq.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.localizacao_celula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.localizacao_setor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getPathStringById(eq.parent_id).toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key] || '';
        const bValue = b[sortConfig.key] || '';
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    
    return filtered;
  }, [subequipamentos, searchTerm, sortConfig, getPathStringById]);

  const handleShowQR = (equipamento) => {
    setSelectedEquipamento(equipamento);
    setQrModalOpen(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowModal(true);
    setError("");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este equipamento?")) {
      try {
        const hasChildren = equipamentos.some(eq => eq.parent_id === id);
        if (hasChildren) {
          alert("Não é possível excluir um equipamento que possui sub-equipamentos. Remova os filhos primeiro ou reconfigure sua hierarquia.");
          return;
        }

        await Equipamento.delete(id);
        await loadData();
      } catch (error) {
        setError("Erro ao excluir equipamento");
        console.error("Erro ao excluir equipamento:", error);
      }
    }
  };

  const handleNew = () => {
    setEditingItem(null);
    setShowModal(true);
    setError("");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddChild = (parentNode) => {
    setEditingItem({ parent_id: parentNode.id });
    setShowModal(true);
    setError("");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImportStatus({ type: 'info', message: 'Fazendo upload do arquivo...' });

    try {
        const { file_url } = await UploadFile({ file });
        setImportStatus({ type: 'info', message: 'Extraindo dados...' });

        const json_schema = {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    codigo: { type: 'string' },
                    descricao: { type: 'string' },
                    marca: { type: 'string' },
                    modelo: { type: 'string' },
                    numero_serie: { type: 'string' },
                    fabricante: { type: 'string' },
                    localizacao_celula: { type: 'string' },
                    localizacao_setor: { type: 'string' },
                    status: { type: 'string' },
                    parent_codigo: { type: 'string' },
                    pecas_por_hora: { type: 'number' }
                },
                required: ['codigo', 'descricao']
            }
        };

        const extractionResult = await ExtractDataFromUploadedFile({ file_url, json_schema });
        if (extractionResult.status !== 'success' || !extractionResult.output) {
            throw new Error(extractionResult.details || "Falha ao extrair dados.");
        }
        
        setImportStatus({ type: 'info', message: 'Processando e salvando registros...' });
        
        const dataToCreate = [];
        for (const item of extractionResult.output) {
            // Find existing location based on description (celula) and setor
            const localizacaoFound = localizacoes.find(loc => 
              (loc.descricao === item.localizacao_celula && loc.setor === item.localizacao_setor) ||
              (loc.descricao === item.localizacao_celula && !loc.setor && !item.localizacao_setor)
            );
            
            let parentId = null;
            if (item.parent_codigo) {
                const parentEquip = equipamentos.find(eq => eq.codigo === item.parent_codigo);
                if (parentEquip) {
                    parentId = parentEquip.id;
                } else {
                    console.warn(`Parent equipment with code '${item.parent_codigo}' not found for '${item.codigo}'. Setting parent_id to null.`);
                }
            }

            dataToCreate.push({ 
              ...item, 
              localizacao_id: localizacaoFound?.id || null,
              parent_id: parentId,
              imagens: []
            });
        }

        if (dataToCreate.length > 0) {
            await Equipamento.bulkCreate(dataToCreate);
        }

        setImportStatus({ type: 'success', message: `${dataToCreate.length} registros importados!` });
        await loadData();

    } catch (error) {
        setImportStatus({ type: 'error', message: `Erro na importação: ${error.message}` });
        console.error("Erro na importação:", error);
    } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
    
  const handleExport = () => {
      const headers = ["codigo", "descricao", "marca", "modelo", "numero_serie", "fabricante", "localizacao_celula", "localizacao_setor", "status", "parent_codigo", "pecas_por_hora"];
      const rows = equipamentos.map(eq => {
          const parentEquip = eq.parent_id ? equipamentos.find(parent => parent.id === eq.parent_id) : null;
          const parent_codigo = parentEquip ? parentEquip.codigo : '';
          return headers.map(h => {
              if (h === 'parent_codigo') return `"${parent_codigo}"`;
              return `"${eq[h] || ''}"`
          }).join(',');
      });
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "equipamentos.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleNavigate = (currentId, direction) => {
    const currentIndex = equipamentos.findIndex(eq => eq.id === currentId);
    let nextIndex;
    
    if (direction === 'next') {
      nextIndex = currentIndex + 1;
    } else if (direction === 'previous') {
      nextIndex = currentIndex - 1;
    }
    
    if (nextIndex >= 0 && nextIndex < equipamentos.length) {
      setEditingItem(equipamentos[nextIndex]);
    } else {
        // Optionally close modal or show message if no next/previous
        // For now, it will just not navigate if out of bounds, staying on current item
    }
  };

  const searchValue = activeView === 'arvore' ? treeSearchTerm : searchTerm;
  const searchPlaceholder = activeView === 'arvore' ? 'Pesquisar na árvore...' : 'Pesquisar equipamentos...';
  const handleSearchInputChange = (value) => {
    if (activeView === 'arvore') {
      setTreeSearchTerm(value);
      return;
    }

    setSearchTerm(value);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex flex-wrap items-center gap-2">
          <input type="file" ref={fileInputRef} onChange={handleImport} accept=".csv" className="hidden" />
          <Button size="sm" variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4" /> Importar
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={handleExport}>
              <Download className="w-4 h-4" /> Exportar
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowCodigosModal(true)}>
              <ListOrdered className="w-4 h-4" /> Ver Códigos por Setor
          </Button>
          <Dialog>
              <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0"><HelpCircle className="w-4 h-4" /></Button>
              </DialogTrigger>
              <DialogContent>
                  <DialogHeader>
                      <DialogTitle>Ajuda para Importação</DialogTitle>
                      <DialogDescription>
                          Para importar, crie um arquivo CSV com as colunas: `codigo`, `descricao`, `marca`, `modelo`, `numero_serie`, `fabricante`, `localizacao_celula`, `localizacao_setor`, `status`, `parent_codigo`, `pecas_por_hora`.
                      </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                      <DialogClose asChild>
                        <Button>Fechar</Button>
                      </DialogClose>
                  </DialogFooter>
              </DialogContent>
          </Dialog>
          <Button size="sm" onClick={handleNew} className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Plus className="w-4 h-4" />
            Novo Equipamento
          </Button>
          </div>

          <div className="relative w-full xl:ml-auto xl:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              className="h-8 pl-9"
            />
          </div>
        </div>
      </div>

      {importStatus.message && (
        <Alert variant={importStatus.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{importStatus.message}</AlertDescription>
        </Alert>
      )}

      {/* Views dinâmicas com separação */}
      <Tabs value={activeView} onValueChange={setActiveView} className="space-y-3">
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-lg bg-slate-100 p-1 sm:w-fit">
          <TabsTrigger value="principais" className="h-8 flex-none px-3 text-xs sm:text-sm">
            <PackageOpen className="w-4 h-4 mr-2" />
            Equipamentos Principais ({equipamentosPrincipais.length})
          </TabsTrigger>
          <TabsTrigger value="subequipamentos" className="h-8 flex-none px-3 text-xs sm:text-sm">
            <Layers className="w-4 h-4 mr-2" />
            Subequipamentos ({subequipamentos.length})
          </TabsTrigger>
          <TabsTrigger value="arvore" className="h-8 flex-none px-3 text-xs sm:text-sm">
            <Layers className="w-4 h-4 mr-2" />
            Visualização em Árvore
          </TabsTrigger>
        </TabsList>

        <TabsContent value="principais" className="mt-0">
          <Card className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-center text-sm text-slate-500">Carregando...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader column="codigo" sortConfig={sortConfig} onSort={handleSort}>Código</SortableHeader>
                        <SortableHeader column="descricao" sortConfig={sortConfig} onSort={handleSort}>Descrição</SortableHeader>
                        <SortableHeader column="localizacao_celula" sortConfig={sortConfig} onSort={handleSort}>Célula</SortableHeader>
                        <SortableHeader column="localizacao_setor" sortConfig={sortConfig} onSort={handleSort}>Setor</SortableHeader>
                        <SortableHeader column="pecas_por_hora" sortConfig={sortConfig} onSort={handleSort}>Peças/Hora</SortableHeader>
                        <SortableHeader column="status" sortConfig={sortConfig} onSort={handleSort}>Status</SortableHeader>
                        <TableHead>Subequipamentos</TableHead>
                        <TableHead className="w-40">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedAndFilteredPrincipais.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.codigo}</TableCell>
                          <TableCell>{item.descricao}</TableCell>
                          <TableCell>{item.localizacao_celula || "-"}</TableCell>
                          <TableCell>{item.localizacao_setor || "-"}</TableCell>
                          <TableCell>
                            {item.pecas_por_hora ? (
                              <span className="font-medium text-blue-600">{item.pecas_por_hora}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={item.status === 'Ativo' ? 'default' : 'secondary'}
                              className={item.status === 'Ativo' ? 'bg-emerald-100 text-emerald-800' : ''}
                            >
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {(childrenMap[item.id] || []).length} itens
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Link to={createPageUrl(`EquipamentoDetalhes?id=${item.id}`)}>
                                  <Button size="sm" variant="outline" className="text-indigo-600 hover:text-indigo-700">
                                      <PackageOpen className="w-3 h-3" />
                                  </Button>
                              </Link>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleShowQR(item)}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <QrCode className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(item)}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(item.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {sortedAndFilteredPrincipais.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                            {searchTerm ? "Nenhum equipamento principal encontrado" : "Nenhum equipamento principal cadastrado"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subequipamentos" className="mt-0">
          <Card className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-center text-sm text-slate-500">Carregando...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader column="codigo" sortConfig={sortConfig} onSort={handleSort}>Código</SortableHeader>
                        <SortableHeader column="descricao" sortConfig={sortConfig} onSort={handleSort}>Descrição</SortableHeader>
                        <TableHead>Equipamento Pai</TableHead>
                        <SortableHeader column="marca" sortConfig={sortConfig} onSort={handleSort}>Marca</SortableHeader>
                        <SortableHeader column="modelo" sortConfig={sortConfig} onSort={handleSort}>Modelo</SortableHeader>
                        <TableHead className="w-40">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedAndFilteredSubequipamentos.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.codigo || "-"}</TableCell>
                          <TableCell>{item.descricao}</TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {getPathStringById(item.parent_id)}
                          </TableCell>
                          <TableCell>{item.marca || "-"}</TableCell>
                          <TableCell>{item.modelo || "-"}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleShowQR(item)}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <QrCode className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(item)}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(item.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {sortedAndFilteredSubequipamentos.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                            {searchTerm ? "Nenhum subequipamento encontrado" : "Nenhum subequipamento cadastrado"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="arvore" className="mt-0">
          <Card className="rounded-lg border bg-white shadow-sm">
            <CardHeader className="p-3 pb-0">
              <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExpandAll(!expandAll)}
                    className="gap-2"
                  >
                    {expandAll ? <Shrink className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
                    {expandAll ? 'Recolher' : 'Expandir'} Tudo
                  </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <EquipamentoTree
                  equipamentos={equipamentos}
                  selectedId={selectedNodeId}
                  onSelect={(id) => setSelectedNodeId(id === selectedNodeId ? null : id)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onAddChild={handleAddChild}
                  onShowQR={handleShowQR}
                  showActions={true}
                  expandAll={expandAll}
                  searchTerm={treeSearchTerm}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modais */}
      <EquipamentoModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingItem(null);
        }}
        equipamento={editingItem}
        localizacoes={localizacoes}
        familias={familias}
        equipamentos={equipamentos}
        onSave={loadData}
        onNavigate={handleNavigate}
        onLocalizacoesChange={setLocalizacoes}
        onFamiliasChange={setFamilias}
      />

      <QRCodeModal 
        equipamento={selectedEquipamento}
        isOpen={qrModalOpen}
        onClose={() => {
          setQrModalOpen(false);
          setSelectedEquipamento(null);
        }}
      />

      {/* Modal de Códigos por Setor */}
      <Dialog open={showCodigosModal} onOpenChange={setShowCodigosModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <ListOrdered className="w-5 h-5" />
              Códigos de Equipamentos por Setor
            </DialogTitle>
            <DialogDescription>
              Visualização organizada de todos os códigos cadastrados, agrupados por setor
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {Object.keys(codigosPorSetor).length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                Nenhum código de equipamento cadastrado
              </div>
            ) : (
              Object.keys(codigosPorSetor).sort().map(setor => (
                <Card key={setor} className="border-2">
                  <CardHeader className="pb-3 bg-slate-50">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{setor}</span>
                      <Badge variant="secondary">{codigosPorSetor[setor].length} itens</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {codigosPorSetor[setor].map((item, index) => (
                        <div 
                          key={index} 
                          className="p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-mono font-bold text-blue-700 text-sm">
                                {item.codigo}
                              </p>
                              <p className="text-xs text-slate-600 truncate" title={item.descricao}>
                                {item.descricao}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                <span className="font-medium">Célula:</span> {item.celula}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCodigosModal(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
