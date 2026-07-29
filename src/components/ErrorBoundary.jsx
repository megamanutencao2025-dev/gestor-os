import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Erro de renderização capturado:", error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    const title = this.props.title || "Não foi possível carregar esta tela";
    const message = this.props.message || "Ocorreu um erro inesperado. A página não ficará em branco; tente recarregar ou voltar ao dashboard.";

    if (this.props.fallback) {
      return this.props.fallback({ error: this.state.error, reset: () => this.setState({ error: null }) });
    }

    return (
      <div className="min-h-[320px] flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-lg border bg-white p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
          <p className="mt-3 rounded bg-slate-50 p-2 text-xs text-slate-500">
            {this.state.error?.message || "Erro desconhecido"}
          </p>
          <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => this.setState({ error: null })}>
              Tentar novamente
            </Button>
            <Button onClick={() => window.location.assign("/")}>
              Voltar ao dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
