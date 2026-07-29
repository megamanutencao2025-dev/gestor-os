
import React, { useState, useEffect, useMemo } from "react";
import { appApi } from "@/api/appClient";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Eye, EyeOff, Calendar, Wrench, AlertCircle, CheckCircle, RefreshCw, Printer, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ModuleLabel from "@/components/ModuleLabel";
import VisualizacaoOSModal from "@/components/ordens/VisualizacaoOSModal";

export default function Notificacoes() {
  const { user: currentUser } = useAuth();
  const [notificacoes, setNotificacoes] = useState([]);
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState({});
  const [reviewing, setReviewing] = useState({});
  const [rejectionNotification, setRejectionNotification] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedOSForPrint, setSelectedOSForPrint] = useState(null);
  const [printingId, setPrintingId] = useState("");

  useEffect(() => {
    loadNotificacoes();
  }, [currentUser?.id]);

  const loadNotificacoes = async () => {
    setLoading(true);
    setError("");
    try {
      const pendingPromise = currentUser?.role === "admin"
        ? appApi.admin.workOrders.pendingSolicitations()
        : Promise.resolve([]);
      const [notificacoesData, pendingData] = await Promise.all([
        appApi.entities.NotificacaoOS.list('-created_date'),
        pendingPromise,
      ]);
      setNotificacoes(notificacoesData || []);
      setSolicitacoesPendentes(Array.isArray(pendingData) ? pendingData : []);
    } catch (error) {
      console.error("Erro ao carregar notificações:", error);
      setError("Não foi possível carregar as notificações. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  };

  const pendingByWorkOrderId = useMemo(
    () => new Map(solicitacoesPendentes.map((solicitacao) => [String(solicitacao.id), solicitacao])),
    [solicitacoesPendentes],
  );

  const setNotificationRead = async (notificacao) => {
    if (notificacao.foi_lida) return;
    await appApi.entities.NotificacaoOS.update(notificacao.id, {
      foi_lida: true,
      data_leitura: new Date().toISOString(),
    });
  };

  const aprovarSolicitacao = async (notificacao) => {
    setReviewing((prev) => ({ ...prev, [notificacao.id]: true }));
    setError("");
    try {
      await appApi.admin.workOrders.decideSolicitation(
        notificacao.ordem_servico_id,
        "approve",
      );
      await setNotificationRead(notificacao);
      await loadNotificacoes();
    } catch (approvalError) {
      setError(approvalError?.message || "Não foi possível aprovar a solicitação.");
    } finally {
      setReviewing((prev) => ({ ...prev, [notificacao.id]: false }));
    }
  };

  const abrirRecusa = (notificacao) => {
    setRejectionNotification(notificacao);
    setRejectionReason("");
  };

  const reprovarSolicitacao = async (event) => {
    event.preventDefault();
    if (!rejectionNotification || rejectionReason.trim().length < 3) return;
    const notificacao = rejectionNotification;
    setReviewing((prev) => ({ ...prev, [notificacao.id]: true }));
    setError("");
    try {
      await appApi.admin.workOrders.decideSolicitation(
        notificacao.ordem_servico_id,
        "reject",
        rejectionReason.trim(),
      );
      await setNotificationRead(notificacao);
      setRejectionNotification(null);
      setRejectionReason("");
      await loadNotificacoes();
    } catch (rejectionError) {
      setError(rejectionError?.message || "Não foi possível reprovar a solicitação.");
    } finally {
      setReviewing((prev) => ({ ...prev, [notificacao.id]: false }));
    }
  };

  const imprimirOS = async (notificacao) => {
    setPrintingId(notificacao.id);
    setError("");
    try {
      const ordem = await appApi.entities.OrdemServico.get(notificacao.ordem_servico_id);
      setSelectedOSForPrint(ordem);
    } catch (printError) {
      setError(printError?.message || "Não foi possível carregar a OS para impressão.");
    } finally {
      setPrintingId("");
    }
  };

  const marcarComoLida = async (notificacaoId) => {
    setUpdating(prev => ({ ...prev, [notificacaoId]: true }));
    
    try {
      await appApi.entities.NotificacaoOS.update(notificacaoId, {
        foi_lida: true,
        data_leitura: new Date().toISOString()
      });
      
      // Atualizar localmente
      setNotificacoes(prev => 
        prev.map(notif => 
          notif.id === notificacaoId 
            ? { ...notif, foi_lida: true, data_leitura: new Date().toISOString() }
            : notif
        )
      );
    } catch (error) {
      console.error("Erro ao marcar como lida:", error);
      setError("Erro ao atualizar notificação");
    } finally {
      setUpdating(prev => ({ ...prev, [notificacaoId]: false }));
    }
  };

  const marcarComoNaoLida = async (notificacaoId) => {
    setUpdating(prev => ({ ...prev, [notificacaoId]: true }));
    
    try {
      await appApi.entities.NotificacaoOS.update(notificacaoId, {
        foi_lida: false,
        data_leitura: null
      });
      
      // Atualizar localmente
      setNotificacoes(prev => 
        prev.map(notif => 
          notif.id === notificacaoId 
            ? { ...notif, foi_lida: false, data_leitura: null }
            : notif
        )
      );
    } catch (error) {
      console.error("Erro ao marcar como não lida:", error);
      setError("Erro ao atualizar notificação");
    } finally {
      setUpdating(prev => ({ ...prev, [notificacaoId]: false }));
    }
  };

  const marcarTodasComoLidas = async () => {
    const naoLidas = notificacoes.filter(n => !n.foi_lida);
    
    if (naoLidas.length === 0) return;

    try {
      setLoading(true);
      for (const notificacao of naoLidas) {
        await appApi.entities.NotificacaoOS.update(notificacao.id, {
          foi_lida: true,
          data_leitura: new Date().toISOString()
        });
      }
      
      await loadNotificacoes(); // Recarregar todas
    } catch (error) {
      console.error("Erro ao marcar todas como lidas:", error);
      setError("Erro ao atualizar notificações");
    } finally {
      setLoading(false);
    }
  };

  const getIconByTipo = (tipo) => {
    switch (tipo) {
      case 'nova_solicitacao':
        return <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />;
      case 'os_atualizada':
        return <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />;
      default:
        return <Bell className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />;
    }
  };

  const notificacaosSeparadas = {
    naoLidas: notificacoes.filter(n => !n.foi_lida),
    lidas: notificacoes.filter(n => n.foi_lida)
  };

  const renderActions = (notificacao, isRead) => {
    const isPending = pendingByWorkOrderId.has(String(notificacao.ordem_servico_id));
    const isReviewing = Boolean(reviewing[notificacao.id]);
    return (
      <div className="flex flex-wrap items-center justify-start gap-1.5 lg:justify-end">
        {currentUser?.role === "admin" && isPending && (
          <>
            <Button
              type="button"
              size="sm"
              className="h-8 bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
              onClick={() => aprovarSolicitacao(notificacao)}
              disabled={isReviewing}
            >
              <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
              Aprovar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-red-300 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => abrirRecusa(notificacao)}
              disabled={isReviewing}
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
              Reprovar
            </Button>
          </>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-3 text-xs"
          onClick={() => imprimirOS(notificacao)}
          disabled={printingId === notificacao.id}
          title="Visualizar e imprimir OS"
        >
          {printingId === notificacao.id ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-b-2 border-current" />
          ) : (
            <Printer className="h-3.5 w-3.5" />
          )}
          <span>Imprimir</span>
        </Button>
        <Link to={createPageUrl(`EditarOS?id=${notificacao.ordem_servico_id}`)}>
          <Button size="sm" className="h-8 bg-blue-600 px-3 text-xs hover:bg-blue-700">
            <Wrench className="mr-1.5 h-3.5 w-3.5" />
            Ver OS
          </Button>
        </Link>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => isRead ? marcarComoNaoLida(notificacao.id) : marcarComoLida(notificacao.id)}
          disabled={updating[notificacao.id]}
          aria-label={isRead ? "Marcar como não lida" : "Marcar como lida"}
          title={isRead ? "Marcar como não lida" : "Marcar como lida"}
        >
          {updating[notificacao.id] ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-b-2 border-current" />
          ) : isRead ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    );
  };

  const renderNotificationRow = (notificacao, isRead) => (
    <article
      key={notificacao.id}
      className="border-l-2 border-l-orange-400 bg-slate-50 px-3 py-2.5 sm:px-4"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {getIconByTipo(notificacao.tipo_notificacao)}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-5 text-slate-900">
              {notificacao.mensagem}
            </p>
            <Badge variant="outline" className="mt-1 h-5 border-slate-300 px-2 text-[10px] font-medium text-slate-700">
              {notificacao.tipo_notificacao === 'nova_solicitacao' ? 'Nova Solicitação' : 'Atualizada'}
            </Badge>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Criada: {format(new Date(notificacao.created_date), "dd/MM/yy 'às' HH:mm")}
              </span>
              {isRead && notificacao.data_leitura && (
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  Lida: {format(new Date(notificacao.data_leitura), "dd/MM/yy 'às' HH:mm")}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0 lg:pl-3">{renderActions(notificacao, isRead)}</div>
      </div>
    </article>
  );

  if (loading && !error) {
    return (
      <div className="p-8 flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 max-w-4xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div className="space-y-1">
          <ModuleLabel>Notificações</ModuleLabel>
          <p className="text-sm text-slate-600">
            {error ? "Sistema de notificações temporariamente indisponível" :
             `${notificacaosSeparadas.naoLidas.length} não lidas • ${notificacaosSeparadas.lidas.length} lidas`}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={loadNotificacoes} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          {notificacaosSeparadas.naoLidas.length > 0 && !error && (
            <Button onClick={marcarTodasComoLidas} className="bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Marcar Todas como Lidas
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Notificações Não Lidas */}
      {notificacaosSeparadas.naoLidas.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-card p-3 shadow-sm sm:p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            Não Lidas ({notificacaosSeparadas.naoLidas.length})
          </h2>
          <div className="space-y-2">
            {notificacaosSeparadas.naoLidas.map((notificacao) => renderNotificationRow(notificacao, false))}
          </div>
        </section>
      )}

      {/* Notificações Lidas */}
      {notificacaosSeparadas.lidas.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-card p-3 shadow-sm sm:p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            Lidas ({notificacaosSeparadas.lidas.length})
          </h2>
          <div className="space-y-2">
            {notificacaosSeparadas.lidas.map((notificacao) => renderNotificationRow(notificacao, true))}
          </div>
        </section>
      )}

      {!error && notificacoes.length === 0 && !loading && (
        <Card className="shadow-sm border-0 bg-white">
          <CardContent className="text-center py-12">
            <Bell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Nenhuma Notificação</h3>
            <p className="text-slate-600">
              Você não possui notificações no momento. Quando houver novas solicitações de OS, elas aparecerão aqui.
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={Boolean(rejectionNotification)}
        onOpenChange={(open) => !open && setRejectionNotification(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar solicitação de OS</DialogTitle>
            <DialogDescription>
              O motivo ficará registrado e a solicitação não entrará na lista de ordens de serviço.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={reprovarSolicitacao} className="space-y-4">
            <div>
              <Label htmlFor="notification-rejection-reason">Motivo da reprovação *</Label>
              <Textarea
                id="notification-rejection-reason"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Informe o motivo da reprovação"
                required
                minLength={3}
                className="mt-1 min-h-28"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectionNotification(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={rejectionReason.trim().length < 3 || Boolean(reviewing[rejectionNotification?.id])}
              >
                {reviewing[rejectionNotification?.id] ? "Salvando..." : "Confirmar reprovação"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <VisualizacaoOSModal
        isOpen={Boolean(selectedOSForPrint)}
        onClose={() => setSelectedOSForPrint(null)}
        os={selectedOSForPrint}
      />
    </div>
  );
}
