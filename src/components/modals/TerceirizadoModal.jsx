import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ImageUploader from "../attachments/ImageUploader";
import FileUploader from "../attachments/FileUploader";
import { appApi } from "@/api/appClient";
import RelatedEntitySelect from "@/components/RelatedEntitySelect";
import QuickCreateFields from "@/components/quick-create/QuickCreateFields";
import { sortByText, upsertCreatedOption, validateQuickCreateFields } from "@/utils/quickCreate";

const prestadoraQuickCreateFields = [
  { name: "nome_empresa", label: "Nome da empresa", required: true, placeholder: "Nome da empresa" },
  { name: "cnpj", label: "CNPJ", placeholder: "00.000.000/0000-00" },
  { name: "email", label: "E-mail", type: "email", placeholder: "contato@empresa.com" },
  { name: "contato1", label: "Contato", placeholder: "Telefone ou e-mail" },
];

const centroCustoQuickCreateFields = [
  { name: "codigo", label: "Código", placeholder: "Ex: CC-001" },
  { name: "descricao", label: "Descrição", required: true, placeholder: "Descrição do centro de custo" },
];

export default function TerceirizadoModal({
  isOpen,
  onClose,
  terceirizado,
  onSave,
  prestadoras,
  centrosCusto = [],
  onPrestadorasChange,
  onCentrosCustoChange,
}) {
  const [formData, setFormData] = useState({});
  const [error, setError] = useState("");
  const [loadedPrestadoras, setLoadedPrestadoras] = useState([]);
  const [loadedCentrosCusto, setLoadedCentrosCusto] = useState([]);

  useEffect(() => {
    if (isOpen && terceirizado) {
      setFormData({ ...terceirizado });
      setError("");
    }
  }, [isOpen, terceirizado]);

  useEffect(() => {
    setLoadedPrestadoras(prestadoras || []);
  }, [prestadoras]);

  useEffect(() => {
    const loadCentrosCusto = async () => {
      if (isOpen && (!centrosCusto || centrosCusto.length === 0)) {
        try {
          const data = await appApi.entities.CentroCusto.list();
          setLoadedCentrosCusto(data || []);
        } catch (error) {
          console.error("Erro ao carregar centros de custo:", error);
        }
      } else {
        setLoadedCentrosCusto(centrosCusto || []);
      }
    };
    loadCentrosCusto();
  }, [isOpen, centrosCusto]);

  const handleSubmit = () => {
    setError("");

    if (!formData.prestadora_id) {
      setError("Selecione uma prestadora");
      return;
    }

    if (!formData.data_servico) {
      setError("Data do serviço é obrigatória");
      return;
    }

    onSave(formData);
    onClose();
  };

  const updateField = (field, value) => {
    const updated = { ...formData, [field]: value };
    
    if (field === 'prestadora_id' && value) {
      const prestadora = (loadedPrestadoras || []).find(p => p.id === value);
      updated.prestadora_nome = prestadora?.nome_empresa || '';
    }
    
    setFormData(updated);
  };

  const handleCreatePrestadora = async (data) => {
    validateQuickCreateFields(data, prestadoraQuickCreateFields);
    const created = await appApi.entities.PrestadoraServico.create(data);
    const updateList = (current) =>
      sortByText(upsertCreatedOption(current, created), (item) => item.nome_empresa || "");
    setLoadedPrestadoras(updateList);
    onPrestadorasChange?.(updateList);
    return created;
  };

  const handleCreateCentroCusto = async (data) => {
    validateQuickCreateFields(data, centroCustoQuickCreateFields);
    const created = await appApi.entities.CentroCusto.create(data);
    const updateList = (current) =>
      sortByText(upsertCreatedOption(current, created), (item) => `${item.codigo || ""} ${item.descricao || ""}`);
    setLoadedCentrosCusto(updateList);
    onCentrosCustoChange?.(updateList);
    return created;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {terceirizado?.id ? "Editar Serviço Terceirizado" : "Novo Serviço Terceirizado"}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <RelatedEntitySelect
                label="Prestadora"
                value={formData.prestadora_id || ""}
                onChange={(value, createdOrSelected) => {
                  const prestadora = createdOrSelected || (loadedPrestadoras || []).find(p => p.id === value);
                  setFormData(prev => ({
                    ...prev,
                    prestadora_id: value,
                    prestadora_nome: prestadora?.nome_empresa || '',
                  }));
                }}
                options={loadedPrestadoras || []}
                optionLabel="nome_empresa"
                optionValue="id"
                placeholder="Escolha uma prestadora"
                createButtonLabel="Nova prestadora"
                modalTitle="Nova prestadora de serviço"
                createForm={({ formData: quickData, setFormData: setQuickData, disabled }) => (
                  <QuickCreateFields
                    fields={prestadoraQuickCreateFields}
                    formData={quickData}
                    setFormData={setQuickData}
                    disabled={disabled}
                  />
                )}
                onCreate={handleCreatePrestadora}
                required
              />
            </div>

            <div>
              <Label>Data do Serviço</Label>
              <Input
                type="date"
                value={formData.data_servico || ""}
                onChange={(e) => updateField('data_servico', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Serviço Realizado</Label>
            <Input
              value={formData.descricao_servico || ""}
              onChange={(e) => updateField('descricao_servico', e.target.value)}
              placeholder="Descrição do serviço realizado"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Valor do Serviço (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_servico || ""}
                onChange={(e) => updateField('valor_servico', e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div>
              <RelatedEntitySelect
                label="Centro de Custo"
                value={formData.centro_custo_id || ""}
                onChange={(value, createdOrSelected) => {
                  const cc = createdOrSelected || (loadedCentrosCusto || []).find(c => c.id === value);
                  setFormData(prev => ({
                    ...prev,
                    centro_custo_id: value,
                    centro_custo_nome: cc?.descricao || ''
                  }));
                }}
                options={loadedCentrosCusto || []}
                optionLabel={(cc) => cc.codigo ? `${cc.codigo} - ${cc.descricao}` : cc.descricao}
                optionValue="id"
                placeholder="Selecione o centro de custo"
                createButtonLabel="Novo centro"
                modalTitle="Novo centro de custo"
                createForm={({ formData: quickData, setFormData: setQuickData, disabled }) => (
                  <QuickCreateFields
                    fields={centroCustoQuickCreateFields}
                    formData={quickData}
                    setFormData={setQuickData}
                    disabled={disabled}
                  />
                )}
                onCreate={handleCreateCentroCusto}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Imagens do Serviço</Label>
              <ImageUploader
                value={formData.anexos || []}
                onChange={(list) => setFormData(prev => ({ ...prev, anexos: list }))}
                label="Adicionar imagens"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Documentos (PDF)</Label>
              <FileUploader
                value={formData.documentos || []}
                onChange={(list) => setFormData(prev => ({ ...prev, documentos: list }))}
                label="Adicionar PDFs"
                accept="application/pdf"
                className="mt-2"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
