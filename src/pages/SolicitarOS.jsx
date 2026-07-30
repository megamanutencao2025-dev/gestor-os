import React, { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { User } from "@/entities/User";
import { appApi } from "@/api/appClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "next-themes";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Camera,
  Check,
  CheckCircle,
  FileText,
  Layers,
  MessageSquare,
  Send,
  Settings,
  Upload,
  UserRound,
  X,
  Sun,
  Moon,
} from "lucide-react";
import EquipamentoSelector from "../components/EquipamentoSelector";
import ModuleLabel from "@/components/ModuleLabel";
import QrScannerDialog from "@/components/qr/QrScannerDialog";

const STEPS = [
  { id: 1, title: "Equipamento", description: "Onde está o problema?" },
  { id: 2, title: "Defeito", description: "O que aconteceu?" },
  { id: 3, title: "Detalhes", description: "Complete a solicitação" },
  { id: 4, title: "Revisão", description: "Confira e envie" },
];

const getNow = () => {
  const now = new Date();
  return {
    data_programada: now.toISOString().split("T")[0],
    hora_programada: now.toTimeString().slice(0, 5),
  };
};

const emptyForm = (requester = "") => ({
  equipamento_id: "",
  equipamento_nome: "",
  equipamento_nao_cadastrado: false,
  equipamento_descricao_livre: "",
  localizacao_celula: "",
  localizacao_setor: "",
  tipo_id: "",
  tipo_nome: "",
  area_id: "",
  area_nome: "",
  solicitante: requester,
  ...getNow(),
  descricao_defeito: "",
  observacoes: "",
  parada_completa: null,
  prioridade_id: "",
  prioridade_nome: "",
});

export default function SolicitarOS() {
  const { resolvedTheme, setTheme } = useTheme();
  const [equipamentos, setEquipamentos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [areas, setAreas] = useState([]);
  const [prioridades, setPrioridades] = useState([]);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState(() => emptyForm());
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [uploadingQR, setUploadingQR] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [showEquipamentoSelector, setShowEquipamentoSelector] = useState(false);
  const qrUploadRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [currentUser, referenceData] = await Promise.all([
        User.me().catch(() => null),
        appApi.publicSolicitation.reference(),
      ]);
      const requester = currentUser?.full_name || currentUser?.name || currentUser?.email || "";
      setUser(currentUser);
      setEquipamentos(referenceData.equipamentos || []);
      setTipos(referenceData.tipos || []);
      setAreas(referenceData.areas || []);
      setPrioridades(referenceData.prioridades || []);
      setFormData((previous) => ({ ...previous, solicitante: requester }));
    } catch (loadError) {
      setError("Erro ao carregar os dados do sistema.");
      console.error("Erro ao carregar dados:", loadError);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEquipamento = (equipamento) => {
    setShowEquipamentoSelector(false);
    if (!equipamento) return;

    const principal = equipamento.hierarquia?.[0] || equipamento;
    setFormData((previous) => ({
      ...previous,
      equipamento_id: equipamento.equipamento_id || equipamento.id,
      equipamento_nome: equipamento.equipamento_nome || equipamento.descricao,
      equipamento_nao_cadastrado: false,
      equipamento_descricao_livre: "",
      localizacao_celula: principal?.localizacao_celula || equipamento.localizacao_celula || "",
      localizacao_setor: principal?.localizacao_setor || equipamento.localizacao_setor || "",
    }));
    setError("");
  };

  const handleTipoChange = (tipoId) => {
    const tipo = tipos.find((item) => item.id === tipoId);
    setFormData((previous) => ({ ...previous, tipo_id: tipoId, tipo_nome: tipo?.descricao || "" }));
  };

  const handleAreaChange = (areaId) => {
    const area = areas.find((item) => item.id === areaId);
    setFormData((previous) => ({ ...previous, area_id: areaId, area_nome: area?.descricao || "" }));
  };

  const processQRCode = (qrData) => {
    let equipamentoId = "";
    let equipamentoCodigo = "";
    try {
      const decoded = JSON.parse(qrData);
      if (decoded && typeof decoded === "object") {
        equipamentoId = String(decoded.id || "");
        equipamentoCodigo = String(decoded.codigo || "");
      }
    } catch {
      equipamentoCodigo = String(qrData || "");
    }

    const normalizedCode = equipamentoCodigo.trim().toLocaleLowerCase("pt-BR");
    const equipamento = equipamentos.find((item) => (
      (equipamentoId && String(item.id) === equipamentoId)
      || (normalizedCode && String(item.codigo || "").trim().toLocaleLowerCase("pt-BR") === normalizedCode)
    ));

    if (!equipamento) {
      setError("QR Code lido, mas o equipamento não foi encontrado.");
      return false;
    }
    handleSelectEquipamento(equipamento);
    setCurrentStep(2);
    return true;
  };

  const handleQRUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingQR(true);
    setError("");
    try {
      const imageUrl = URL.createObjectURL(file);
      try {
        const reader = new BrowserQRCodeReader();
        const result = await reader.decodeFromImageUrl(imageUrl);
        processQRCode(result.getText());
      } finally {
        URL.revokeObjectURL(imageUrl);
      }
    } catch (qrError) {
      setError("Não foi possível ler o QR Code da imagem. Verifique a qualidade da foto.");
      console.error("Erro ao ler imagem do QR Code:", qrError);
    } finally {
      setUploadingQR(false);
      event.target.value = "";
    }
  };

  const validateStep = (step) => {
    if (step === 1 && ((!formData.equipamento_nao_cadastrado && !formData.equipamento_id) || (formData.equipamento_nao_cadastrado && !formData.equipamento_descricao_livre.trim()))) return "Selecione o equipamento ou descreva qual máquina precisa de manutenção.";
    if (step === 2 && !formData.descricao_defeito.trim()) return "Descreva o defeito para continuar.";
    if (step === 3) {
      if (!formData.tipo_id) return "Selecione o tipo de manutenção.";
      if (formData.parada_completa === null) return "Informe se a máquina realmente parou com o defeito.";
    }
    return "";
  };

  const goNext = () => {
    const validationError = validateStep(currentStep);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setCurrentStep((step) => Math.min(step + 1, STEPS.length));
  };

  const goBack = () => {
    setError("");
    setCurrentStep((step) => Math.max(step - 1, 1));
  };

  const generateOSNumber = async () => {
    const allOS = await appApi.publicSolicitation.ordens();
    const numbers = (allOS || [])
      .map((os) => Number(os.numero?.match(/^OS-(\d+)$/)?.[1] || 0))
      .filter((number) => number > 0);
    return `OS-${String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(3, "0")}`;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    for (const step of [1, 2, 3]) {
      const validationError = validateStep(step);
      if (validationError) {
        setCurrentStep(step);
        setError(validationError);
        return;
      }
    }

    setSubmitting(true);
    try {
      const numero = await generateOSNumber();
      const referenceData = await appApi.publicSolicitation.reference();
      const statusList = referenceData.status || [];
      const statusSolicitado = statusList.find((status) => /solicitado|pendente|aberto/i.test(status.descricao)) || statusList[0];
      const osData = {
        numero,
        equipamento_id: formData.equipamento_id,
        equipamento_nome: equipmentDisplayName,
        equipamento_nao_cadastrado: !formData.equipamento_id,
        equipamento_descricao_livre: formData.equipamento_descricao_livre.trim(),
        localizacao_celula: formData.localizacao_celula,
        localizacao_setor: formData.localizacao_setor,
        tipo_id: formData.tipo_id,
        tipo_nome: formData.tipo_nome,
        area_id: formData.area_id,
        area_nome: formData.area_nome,
        solicitante: formData.solicitante,
        data_programada: formData.data_programada,
        hora_programada: formData.hora_programada,
        descricao_defeito: formData.descricao_defeito,
        observacoes: formData.observacoes,
        parada_completa: formData.parada_completa === true,
        maquina_parada: formData.parada_completa === true,
        prioridade_id: formData.prioridade_id,
        prioridade_nome: formData.prioridade_nome,
        status_id: statusSolicitado?.id,
        status_nome: statusSolicitado?.descricao,
        servicos: [],
        materiais: [],
        outros: [],
        valor_total_servicos: 0,
        valor_total_materiais: 0,
        valor_total_outros: 0,
        valor_total_geral: 0,
        is_solicitacao: true,
      };
      const novaOS = await appApi.publicSolicitation.createOrdem(osData);
      await appApi.publicSolicitation.createNotificacao({
        ordem_servico_id: novaOS.id,
        tipo_notificacao: "nova_solicitacao",
        mensagem: `Nova solicitação de OS #${numero} - ${equipmentDisplayName}`,
      });
      setSuccess(true);
      setFormData(emptyForm(user?.full_name || user?.name || user?.email || ""));
      setCurrentStep(1);
    } catch (submitError) {
      const apiErrors = submitError.payload?.errors
        ?.map((item) => item?.message)
        .filter(Boolean)
        .join(" ");
      setError(apiErrors || submitError.message || "Erro ao enviar solicitação. Tente novamente.");
      console.error("Erro ao enviar solicitação:", submitError);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md border-slate-200 shadow-sm">
          <CardContent className="p-8 text-center">
            <CheckCircle className="mx-auto mb-4 h-14 w-14 text-emerald-500" />
            <h2 className="mb-2 text-2xl font-semibold text-slate-900">Solicitação enviada</h2>
            <p className="mb-6 text-sm leading-6 text-slate-600">A equipe de manutenção recebeu sua solicitação e fará a análise.</p>
            <Button onClick={() => setSuccess(false)} className="w-full bg-blue-600 hover:bg-blue-700">Fazer nova solicitação</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const step = STEPS[currentStep - 1];
  const requesterName = formData.solicitante || "Usuário autenticado";
  const selectedPriority = prioridades.find((priority) => priority.id === formData.prioridade_id);
  const isDarkTheme = resolvedTheme === "dark";
  const equipmentDisplayName = formData.equipamento_id
    ? formData.equipamento_nome
    : formData.equipamento_descricao_livre.trim()
      ? `Não cadastrado: ${formData.equipamento_descricao_livre.trim()}`
      : "";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div><ModuleLabel>Solicitar OS</ModuleLabel><p className="mt-1 text-sm text-slate-500">Abra um chamado de manutenção em poucos passos.</p></div>
          <div className="flex shrink-0 items-center gap-2"><Button type="button" variant="ghost" size="icon" onClick={() => setTheme(isDarkTheme ? "light" : "dark")} className="h-9 w-9" aria-label={isDarkTheme ? "Ativar modo claro" : "Ativar modo escuro"} title={isDarkTheme ? "Ativar modo claro" : "Ativar modo escuro"}>{isDarkTheme ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</Button><div className="flex max-w-[160px] items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"><UserRound className="h-4 w-4 shrink-0 text-blue-600" /><span className="truncate">{requesterName}</span></div></div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-8">
        <nav aria-label="Etapas da solicitação" className="mb-5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex items-center justify-between gap-1 sm:gap-3">
            {STEPS.map((item, index) => (
              <React.Fragment key={item.id}>
                <button type="button" onClick={() => item.id < currentStep && setCurrentStep(item.id)} disabled={item.id > currentStep} className={`flex min-w-0 items-center gap-2 text-left ${item.id <= currentStep ? "text-blue-700" : "text-slate-400"}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${item.id < currentStep ? "border-blue-600 bg-blue-600 text-white" : item.id === currentStep ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-300 bg-white"}`}>{item.id < currentStep ? <Check className="h-4 w-4" /> : item.id}</span>
                  <span className="hidden min-w-0 sm:block"><span className="block text-xs font-semibold">{item.title}</span><span className="block truncate text-[11px] text-slate-500">{item.description}</span></span>
                </button>
                {index < STEPS.length - 1 && <span className={`h-px flex-1 ${item.id < currentStep ? "bg-blue-600" : "bg-slate-200"}`} />}
              </React.Fragment>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 sm:hidden"><span>Etapa {currentStep} de {STEPS.length}</span><span className="font-medium text-slate-700">{step.title}</span></div>
        </nav>

        {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

        <form onSubmit={handleSubmit}>
          {currentStep === 1 && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Settings className="h-5 w-5 text-orange-600" />1. Escolha o equipamento</CardTitle><p className="text-sm text-slate-500">Comece indicando onde o problema está acontecendo.</p></CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <Label className="mb-3 flex items-center gap-2 font-medium text-blue-900"><Camera className="h-4 w-4" />Encontrar pelo QR Code <span className="font-normal text-blue-700">(opcional)</span></Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input ref={qrUploadRef} type="file" accept="image/*" onChange={handleQRUpload} className="hidden" />
                    <Button type="button" onClick={() => setCameraOpen(true)} disabled={uploadingQR} className="bg-blue-600 hover:bg-blue-700"><Camera className="mr-2 h-4 w-4" />Abrir câmera</Button>
                    <Button type="button" variant="outline" onClick={() => qrUploadRef.current?.click()} disabled={uploadingQR}>{uploadingQR ? <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600" />Lendo...</> : <><Upload className="mr-2 h-4 w-4" />Usar uma foto</>}</Button>
                  </div>
                </div>
                <div className="space-y-3">
                  {!formData.equipamento_nao_cadastrado && <>
                    <Label>Equipamento ou conjunto <span className="text-red-500">*</span></Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => setShowEquipamentoSelector(true)} className="min-h-11 flex-1 justify-start text-left font-normal">{formData.equipamento_nome || "Toque para selecionar"}</Button>
                      {formData.equipamento_id && <Button type="button" variant="outline" size="icon" aria-label="Limpar equipamento" onClick={() => setFormData((previous) => ({ ...previous, equipamento_id: "", equipamento_nome: "", localizacao_celula: "", localizacao_setor: "" }))}><X className="h-4 w-4" /></Button>}
                    </div>
                    {formData.equipamento_id ? <div className="grid grid-cols-1 gap-2 rounded-lg border bg-slate-50 p-3 text-sm sm:grid-cols-2"><div><span className="block text-xs text-slate-500">Célula</span><span className="font-medium text-slate-800">{formData.localizacao_celula || "-"}</span></div><div><span className="block text-xs text-slate-500">Setor</span><span className="font-medium text-slate-800">{formData.localizacao_setor || "-"}</span></div></div> : <p className="text-xs text-slate-500">Você pode escolher o equipamento principal ou um componente específico.</p>}
                  </>}
                  <button type="button" className="text-left text-sm font-medium text-blue-700 underline-offset-4 hover:underline" onClick={() => setFormData((previous) => ({ ...previous, equipamento_nao_cadastrado: !previous.equipamento_nao_cadastrado, equipamento_id: "", equipamento_nome: "", equipamento_descricao_livre: "", localizacao_celula: "", localizacao_setor: "" }))}>{formData.equipamento_nao_cadastrado ? "Voltar para escolher um equipamento cadastrado" : "Não encontrei a máquina no cadastro"}</button>
                  {formData.equipamento_nao_cadastrado && <div><Label htmlFor="equipamento_descricao_livre">Qual máquina precisa de manutenção? <span className="text-red-500">*</span></Label><Textarea id="equipamento_descricao_livre" autoFocus value={formData.equipamento_descricao_livre} onChange={(event) => setFormData((previous) => ({ ...previous, equipamento_descricao_livre: event.target.value }))} placeholder="Informe o nome, código, localização ou outra referência da máquina." rows={4} className="mt-2 resize-none" /><p className="mt-1 text-xs text-slate-500">A equipe poderá cadastrar o equipamento depois.</p></div>}
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><MessageSquare className="h-5 w-5 text-blue-600" />2. Descreva o defeito</CardTitle><p className="text-sm text-slate-500">Quanto mais detalhes, mais rápido o diagnóstico.</p></CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><span className="text-xs text-slate-500">Equipamento informado</span><p className="mt-1 font-medium text-slate-900">{equipmentDisplayName || "-"}</p></div>
                <div><Label htmlFor="solicitante">Solicitante</Label><Input id="solicitante" value={requesterName} readOnly className="mt-2 min-h-11 bg-slate-50 text-slate-700" /><p className="mt-1 text-xs text-slate-500">Preenchido automaticamente pelo usuário logado.</p></div>
                <div><Label htmlFor="descricao_defeito">O que aconteceu? <span className="text-red-500">*</span></Label><Textarea id="descricao_defeito" autoFocus value={formData.descricao_defeito} onChange={(event) => setFormData((previous) => ({ ...previous, descricao_defeito: event.target.value }))} placeholder="Ex.: A esteira parou e emite um ruído metálico..." rows={7} className="mt-2 resize-none" /></div>
                <div><Label htmlFor="observacoes">Observações adicionais <span className="font-normal text-slate-400">(opcional)</span></Label><Textarea id="observacoes" value={formData.observacoes} onChange={(event) => setFormData((previous) => ({ ...previous, observacoes: event.target.value }))} placeholder="Informe sintomas, riscos ou informações úteis." rows={4} className="mt-2 resize-none" /></div>
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Layers className="h-5 w-5 text-slate-600" />3. Complete os detalhes</CardTitle><p className="text-sm text-slate-500">Essas informações ajudam a equipe a priorizar o atendimento.</p></CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><Label htmlFor="tipo">Tipo de manutenção <span className="text-red-500">*</span></Label><Select value={formData.tipo_id} onValueChange={handleTipoChange}><SelectTrigger id="tipo" className="mt-2 min-h-11"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger><SelectContent>{tipos.map((tipo) => <SelectItem key={tipo.id} value={tipo.id}>{tipo.descricao}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="area">Área de manutenção <span className="font-normal text-slate-400">(opcional)</span></Label><Select value={formData.area_id} onValueChange={handleAreaChange}><SelectTrigger id="area" className="mt-2 min-h-11"><SelectValue placeholder="Selecione a área" /></SelectTrigger><SelectContent>{areas.map((area) => <SelectItem key={area.id} value={area.id}>{area.descricao}</SelectItem>)}</SelectContent></Select></div></div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><Label htmlFor="data_programada"><Calendar className="mr-1 inline h-4 w-4" />Data desejada</Label><Input id="data_programada" type="date" value={formData.data_programada} onChange={(event) => setFormData((previous) => ({ ...previous, data_programada: event.target.value }))} className="mt-2 min-h-11" /></div><div><Label htmlFor="hora_programada">Horário desejado</Label><Input id="hora_programada" type="time" value={formData.hora_programada} onChange={(event) => setFormData((previous) => ({ ...previous, hora_programada: event.target.value }))} className="mt-2 min-h-11" /></div></div>
                <div className={`rounded-lg border p-4 transition-colors ${formData.parada_completa === null ? "border-destructive/45 bg-destructive/[0.04]" : "border-border bg-muted/25"}`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <Label className="font-semibold text-foreground">A máquina parou completamente? <span className="text-red-500">*</span></Label>
                      <p className="mt-1 text-xs text-muted-foreground">Marque uma opção para registrar corretamente a solicitação.</p>
                    </div>
                    {formData.parada_completa === null && (
                      <span className="shrink-0 rounded-full border border-destructive/25 bg-destructive/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-destructive">Obrigatório</span>
                    )}
                  </div>
                  <RadioGroup
                    value={formData.parada_completa === null ? "" : formData.parada_completa ? "sim" : "nao"}
                    onValueChange={(value) => setFormData((previous) => ({ ...previous, parada_completa: value === "sim" }))}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                  >
                    <label htmlFor="parada-sim" className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border bg-background/60 p-3 transition-colors ${formData.parada_completa === true ? "border-emerald-500/70 bg-emerald-500/10" : "border-border hover:border-emerald-500/50 hover:bg-emerald-500/[0.04]"}`}>
                      <RadioGroupItem id="parada-sim" value="sim" />
                      <span>
                        <span className="block text-sm font-medium text-foreground">Sim, a máquina parou</span>
                        <span className="block text-xs text-muted-foreground">O defeito interrompeu a operação.</span>
                      </span>
                    </label>
                    <label htmlFor="parada-nao" className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border bg-background/60 p-3 transition-colors ${formData.parada_completa === false ? "border-amber-500/70 bg-amber-500/10" : "border-border hover:border-amber-500/50 hover:bg-amber-500/[0.04]"}`}>
                      <RadioGroupItem id="parada-nao" value="nao" />
                      <span>
                        <span className="block text-sm font-medium text-foreground">Não, continuou operando</span>
                        <span className="block text-xs text-muted-foreground">A equipe pode programar a intervenção.</span>
                      </span>
                    </label>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 4 && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5 text-blue-600" />4. Revise sua solicitação</CardTitle><p className="text-sm text-slate-500">Confira os dados antes de enviar para a manutenção.</p></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 rounded-xl border bg-slate-50 p-4 text-sm sm:grid-cols-2"><div><span className="block text-xs text-slate-500">Solicitante</span><span className="font-medium">{requesterName}</span></div><div><span className="block text-xs text-slate-500">Equipamento</span><span className="font-medium">{equipmentDisplayName}</span></div><div><span className="block text-xs text-slate-500">Tipo</span><span className="font-medium">{formData.tipo_nome}</span></div><div><span className="block text-xs text-slate-500">Área</span><span className="font-medium">{formData.area_nome || "Não informada"}</span></div><div><span className="block text-xs text-slate-500">Parada completa</span><span className="font-medium">{formData.parada_completa ? "Sim" : "Não"}</span></div><div><span className="block text-xs text-slate-500">Prioridade</span><span className="font-medium">{selectedPriority?.descricao || "Não informada"}</span></div></div>
                <div><span className="text-xs text-slate-500">Descrição do defeito</span><p className="mt-1 whitespace-pre-wrap rounded-lg border p-3 text-sm text-slate-800">{formData.descricao_defeito}</p></div>
                <div><Label htmlFor="prioridade">Grau de prioridade <span className="font-normal text-slate-400">(opcional)</span></Label><Select value={formData.prioridade_id} onValueChange={(value) => { const priority = prioridades.find((item) => item.id === value); setFormData((previous) => ({ ...previous, prioridade_id: value, prioridade_nome: priority?.descricao || "" })); }}><SelectTrigger id="prioridade" className="mt-2 min-h-11"><SelectValue placeholder="Selecione a prioridade" /></SelectTrigger><SelectContent>{prioridades.map((priority) => <SelectItem key={priority.id} value={priority.id}>{priority.descricao}</SelectItem>)}</SelectContent></Select></div>
                <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>O nome será registrado conforme o usuário autenticado: <strong>{requesterName}</strong>.</span></div>
              </CardContent>
            </Card>
          )}

          <div className="mt-5 flex gap-2 sm:justify-between"><Button type="button" variant="outline" onClick={currentStep === 1 ? () => window.history.back() : goBack} disabled={submitting} className="min-h-11 flex-1 sm:flex-none">{currentStep === 1 ? <><X className="mr-2 h-4 w-4" />Cancelar</> : <><ArrowLeft className="mr-2 h-4 w-4" />Voltar</>}</Button>{currentStep < STEPS.length ? <Button type="button" onClick={goNext} className="min-h-11 flex-1 bg-blue-600 hover:bg-blue-700 sm:flex-none sm:px-8">Continuar<ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button type="submit" disabled={submitting} className="min-h-11 flex-1 bg-blue-600 hover:bg-blue-700 sm:flex-none sm:px-8">{submitting ? <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />Enviando...</> : <><Send className="mr-2 h-4 w-4" />Enviar solicitação</>}</Button>}</div>
          <p className="mt-4 text-center text-xs text-slate-500">O atendimento será analisado pela equipe de manutenção.</p>
        </form>
      </main>

      <EquipamentoSelector isOpen={showEquipamentoSelector} onClose={() => setShowEquipamentoSelector(false)} equipamentos={equipamentos} onSelectEquipamento={handleSelectEquipamento} allowMultiple={false} />
      <QrScannerDialog open={cameraOpen} onOpenChange={setCameraOpen} onDetected={processQRCode} />
    </div>
  );
}
