export function validateQuickCreateFields(formData, fields = []) {
  const missingField = fields.find((field) => {
    if (!field.required) return false;
    const value = formData?.[field.name];
    return value === null || value === undefined || String(value).trim() === "";
  });

  if (missingField) {
    throw new Error(`${missingField.label} é obrigatório.`);
  }
}

export function sortByText(list, getText) {
  return [...(list || [])].sort((a, b) =>
    String(getText(a) || "").localeCompare(String(getText(b) || ""), "pt-BR", {
      sensitivity: "base",
      numeric: true,
    })
  );
}

export function upsertCreatedOption(list, created, getValue = (item) => item.id) {
  if (!created) return list || [];
  const createdValue = String(getValue(created));
  const withoutDuplicate = (list || []).filter((item) => String(getValue(item)) !== createdValue);
  return [...withoutDuplicate, created];
}
