import { normalizeOrdemServico, normalizeOrdemServicoList } from "../utils/ordemServicoNormalizer.js";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const TOKEN_KEY = "maintenancepro_access_token";
const REFRESH_TOKEN_KEY = "maintenancepro_refresh_token";

if (!import.meta.env.VITE_API_URL) {
  console.warn("VITE_API_URL não definido. Usando http://127.0.0.1:8000 como fallback.");
}

const entityRoutes = {
  AreaManutencao: "areas-manutencao",
  CentroCusto: "centros-custo",
  Equipamento: "equipamentos",
  FamiliaEquipamento: "familias-equipamento",
  Localizacao: "localizacoes",
  Mantenedor: "mantenedores",
  Material: "materiais",
  NotificacaoOS: "notificacoes-os",
  OrdemServico: "ordens-servico",
  PrestadoraServico: "prestadoras-servico",
  Prioridade: "prioridades",
  StatusOS: "status-os",
  TipoManutencao: "tipos-manutencao",
};

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function getRefreshToken() {
  return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

function setRefreshToken(token) {
  if (token) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    setToken(null);
    setRefreshToken(null);
    return false;
  }

  const payload = await response.json();
  setToken(payload.accessToken);
  setRefreshToken(payload.refreshToken);
  return true;
}

async function request(path, options = {}) {
  const { responseType, _retried, ...fetchOptions } = options;
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (
    !headers.has("Content-Type")
    && options.body !== undefined
    && !(options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers,
    });
  } catch (error) {
    const requestError = new Error(`Não foi possível conectar à API em ${API_URL}. Verifique o VITE_API_URL e se o backend está ativo.`);
    requestError.status = 0;
    requestError.cause = error;
    throw requestError;
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = responseType === "blob" && response.ok
    ? await response.blob()
    : contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");

  if (!response.ok) {
    if (response.status === 401 && !_retried && !path.startsWith("/auth/")) {
      const refreshed = await refreshSession().catch(() => false);
      if (refreshed) {
        return request(path, { ...options, _retried: true });
      }
    }
    if (response.status === 401) {
      setToken(null);
      setRefreshToken(null);
      window.dispatchEvent(new CustomEvent("maintenancepro:unauthorized"));
    }
    const message = payload?.message || payload?.error || response.statusText || "Erro na requisição";
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function normalizeSort(sort) {
  return sort ? `?sort=${encodeURIComponent(sort)}` : "";
}

function withQuery(path, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

function normalizeEntityPayload(entityName, payload) {
  if (entityName !== "OrdemServico") return payload;
  return Array.isArray(payload) ? normalizeOrdemServicoList(payload) : normalizeOrdemServico(payload);
}

function createEntityClient(route, entityName) {
  const basePath = `/api/${route}`;

  return {
    list: async (sort) => normalizeEntityPayload(entityName, await request(`${basePath}${normalizeSort(sort)}`)),
    get: async (id) => normalizeEntityPayload(entityName, await request(`${basePath}/${encodeURIComponent(id)}`)),
    create: async (data) => normalizeEntityPayload(entityName, await request(basePath, {
      method: "POST",
      body: JSON.stringify(data || {}),
    })),
    bulkCreate: async (records) => normalizeEntityPayload(entityName, await request(`${basePath}/bulk`, {
      method: "POST",
      body: JSON.stringify(Array.isArray(records) ? records : []),
    })),
    update: async (id, data) => normalizeEntityPayload(entityName, await request(`${basePath}/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data || {}),
    })),
    delete: async (id) => normalizeEntityPayload(entityName, await request(`${basePath}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    })),
  };
}

const entities = Object.fromEntries(
  Object.entries(entityRoutes).map(([name, route]) => [name, createEntityClient(route, name)])
);

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Erro ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

export const appApi = {
  API_URL,
  getToken,
  setToken,
  request,
  auth: {
    async login(credentials) {
      const result = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials || {}),
      });
      setToken(result?.accessToken);
      setRefreshToken(result?.refreshToken);
      return result?.user || result;
    },
    async register(data) {
      const result = await request("/auth/register", {
        method: "POST",
        body: JSON.stringify(data || {}),
      });
      setToken(result?.accessToken);
      setRefreshToken(result?.refreshToken);
      return result?.user || result;
    },
    me: () => request("/auth/me"),
    async logout() {
      try {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          await request("/auth/logout", {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
          });
        }
      } finally {
        setToken(null);
        setRefreshToken(null);
      }
    },
    changePassword: (data) => request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),
  },
  entities,
  dashboard: {
    maintenance: (params) => request(
      withQuery("/api/v1/dashboard/maintenance/", params)
    ),
  },
  workOrders: {
    list: (params) => request(withQuery("/api/v1/work-orders/", params)),
    get: (id) => request(`/api/v1/work-orders/${encodeURIComponent(id)}/`),
  },
  files: {
    async upload(file) {
      const dataUrl = await fileToDataUrl(file);
      return request("/files", {
        method: "POST",
        body: JSON.stringify({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl,
        }),
      });
    },
  },
  integrations: {
    extract: (payload) => request("/integrations/extract", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }),
    invokeLLM: (payload) => request("/integrations/llm", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }),
  },
  admin: {
    workOrders: {
      pendingSolicitations: () => request("/api/ordens-servico/solicitacoes-pendentes"),
      decideSolicitation: (id, action, reason = "") => request(
        `/api/ordens-servico/${encodeURIComponent(id)}/aprovacao`,
        {
          method: "PATCH",
          body: JSON.stringify({ action, reason }),
        }
      ),
    },
    users: {
      list: () => request("/api/users"),
      create: (data) => request("/api/users", {
        method: "POST",
        body: JSON.stringify(data || {}),
      }),
      update: (id, data) => request(`/api/users/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(data || {}),
      }),
      changePassword: (id, password) => request(`/api/users/${encodeURIComponent(id)}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password }),
      }),
      temporaryPassword: (id) => request(`/api/users/${encodeURIComponent(id)}/temporary-password`, {
        method: "POST",
      }),
      setStatus: (id, active) => request(`/api/users/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      }),
      modules: (id) => request(`/api/users/${encodeURIComponent(id)}/modules`),
      updateModules: (id, moduleKeys) => request(`/api/users/${encodeURIComponent(id)}/modules`, {
        method: "PUT",
        body: JSON.stringify({ moduleKeys }),
      }),
    },
    modules: {
      list: () => request("/api/modules"),
      mine: () => request("/api/me/modules"),
    },
  },
  publicSolicitation: {
    reference: () => request("/api/public/solicitar-os/reference"),
    ordens: () => request("/api/public/solicitar-os/ordens"),
    createOrdem: (data) => request("/api/public/solicitar-os/ordens", {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),
    createNotificacao: (data) => request("/api/public/solicitar-os/notificacoes", {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),
  },
  dataTransfer: {
    exportCsv: (entityName) => request(
      `/api/v1/data-transfer/export/${encodeURIComponent(entityName)}/`,
      { responseType: "blob" }
    ),
    importCsv: (entityName, file) => {
      const body = new FormData();
      body.append("file", file);
      return request(
        `/api/v1/data-transfer/import/${encodeURIComponent(entityName)}/`,
        { method: "POST", body }
      );
    },
  },
  materialNfeImport: {
    preview: (files) => {
      const body = new FormData();
      files.forEach((file) => body.append("files", file));
      return request("/api/v1/inventory/nfe/preview/", {
        method: "POST",
        body,
      });
    },
    confirm: (payload) => request("/api/v1/inventory/nfe/confirm/", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }),
  },
};
