import { useState } from "react";
import { Moon, Sun, Wrench } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 bg-cover bg-bottom px-4 py-16 sm:px-6"
      style={{ backgroundImage: "url('/images/login-background.png')" }}
    >
      <div className="absolute inset-0 bg-slate-950/10" aria-hidden="true" />
      <Button type="button" variant="outline" size="icon" onClick={() => setTheme(isDarkTheme ? "light" : "dark")} className="absolute right-4 top-4 z-10 border-white/20 bg-slate-950/50 text-white backdrop-blur-sm hover:bg-slate-900/70 hover:text-white" aria-label={isDarkTheme ? "Ativar modo claro" : "Ativar modo escuro"} title={isDarkTheme ? "Ativar modo claro" : "Ativar modo escuro"}>
        {isDarkTheme ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <section className="relative z-10 w-full max-w-sm rounded-lg border border-white/15 bg-background/90 p-6 shadow-2xl backdrop-blur-md sm:p-7">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 shadow-lg shadow-blue-950/30">
            <Wrench className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">MaintenancePro</h1>
            <p className="text-sm text-muted-foreground">Acesse sua conta</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="username">Usuário ou e-mail</Label>
            <Input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              className="bg-background/70"
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
              className="bg-background/70"
              required
            />
          </div>
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </section>
    </main>
  );
}
