import React, { useState, useEffect } from "react";
import { appApi } from "@/api/appClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ModuleLabel from "@/components/ModuleLabel";
import { Loader2, PieChart as PieChartIcon, TrendingUp, AlertCircle, Signal, DollarSign, Building2, Clock, MapPin, Settings } from "lucide-react";
import _ from "lodash";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart, 
  Line,
  XAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";

// Paleta de cores moderna
const MODERN_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#84cc16", "#f97316"];

// Cores específicas para cada gráfico
const CHART_COLORS = {
  custoMensal: "#26F09C",
  status: MODERN_COLORS,
  localizacao: "#ec4899",
  equipamentosOS: "#10b981",
  equipamentosCusto: "#f59e0b",
};

// Função auxiliar para validar e formatar datas com segurança
const safeFormatDate = (dateString, formatStr = "MMM/yy") => {
  if (!dateString) return null;
  
  try {
    let date;
    
    // Tentar parsear a data de diferentes formas
    if (typeof dateString === 'string') {
      // Se está no formato YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        date = new Date(`${dateString}T12:00:00Z`);
      } 
      // Se está no formato YYYY-MM
      else if (/^\d{4}-\d{2}$/.test(dateString)) {
        date = new Date(`${dateString}-01T12:00:00Z`);
      }
      // Outros formatos
      else {
        date = new Date(dateString);
      }
    } else if (dateString instanceof Date) {
      date = dateString;
    } else {
      return null;
    }
    
    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return format(date, formatStr, { locale: ptBR });
  } catch (error) {
    console.warn("Erro ao formatar data:", dateString, error);
    return null;
  }
};

// Função auxiliar para extrair ano-mês de uma data
const extractYearMonth = (dateString) => {
  if (!dateString) return null;
  
  try {
    let date;
    
    if (typeof dateString === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        date = new Date(`${dateString}T12:00:00Z`);
      } else {
        date = new Date(dateString);
      }
    } else if (dateString instanceof Date) {
      date = dateString;
    } else {
      return null;
    }
    
    if (isNaN(date.getTime())) {
      return null;
    }
    
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  } catch (error) {
    console.warn("Erro ao extrair ano-mês:", dateString, error);
    return null;
  }
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
        <p className="font-bold text-slate-800">{label}</p>
        {payload.map((pld, index) => (
          <p key={index} style={{ color: pld.color }}>
            {`${pld.name}: ${pld.value.toLocaleString('pt-BR', pld.name.toLowerCase().includes('valor') || pld.name.toLowerCase().includes('custo') ? { style: 'currency', currency: 'BRL' } : {})}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const StatusCard = ({ stats, total }) => (
  <Card className="shadow-sm border-0 bg-white flex flex-col">
    <CardHeader>
      <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Signal className="w-5 h-5" />
                Status das OS
            </CardTitle>
          </div>
          <div className="text-right">
              <p className="text-sm text-slate-500">Total de Ordens</p>
              <p className="text-2xl font-bold text-slate-900">{total}</p>
          </div>
      </div>
    </CardHeader>
    <CardContent className="flex-grow flex flex-col justify-center">
      {stats.map((s, index) => (
        <div key={s.id} className="mb-4 last:mb-0">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-slate-700">{s.descricao}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800">{s.count}</span>
              <span className="text-xs text-slate-500">({s.percentage.toFixed(1)}%)</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all duration-500"
              style={{ width: `${s.percentage}%`, backgroundColor: MODERN_COLORS[index % MODERN_COLORS.length] }}
            ></div>
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

const ProgressListCard = ({ title, data, total, totalValue, icon: Icon, valueKey, labelKey, formatValue, barColor }) => {
  const calculatedTotal = totalValue !== undefined ? totalValue : data.reduce((sum, item) => sum + (item[valueKey] || 0), 0);

  return (
    <Card className="shadow-sm border-0 bg-white flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              {Icon && <Icon className="w-5 h-5" />}
              {title}
            </CardTitle>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Total</p>
            <p className="text-2xl font-bold text-slate-900">{formatValue && typeof total === 'number' ? formatValue(total) : total}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-center">
        {data.length === 0 ? (
          <div className="flex items-center justify-center text-slate-500 py-8">
            <AlertCircle className="w-5 h-5 mr-2" />
            Não há dados suficientes
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((item, index) => {
              const percentage = calculatedTotal > 0 ? (item[valueKey] / calculatedTotal) * 100 : 0;
              return (
                <div key={index} className="mb-4 last:mb-0">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium text-slate-700 pr-2 leading-tight break-words flex-1">
                      {item[labelKey] || "Sem nome"}
                    </span>
                    <div className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
                      <span className="text-sm font-bold text-slate-800">
                        {formatValue ? formatValue(item[valueKey]) : item[valueKey]}
                      </span>
                      <span className="text-xs text-slate-500">
                        ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div
                      className="h-3 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${percentage}%`, 
                        backgroundColor: barColor || MODERN_COLORS[0]
                      }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const GenericChartCard = ({ title, data, children, icon: Icon, className = "", height = 300 }) => (
  <Card className={`shadow-sm border-0 bg-white ${className}`}>
    <CardHeader>
      <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5" />}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      {data && data.length > 0 ? (
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className={`h-[${height}px] flex items-center justify-center text-slate-500`}>
          <AlertCircle className="w-5 h-5 mr-2" />
          Não há dados suficientes para exibir o gráfico.
        </div>
      )}
    </CardContent>
  </Card>
);

const CostCard = ({ title, value, icon: Icon, color, bgColor }) => (
  <Card className="shadow-sm border-0 bg-white">
    <CardContent className="p-6">
      <div className="flex items-center">
        <div className={`rounded-full p-3 ${bgColor} mr-4`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="text-2xl font-bold text-slate-900">
            {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function Dashboard() {
  const [data, setData] = useState({
    statusStats: [],
    totalOS: 0,
    tiposData: [],
    localData: [],
    custoMensalData: [],
    topEquipamentosOS: [],
    topEquipamentosCusto: [],
    totalCost: 0,
    totalMateriais: 0,
    totalHoraHomem: 0,
    totalTerceirizados: 0,
    countTerceirizados: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [ordensServico, statusList, equipamentos] = await Promise.all([
        appApi.entities.OrdemServico.list(),
        appApi.entities.StatusOS.list(),
        appApi.entities.Equipamento.list(),
      ]);

      const totalOS = ordensServico.length;
      
      const osByStatus = _.groupBy(ordensServico, "status_id");
      const statusStats = statusList.map(s => ({
        ...s,
        count: osByStatus[s.id]?.length || 0,
        percentage: totalOS > 0 ? ((osByStatus[s.id]?.length || 0) / totalOS) * 100 : 0
      }));

      const tiposData = _.map(_.groupBy(ordensServico, "tipo_nome"), (value, key) => ({
        name: key || "Sem Tipo",
        value: value.length,
      })).filter(item => item.value > 0);

      const localData = _.chain(ordensServico)
        .groupBy(os => {
          if (os.equipamentos && os.equipamentos.length > 0) {
            return os.equipamentos[0].localizacao_celula || "Sem Localização";
          }
          return os.localizacao_celula || os.local || "Sem Localização";
        })
        .map((value, key) => ({ name: key, OS: value.length }))
        .filter(item => item.OS > 0 && item.name !== "Sem Localização")
        .orderBy(['OS'], ['desc'])
        .take(10)
        .value();

      const allCostsGranular = ordensServico.map(os => {
          const materiais = parseFloat(os.valor_total_materiais) || 0;
          const servicos = parseFloat(os.valor_total_servicos) || 0;
          const terceirizados = parseFloat(os.valor_total_terceirizados) || 0;
          return {
              equipamento_nome: os.equipamento_nome,
              data: os.data_programada || os.created_date,
              custo: materiais + servicos + terceirizados
          };
      });
      
      // Custo mensal ordenado cronologicamente - COM VALIDAÇÃO DE DATAS
      const custoMensalData = _.chain(allCostsGranular)
        .filter(item => item.data)
        .map(item => {
          const yearMonth = extractYearMonth(item.data);
          if (!yearMonth) return null;
          return {
            ...item,
            yearMonth
          };
        })
        .filter(item => item && item.yearMonth)
        .groupBy('yearMonth')
        .map((value, key) => {
          const monthLabel = safeFormatDate(key, "MMM/yy");
          if (!monthLabel) return null;
          
          return {
            month: monthLabel,
            "Valor Gasto": _.sumBy(value, 'custo'),
            sortKey: key
          };
        })
        .filter(item => item && item["Valor Gasto"] > 0)
        .orderBy(['sortKey'], ['asc'])
        .value();

      // Criar mapa de equipamentos para buscar hierarquia
      const equipamentosMap = {};
      equipamentos.forEach(eq => {
        equipamentosMap[eq.id] = eq;
      });

      // Função para obter nome completo com hierarquia
      const getNomeComHierarquia = (equipamentoNome, equipamentoId) => {
        if (!equipamentoId) return equipamentoNome || "Sem Nome";
        
        const equipamento = equipamentosMap[equipamentoId];
        if (!equipamento) return equipamentoNome || "Sem Nome";
        
        // Se tem parent_id, é subequipamento - buscar equipamento pai
        if (equipamento.parent_id) {
          const equipamentoPai = equipamentosMap[equipamento.parent_id];
          if (equipamentoPai) {
            return `${equipamentoNome} (${equipamentoPai.descricao})`;
          }
        }
        
        return equipamentoNome || "Sem Nome";
      };

      // Contar OS por equipamento considerando múltiplos equipamentos por OS
      const equipamentoOSCount = {};
      
      ordensServico.forEach(os => {
        // Se a OS tem array de equipamentos (novo formato), contar para todos
        if (os.equipamentos && Array.isArray(os.equipamentos) && os.equipamentos.length > 0) {
          os.equipamentos.forEach(eq => {
            const nomeComHierarquia = getNomeComHierarquia(eq.equipamento_nome, eq.equipamento_id);
            equipamentoOSCount[nomeComHierarquia] = (equipamentoOSCount[nomeComHierarquia] || 0) + 1;
          });
        } 
        // Caso contrário, usar equipamento principal (compatibilidade)
        else if (os.equipamento_nome) {
          const nomeComHierarquia = getNomeComHierarquia(os.equipamento_nome, os.equipamento_id);
          equipamentoOSCount[nomeComHierarquia] = (equipamentoOSCount[nomeComHierarquia] || 0) + 1;
        }
      });
      
      const topEquipamentosOS = _.chain(equipamentoOSCount)
        .map((count, name) => ({ 
          name: name, 
          "Nº de OS": count 
        }))
        .filter(item => item["Nº de OS"] > 0)
        .orderBy(["Nº de OS"], ["desc"])
        .take(10)
        .value();

      const topEquipamentosCusto = _.chain(allCostsGranular)
        .groupBy('equipamento_nome')
        .map((value, key) => ({
          name: key || "Sem Nome",
          "Valor Gasto": _.sumBy(value, 'custo'),
        }))
        .filter(item => item["Valor Gasto"] > 0)
        .orderBy(["Valor Gasto"], ["desc"])
        .take(10)
        .value();
        
      const totalMateriais = ordensServico.reduce((sum, os) => sum + (parseFloat(os.valor_total_materiais) || 0), 0);
      const totalHoraHomem = ordensServico.reduce((sum, os) => sum + (parseFloat(os.valor_total_servicos) || 0), 0);
      const totalTerceirizados = ordensServico.reduce((sum, os) => sum + (parseFloat(os.valor_total_terceirizados) || 0), 0);
      
      const countTerceirizados = ordensServico.reduce((count, os) => {
        if (os.terceirizados && Array.isArray(os.terceirizados)) {
          return count + os.terceirizados.length;
        }
        return count;
      }, 0);

      const totalCost = totalMateriais + totalHoraHomem + totalTerceirizados;
        
      setData({
        statusStats,
        totalOS,
        tiposData,
        localData,
        custoMensalData,
        topEquipamentosOS,
        topEquipamentosCusto,
        totalCost,
        totalMateriais,
        totalHoraHomem,
        totalTerceirizados,
        countTerceirizados,
      });

    } catch (error) {
      console.error("Erro ao carregar dados do dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  const formatCurrency = (value) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const CustomLabel = ({ x, y, value }) => {
    return (
      <text
        x={x}
        y={y - 10}
        fill="#64748b"
        textAnchor="middle"
        fontSize={11}
        fontWeight="bold"
      >
        {formatCurrency(value)}
      </text>
    );
  };
  
  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 bg-slate-50">
      <ModuleLabel>Dashboard</ModuleLabel>

      {/* Cards de Indicadores de Custos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <CostCard 
          title="Gastos com Materiais"
          value={data.totalMateriais}
          icon={Building2}
          color="text-blue-600"
          bgColor="bg-blue-100"
        />
        <CostCard 
          title="Gastos Hora-Homem"
          value={data.totalHoraHomem}
          icon={Clock}
          color="text-green-600"
          bgColor="bg-green-100"
        />
        <CostCard 
          title="Gastos Terceirizados"
          value={data.totalTerceirizados}
          icon={Building2}
          color="text-purple-600"
          bgColor="bg-purple-100"
        />
        <CostCard 
          title="Total Geral"
          value={data.totalCost}
          icon={DollarSign}
          color="text-orange-600"
          bgColor="bg-orange-100"
        />
      </div>

      {/* Layout dos cards - Status e Tipos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatusCard stats={data.statusStats} total={data.totalOS} />
        <GenericChartCard title="Tipos de Manutenção" data={data.tiposData} icon={PieChartIcon} height={300}>
          <PieChart>
            <Pie 
              data={data.tiposData} 
              dataKey="value" 
              nameKey="name" 
              cx="50%" 
              cy="50%" 
              innerRadius={60} 
              outerRadius={80} 
              paddingAngle={5}
              label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.tiposData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={MODERN_COLORS[index % MODERN_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </GenericChartCard>
      </div>

      {/* Gráfico de Custo Mensal - Gráfico de Linhas */}
      <GenericChartCard title="Custo Mensal de Manutenção" data={data.custoMensalData} icon={TrendingUp} height={350}>
        <LineChart data={data.custoMensalData} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="month" 
            tick={{ fontSize: 12, fill: '#64748b' }}
            stroke="#cbd5e1"
          />
          <Tooltip content={<CustomTooltip />} />
          <Line 
            type="monotone" 
            dataKey="Valor Gasto" 
            stroke={CHART_COLORS.custoMensal}
            strokeWidth={3}
            dot={{ fill: CHART_COLORS.custoMensal, r: 5, strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
            label={<CustomLabel />}
          />
        </LineChart>
      </GenericChartCard>

      {/* OS por Localização e Top Equipamentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProgressListCard
          title="Top 10 Localizações com mais OS"
          data={data.localData}
          total={data.totalOS}
          totalValue={data.totalOS}
          icon={MapPin}
          valueKey="OS"
          labelKey="name"
          barColor={CHART_COLORS.localizacao}
        />
        
        <ProgressListCard
          title="Top 10 Equipamentos com mais OS"
          data={data.topEquipamentosOS}
          total={data.totalOS}
          totalValue={data.totalOS}
          icon={Settings}
          valueKey="Nº de OS"
          labelKey="name"
          barColor={CHART_COLORS.equipamentosOS}
        />
      </div>

      {/* Top Equipamentos por Custo */}
      <ProgressListCard
        title="Top 10 Equipamentos com Maior Custo"
        data={data.topEquipamentosCusto}
        total={data.totalCost}
        totalValue={data.totalCost}
        icon={DollarSign}
        valueKey="Valor Gasto"
        labelKey="name"
        formatValue={formatCurrency}
        barColor={CHART_COLORS.equipamentosCusto}
      />
    </div>
  );
}
