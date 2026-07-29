import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function PageNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center space-y-4">
        <div className="text-sm font-semibold text-blue-600">404</div>
        <h1 className="text-3xl font-bold text-slate-900">Página não encontrada</h1>
        <p className="text-slate-600">A rota acessada não existe neste sistema.</p>
        <Button asChild>
          <Link to="/">Voltar ao dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
