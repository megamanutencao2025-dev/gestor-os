import { lazy } from "react";

const pageLoaders = {
  AssistenteIA: () => import("@/pages/AssistenteIA"),
  Cadastros: () => import("@/pages/Cadastros"),
  configuracoes: () => import("@/pages/Configuracoes"),
  Dashboard: () => import("@/pages/Dashboard"),
  EditarOS: () => import("@/pages/EditarOS"),
  EquipamentoDetalhes: () => import("@/pages/EquipamentoDetalhes"),
  ExportarDados: () => import("@/pages/ExportarDados"),
  GestaoTerceirizados: () => import("@/pages/GestaoTerceirizados"),
  Notificacoes: () => import("@/pages/Notificacoes"),
  NovaOS: () => import("@/pages/NovaOS"),
  NovaOSTerceirizado: () => import("@/pages/NovaOSTerceirizado"),
  OrdemServico: () => import("@/pages/OrdemServico"),
  PlanejamentoManutencao: () => import("@/pages/PlanejamentoManutencao"),
  Relatorios: () => import("@/pages/Relatorios"),
  SolicitarOS: () => import("@/pages/SolicitarOS"),
};

export const preloadPage = (pageName) => pageLoaders[pageName]?.();

export const PAGES = Object.fromEntries(
  Object.entries(pageLoaders).map(([pageName, loader]) => [pageName, lazy(loader)])
);
