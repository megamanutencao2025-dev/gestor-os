import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Filter,
  Gauge,
  Loader2,
  RefreshCw,
  RotateCcw,
  UserRoundX,
  Wrench,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { appApi } from "@/api/appClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FILTER_KEYS = [
  "date_from",
  "date_to",
  "location",
  "equipment",
  "maintenance_type",
  "priority",
  "responsible",
];

const ATTENTION_TABS = [
  ["all", "Todas"],
  ["overdue", "Vencidas"],
  ["due_today", "Vencem hoje"],
  ["unassigned", "Sem responsável"],
  ["waiting_parts", "Aguardando peça"],
  ["emergency", "Emergenciais"],
];

const SITUATION_LABELS = {
  overdue: "Vencida",
  due_today: "Vence hoje",
  unassigned: "Sem responsável",
  waiting_parts: "Aguardando peça",
  emergency: "Emergencial",
  open: "Aberta",
};

const SITUATION_STYLES = {
  overdue: "border-red-500/40 bg-red-500/10 text-red-300",
  due_today: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  unassigned: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  waiting_parts: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  emergency: "border-red-500/40 bg-red-500/10 text-red-300",
  open: "border-blue-500/40 bg-blue-500/10 text-blue-300",
};

const CHART_COLORS = {
  opened: "#5B8FF9",
  completed: "#2DD4A7",
  bars: "#5B8FF9",
};

function localIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function periodRange(kind) {
  const today = new Date();
  const start = new Date(today);
  if (kind === "today") {
    return [localIsoDate(today), localIsoDate(today)];
  }
  if (kind === "7d" || kind === "30d") {
    start.setDate(today.getDate() - (kind === "7d" ? 6 : 29));
  } else if (kind === "month") {
    start.setDate(1);
  } else if (kind === "year") {
    start.setMonth(0, 1);
  }
  return [localIsoDate(start), localIsoDate(today)];
}

function initialFilters(searchParams) {
  const [defaultStart, defaultEnd] = periodRange("30d");
  return {
    date_from: searchParams.get("date_from") || defaultStart,
    date_to: searchParams.get("date_to") || defaultEnd,
    location: searchParams.get("location") || "",
    equipment: searchParams.get("equipment") || "",
    maintenance_type: searchParams.get("maintenance_type") || "",
    priority: searchParams.get("priority") || "",
    responsible: searchParams.get("responsible") || "",
  };
}

function getReferenceLabel(item) {
  return item?.descricao || item?.description || item?.nome || item?.name || "";
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateTime(value) {
  if (!value) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPeriodLabel(value, bucket) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (bucket === "month") {
    return new Intl.DateTimeFormat("pt-BR", {
      month: "short",
      year: "2-digit",
    }).format(date);
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatOpenTime(hours) {
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-label="Carregando dashboard">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-32 rounded-md border bg-card" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="h-80 rounded-md border bg-card" />
        <div className="h-80 rounded-md border bg-card" />
      </div>
    </div>
  );
}

function IndicatorCard({ label, value, detail, icon: Icon, tone, onClick, title }) {
  const tones = {
    blue: "border-l-blue-500 text-blue-400",
    red: "border-l-red-500 text-red-400",
    orange: "border-l-orange-500 text-orange-400",
    green: "border-l-emerald-500 text-emerald-400",
    slate: "border-l-slate-500 text-slate-300",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`min-h-32 rounded-md border border-l-4 bg-card p-4 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tones[tone]}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          {label}
        </span>
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      </span>
      <strong className="mt-4 block text-2xl text-foreground">{value}</strong>
      <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>
    </button>
  );
}

function EmptyState({ children }) {
  return (
    <div className="flex min-h-44 items-center justify-center rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
      <p className="mb-2 font-semibold">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} style={{ color: item.color }}>
          {item.name}: {item.value}
        </p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => initialFilters(searchParams));
  const [data, setData] = useState(null);
  const [references, setReferences] = useState({
    locations: [],
    equipment: [],
    types: [],
    priorities: [],
    maintainers: [],
  });
  const [attentionFilter, setAttentionFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const updateUrl = useCallback((nextFilters) => {
    const next = new URLSearchParams(searchParams);
    FILTER_KEYS.forEach((key) => {
      if (nextFilters[key]) next.set(key, nextFilters[key]);
      else next.delete(key);
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadDashboard = useCallback(async (nextFilters, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const result = await appApi.dashboard.maintenance(nextFilters);
      setData(result);
    } catch (requestError) {
      setError(
        requestError?.message
          || "Não foi possível carregar os indicadores de manutenção."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      appApi.entities.Localizacao.list(),
      appApi.entities.Equipamento.list(),
      appApi.entities.TipoManutencao.list(),
      appApi.entities.Prioridade.list(),
      appApi.entities.Mantenedor.list(),
    ]).then(([locations, equipment, types, priorities, maintainers]) => {
      setReferences({
        locations: Array.isArray(locations) ? locations : [],
        equipment: Array.isArray(equipment) ? equipment : [],
        types: Array.isArray(types) ? types : [],
        priorities: Array.isArray(priorities) ? priorities : [],
        maintainers: Array.isArray(maintainers) ? maintainers : [],
      });
    }).catch(() => {
      setReferences((current) => current);
    });
  }, []);

  useEffect(() => {
    const next = initialFilters(searchParams);
    setFilters(next);
    loadDashboard(next);
  }, [searchParams, loadDashboard]);

  const applyFilters = () => {
    updateUrl(filters);
    setShowMobileFilters(false);
  };

  const setPeriod = (kind) => {
    const [dateFrom, dateTo] = periodRange(kind);
    const next = { ...filters, date_from: dateFrom, date_to: dateTo };
    setFilters(next);
    updateUrl(next);
  };

  const clearFilters = () => {
    const [dateFrom, dateTo] = periodRange("30d");
    const next = {
      date_from: dateFrom,
      date_to: dateTo,
      location: "",
      equipment: "",
      maintenance_type: "",
      priority: "",
      responsible: "",
    };
    setFilters(next);
    updateUrl(next);
  };

  const openOrderList = (extra = {}) => {
    const params = new URLSearchParams();
    Object.entries({ ...filters, ...extra }).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    navigate(`/ordens-servico?${params.toString()}`);
  };

  const completedStatus = data?.statuses?.find(
    (status) => status.category === "completed"
  );
  const chartData = useMemo(
    () => (data?.series?.items || []).map((item) => ({
      ...item,
      label: formatPeriodLabel(item.period, data?.series?.bucket),
    })),
    [data]
  );
  const visibleAttention = useMemo(() => {
    const items = data?.attention || [];
    return attentionFilter === "all"
      ? items
      : items.filter((item) => item.situation === attentionFilter);
  }, [attentionFilter, data]);

  const activeFilterCount = FILTER_KEYS.slice(2).filter(
    (key) => filters[key]
  ).length;
  const indicators = data?.indicators;
  const onTimeValue = indicators?.on_time_rate == null
    ? "Sem dados"
    : `${indicators.on_time_rate}%`;
  const meanCompletionValue = indicators?.mean_completion_hours == null
    ? "Sem dados"
    : `${indicators.mean_completion_hours} h`;

  return (
    <main className="space-y-4 p-4 sm:p-5 xl:p-6">
      <header className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Dashboard de manutenção</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operação, confiabilidade e custos das ordens de serviço
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="xl:hidden"
            onClick={() => setShowMobileFilters((current) => !current)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-2 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => loadDashboard(filters, true)}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar
          </Button>
        </div>
      </header>

      <section
        className={`${showMobileFilters ? "block" : "hidden"} rounded-md border bg-card p-3 xl:block`}
        aria-label="Filtros do dashboard"
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <Input
            type="date"
            aria-label="Data inicial"
            value={filters.date_from}
            onChange={(event) => setFilters((current) => ({
              ...current,
              date_from: event.target.value,
            }))}
          />
          <Input
            type="date"
            aria-label="Data final"
            value={filters.date_to}
            onChange={(event) => setFilters((current) => ({
              ...current,
              date_to: event.target.value,
            }))}
          />
          {[
            ["location", "Todos os locais", references.locations],
            ["equipment", "Todos os equipamentos", references.equipment],
            ["maintenance_type", "Todos os tipos", references.types],
            ["priority", "Todas as prioridades", references.priorities],
            ["responsible", "Todos os responsáveis", references.maintainers],
          ].map(([key, placeholder, options]) => (
            <Select
              key={key}
              value={filters[key] || "all"}
              onValueChange={(value) => setFilters((current) => ({
                ...current,
                [key]: value === "all" ? "" : value,
              }))}
            >
              <SelectTrigger aria-label={placeholder}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{placeholder}</SelectItem>
                {options.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {getReferenceLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {[
            ["today", "Hoje"],
            ["7d", "7 dias"],
            ["30d", "30 dias"],
            ["month", "Este mês"],
            ["year", "Este ano"],
          ].map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant="outline"
              onClick={() => setPeriod(key)}
            >
              {label}
            </Button>
          ))}
          <span className="flex-1" />
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Limpar
          </Button>
          <Button size="sm" onClick={applyFilters}>
            <Filter className="mr-2 h-4 w-4" />
            Aplicar
          </Button>
        </div>
      </section>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </span>
          <Button
            size="icon"
            variant="ghost"
            title="Fechar mensagem"
            onClick={() => setError("")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Período: {new Date(`${data.period.date_from}T12:00:00`).toLocaleDateString("pt-BR")}
              {" a "}
              {new Date(`${data.period.date_to}T12:00:00`).toLocaleDateString("pt-BR")}
            </span>
            <span>Atualizado em {formatDateTime(data.last_updated)}</span>
          </div>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
            <IndicatorCard
              label="OS abertas"
              value={indicators.open}
              detail={`${indicators.unassigned} sem responsável`}
              icon={Wrench}
              tone="blue"
              title="Ordens aprovadas que não estão concluídas, canceladas ou recusadas"
              onClick={() => openOrderList({ situation: "open" })}
            />
            <IndicatorCard
              label="OS vencidas"
              value={indicators.overdue}
              detail="Prazo anterior ao momento atual"
              icon={CalendarClock}
              tone="red"
              title="Ordens abertas cujo prazo já terminou"
              onClick={() => openOrderList({ situation: "overdue" })}
            />
            <IndicatorCard
              label="Emergenciais"
              value={indicators.emergency}
              detail="Prioridade crítica ou emergência"
              icon={AlertTriangle}
              tone="red"
              title="Ordens abertas com prioridade crítica ou emergencial"
              onClick={() => openOrderList({ situation: "emergency" })}
            />
            <IndicatorCard
              label="Aguardando peça"
              value={indicators.waiting_parts}
              detail="Ordens bloqueadas por material"
              icon={Boxes}
              tone="orange"
              title="Ordens abertas no status Aguardando peças"
              onClick={() => openOrderList({ situation: "waiting_parts" })}
            />
            <IndicatorCard
              label="No prazo"
              value={onTimeValue}
              detail={`${indicators.on_time_evaluable} concluídas avaliadas`}
              icon={CheckCircle2}
              tone="green"
              title="Percentual concluído até o prazo informado"
              onClick={() => openOrderList(
                completedStatus ? { status: completedStatus.id } : {}
              )}
            />
            <IndicatorCard
              label="Tempo de conclusão"
              value={meanCompletionValue}
              detail={`${indicators.completed} concluídas no período`}
              icon={Clock3}
              tone="slate"
              title="Média entre a abertura e a conclusão das ordens"
              onClick={() => openOrderList(
                completedStatus ? { status: completedStatus.id } : {}
              )}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
            <Card className="rounded-md">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Ordens que requerem atenção</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Priorizadas por prazo, criticidade e antiguidade
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openOrderList(
                      attentionFilter === "all"
                        ? { situation: "open" }
                        : { situation: attentionFilter }
                    )}
                  >
                    Ver todas
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
                  {ATTENTION_TABS.map(([key, label]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={attentionFilter === key ? "secondary" : "ghost"}
                      className="shrink-0"
                      onClick={() => setAttentionFilter(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {visibleAttention.length === 0 ? (
                  <EmptyState>Nenhuma ordem exige atenção neste filtro.</EmptyState>
                ) : (
                  <div className="divide-y overflow-hidden rounded-md border">
                    {visibleAttention.slice(0, 8).map((order) => (
                      <button
                        type="button"
                        key={order.id}
                        className="grid w-full gap-2 p-3 text-left hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none sm:grid-cols-[minmax(0,1.5fr)_auto_auto] sm:items-center"
                        onClick={() => navigate(`/editar-os?id=${order.id}`)}
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <strong className="text-sm">{order.number}</strong>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${SITUATION_STYLES[order.situation]}`}>
                              {SITUATION_LABELS[order.situation]}
                            </span>
                          </span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            {order.equipment}
                          </span>
                        </span>
                        <span className="text-xs">
                          <span className="block font-medium">{formatDateTime(order.due_at)}</span>
                          <span className="text-muted-foreground">
                            {formatOpenTime(order.open_hours)} em aberto
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {order.responsible || "Sem responsável"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-base">Abertas x concluídas</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <EmptyState>Sem movimentação no período selecionado.</EmptyState>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ left: -20, right: 8 }}>
                        <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend />
                        <Line
                          name="Abertas"
                          type="monotone"
                          dataKey="opened"
                          stroke={CHART_COLORS.opened}
                          strokeWidth={2}
                        />
                        <Line
                          name="Concluídas"
                          type="monotone"
                          dataKey="completed"
                          stroke={CHART_COLORS.completed}
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-base">Distribuição por status</CardTitle>
              </CardHeader>
              <CardContent>
                {data.statuses.length === 0 ? (
                  <EmptyState>Sem ordens no período selecionado.</EmptyState>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={data.statuses}
                        margin={{ left: 18, right: 18 }}
                        onClick={(event) => {
                          const status = event?.activePayload?.[0]?.payload;
                          if (status) openOrderList({ status: status.id });
                        }}
                      >
                        <CartesianGrid stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={110}
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={11}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar
                          name="Ordens"
                          dataKey="count"
                          fill={CHART_COLORS.bars}
                          radius={[0, 4, 4, 0]}
                          className="cursor-pointer"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-base">Perfil da manutenção</CardTitle>
              </CardHeader>
              <CardContent>
                {data.types.length === 0 ? (
                  <EmptyState>Sem tipos de manutenção no período.</EmptyState>
                ) : (
                  <div className="space-y-3">
                    {data.types.map((type) => {
                      const total = data.types.reduce((sum, item) => sum + item.count, 0);
                      const percentage = total ? Math.round(type.count * 100 / total) : 0;
                      return (
                        <button
                          type="button"
                          key={type.id}
                          className="block w-full rounded-md p-2 text-left hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => openOrderList({ maintenance_type: type.id })}
                        >
                          <span className="mb-1.5 flex justify-between text-sm">
                            <span>{type.name}</span>
                            <strong>{type.count} <span className="font-normal text-muted-foreground">({percentage}%)</span></strong>
                          </span>
                          <span className="block h-2 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full bg-cyan-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <Card className="rounded-md">
            <CardHeader>
              <CardTitle className="text-base">Equipamentos com maior impacto</CardTitle>
              <p className="text-xs text-muted-foreground">
                Ordens corretivas e emergenciais do período
              </p>
            </CardHeader>
            <CardContent>
              {data.equipment_impact.length === 0 ? (
                <EmptyState>Sem ordens corretivas ou emergenciais no período.</EmptyState>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="p-2 font-medium">Equipamento</th>
                        <th className="p-2 text-right font-medium">OS corretivas</th>
                        <th className="p-2 text-right font-medium">Reincidências</th>
                        <th className="p-2 text-right font-medium">Parada</th>
                        <th className="p-2 text-right font-medium">Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.equipment_impact.map((equipment) => (
                        <tr
                          key={equipment.id || equipment.name}
                          className="cursor-pointer border-b last:border-0 hover:bg-accent/40"
                          tabIndex={0}
                          onClick={() => equipment.id && openOrderList({ equipment: equipment.id })}
                          onKeyDown={(event) => {
                            if ((event.key === "Enter" || event.key === " ") && equipment.id) {
                              openOrderList({ equipment: equipment.id });
                            }
                          }}
                        >
                          <td className="p-2 font-medium">{equipment.name}</td>
                          <td className="p-2 text-right">{equipment.count}</td>
                          <td className="p-2 text-right">{equipment.recurrences}</td>
                          <td className="p-2 text-right">
                            {(equipment.downtime_minutes / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h
                          </td>
                          <td className="p-2 text-right">{formatCurrency(equipment.total_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <CircleDollarSign className="h-5 w-5 text-emerald-400" />
              <h2 className="text-base font-bold">Custos do período</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
              {[
                ["Custo total", data.costs.total, Gauge],
                ["Materiais", data.costs.materials, Boxes],
                ["Mão de obra", data.costs.services, Wrench],
                ["Terceirização", data.costs.outsourced, UserRoundX],
                ["Média por OS", data.costs.average, CircleDollarSign],
              ].map(([label, value, Icon]) => (
                <Card key={label} className="rounded-md">
                  <CardContent className="p-4">
                    <span className="flex items-center justify-between text-xs text-muted-foreground">
                      {label}
                      <Icon className="h-4 w-4" />
                    </span>
                    <strong className="mt-3 block text-base sm:text-lg">
                      {formatCurrency(value)}
                    </strong>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                <strong className="mb-1 block text-foreground">Orçamento</strong>
                {data.budget.message}
              </div>
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                <strong className="mb-1 block text-foreground">Causas de falha</strong>
                {data.causes.message}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
