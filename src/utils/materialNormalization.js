export const MATERIAL_UNIT_OPTIONS = [
  { value: "kg", label: "Kg", legacyValue: "Kg" },
  { value: "unit", label: "Unidade", legacyValue: "Unidade" },
  { value: "liter", label: "Litro", legacyValue: "Litro" },
  { value: "meter", label: "Metro", legacyValue: "Metro" },
  { value: "square_meter", label: "Metro Quadrado", legacyValue: "Metro Quadrado" },
  { value: "cubic_meter", label: "Metro Cúbico", legacyValue: "Metro Cúbico" },
  { value: "hour", label: "Hora", legacyValue: "Hora" },
];

export function normalizeProductName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR");
}
