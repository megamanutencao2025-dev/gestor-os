import React, { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  Bot,
  ChevronDown,
  Clock3,
  Database,
  Eraser,
  FileText,
  Gauge,
  History,
  MessageSquareText,
  Sparkles,
  Tags,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const PROVIDER_COLORS = {
  gemini: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  groq: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  deepseek: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
  cohere: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  openai: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  default: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
};

const PROVIDER_NAMES = {
  gemini: "Google Gemini",
  groq: "Groq",
  deepseek: "DeepSeek",
  cohere: "Cohere",
  openai: "OpenAI",
};

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function getProviderName(provider) {
  const value = String(provider || "").trim();
  return PROVIDER_NAMES[value.toLowerCase()] || value || "Provider";
}

function getProviderColor(provider) {
  const value = String(provider || "").toLowerCase();
  return PROVIDER_COLORS[value] || PROVIDER_COLORS.default;
}

function formatNumber(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "0";
  return new Intl.NumberFormat("pt-BR").format(numberValue);
}

function formatCurrency(value, currency = "USD") {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: numberValue < 1 ? 4 : 2,
  }).format(numberValue);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeTopics(sessionContext) {
  return toArray(sessionContext.topics)
    .map((item) => ({
      name: typeof item === "string" ? item : item?.topic || item?.name || "",
      count: typeof item === "object" ? item?.count : null,
    }))
    .filter((item) => item.name)
    .slice(0, 12);
}

function normalizeProviderTimeline(sessionContext) {
  const history = toArray(sessionContext.providerHistory || sessionContext.providersHistory);
  if (history.length > 0) {
    return history.map((item, index) => ({
      id: item.id || `${item.provider || item.toProvider || index}-${index}`,
      provider: item.provider || item.toProvider || item.fromProvider || "provider",
      action: item.action || (item.toProvider ? "switch" : "message"),
      fromProvider: item.fromProvider,
      toProvider: item.toProvider,
      createdAt: item.createdAt || item.timestamp,
    }));
  }

  return toArray(sessionContext.providersUsed)
    .filter(Boolean)
    .map((provider, index) => ({
      id: `${provider}-${index}`,
      provider,
      action: index === 0 ? "started" : "used",
      createdAt: null,
    }));
}

function buildExportPayload(sessionContext) {
  return {
    exportedAt: new Date().toISOString(),
    sessionContext,
  };
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function StatCard({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-lg border border-white/70 bg-white/60 p-3 shadow-sm transition-colors duration-300 dark:border-slate-700 dark:bg-slate-900/60">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-50">
        {value}
      </div>
      {helper && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helper}</div>}
    </div>
  );
}

export default function ContextPanel({
  sessionContext = {},
  defaultOpen = false,
  onExportContext,
  onClearContext,
  className,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [status, setStatus] = useState("");

  const summary = typeof sessionContext.summary === "string"
    ? sessionContext.summary
    : sessionContext.summary?.content || sessionContext.summaryText || "A conversa ainda nao possui resumo automatico.";
  const topics = useMemo(() => normalizeTopics(sessionContext), [sessionContext]);
  const providerTimeline = useMemo(() => normalizeProviderTimeline(sessionContext), [sessionContext]);
  const stats = sessionContext.stats || sessionContext.usage || {};
  const messageCount = Number(sessionContext.messageCount ?? stats.messageCount ?? sessionContext.messages?.length ?? 0);
  const tokensUsed = Number(sessionContext.tokensUsed ?? sessionContext.totalTokens ?? stats.tokens ?? stats.totalTokens ?? 0);
  const costValue = sessionContext.cost?.estimatedCost ?? stats.cost?.estimatedCost ?? stats.cost ?? sessionContext.cost ?? 0;
  const currency = sessionContext.cost?.currency || stats.cost?.currency || "USD";
  const cacheHits = Number(sessionContext.cacheHits ?? stats.cacheHits ?? stats.cache?.hits ?? 0);
  const sessionId = sessionContext.sessionId || sessionContext.session?.sessionId || "sessao-atual";

  async function handleExport() {
    try {
      if (onExportContext) {
        await onExportContext(sessionContext);
      } else {
        downloadJson(buildExportPayload(sessionContext), `contexto-ia-${sessionId}.json`);
      }
      setStatus("Contexto exportado com sucesso.");
    } catch (error) {
      setStatus(error?.message || "Nao foi possivel exportar o contexto.");
    }
  }

  async function handleClear() {
    try {
      await onClearContext?.(sessionContext);
      setStatus("Contexto limpo para esta sessao.");
    } catch (error) {
      setStatus(error?.message || "Nao foi possivel limpar o contexto.");
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <div className="overflow-hidden rounded-lg border border-white/70 bg-white/70 shadow-sm backdrop-blur-xl transition-colors duration-300 dark:border-slate-700 dark:bg-slate-950/70">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-300 hover:bg-white/70 dark:hover:bg-slate-900/70"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-500/20">
                <Database className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-950 dark:text-slate-50">
                  Contexto da IA
                </div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {formatNumber(messageCount)} mensagens, {formatNumber(tokensUsed)} tokens, {formatNumber(cacheHits)} cache hits
                </div>
              </div>
            </div>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300", open && "rotate-180")} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent
          className={cn(
            "overflow-hidden border-t border-white/70 data-[state=closed]:animate-out data-[state=open]:animate-in",
            "data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2",
            "dark:border-slate-700",
          )}
        >
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <div className="space-y-4">
              <div className="rounded-lg border border-white/70 bg-white/60 p-4 transition-colors duration-300 dark:border-slate-700 dark:bg-slate-900/60">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                  Resumo da conversa atual
                </div>
                <div className="max-h-52 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                  {summary}
                </div>
              </div>

              <div className="rounded-lg border border-white/70 bg-white/60 p-4 transition-colors duration-300 dark:border-slate-700 dark:bg-slate-900/60">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                  <History className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                  Timeline de providers
                </div>
                <div className="space-y-3">
                  {providerTimeline.length > 0 ? providerTimeline.map((item, index) => (
                    <div key={item.id} className="relative flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={cn("flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold", getProviderColor(item.provider))}>
                          <Bot className="h-3.5 w-3.5" />
                        </div>
                        {index < providerTimeline.length - 1 && (
                          <div className="mt-1 h-7 w-px bg-slate-200 dark:bg-slate-700" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pb-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={getProviderColor(item.provider)}>
                            {getProviderName(item.provider)}
                          </Badge>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {item.action === "switch" ? "troca de IA" : "uso registrado"}
                          </span>
                        </div>
                        {(item.fromProvider || item.toProvider || item.createdAt) && (
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {item.fromProvider && item.toProvider
                              ? `${getProviderName(item.fromProvider)} -> ${getProviderName(item.toProvider)}`
                              : item.createdAt ? formatDateTime(item.createdAt) : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Nenhum provider usado ainda nesta sessao.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={MessageSquareText} label="Mensagens" value={formatNumber(messageCount)} />
                <StatCard icon={Gauge} label="Tokens" value={formatNumber(tokensUsed)} />
                <StatCard icon={WalletCards} label="Custo" value={formatCurrency(costValue, currency)} />
                <StatCard icon={Sparkles} label="Cache hits" value={formatNumber(cacheHits)} />
              </div>

              <div className="rounded-lg border border-white/70 bg-white/60 p-4 transition-colors duration-300 dark:border-slate-700 dark:bg-slate-900/60">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                  <Tags className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                  Topicos principais
                </div>
                <div className="flex flex-wrap gap-2">
                  {topics.length > 0 ? topics.map((topic) => (
                    <Badge key={topic.name} variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                      {topic.name}
                      {topic.count ? <span className="ml-1 opacity-70">({topic.count})</span> : null}
                    </Badge>
                  )) : (
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Os topicos serao detectados conforme a conversa evoluir.
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-white/70 bg-white/60 p-4 transition-colors duration-300 dark:border-slate-700 dark:bg-slate-900/60">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-white/80 bg-white/70 dark:border-slate-700 dark:bg-slate-950/40"
                    onClick={handleExport}
                  >
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    Exportar contexto
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
                    onClick={handleClear}
                  >
                    <Eraser className="mr-2 h-4 w-4" />
                    Limpar contexto
                  </Button>
                </div>
                {status && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                    <Clock3 className="h-4 w-4" />
                    {status}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
