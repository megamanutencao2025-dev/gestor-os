import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Bot,
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  Gift,
  Info,
  Loader2,
  Lock,
  MessagesSquare,
  Sparkles,
  Tags,
  XCircle,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DEFAULT_PROVIDERS = [
  {
    id: "gemini",
    name: "Google Gemini",
    freeTier: true,
    dailyLimit: 1500,
    remaining: 1500,
    speed: "medio",
    strengths: ["Contexto longo", "equilibrado", "multimodal"],
  },
  {
    id: "groq",
    name: "Groq",
    freeTier: true,
    dailyLimit: 1000,
    remaining: 1000,
    speed: "rapido",
    strengths: ["Muito rapida", "respostas curtas", "baixo custo"],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    freeTier: true,
    dailyLimit: 50,
    remaining: 50,
    speed: "medio",
    strengths: ["Raciocinio", "codigo", "32k tokens"],
  },
  {
    id: "cohere",
    name: "Cohere",
    freeTier: true,
    dailyLimit: 500,
    remaining: 500,
    speed: "medio",
    strengths: ["RAG", "documentos", "citacoes"],
  },
];

const PROVIDER_LOOKUP = {
  gemini: {
    name: "Google Gemini",
    icon: Sparkles,
    color: "gemini",
    speed: "medio",
    strengths: ["Contexto longo", "equilibrado", "multimodal"],
  },
  groq: {
    name: "Groq",
    icon: Zap,
    color: "groq",
    speed: "rapido",
    strengths: ["Muito rapida", "baixa latencia", "respostas curtas"],
  },
  deepseek: {
    name: "DeepSeek",
    icon: BrainCircuit,
    color: "deepseek",
    speed: "medio",
    strengths: ["Raciocinio", "codigo", "32k tokens"],
  },
  cohere: {
    name: "Cohere",
    icon: FileText,
    color: "cohere",
    speed: "medio",
    strengths: ["RAG", "documentos", "citacoes"],
  },
  openai: {
    name: "OpenAI",
    icon: Bot,
    color: "openai",
    speed: "medio",
    strengths: ["Geral", "qualidade", "ferramentas"],
  },
};

const COLOR_STYLES = {
  gemini: {
    shell: "from-sky-500/15 via-cyan-500/10 to-white/30 dark:to-slate-900/40",
    border: "border-sky-200/80 dark:border-sky-800/70",
    icon: "bg-sky-500 text-white shadow-sky-500/20",
    text: "text-sky-700 dark:text-sky-300",
    bar: "bg-sky-500",
    soft: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  },
  groq: {
    shell: "from-orange-500/15 via-amber-500/10 to-white/30 dark:to-slate-900/40",
    border: "border-orange-200/80 dark:border-orange-800/70",
    icon: "bg-orange-500 text-white shadow-orange-500/20",
    text: "text-orange-700 dark:text-orange-300",
    bar: "bg-orange-500",
    soft: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
  },
  deepseek: {
    shell: "from-indigo-500/15 via-blue-500/10 to-white/30 dark:to-slate-900/40",
    border: "border-indigo-200/80 dark:border-indigo-800/70",
    icon: "bg-indigo-500 text-white shadow-indigo-500/20",
    text: "text-indigo-700 dark:text-indigo-300",
    bar: "bg-indigo-500",
    soft: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
  },
  cohere: {
    shell: "from-emerald-500/15 via-teal-500/10 to-white/30 dark:to-slate-900/40",
    border: "border-emerald-200/80 dark:border-emerald-800/70",
    icon: "bg-emerald-500 text-white shadow-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
    soft: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  },
  openai: {
    shell: "from-slate-500/15 via-zinc-500/10 to-white/30 dark:to-slate-900/40",
    border: "border-slate-200/80 dark:border-slate-700",
    icon: "bg-slate-700 text-white shadow-slate-500/20",
    text: "text-slate-700 dark:text-slate-300",
    bar: "bg-slate-700 dark:bg-slate-300",
    soft: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
  },
  default: {
    shell: "from-blue-500/15 via-slate-500/10 to-white/30 dark:to-slate-900/40",
    border: "border-blue-200/80 dark:border-blue-800/70",
    icon: "bg-blue-600 text-white shadow-blue-500/20",
    text: "text-blue-700 dark:text-blue-300",
    bar: "bg-blue-600",
    soft: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  },
};

function clampPercent(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.max(0, Math.min(100, numberValue));
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function formatNumber(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "--";
  return new Intl.NumberFormat("pt-BR").format(numberValue);
}

function formatCost(value, currency = "USD") {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "Sob consulta";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: numberValue < 1 ? 4 : 2,
  }).format(numberValue);
}

function getProviderBase(id) {
  const key = String(id || "").toLowerCase();
  return PROVIDER_LOOKUP[key] || PROVIDER_LOOKUP[Object.keys(PROVIDER_LOOKUP).find((item) => key.includes(item))] || {};
}

function normalizeProvider(rawProvider = {}) {
  const id = String(rawProvider.id || rawProvider.provider || rawProvider.key || rawProvider.name || "").trim();
  const base = getProviderBase(id);
  const quota = rawProvider.quota || {};
  const localUsage = quota.localUsage || rawProvider.localUsage || {};
  const dailyLimit = Number(rawProvider.dailyLimit ?? quota.dailyLimit ?? rawProvider.limit ?? 0);
  const remainingRaw = rawProvider.remaining ?? quota.remaining;
  const usedRaw = rawProvider.used ?? rawProvider.requestsUsed ?? localUsage.requests;
  const used = Number.isFinite(Number(usedRaw)) ? Number(usedRaw) : Math.max(0, dailyLimit - Number(remainingRaw || 0));
  const remaining = Number.isFinite(Number(remainingRaw)) ? Number(remainingRaw) : Math.max(0, dailyLimit - used);
  const usagePercent = dailyLimit > 0 ? clampPercent((used / dailyLimit) * 100) : clampPercent(rawProvider.usagePercent);
  const remainingPercent = dailyLimit > 0 ? clampPercent((remaining / dailyLimit) * 100) : 100;
  const available = rawProvider.available !== false
    && rawProvider.enabled !== false
    && rawProvider.configured !== false
    && quota.configured !== false
    && rawProvider.status !== "disabled"
    && rawProvider.status !== "error"
    && !quota.exhausted;
  const paid = Boolean(rawProvider.paid || rawProvider.billing === "paid" || rawProvider.freeTier === false || quota.freeTier === false);
  const estimatedCost = rawProvider.estimatedCost ?? rawProvider.cost?.estimatedCost ?? quota.estimatedCost;

  return {
    ...rawProvider,
    id,
    name: rawProvider.name || base.name || id || "Provider",
    icon: rawProvider.icon || base.icon || Bot,
    color: rawProvider.color || base.color || "default",
    category: available ? (paid ? "paid" : "free") : "unavailable",
    available,
    paid,
    freeTier: !paid,
    speed: rawProvider.speed || base.speed || "medio",
    strengths: toArray(rawProvider.strengths || rawProvider.forces || rawProvider.tags || base.strengths).slice(0, 4),
    dailyLimit,
    remaining,
    used,
    usagePercent,
    remainingPercent,
    estimatedCost,
    currency: rawProvider.currency || rawProvider.cost?.currency || "USD",
    statusMessage: rawProvider.statusMessage || rawProvider.message || rawProvider.health?.message || "",
  };
}

function getSpeedLabel(speed) {
  const normalized = String(speed || "").toLowerCase();
  if (normalized.includes("fast") || normalized.includes("rap")) return "rapido";
  if (normalized.includes("slow") || normalized.includes("lent")) return "lento";
  return "medio";
}

function getSpeedClasses(speed) {
  const label = getSpeedLabel(speed);
  if (label === "rapido") return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
  if (label === "lento") return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
  return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
}

function UsageBar({ value, colorClass, className }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500 ease-out", colorClass)}
        style={{ width: `${clampPercent(value)}%` }}
      />
    </div>
  );
}

function ProviderAvatar({ provider, size = "md" }) {
  const Icon = provider.icon || Bot;
  const colors = COLOR_STYLES[provider.color] || COLOR_STYLES.default;
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg shadow-lg transition-transform duration-300",
        colors.icon,
        size === "sm" ? "h-8 w-8" : "h-11 w-11",
      )}
    >
      <Icon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
    </div>
  );
}

function ProviderOption({ provider }) {
  const colors = COLOR_STYLES[provider.color] || COLOR_STYLES.default;
  return (
    <div className="flex w-full min-w-0 items-center gap-3 py-1">
      <ProviderAvatar provider={provider} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{provider.name}</span>
          {provider.paid ? (
            <CreditCard className="h-3.5 w-3.5 text-amber-600" />
          ) : (
            <Gift className="h-3.5 w-3.5 text-emerald-600" />
          )}
        </div>
        {provider.category === "free" && (
          <div className="mt-1 flex items-center gap-2">
            <UsageBar value={100 - provider.usagePercent} colorClass={colors.bar} className="h-1.5" />
            <span className="w-16 text-right text-[11px] text-slate-500 dark:text-slate-400">
              {formatNumber(provider.remaining)}
            </span>
          </div>
        )}
        {provider.category === "paid" && (
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {formatCost(provider.estimatedCost, provider.currency)} estimado
          </div>
        )}
        {provider.category === "unavailable" && (
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {provider.statusMessage || "Configure a chave de API para usar"}
          </div>
        )}
      </div>
    </div>
  );
}

function AlertItem({ type = "info", title, description, action }) {
  const Icon = type === "danger" ? XCircle : type === "warning" ? AlertTriangle : Info;
  const styles = {
    info: "border-blue-200 bg-blue-50/80 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100",
    warning: "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
    danger: "border-red-200 bg-red-50/80 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100",
  };

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors duration-300", styles[type])}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        {description && <div className="mt-0.5 text-xs opacity-80">{description}</div>}
      </div>
      {action}
    </div>
  );
}

export default function ProviderSelector({
  currentProvider,
  sessionContext = {},
  onProviderChange,
  availableProviders = DEFAULT_PROVIDERS,
}) {
  const [localProvider, setLocalProvider] = useState(currentProvider || "");
  const [changeState, setChangeState] = useState("idle");
  const [feedback, setFeedback] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    if (currentProvider) setLocalProvider(currentProvider);
  }, [currentProvider]);

  const providers = useMemo(() => {
    const source = Array.isArray(availableProviders) && availableProviders.length > 0
      ? availableProviders
      : DEFAULT_PROVIDERS;
    return source.map(normalizeProvider).filter((provider) => provider.id);
  }, [availableProviders]);

  const groupedProviders = useMemo(() => ({
    free: providers.filter((provider) => provider.category === "free"),
    paid: providers.filter((provider) => provider.category === "paid"),
    unavailable: providers.filter((provider) => provider.category === "unavailable"),
  }), [providers]);

  const selectedProvider = providers.find((provider) => provider.id === (currentProvider || localProvider))
    || providers.find((provider) => provider.available)
    || providers[0]
    || normalizeProvider(DEFAULT_PROVIDERS[0]);
  const selectedColors = COLOR_STYLES[selectedProvider.color] || COLOR_STYLES.default;
  const messageCount = Number(sessionContext.messageCount ?? sessionContext.messages?.length ?? 0);
  const providersUsed = toArray(sessionContext.providersUsed || sessionContext.providerHistory)
    .map((item) => (typeof item === "string" ? item : item?.provider || item?.toProvider || item?.fromProvider))
    .filter(Boolean);
  const topics = toArray(sessionContext.topics)
    .map((item) => (typeof item === "string" ? item : item?.topic || item?.name))
    .filter(Boolean)
    .slice(0, 8);
  const summary = typeof sessionContext.summary === "string"
    ? sessionContext.summary
    : sessionContext.summary?.content || sessionContext.summaryText || "Resumo ainda nao disponivel para esta sessao.";
  const estimatedTokens = Number(sessionContext.estimatedTokens || sessionContext.tokens || 0);
  const maxTokens = Number(sessionContext.maxTokens || sessionContext.maxContextTokens || 8000);
  const contextPercent = maxTokens > 0 ? clampPercent((estimatedTokens / maxTokens) * 100) : 0;
  const suggestedProvider = providers.find((provider) => (
    provider.available
    && provider.id !== selectedProvider.id
    && provider.category === "free"
    && provider.remainingPercent > 30
  ));

  const alerts = [
    selectedProvider.available && selectedProvider.category === "free" && selectedProvider.remainingPercent <= 15 && {
      type: "warning",
      title: "Provider proximo do limite",
      description: `Restam ${formatNumber(selectedProvider.remaining)} requisicoes no plano gratuito.`,
    },
    selectedProvider.category === "paid" && {
      type: "warning",
      title: "Mudanca para provider pago",
      description: `Custo estimado: ${formatCost(selectedProvider.estimatedCost, selectedProvider.currency)} por uso monitorado.`,
    },
    contextPercent >= 85 && {
      type: "danger",
      title: "Contexto muito longo",
      description: "A conversa esta perto do limite de contexto. O sistema pode resumir mensagens antigas automaticamente.",
    },
    suggestedProvider && (selectedProvider.remainingPercent <= 15 || contextPercent >= 85) && {
      type: "info",
      title: "Sugestao de troca",
      description: `${suggestedProvider.name} tem mais limite disponivel e o contexto sera mantido.`,
      action: (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 border-current bg-white/40 px-2 text-xs hover:bg-white/70 dark:bg-slate-900/30 dark:hover:bg-slate-900/60"
          onClick={() => handleProviderChange(suggestedProvider.id)}
        >
          Trocar
        </Button>
      ),
    },
  ].filter(Boolean);

  async function handleProviderChange(nextProviderId) {
    const nextProvider = providers.find((provider) => provider.id === nextProviderId);
    if (!nextProvider || nextProvider.id === selectedProvider.id || !nextProvider.available) return;

    const previousProviderId = selectedProvider.id;
    setLocalProvider(nextProvider.id);
    setChangeState("loading");
    setFeedback(`Trocando para ${nextProvider.name}. O contexto da sessao sera mantido.`);

    try {
      await onProviderChange?.(nextProvider.id, nextProvider);
      setChangeState("success");
      setFeedback(`${nextProvider.name} ativo. Contexto preservado com sucesso.`);
      window.setTimeout(() => setChangeState("idle"), 2200);
    } catch (error) {
      setLocalProvider(previousProviderId);
      setChangeState("error");
      setFeedback(error?.message || "Nao foi possivel trocar de provider.");
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-gradient-to-br p-3 shadow-sm backdrop-blur-xl transition-all duration-300 sm:p-4",
        "bg-white/70 dark:bg-slate-950/70",
        selectedColors.shell,
        selectedColors.border,
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Provider de IA
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Selecione a IA sem perder o contexto da conversa.
              </div>
            </div>

            <Select value={selectedProvider.id} onValueChange={handleProviderChange}>
              <SelectTrigger className="h-11 min-w-0 border-white/70 bg-white/70 shadow-sm transition-colors duration-300 dark:border-slate-700 dark:bg-slate-900/70 sm:w-72">
                <div className="flex min-w-0 items-center gap-2">
                  <ProviderAvatar provider={selectedProvider} size="sm" />
                  <div className="min-w-0 text-left">
                    <div className="truncate text-sm font-semibold">{selectedProvider.name}</div>
                    <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {selectedProvider.category === "paid" ? "Pago" : selectedProvider.available ? "Gratuito" : "Indisponivel"}
                    </div>
                  </div>
                </div>
              </SelectTrigger>
              <SelectContent className="w-[min(92vw,360px)] border-white/70 bg-white/95 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/95">
                <SelectGroup>
                  <SelectLabel className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                    <Gift className="h-3.5 w-3.5" />
                    Gratuitos
                  </SelectLabel>
                  {groupedProviders.free.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-slate-500">Nenhum provider gratuito disponivel.</div>
                  ) : groupedProviders.free.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      <ProviderOption provider={provider} />
                    </SelectItem>
                  ))}
                </SelectGroup>

                <SelectSeparator />

                <SelectGroup>
                  <SelectLabel className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                    <CreditCard className="h-3.5 w-3.5" />
                    Pagos
                  </SelectLabel>
                  {groupedProviders.paid.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-slate-500">Nenhum provider pago configurado.</div>
                  ) : groupedProviders.paid.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      <ProviderOption provider={provider} />
                    </SelectItem>
                  ))}
                </SelectGroup>

                <SelectSeparator />

                <SelectGroup>
                  <SelectLabel className="flex items-center gap-2 text-xs text-slate-500">
                    <Lock className="h-3.5 w-3.5" />
                    Indisponiveis
                  </SelectLabel>
                  {groupedProviders.unavailable.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-slate-500">Nenhum provider bloqueado.</div>
                  ) : groupedProviders.unavailable.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id} disabled>
                      <ProviderOption provider={provider} />
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-white/70 bg-white/60 p-4 shadow-sm transition-all duration-300 dark:border-slate-700 dark:bg-slate-900/60">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <ProviderAvatar provider={selectedProvider} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
                    {selectedProvider.name}
                  </h3>
                  <Badge variant="outline" className={cn("border", selectedColors.soft)}>
                    {selectedProvider.paid ? "Pago" : "Gratuito"}
                  </Badge>
                  <Badge variant="outline" className={cn("border", getSpeedClasses(selectedProvider.speed))}>
                    <Clock3 className="mr-1 h-3 w-3" />
                    {getSpeedLabel(selectedProvider.speed)}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedProvider.strengths.map((strength) => (
                    <Badge key={strength} variant="outline" className="border-white/80 bg-white/60 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
                      {strength}
                    </Badge>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Limite restante</span>
                      <span>{formatNumber(selectedProvider.remaining)} / {formatNumber(selectedProvider.dailyLimit)}</span>
                    </div>
                    <UsageBar value={selectedProvider.remainingPercent} colorClass={selectedColors.bar} />
                  </div>

                  <div className="rounded-lg border border-white/70 bg-white/50 p-3 text-sm dark:border-slate-700 dark:bg-slate-950/40">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <CircleDollarSign className="h-4 w-4" />
                      Custo estimado
                    </div>
                    <div className="mt-1 font-semibold text-slate-950 dark:text-slate-50">
                      {selectedProvider.paid
                        ? formatCost(selectedProvider.estimatedCost, selectedProvider.currency)
                        : "Sem custo no plano gratuito"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {(changeState !== "idle" || alerts.length > 0) && (
            <div className="space-y-2 transition-all duration-300">
              {changeState !== "idle" && (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-300",
                    changeState === "loading" && "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
                    changeState === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
                    changeState === "error" && "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
                  )}
                >
                  {changeState === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {changeState === "success" && <CheckCircle2 className="h-4 w-4" />}
                  {changeState === "error" && <XCircle className="h-4 w-4" />}
                  <span>{feedback}</span>
                </div>
              )}

              {alerts.map((alert) => (
                <AlertItem key={`${alert.title}-${alert.description}`} {...alert} />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-white/70 bg-white/60 p-4 shadow-sm transition-all duration-300 dark:border-slate-700 dark:bg-slate-900/60">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Contexto da sessao
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Historico preservado entre providers.
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-white/70 bg-white/60 text-xs dark:border-slate-700 dark:bg-slate-950/40"
              onClick={() => setSummaryOpen(true)}
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Resumo
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/70 bg-white/50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <MessagesSquare className="h-4 w-4" />
                Mensagens
              </div>
              <div className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-50">
                {formatNumber(messageCount)}
              </div>
            </div>

            <div className="rounded-lg border border-white/70 bg-white/50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <ArrowRightLeft className="h-4 w-4" />
                IAs usadas
              </div>
              <div className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-50">
                {formatNumber(new Set(providersUsed).size)}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Bot className="h-4 w-4" />
              Providers anteriores
            </div>
            <div className="flex flex-wrap gap-2">
              {providersUsed.length > 0 ? providersUsed.map((providerId) => (
                <Badge key={providerId} variant="outline" className="border-white/80 bg-white/60 text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200">
                  {getProviderBase(providerId).name || providerId}
                </Badge>
              )) : (
                <span className="text-xs text-slate-500 dark:text-slate-400">Nenhuma IA anterior nesta sessao.</span>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Tags className="h-4 w-4" />
              Topicos detectados
            </div>
            <div className="flex flex-wrap gap-2">
              {topics.length > 0 ? topics.map((topic) => (
                <Badge key={topic} variant="outline" className={cn("border", selectedColors.soft)}>
                  {topic}
                </Badge>
              )) : (
                <span className="text-xs text-slate-500 dark:text-slate-400">Os topicos aparecem conforme a conversa evolui.</span>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Uso do contexto</span>
              <span>{formatNumber(estimatedTokens)} / {formatNumber(maxTokens)} tokens</span>
            </div>
            <UsageBar
              value={contextPercent}
              colorClass={contextPercent >= 85 ? "bg-red-500" : contextPercent >= 65 ? "bg-amber-500" : selectedColors.bar}
            />
          </div>
        </div>
      </div>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-2xl border-white/70 bg-white/95 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/95">
          <DialogHeader>
            <DialogTitle>Resumo da conversa</DialogTitle>
            <DialogDescription>
              Contexto consolidado que sera mantido ao trocar de IA.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <pre className="whitespace-pre-wrap font-sans">{summary}</pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
