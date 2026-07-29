const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return [];

  if (typeof value === "string") {
    try {
      return toArray(JSON.parse(value));
    } catch {
      return [];
    }
  }

  if (typeof value === "object") {
    const values = Object.values(value);
    if (values.length > 0 && values.every((item) => item && typeof item === "object")) {
      return values;
    }
    return [value];
  }

  return [];
};

export function normalizeOrdemServico(os) {
  if (!os || typeof os !== "object") return os;

  const equipamentos = toArray(os.equipamentos).map((equipamento) => ({
    ...equipamento,
    hierarquia: toArray(equipamento?.hierarquia),
  }));
  const servicos = toArray(os.servicos).map((servico) => ({
    ...servico,
    mantenedores: toArray(servico?.mantenedores),
    anexos: toArray(servico?.anexos),
  }));
  const materiais = toArray(os.materiais).map((material) => ({
    ...material,
    anexos: toArray(material?.anexos),
  }));
  const terceirizados = toArray(os.terceirizados).map((terceirizado) => ({
    ...terceirizado,
    anexos: toArray(terceirizado?.anexos),
    documentos: toArray(terceirizado?.documentos),
  }));
  const outrosCustos = toArray(os.outrosCustos ?? os.outros).map((outro) => ({
    ...outro,
    anexos: toArray(outro?.anexos),
  }));

  return {
    ...os,
    equipamentos,
    servicos,
    materiais,
    terceirizados,
    outrosCustos,
    outros: outrosCustos,
    anexos: toArray(os.anexos),
  };
}

export function normalizeOrdemServicoList(records) {
  return Array.isArray(records) ? records.map(normalizeOrdemServico) : [];
}
