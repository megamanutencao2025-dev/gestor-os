import AssistenteIA from './pages/AssistenteIA';
import Cadastros from './pages/Cadastros';
import Dashboard from './pages/Dashboard';
import EditarOS from './pages/EditarOS';
import EquipamentoDetalhes from './pages/EquipamentoDetalhes';
import ExportarDados from './pages/ExportarDados';
import GestaoTerceirizados from './pages/GestaoTerceirizados';
import Notificacoes from './pages/Notificacoes';
import NovaOS from './pages/NovaOS';
import NovaOSTerceirizado from './pages/NovaOSTerceirizado';
import OrdemServico from './pages/OrdemServico';
import PlanejamentoManutencao from './pages/PlanejamentoManutencao';
import Relatorios from './pages/Relatorios';
import SolicitarOS from './pages/SolicitarOS';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AssistenteIA": AssistenteIA,
    "Cadastros": Cadastros,
    "Dashboard": Dashboard,
    "EditarOS": EditarOS,
    "EquipamentoDetalhes": EquipamentoDetalhes,
    "ExportarDados": ExportarDados,
    "GestaoTerceirizados": GestaoTerceirizados,
    "Notificacoes": Notificacoes,
    "NovaOS": NovaOS,
    "NovaOSTerceirizado": NovaOSTerceirizado,
    "OrdemServico": OrdemServico,
    "PlanejamentoManutencao": PlanejamentoManutencao,
    "Relatorios": Relatorios,
    "SolicitarOS": SolicitarOS,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};