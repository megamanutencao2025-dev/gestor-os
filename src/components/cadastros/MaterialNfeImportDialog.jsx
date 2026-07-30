import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileCode2,
  FileWarning,
  Loader2,
  Save,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { appApi } from "@/api/appClient";
import { CentroCusto } from "@/entities/CentroCusto";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { MATERIAL_UNIT_OPTIONS, normalizeProductName } from "@/utils/materialNormalization";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const STATUS_CONFIG = {
  new: { label: "Novo material", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600" },
  existing: { label: "Já cadastrado", className: "border-blue-500/40 bg-blue-500/10 text-blue-600" },
  unknown_unit: { label: "Unidade pendente", className: "border-amber-500/50 bg-amber-500/10 text-amber-600" },
  invalid: { label: "Dados inválidos", className: "border-red-500/40 bg-red-500/10 text-red-600" },
  duplicate_invoice: { label: "NF-e já importada", className: "border-red-500/40 bg-red-500/10 text-red-600" },
};

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function fileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function buildRows(documents) {
  return documents.flatMap((document) =>
    document.products.map((product) => ({
      ...product,
      filename: document.filename,
      supplierName: document.supplier_name,
      duplicateInvoice: document.duplicate_invoice,
      cost_center_id: "",
      remember_unit_mapping: true,
    }))
  );
}

export default function MaterialNfeImportDialog({ open, onClose, onImported }) {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [fileErrors, setFileErrors] = useState([]);
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    CentroCusto.list()
      .then(setCostCenters)
      .catch(() => setCostCenters([]));
  }, [open]);

  useEffect(() => {
    if (open) return;
    setFiles([]);
    setFileErrors([]);
    setPreview(null);
    setRows([]);
    setDragActive(false);
    setError("");
  }, [open]);

  const selectedRows = useMemo(() => rows.filter((row) => row.selected), [rows]);
  const blockingRows = useMemo(
    () =>
      selectedRows.filter(
        (row) =>
          row.status === "invalid" ||
          row.status === "duplicate_invoice" ||
          !row.unit ||
          !normalizeProductName(row.name) ||
          (row.action === "create" && !String(row.internal_code || "").trim())
      ),
    [selectedRows]
  );

  const addFiles = (incoming) => {
    const nextErrors = [];
    const valid = [];
    Array.from(incoming || []).forEach((file) => {
      if (!file.name.toLowerCase().endsWith(".xml")) {
        nextErrors.push(`${file.name}: selecione um arquivo XML.`);
      } else if (file.size > MAX_FILE_BYTES) {
        nextErrors.push(`${file.name}: o arquivo excede 2 MB.`);
      } else {
        valid.push(file);
      }
    });
    setFileErrors((current) => [...current, ...nextErrors]);
    setFiles((current) => {
      const known = new Set(current.map(fileKey));
      const merged = [...current];
      valid.forEach((file) => {
        if (!known.has(fileKey(file)) && merged.length < MAX_FILES) {
          merged.push(file);
          known.add(fileKey(file));
        }
      });
      if (current.length + valid.length > MAX_FILES) {
        setFileErrors((errors) => [
          ...errors,
          `É possível processar no máximo ${MAX_FILES} arquivos por vez.`,
        ]);
      }
      return merged;
    });
    setError("");
  };

  const removeFile = (key) => {
    setFiles((current) => current.filter((file) => fileKey(file) !== key));
  };

  const processFiles = async () => {
    if (!files.length) {
      setError("Selecione ao menos um arquivo XML.");
      return;
    }
    setProcessing(true);
    setError("");
    try {
      const result = await appApi.materialNfeImport.preview(files);
      setPreview(result);
      setRows(buildRows(result.documents || []));
      if (!(result.documents || []).length) {
        setError("Nenhum XML válido foi encontrado.");
      }
    } catch (requestError) {
      setError(requestError.message || "Não foi possível processar os arquivos.");
    } finally {
      setProcessing(false);
    }
  };

  const updateRow = (previewId, field, value) => {
    setRows((current) =>
      current.map((row) => (row.preview_id === previewId ? { ...row, [field]: value } : row))
    );
  };

  const selectAll = (checked) => {
    setRows((current) =>
      current.map((row) =>
        row.status === "invalid" || row.status === "duplicate_invoice"
          ? row
          : { ...row, selected: Boolean(checked) }
      )
    );
  };

  const saveMaterials = async () => {
    if (!selectedRows.length) {
      setError("Selecione ao menos um produto.");
      return;
    }
    if (blockingRows.length) {
      setError("Corrija os produtos selecionados que possuem campos pendentes.");
      return;
    }
    if (!window.confirm(`Confirmar o processamento de ${selectedRows.length} produto(s)?`)) return;

    setSaving(true);
    setError("");
    try {
      const result = await appApi.materialNfeImport.confirm({
        token: preview.token,
        items: rows.map((row) => ({
          preview_id: row.preview_id,
          selected: Boolean(row.selected),
          action: row.action,
          internal_code: String(row.internal_code || "").trim(),
          name: normalizeProductName(row.name),
          unit: row.unit || "",
          cost_center_id: row.cost_center_id || null,
          remember_unit_mapping: Boolean(row.remember_unit_mapping),
        })),
      });
      toast({
        title: "Materiais processados",
        description: `${result.created} criado(s), ${result.updated} atualizado(s) e ${result.ignored} ignorado(s).`,
      });
      await onImported?.(result);
      onClose();
    } catch (requestError) {
      setError(requestError.message || "Erro ao salvar os materiais.");
    } finally {
      setSaving(false);
    }
  };

  const fileSummaries = preview?.files || [];
  const allEligibleSelected =
    rows.some((row) => !["invalid", "duplicate_invoice"].includes(row.status)) &&
    rows
      .filter((row) => !["invalid", "duplicate_invoice"].includes(row.status))
      .every((row) => row.selected);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !saving && onClose()}>
      <DialogContent
        className="flex h-[92vh] w-[96vw] max-w-[1600px] grid-rows-none flex-col gap-0 overflow-hidden p-0"
        onEscapeKeyDown={(event) => saving && event.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileCode2 className="h-5 w-5 text-blue-600" />
            Importar materiais por XML
          </DialogTitle>
          <DialogDescription>
            Revise os produtos da NF-e antes de incluí-los no cadastro atual.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!preview ? (
            <div className="mx-auto max-w-4xl space-y-5 p-5 sm:p-8">
              <button
                type="button"
                className={`flex min-h-52 w-full flex-col items-center justify-center border-2 border-dashed px-6 text-center transition-colors ${
                  dragActive
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-border bg-muted/30 hover:border-blue-500/60"
                }`}
                onClick={() => inputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  addFiles(event.dataTransfer.files);
                }}
              >
                <UploadCloud className="mb-3 h-10 w-10 text-blue-600" />
                <span className="font-semibold">Selecione ou arraste os XMLs de NF-e</span>
                <span className="mt-1 text-sm text-muted-foreground">
                  Até 10 arquivos, com no máximo 2 MB cada
                </span>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".xml,application/xml,text/xml"
                multiple
                className="hidden"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />

              {files.length > 0 && (
                <div className="divide-y rounded-md border">
                  {files.map((file) => (
                    <div key={fileKey(file)} className="flex items-center gap-3 px-4 py-3">
                      <FileCode2 className="h-5 w-5 shrink-0 text-blue-600" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{file.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title={`Remover ${file.name}`}
                        onClick={() => removeFile(fileKey(file))}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {fileErrors.map((message, index) => (
                <Alert variant="destructive" key={`${message}-${index}`}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              ))}
            </div>
          ) : (
            <div className="space-y-4 p-4 sm:p-5">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {fileSummaries.map((file) => (
                  <div
                    key={`${file.filename}-${file.access_key || file.error}`}
                    className={`flex items-start gap-3 border px-3 py-2.5 ${
                      file.status === "error" || file.status === "duplicate"
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-emerald-500/40 bg-emerald-500/10"
                    }`}
                  >
                    {file.status === "ready" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{file.filename}</div>
                      <div className="text-xs text-muted-foreground">
                        {file.error ||
                          (file.duplicate_invoice
                            ? "Esta NF-e já foi importada."
                            : `${file.product_count} produto(s) • ${file.supplier_name}`)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-y py-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={allEligibleSelected} onCheckedChange={selectAll} />
                  <span className="text-sm font-medium">
                    {selectedRows.length} de {rows.length} produto(s) selecionado(s)
                  </span>
                </div>
                <Button type="button" variant="outline" onClick={() => setPreview(null)}>
                  Alterar arquivos
                </Button>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[1680px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Sel.</TableHead>
                      <TableHead className="w-48">Origem</TableHead>
                      <TableHead className="w-40">Códigos</TableHead>
                      <TableHead className="w-72">Produto</TableHead>
                      <TableHead className="w-52">Unidade</TableHead>
                      <TableHead className="w-36 text-right">Valores</TableHead>
                      <TableHead className="w-52">Centro de custo</TableHead>
                      <TableHead className="w-52">Tratamento</TableHead>
                      <TableHead className="w-44">Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const config =
                        row.status === "unknown_unit" && row.unit
                          ? STATUS_CONFIG.new
                          : STATUS_CONFIG[row.status] || STATUS_CONFIG.invalid;
                      const disabled = row.status === "invalid" || row.status === "duplicate_invoice";
                      return (
                        <TableRow key={row.preview_id} className={!row.selected ? "opacity-60" : ""}>
                          <TableCell className="align-top">
                            <Checkbox
                              checked={row.selected}
                              disabled={disabled}
                              onCheckedChange={(checked) =>
                                updateRow(row.preview_id, "selected", Boolean(checked))
                              }
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="truncate text-xs font-medium">{row.filename}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{row.supplierName}</div>
                          </TableCell>
                          <TableCell className="space-y-2 align-top">
                            <div>
                              <div className="text-[11px] text-muted-foreground">Compra</div>
                              <div className="text-xs font-medium">{row.purchase_code || "-"}</div>
                            </div>
                            <Input
                              value={row.internal_code || ""}
                              disabled={!row.selected || row.action !== "create"}
                              aria-label={`Código interno de ${row.name}`}
                              onChange={(event) =>
                                updateRow(row.preview_id, "internal_code", event.target.value)
                              }
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              value={row.name || ""}
                              disabled={!row.selected || disabled}
                              onChange={(event) => updateRow(row.preview_id, "name", event.target.value)}
                              onBlur={() =>
                                updateRow(row.preview_id, "name", normalizeProductName(row.name))
                              }
                              className="h-8 text-xs"
                            />
                            {row.errors?.length > 0 && (
                              <div className="mt-1 text-xs text-red-600">{row.errors.join(" ")}</div>
                            )}
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="mb-1 text-xs text-muted-foreground">
                              XML: {row.original_unit || "não informada"}
                            </div>
                            <Select
                              value={row.unit || ""}
                              disabled={!row.selected || disabled}
                              onValueChange={(value) => updateRow(row.preview_id, "unit", value)}
                            >
                              <SelectTrigger
                                className={`h-8 text-xs ${row.selected && !row.unit ? "border-amber-500" : ""}`}
                              >
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {MATERIAL_UNIT_OPTIONS.map((unit) => (
                                  <SelectItem key={unit.value} value={unit.value}>
                                    {unit.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {row.selected && !row.unit && (
                              <div className="mt-1 text-xs text-amber-600">
                                Unidade não reconhecida.
                              </div>
                            )}
                            {row.status === "unknown_unit" && row.unit && (
                              <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                <Checkbox
                                  checked={row.remember_unit_mapping}
                                  onCheckedChange={(checked) =>
                                    updateRow(
                                      row.preview_id,
                                      "remember_unit_mapping",
                                      Boolean(checked)
                                    )
                                  }
                                />
                                Lembrar esta equivalência
                              </label>
                            )}
                          </TableCell>
                          <TableCell className="align-top text-right text-xs">
                            <div>{row.quantity || "-"} un.</div>
                            <div>{formatCurrency(row.unit_cost)}</div>
                            <div className="mt-1 font-semibold">{formatCurrency(row.total_amount)}</div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Select
                              value={row.cost_center_id || "none"}
                              disabled={!row.selected || disabled}
                              onValueChange={(value) =>
                                updateRow(row.preview_id, "cost_center_id", value === "none" ? "" : value)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Não informado" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Não informado</SelectItem>
                                {costCenters.map((center) => (
                                  <SelectItem key={center.id} value={center.id}>
                                    {center.descricao}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="align-top">
                            {row.status === "existing" ? (
                              <Select
                                value={row.action}
                                disabled={!row.selected}
                                onValueChange={(value) => updateRow(row.preview_id, "action", value)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ignore">Ignorar</SelectItem>
                                  <SelectItem value="update">Atualizar custo e compra</SelectItem>
                                  <SelectItem value="create">Cadastrar como novo</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {disabled ? "Não será processado" : "Cadastrar como novo"}
                              </span>
                            )}
                            {row.existing_material && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {row.existing_material.code} • {formatCurrency(row.existing_material.unit_cost)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge variant="outline" className={config.className}>
                              {row.selected ? config.label : "Não selecionado"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="shrink-0 border-t px-5 pt-3">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter className="shrink-0 gap-2 border-t px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          {!preview ? (
            <Button type="button" onClick={processFiles} disabled={!files.length || processing}>
              {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCode2 className="mr-2 h-4 w-4" />}
              Processar XML
            </Button>
          ) : (
            <Button
              type="button"
              onClick={saveMaterials}
              disabled={!selectedRows.length || blockingRows.length > 0 || saving}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar materiais
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
