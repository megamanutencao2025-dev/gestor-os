import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { appApi } from "@/api/appClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [modules, setModules] = useState([]);

  const loadModules = useCallback(async () => {
    if (!appApi.getToken()) {
      setModules([]);
      return [];
    }

    const moduleList = await appApi.admin.modules.mine();
    setModules(moduleList || []);
    return moduleList || [];
  }, []);

  const checkUserAuth = useCallback(async () => {
    if (!appApi.getToken()) {
      setUser(null);
      setModules([]);
      setAuthError(null);
      setAuthChecked(true);
      setIsLoadingAuth(false);
      return null;
    }

    setIsLoadingAuth(true);
    try {
      const currentUser = await appApi.auth.me();
      setUser(currentUser);
      await loadModules();
      setAuthError(null);
      return currentUser;
    } catch (error) {
      setUser(null);
      setModules([]);
      setAuthError(error.status === 403 ? { type: "user_not_registered" } : null);
      return null;
    } finally {
      setAuthChecked(true);
      setIsLoadingAuth(false);
    }
  }, [loadModules]);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setModules([]);
      setAuthError(null);
      setAuthChecked(true);
      setIsLoadingAuth(false);
    };

    window.addEventListener("maintenancepro:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("maintenancepro:unauthorized", handleUnauthorized);
  }, []);

  const login = useCallback(async (credentials) => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const loggedUser = await appApi.auth.login(credentials);
      setUser(loggedUser);
      await loadModules();
      setAuthChecked(true);
      return loggedUser;
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await appApi.auth.logout();
    setUser(null);
    setModules([]);
    setAuthError(null);
    setAuthChecked(true);
  }, []);

  const canAccess = useCallback((moduleKey) => {
    if (!moduleKey) return true;
    if (user?.role === "admin") return true;
    return (modules || []).some((module) => module.key === moduleKey && module.canAccess);
  }, [modules, user]);

  const value = useMemo(() => ({
    user,
    modules,
    authChecked,
    authError,
    isLoadingAuth,
    isLoadingPublicSettings: false,
    isAuthenticated: Boolean(user),
    canAccess,
    refreshModules: loadModules,
    checkUserAuth,
    login,
    logout,
  }), [user, modules, authChecked, authError, isLoadingAuth, canAccess, loadModules, checkUserAuth, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
