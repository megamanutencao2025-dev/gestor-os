import React, { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QuickCreateModal from "@/components/quick-create/QuickCreateModal";
import QuickCreateButton from "@/components/quick-create/QuickCreateButton";

const EMPTY_VALUE = "__empty__";

function resolveAccessor(accessor, item, fallback = "") {
  if (!item) return fallback;
  if (typeof accessor === "function") return accessor(item);
  if (typeof accessor === "string") return item[accessor] ?? fallback;
  return fallback;
}

export default function RelatedEntitySelect({
  label,
  value,
  onChange,
  options = [],
  optionLabel = "descricao",
  optionValue = "id",
  placeholder = "Selecione",
  createButtonLabel = "+ Novo",
  modalTitle = "Novo cadastro",
  createForm,
  onCreate,
  required = false,
  error,
  disabled = false,
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const normalizedValue = value === null || value === undefined ? "" : String(value);

  const selectOptions = useMemo(() => (
    (options || [])
      .map((item) => ({
        item,
        value: String(resolveAccessor(optionValue, item)),
        label: resolveAccessor(optionLabel, item),
      }))
      .filter((item) => item.value && item.value !== "undefined")
  ), [optionLabel, optionValue, options]);

  const handleCreated = async (created) => {
    if (!created) return;
    const createdValue = String(resolveAccessor(optionValue, created));
    if (createdValue && createdValue !== "undefined") {
      onChange(createdValue, created);
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}

      <div className="flex items-center gap-2">
        <Select
          value={normalizedValue}
          onValueChange={(nextValue) => onChange(nextValue === EMPTY_VALUE ? "" : nextValue)}
          disabled={disabled}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_VALUE}>{placeholder}</SelectItem>
            {selectOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {onCreate && createForm && (
          <QuickCreateButton
            label={createButtonLabel}
            onClick={() => setCreateOpen(true)}
            disabled={disabled}
          />
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {onCreate && createForm && (
        <QuickCreateModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          title={modalTitle}
          createForm={createForm}
          onCreate={onCreate}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
