import { useState } from "react";
import { Moon, Sun, Wrench } from "lucide-react";
import { useTheme } from "next-themes";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isDarkTheme = resolvedTheme === "dark";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ username, password });
    } catch (err) {
      setError(err.message || "Não foi possível entrar no sistema.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-slate-950 bg-cover bg-bottom"
      style={{ backgroundImage: "url('/images/login-background.png')" }}
    >
      <div className="absolute inset-0 bg-slate-950/10" aria-hidden="true" />

      <header className="absolute inset-x-0 top-0 z-20 flex h-12 items-center justify-center border-b border-white/10 bg-slate-950/70 px-4 backdrop-blur-md">
        <span className="text-xs font-medium text-white/75 sm:text-sm">
          MaintenancePro
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setTheme(isDarkTheme ? "light" : "dark")}
          className="absolute right-3 h-8 w-8 border-white/20 bg-slate-950/40 text-white hover:bg-slate-900/70 hover:text-white sm:right-4"
          aria-label={isDarkTheme ? "Ativar modo claro" : "Ativar modo escuro"}
          title={isDarkTheme ? "Ativar modo claro" : "Ativar modo escuro"}
        >
          {isDarkTheme ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </header>

      <div className="relative z-10 flex min-h-screen justify-end pt-12">
        <aside className="flex min-h-[calc(100vh-3rem)] w-full items-center border-l border-white/15 bg-background/90 px-6 py-10 shadow-2xl backdrop-blur-md sm:w-[390px] sm:bg-background/95 sm:px-9 lg:w-[430px] lg:px-12">
          <section className="mx-auto w-full max-w-sm" aria-labelledby="login-title">
            <div className="mb-8">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-blue-600 shadow-lg shadow-blue-950/30">
                <Wrench className="h-5 w-5 text-white" />
              </div>
              <h1 id="login-title" className="text-2xl font-bold text-foreground">
                Acesse o sistema
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Entre com suas credenciais
              </p>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-5">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="username">Usuário ou e-mail</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  className="mt-2 h-10 bg-background/70"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="mt-2 h-10 bg-background/70"
                  required
                />
              </div>
              <Button
                type="submit"
                className="h-10 w-full bg-blue-600 hover:bg-blue-700"
                disabled={loading}
              >
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </section>
        </aside>
      </div>
    </main>
  );
}
