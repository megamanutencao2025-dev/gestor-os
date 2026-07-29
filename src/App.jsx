import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import LoginScreen from '@/components/LoginScreen';
import SolicitarOS from './pages/SolicitarOS';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/components/theme-provider';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const routeAliases = {
  "assistente-ia": "AssistenteIA",
  cadastros: "Cadastros",
  configuracoes: "configuracoes",
  dashboard: "Dashboard",
  "editar-os": "EditarOS",
  "equipamento-detalhes": "EquipamentoDetalhes",
  "exportar-dados": "ExportarDados",
  "gestao-terceirizados": "GestaoTerceirizados",
  notificacoes: "Notificacoes",
  "nova-os": "NovaOS",
  "nova-os-terceirizado": "NovaOSTerceirizado",
  "ordens-servico": "OrdemServico",
  planejamento: "PlanejamentoManutencao",
  relatorios: "Relatorios",
};

const pageModuleMap = {
  Dashboard: "dashboard",
  OrdemServico: "ordens_servico",
  EditarOS: "ordens_servico",
  NovaOSTerceirizado: "ordens_servico",
  GestaoTerceirizados: "ordens_servico",
  NovaOS: "nova_os",
  PlanejamentoManutencao: "planejamento_manutencao",
  Cadastros: "cadastros",
  EquipamentoDetalhes: "cadastros",
  Relatorios: "relatorios",
  ExportarDados: "exportar_dados",
  Notificacoes: "notificacoes",
  AssistenteIA: "assistente_ia",
  configuracoes: "configuracoes",
};

const LayoutWrapper = ({ children, currentPageName, resetKey }) => (
  <ErrorBoundary resetKey={resetKey || currentPageName}>
    {Layout ? (
      <Layout currentPageName={currentPageName}>{children}</Layout>
    ) : (
      <>{children}</>
    )}
  </ErrorBoundary>
);

const AuthenticatedApp = () => {
  const location = useLocation();
  const { isLoadingAuth, isLoadingPublicSettings, isAuthenticated, authError, canAccess } = useAuth();
  const publicPath = location.pathname.toLowerCase();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
  }

  if (!isAuthenticated) {
    if (publicPath === "/solicitar-os") {
      return (
        <ErrorBoundary resetKey={location.pathname}>
          <SolicitarOS />
        </ErrorBoundary>
      );
    }
    return <LoginScreen />;
  }

  const AccessDenied = () => (
    <LayoutWrapper currentPageName="Acesso negado" resetKey={location.pathname}>
      <div className="p-8">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Acesso negado</h1>
          <p className="text-slate-600">Você não tem permissão para acessar este módulo.</p>
        </div>
      </div>
    </LayoutWrapper>
  );

  if (publicPath === "/solicitar-os") {
    if (!canAccess("solicitar_os")) return <AccessDenied />;
    return (
      <ErrorBoundary resetKey={location.pathname}>
        <SolicitarOS />
      </ErrorBoundary>
    );
  }

  const renderProtectedPage = (path, Page) => {
    const moduleKey = pageModuleMap[path];
    if (moduleKey && !canAccess(moduleKey)) return <AccessDenied />;
    return (
      <LayoutWrapper currentPageName={path} resetKey={location.pathname}>
        <Page />
      </LayoutWrapper>
    );
  };

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        canAccess(pageModuleMap[mainPageKey])
          ? (
            <LayoutWrapper currentPageName={mainPageKey} resetKey={location.pathname}>
              <MainPage />
            </LayoutWrapper>
          )
          : canAccess("solicitar_os")
            ? <Navigate to="/solicitar-os" replace />
            : <AccessDenied />
      } />
      <Route path="/solicitar-os" element={<SolicitarOS />} />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={renderProtectedPage(path, Page)}
        />
      ))}
      {Object.entries(routeAliases).map(([alias, pageName]) => {
        const Page = Pages[pageName];
        if (!Page) return null;
        return (
          <Route
            key={alias}
            path={`/${alias}`}
            element={renderProtectedPage(pageName, Page)}
          />
        );
      })}
      <Route path="/ordem-servico" element={<Navigate to="/ordens-servico" replace />} />
      <Route
        path="*"
        element={(
          <LayoutWrapper currentPageName="Página não encontrada" resetKey={location.pathname}>
            <PageNotFound />
          </LayoutWrapper>
        )}
      />
    </Routes>
  );
};


function App() {

  return (
    <ErrorBoundary resetKey="app" title="Erro ao iniciar o aplicativo">
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
        <AuthProvider>
          <QueryClientProvider client={queryClientInstance}>
            <Router>
              <NavigationTracker />
              <AuthenticatedApp />
            </Router>
            <Toaster />
            <VisualEditAgent />
          </QueryClientProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
