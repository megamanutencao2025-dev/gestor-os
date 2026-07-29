
import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { appApi } from "@/api/appClient";
import { useAuth } from "@/lib/AuthContext";
import { 
  Settings, 
  Wrench, 
  FileText, 
  Home,
  Database,
  BarChart3,
  Calendar,
  Bell,
  Send,
  PanelLeft,
  X,
  UserCog,
  Sun,
  Moon,
  AlertTriangle,
  Clock3,
  ExternalLink,
  ClipboardCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTheme } from "next-themes";

const navigationItems = [
  { title: "Dashboard", url: createPageUrl("Dashboard"), icon: Home, moduleKey: "dashboard" },
  { title: "Ordens de Serviço", url: createPageUrl("OrdemServico"), icon: FileText, moduleKey: "ordens_servico" },
  { title: "Nova OS", url: createPageUrl("NovaOS"), icon: Wrench, moduleKey: "nova_os" },
  { title: "Planejamento", url: createPageUrl("PlanejamentoManutencao"), icon: Calendar, moduleKey: "planejamento_manutencao" },
  { title: "Cadastros", url: createPageUrl("Cadastros"), icon: Database, moduleKey: "cadastros" },
  { title: "Relatórios", url: createPageUrl("Relatorios"), icon: BarChart3, moduleKey: "relatorios" },
  { title: "Exportar Dados", url: createPageUrl("ExportarDados"), icon: Settings, moduleKey: "exportar_dados" },
  { title: "Assistente IA", url: createPageUrl("AssistenteIA"), icon: Settings, moduleKey: "assistente_ia" },
  { title: "Configurações", url: "/configuracoes", icon: UserCog, moduleKey: "configuracoes" },
  { title: "Solicitar OS", url: "/solicitar-os", icon: Send, moduleKey: "solicitar_os" },
];

const NavLink = ({ item, isActive, isCollapsed }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const Icon = item.icon;
    
    const linkContent = (
      <>
        <Icon className={`${isCollapsed ? 'w-5 h-5' : 'w-5 h-5'} ${isActive ? 'text-blue-600' : ''}`} />
        {!isCollapsed && <span className="truncate">{item.title}</span>}
        {!isCollapsed && item.badge && (
          <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
            {item.badge > 9 ? '9+' : item.badge}
          </Badge>
        )}
      </>
    );

    const linkElement = (
      <Link
        to={item.url}
        className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} rounded-lg px-3 py-2.5 text-slate-700 transition-all hover:bg-slate-100 hover:text-slate-900 ${isActive ? 'bg-blue-50 text-blue-600 font-semibold' : ''} ${isCollapsed ? 'mx-auto' : ''}`}
        onMouseEnter={() => isCollapsed && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {linkContent}
      </Link>
    );

    if (isCollapsed) {
      return (
        <div className="relative">
          {linkElement}
          {showTooltip && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 overflow-hidden rounded-md border bg-slate-900 text-white px-3 py-1.5 text-sm shadow-md whitespace-nowrap font-medium">
              {item.title}
              {item.badge && (
                <Badge className="ml-2 bg-red-500 text-white">
                  {item.badge > 9 ? '9+' : item.badge}
                </Badge>
              )}
            </div>
          )}
        </div>
      );
    }

    return linkElement;
};

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const { user: authUser, canAccess } = useAuth();
  const [user, setUser] = useState(null);
  const [notificacoesNaoLidas, setNotificacoesNaoLidas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificacoesError, setNotificacoesError] = useState(false);
  const [notificacoesPendentes, setNotificacoesPendentes] = useState([]);
  const [showNotificacoesLogin, setShowNotificacoesLogin] = useState(false);
  const notificacoesPrompted = useRef(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [showToggleTooltip, setShowToggleTooltip] = useState(false);
  const [showUserTooltip, setShowUserTooltip] = useState(false);
  // Removed showLogoTooltip as it's no longer needed for the Wrench icon alone in collapsed state

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadNotificacoes();
      const interval = setInterval(loadNotificacoes, notificacoesError ? 60000 : 30000);
      return () => clearInterval(interval);
    }
  }, [user, notificacoesError]);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const checkUser = async () => {
    if (authUser) {
      setUser(authUser);
      setLoading(false);
      return;
    }

    try {
      const currentUser = await appApi.auth.me();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loadNotificacoes = async () => {
    try {
      const notificacoes = await appApi.entities.NotificacaoOS.list();
      const naoLidasLista = (notificacoes || []).filter(n => !n.foi_lida);
      const naoLidas = naoLidasLista.length;
      setNotificacoesNaoLidas(naoLidas);
      setNotificacoesPendentes(naoLidasLista);
      if (!notificacoesPrompted.current && naoLidas > 0 && canAccess("notificacoes")) {
        setShowNotificacoesLogin(true);
        notificacoesPrompted.current = true;
      }
      setNotificacoesError(false);
    } catch (error) {
      console.warn("Não foi possível carregar notificações:", error?.message || 'Erro desconhecido');
      setNotificacoesError(true);
      setNotificacoesNaoLidas(0);
      setNotificacoesPendentes([]);
    }
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
    setShowToggleTooltip(false); // Hide tooltip when sidebar state changes
  };

  const allNavItems = [
    ...navigationItems,
    { 
      title: "Notificações", 
      url: createPageUrl("Notificacoes"), 
      icon: Bell, 
      moduleKey: "notificacoes",
      badge: (notificacoesNaoLidas > 0 && !notificacoesError) ? notificacoesNaoLidas : null 
    }
  ].filter((item) => item.public || canAccess(item.moduleKey));

  const fecharNotificacoesLogin = () => setShowNotificacoesLogin(false);

  const abrirNotificacao = (notificacao) => {
    fecharNotificacoesLogin();
    navigate(createPageUrl(`EditarOS?id=${notificacao.ordem_servico_id}`));
  };

  const isDarkTheme = resolvedTheme === "dark";
  const toggleTheme = () => setTheme(isDarkTheme ? "light" : "dark");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const SidebarContent = () => (
    <>
      <div className={`flex h-16 shrink-0 items-center ${isCollapsed ? 'justify-center' : 'gap-2 px-6'} border-b border-slate-200`}>
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 relative" // Added relative for tooltip positioning
            onMouseEnter={() => setShowToggleTooltip(true)}
            onMouseLeave={() => setShowToggleTooltip(false)}
          >
            <PanelLeft className="w-5 h-5" />
            {showToggleTooltip && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 overflow-hidden rounded-md border bg-slate-900 text-white px-3 py-1.5 text-sm shadow-md whitespace-nowrap">
                Expandir Menu
              </div>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8"
            aria-label={isDarkTheme ? "Ativar modo claro" : "Ativar modo escuro"}
            title={isDarkTheme ? "Ativar modo claro" : "Ativar modo escuro"}
          >
            {isDarkTheme ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          </div>
        ) : (
          <>
            <Wrench className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-slate-900">MaintenancePro</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="ml-auto h-8 w-8"
            >
              <PanelLeft className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8"
              aria-label={isDarkTheme ? "Ativar modo claro" : "Ativar modo escuro"}
              title={isDarkTheme ? "Ativar modo claro" : "Ativar modo escuro"}
            >
              {isDarkTheme ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </>
        )}
      </div>
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7 p-4">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {allNavItems.map((item) => {
                const isActive = location.pathname === item.url || (item.title === "Dashboard" && location.pathname === "/");
                return (
                  <li key={item.title}>
                    <NavLink item={item} isActive={isActive} isCollapsed={isCollapsed} />
                  </li>
                );
              })}
            </ul>
          </li>
          <li className="mt-auto space-y-4">
            {/* User Info */}
            {user && (
              <div className={`${isCollapsed ? 'p-2' : 'p-4'} rounded-lg bg-slate-50 border`}>
                {isCollapsed ? (
                  <div 
                    className="relative"
                    onMouseEnter={() => setShowUserTooltip(true)}
                    onMouseLeave={() => setShowUserTooltip(false)}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold mx-auto cursor-pointer">
                      {user.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </div>
                    {showUserTooltip && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 overflow-hidden rounded-md border bg-slate-900 text-white px-3 py-1.5 text-sm shadow-md whitespace-nowrap">
                        <div className="font-semibold">{user.full_name || user.email}</div>
                        <div className="text-xs text-slate-300">Usuário</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-slate-800 truncate">{user.full_name || user.email}</div>
                    <Badge variant="outline" className="mt-1">Usuário</Badge>
                  </>
                )}
              </div>
            )}
          </li>
        </ul>
      </nav>
    </>
  );

  return (
    <div>
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 flex z-50 lg:hidden transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="fixed inset-0 bg-gray-900/80" onClick={() => setSidebarOpen(false)}></div>
        <div className={`relative flex w-full max-w-xs flex-1 flex-col bg-white transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button type="button" className="ml-1 flex h-10 w-10 items-center justify-center rounded-full text-white" onClick={() => setSidebarOpen(false)}>
              <span className="sr-only">Fechar sidebar</span>
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <SidebarContent />
        </div>
      </div>

      {/* Static sidebar for desktop */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:flex-col transition-all duration-300 ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}>
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-slate-200 bg-white">
          <SidebarContent />
        </div>
      </div>
      
      {/* Main content area */}
      <div className={`transition-all duration-300 ${isCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        {/* Mobile header */}
        <div className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:hidden">
          <button type="button" className="-m-2.5 p-2.5 text-slate-700 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <span className="sr-only">Abrir sidebar</span>
            <PanelLeft className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="flex-1 text-sm font-semibold leading-6 text-slate-900">{currentPageName}</div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9"
            aria-label={isDarkTheme ? "Ativar modo claro" : "Ativar modo escuro"}
            title={isDarkTheme ? "Ativar modo claro" : "Ativar modo escuro"}
          >
            {isDarkTheme ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>

        <main>
          <div>{children}</div>
        </main>
      </div>
      <Dialog open={showNotificacoesLogin} onOpenChange={setShowNotificacoesLogin}>
        <DialogContent className="max-h-[90vh] max-w-2xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4 pr-12 sm:px-6">
            <DialogTitle className="flex items-center gap-2.5 text-base">
              <Bell className="h-5 w-5 text-blue-600" />
              Central de Notificações
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Solicitações de OS que precisam da sua atenção.
            </DialogDescription>
          </DialogHeader>

          <div className="border-b px-5 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Fila de análise</p>
                  <p className="truncate text-xs text-slate-600">Revise as solicitações antes de liberá-las como OS</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-bold leading-none text-emerald-700">{notificacoesPendentes.length}</p>
                <p className="mt-1 text-[11px] text-emerald-700">aguardando</p>
              </div>
            </div>
          </div>

          <section className="min-h-0 overflow-hidden px-5 py-4 sm:px-6" aria-label="Pendências e alertas">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <h3 className="text-sm font-medium text-slate-900">Pendências e alertas ({notificacoesPendentes.length})</h3>
            </div>
            <div className="max-h-[52vh] space-y-2.5 overflow-y-auto pr-1">
              {notificacoesPendentes.map((notificacao) => (
                <article key={notificacao.id} className="group rounded-md border border-slate-200 border-l-[3px] border-l-orange-400 bg-white px-3 py-3 shadow-sm transition-colors hover:bg-slate-50 sm:px-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
                      <Clock3 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold text-slate-900">{notificacao.mensagem}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span>Solicitação aguardando análise</span>
                        {notificacao.created_date && (
                          <span>{new Date(notificacao.created_date).toLocaleString("pt-BR")}</span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="hidden shrink-0 border-amber-300 bg-amber-50 text-amber-700 sm:inline-flex">
                      Pendente
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => abrirNotificacao(notificacao)}
                      aria-label="Abrir solicitação"
                      title="Abrir solicitação"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="flex flex-col-reverse gap-2 border-t bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <Button type="button" variant="outline" onClick={fecharNotificacoesLogin}>Fechar</Button>
            <Button type="button" onClick={() => { fecharNotificacoesLogin(); navigate(createPageUrl("Notificacoes")); }} className="bg-blue-600 hover:bg-blue-700">
              Abrir central de notificações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
