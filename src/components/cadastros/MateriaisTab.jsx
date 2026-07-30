import React, { useState, useEffect, useMemo, useRef } from "react";
import { Material } from "@/entities/Material";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Save, Trash2, X, Search, Upload, Download, HelpCircle, ArrowUpDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DialogClose, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { formatarData } from "@/components/utils/dateUtils"; // Imported the centralized date formatting utility, path corrected
import MaterialNfeImportDialog from "@/components/cadastros/MaterialNfeImportDialog";
import { MATERIAL_UNIT_OPTIONS } from "@/utils/materialNormalization";

const SortableHeader = ({ children, column, sortConfig, onSort }) => {
  const isSorted = sortConfig.key === column;
  const direction = isSorted ? sortConfig.direction : undefined;

  return (
    <TableHead onClick={() => onSort(column)} className="cursor-pointer hover:bg-slate-50">
      <div className="flex items-center gap-2">
        {children}
        {isSorted ? (
          direction === 'ascending' ? (
            <ArrowUpDown className="w-4 h-4" />
          ) : (
            <ArrowUpDown className="w-4 h-4" />
          )
        ) : (
          <ArrowUpDown className="w-4 h-4 text-slate-400" />
        )}
      </div>
    </TableHead>
  );
};

// Modal de Cadastro/Edição de Material
function MaterialModal({ isOpen, onClose, material, onSave }) {
  const [formData, setFormData] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (material) {
        // Edição - formatar data para input type="date"
        const formattedMaterial = { ...material };
        if (material.data_compra) {
          formattedMaterial.data_compra = new Date(material.data_compra).toISOString().split('T')[0];
        }
        setFormData(formattedMaterial);
      } else {
        // Novo
        setFormData({});
      }
      setError("");
    }
  }, [isOpen, material]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.codigo?.trim() || !formData.nome?.trim() || !formData.unidade_medida || formData.custo === undefined || formData.custo === null) {
      setError("Os campos Código, Nome, Unidade de Medida e Custo são obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        ...formData,
        custo: parseFloat(String(formData.custo).replace(',', '.')) || 0
      };

      await onSave(dataToSave, material); // `material` here is the `editingItem` from MateriaisTab
      onClose(); // Close modal on successful save
    } catch (error) {
      setError(error.message || "Erro ao salvar material");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => { if (!saving) onClose(); }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Edit className="w-5 h-5" />
            {material ? "Editar Material" : "Novo Material"}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="codigo">
                Código do Produto <span className="text-red-500">*</span>
              </Label>
              <Input
                id="codigo"
                value={formData.codigo || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                placeholder="Código do produto"
              />
            </div>

            <div>
              <Label htmlFor="codigo_compra">Código de Compra</Label>
              <Input
                id="codigo_compra"
                value={formData.codigo_compra || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, codigo_compra: e.target.value }))}
                placeholder="Código de compra"
              />
            </div>

            <div className="md:col-span-3">
              <Label htmlFor="nome">
                Nome do Produto <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nome"
                value={formData.nome || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Nome do produto"
                className="text-base"
              />
            </div>

            <div>
              <Label htmlFor="unidade_medida">
                Unidade de Medida <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.unidade_medida || ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, unidade_medida: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_UNIT_OPTIONS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.legacyValue}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="custo">
                Custo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="custo"
                type="number"
                step="0.01"
                min="0"
                value={formData.custo || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, custo: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="centro_custo">Centro de Custo</Label>
              <Input
                id="centro_custo"
                value={formData.centro_custo || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, centro_custo: e.target.value }))}
                placeholder="Centro de custo"
              />
            </div>

            <div>
              <Label htmlFor="fornecedor">Fornecedor</Label>
              <Input
                id="fornecedor"
                value={formData.fornecedor || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, fornecedor: e.target.value }))}
                placeholder="Razão social do fornecedor"
              />
            </div>

            <div>
              <Label htmlFor="fornecedor_cnpj">CNPJ do Fornecedor</Label>
              <Input
                id="fornecedor_cnpj"
                value={formData.fornecedor_cnpj || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, fornecedor_cnpj: e.target.value }))}
                placeholder="Somente números"
                maxLength={18}
              />
            </div>

            <div>
              <Label htmlFor="data_compra">Data de Compra</Label>
              <Input
                id="data_compra"
                type="date"
                value={formData.data_compra || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, data_compra: e.target.value }))}
              />
            </div>
          </div>
          
          <DialogFooter className="gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MateriaisTab() {
  const [materiais, setMateriais] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [showModal, setShowModal] = useState(false); // Changed from showForm
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'nome', direction: 'ascending' });
  const [importStatus, setImportStatus] = useState({ type: '', message: '', ignoredItems: [] });
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [selectedDuplicates, setSelectedDuplicates] = useState(new Set());
  const [showNfeImport, setShowNfeImport] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadMateriais();
  }, []);

  const loadMateriais = async () => {
    setLoading(true);
    try {
      const data = await Material.list();
      setMateriais(data);
    } catch (error) {
      setError("Erro ao carregar materiais");
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const sortedAndFilteredMateriais = useMemo(() => {
     let filtered = materiais.filter(mat => {
      const searchLower = searchTerm.toLowerCase();
      const cnpjSearch = searchTerm.replace(/\D/g, "");
      
      // Pesquisar por código, código de compra, nome, centro de custo
      const matchText = 
        mat.codigo?.toLowerCase().includes(searchLower) ||
        mat.nome?.toLowerCase().includes(searchLower) ||
        mat.codigo_compra?.toLowerCase().includes(searchLower) ||
        mat.centro_custo?.toLowerCase().includes(searchLower) ||
        mat.fornecedor?.toLowerCase().includes(searchLower) ||
        (cnpjSearch && mat.fornecedor_cnpj?.includes(cnpjSearch));
      
      // Pesquisar por data
      let matchDate = false;
      if (mat.data_compra && searchTerm) {
        try {
          // Use formatarData for search consistency
          const formattedDate = formatarData(mat.data_compra);
          if (formattedDate) {
            matchDate = formattedDate.toLowerCase().includes(searchLower);
          }
        } catch (e) {
          // ignore date parsing errors
        }
      }
      
      // Pesquisar por data de cadastro
      let matchCreatedDate = false;
      if (mat.created_date && searchTerm) {
        try {
          // Use formatarData for search consistency
          const formattedCreatedDate = formatarData(mat.created_date);
          if (formattedCreatedDate) {
            matchCreatedDate = formattedCreatedDate.toLowerCase().includes(searchLower);
          }
        } catch (e) {
          // ignore date parsing errors
        }
      }
      
      return matchText || matchDate || matchCreatedDate;
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [materiais, searchTerm, sortConfig]);

  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedItems(new Set(sortedAndFilteredMateriais.map(item => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (itemId, checked) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
    setSelectAll(newSelected.size === sortedAndFilteredMateriais.length && sortedAndFilteredMateriais.length > 0);
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    
    const confirmMessage = `Tem certeza que deseja excluir ${selectedItems.size} materiais selecionados?`;
    if (!window.confirm(confirmMessage)) return;

    try {
      // Deletar todos os itens selecionados
      await Promise.all(Array.from(selectedItems).map(id => Material.delete(id)));
      
      await loadMateriais();
      setSelectedItems(new Set());
      setSelectAll(false);
      setError("");
    } catch (error) {
      setError("Erro ao excluir materiais selecionados");
    }
  };

  const handleSave = async (formDataFromModal, originalMaterial) => { // originalMaterial is `editingItem` from MateriaisTab
    setError(""); // Clear any general errors in the main component

    // Validate for duplicates
    const duplicado = materiais.some(mat => 
      mat.id !== originalMaterial?.id && // Exclude the current item if editing
      mat.codigo?.toLowerCase() === formDataFromModal.codigo?.toLowerCase() &&
      mat.nome?.toLowerCase() === formDataFromModal.nome?.toLowerCase()
    );

    if (duplicado) {
      throw new Error("Já existe um material com este código e descrição");
    }

    try {
      if (originalMaterial) {
        await Material.update(originalMaterial.id, formDataFromModal);
      } else {
        await Material.create(formDataFromModal);
      }
      
      await loadMateriais(); // Reload materials after successful save
    } catch (error) {
      console.error("Error saving material:", error);
      throw new Error("Erro ao salvar material: " + (error.message || "Verifique os dados e tente novamente."));
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowModal(true); // Open modal
    setError(""); // Clear any prior errors
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este material?")) {
      try {
        await Material.delete(id);
        await loadMateriais();
      } catch (error) {
        setError("Erro ao excluir material");
      }
    }
  };

  const handleNew = () => {
    setEditingItem(null); // Clear editing item for new creation
    setShowModal(true); // Open modal
    setError(""); // Clear any prior errors
  };

  // Substituir a função handleImport por parsing local robusto (UTF-8 -> Windows-1252 fallback)
  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setImportStatus({ type: 'error', message: 'Por favor, selecione um arquivo CSV.' });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setImportStatus({ type: 'info', message: 'Lendo arquivo...' });

    const readAsText = (blob, encoding) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        try {
          reader.readAsText(blob, encoding);
        } catch (e) {
          reject(e);
        }
      });
    };

    // Parser CSV simples com suporte a aspas e vírgulas dentro de campos
    const parseCSV = (text) => {
      const rows = [];
      let current = '';
      let row = [];
      let inQuotes = false;
      
      // Normalize line endings to LF for simpler parsing
      text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"' ) {
          if (inQuotes && next === '"') {
            current += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else if (char === '\n' && !inQuotes) {
          row.push(current.trim());
          rows.push(row);
          row = [];
          current = '';
        } else {
          current += char;
        }
      }
      // Add the last row if it's not empty
      if (current.trim() !== '' || row.length > 0) {
        row.push(current.trim());
        rows.push(row);
      }
      // Remove entirely empty rows
      return rows.filter(r => r.some(cell => String(cell).trim() !== ''));
    };

    const normalizeHeader = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '_');

    const coerceNumber = (v) => {
      if (v === null || v === undefined || v === '') return 0;
      const str = String(v).trim();
      
      // Se contém vírgula, assumir formato brasileiro (vírgula = decimal, ponto = milhares)
      // Exemplo: 1.234,56 -> 1234.56
      if (str.includes(',')) {
        const normalized = str.replace(/\./g, '').replace(',', '.');
        const n = parseFloat(normalized);
        return isNaN(n) ? 0 : n;
      }
      
      // Se contém apenas ponto, verificar se é milhares ou decimal
      // Se tem múltiplos pontos, são milhares: 1.234.567 -> 1234567
      // Se tem um ponto, é decimal: 12.90 -> 12.90
      const dotCount = (str.match(/\./g) || []).length;
      if (dotCount > 1) {
        // Múltiplos pontos = separadores de milhares
        const normalized = str.replace(/\./g, '');
        const n = parseFloat(normalized);
        return isNaN(n) ? 0 : n;
      }
      
      // Um único ponto ou nenhum ponto = formato internacional ou número inteiro
      const n = parseFloat(str);
      return isNaN(n) ? 0 : n;
    };

    const coerceDate = (v) => {
      if (!v) return '';
      const s = String(v).trim();
      // suportar DD/MM/AAAA e AAAA-MM-DD
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const [d, m, y] = s.split('/');
        return `${y}-${m}-${d}`;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      
      // tentar Date parse como fallback
      try {
        const d = new Date(s);
        if (!isNaN(d.getTime())) {
          const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,10);
          return iso;
        }
      } catch (e) {
        // ignore parsing errors
      }
      return '';
    };

    const buildObjects = (rows) => {
      if (rows.length === 0) return [];

      const normalizedHeaders = rows[0].map(normalizeHeader);
      
      // Check if it's likely a header row
      const hasHeader = normalizedHeaders.includes('codigo') || normalizedHeaders.includes('nome') || normalizedHeaders.includes('unidade_medida');

      let startIndex = 0;
      let header = [];
      if (hasHeader) {
        header = normalizedHeaders;
        startIndex = 1;
      } else {
        // Assume default order if no clear header
        // codigo, codigo_compra, nome, unidade_medida, custo, centro_custo, data_compra
        header = ['codigo','codigo_compra','nome','unidade_medida','custo','centro_custo','data_compra'];
      }

      const objs = [];
      for (let i = startIndex; i < rows.length; i++) {
        const r = rows[i];
        if (r.every(cell => String(cell).trim() === '')) continue; // Skip empty rows

        const obj = {};
        for (let c = 0; c < header.length; c++) {
          const key = header[c];
          obj[key] = r[c] !== undefined ? String(r[c]).trim() : '';
        }
        
        // normalizações e validação
        const registro = {
          codigo: obj.codigo || '',
          codigo_compra: obj.codigo_compra || '',
          nome: obj.nome || '',
          unidade_medida: obj.unidade_medida || '',
          custo: coerceNumber(obj.custo),
          centro_custo: obj.centro_custo || '',
          data_compra: coerceDate(obj.data_compra)
        };
        
        // ignorar linhas sem campos obrigatórios
        if (registro.codigo && registro.nome && registro.unidade_medida) {
          objs.push(registro);
        }
      }
      return objs;
    };

    try {
      // Tenta UTF-8 primeiro
      let text;
      try {
        text = await readAsText(file, 'utf-8');
      } catch (_) {
        // UTF-8 read failed, continue to fallback
      }

      // If text is null or looks corrupted, try other encodings
      const looksCorrupted = (t) => !t || t.includes('\uFFFD') || /[\u00C3\u00C2]./.test(t); // Check for replacement char or common mis-encoded accents
      if (looksCorrupted(text)) {
        setImportStatus({ type: 'info', message: 'Detectada codificação diferente de UTF-8, tentando Windows-1252...' });
        try {
          text = await readAsText(file, 'windows-1252');
          if (looksCorrupted(text)) { // If still corrupted
            setImportStatus({ type: 'info', message: 'Windows-1252 também não resolveu, tentando ISO-8859-1...' });
            text = await readAsText(file, 'iso-8859-1'); // Fallback to latin1
          }
        } catch {
          // Fallback to latin1 if Windows-1252 fails
          try {
            text = await readAsText(file, 'iso-8859-1');
          } catch (e) {
            throw new Error(`Não foi possível ler o arquivo com as codificações esperadas: ${e.message}`);
          }
        }
      }

      const rows = parseCSV(text);
      if (!rows || rows.length === 0) {
        throw new Error('Arquivo CSV vazio ou inválido. Certifique-se de que o delimitador é vírgula e o texto está formatado corretamente.');
      }

      const records = buildObjects(rows);
      if (records.length === 0) {
        throw new Error('Não foi possível identificar registros válidos. Verifique se as colunas obrigatórias (codigo, nome, unidade_medida) estão presentes e o arquivo não está vazio.');
      }

      setImportStatus({ type: 'info', message: `Importando ${records.length} registros...` });
      
      // Carregar materiais existentes para verificar duplicatas
      const materiaisExistentes = await Material.list();
      
      // Filtrar registros, removendo duplicatas
      const recordsToImport = [];
      const recordsIgnored = [];
      
      for (const record of records) {
        // Verificar se já existe material com mesmo código E nome
        const isDuplicate = materiaisExistentes.some(mat => 
          mat.codigo?.toLowerCase() === record.codigo?.toLowerCase() &&
          mat.nome?.toLowerCase() === record.nome?.toLowerCase()
        );
        
        if (isDuplicate) {
          recordsIgnored.push(record);
        } else {
          recordsToImport.push(record);
        }
      }
      
      // Importar apenas os registros não duplicados
      if (recordsToImport.length > 0) {
        await Material.bulkCreate(recordsToImport);
      }
      
      // Mensagem informando resultado com lista de ignorados
      let message = '';
      if (recordsToImport.length > 0 && recordsIgnored.length > 0) {
        message = `${recordsToImport.length} materiais importados com sucesso. ${recordsIgnored.length} materiais ignorados (já cadastrados):`;
      } else if (recordsToImport.length > 0) {
        message = `${recordsToImport.length} materiais importados com sucesso!`;
      } else {
        message = `Todos os ${recordsIgnored.length} materiais já estavam cadastrados. Nenhum material foi importado.`;
      }
      
      setImportStatus({ 
        type: recordsToImport.length > 0 ? 'success' : 'info', 
        message,
        ignoredItems: recordsIgnored.map(r => `${r.codigo} - ${r.nome}`)
      });
      await loadMateriais();

    } catch (error) {
        setImportStatus({ type: 'error', message: `Erro na importação: ${error.message}` });
    } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
    
  const handleCheckDuplicates = () => {
    const duplicateGroups = [];
    const checked = new Set();
    
    materiais.forEach((mat, index) => {
      if (checked.has(mat.id)) return;
      
      const duplicatesOfThis = materiais.filter((other, otherIndex) => {
        if (index === otherIndex || checked.has(other.id)) return false;
        
        // Verificar duplicatas por código E nome (ambos devem ser iguais)
        const sameCode = mat.codigo?.toLowerCase() === other.codigo?.toLowerCase() && mat.codigo;
        const sameName = mat.nome?.toLowerCase() === other.nome?.toLowerCase() && mat.nome;
        
        return sameCode && sameName;
      });
      
      if (duplicatesOfThis.length > 0) {
        const group = [mat, ...duplicatesOfThis];
        group.forEach(item => checked.add(item.id));
        duplicateGroups.push(group);
      }
    });
    
    setDuplicates(duplicateGroups);
    setSelectedDuplicates(new Set());
    setShowDuplicatesModal(true);
  };

  const handleSelectDuplicate = (itemId, checked) => {
    const newSelected = new Set(selectedDuplicates);
    if (checked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedDuplicates(newSelected);
  };

  const handleDeleteDuplicates = async () => {
    if (selectedDuplicates.size === 0) return;
    
    const confirmMessage = `Tem certeza que deseja excluir ${selectedDuplicates.size} materiais duplicados?`;
    if (!window.confirm(confirmMessage)) return;

    try {
      await Promise.all(Array.from(selectedDuplicates).map(id => Material.delete(id)));
      await loadMateriais();
      setSelectedDuplicates(new Set());
      setShowDuplicatesModal(false);
      setError("");
    } catch (error) {
      setError("Erro ao excluir materiais duplicados");
    }
  };

  const handleExport = () => {
      const headers = ["codigo", "codigo_compra", "nome", "unidade_medida", "custo", "centro_custo", "fornecedor", "fornecedor_cnpj", "data_compra", "created_date"];
      const rows = sortedAndFilteredMateriais.map(mat => headers.map(h => {
        let value = mat[h] || '';
        // Format date for CSV export
        if ((h === 'data_compra' || h === 'created_date') && value) {
            // Use a local date for export to match expected input for import, avoiding timezone conversion issues
            const date = new Date(value);
            // Get YYYY-MM-DD string that represents the local date without timezone offset
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            value = `${year}-${month}-${day}`;
        } else if (h === 'custo') {
            value = String(value).replace('.', ','); // Use comma for decimal separator in export
        }
        // Basic CSV escaping: wrap in quotes and escape internal quotes
        const escapedValue = String(value).replace(/"/g, '""');
        return `"${escapedValue}"`;
      }).join(','));
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "materiais.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">
            <input type="file" ref={fileInputRef} onChange={handleImport} accept=".csv" className="hidden" />
            <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current.click()}>
                <Upload className="w-4 h-4" /> Importar CSV
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setShowNfeImport(true)}>
                <Upload className="w-4 h-4" /> Importar NF-e XML
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleExport}>
                <Download className="w-4 h-4" /> Exportar
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleCheckDuplicates}>
                <Search className="w-4 h-4" /> Verificar Duplicatas
            </Button>
            {selectedItems.size > 0 && (
              <Button variant="destructive" className="gap-2" onClick={handleBulkDelete}>
                <Trash2 className="w-4 h-4" /> Excluir Selecionados ({selectedItems.size})
              </Button>
            )}
             <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline" size="icon"><HelpCircle className="w-4 h-4" /></Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ajuda para Importação</DialogTitle>
                        <DialogDescription>
                            Importe um arquivo CSV (UTF-8 ou Windows-1252). Colunas esperadas: 
                            `codigo`, `codigo_compra` (opcional), `nome`, `unidade_medida` (Kg, Unidade, Litro, Metro, ...), 
                            `custo` (use ponto ou vírgula como separador decimal, ex: 12.50 ou 12,50), `centro_custo` (opcional), 
                            `data_compra` (opcional, formato AAAA-MM-DD ou DD/MM/AAAA) e `created_date` (opcional, data de cadastro do item).
                            O cabeçalho pode ser omitido; os dados serão mapeados pela ordem das colunas.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                       <DialogClose asChild>
                          <Button>Fechar</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
        <Button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Material
        </Button>
      </div>

       {importStatus.message && (
        <Alert variant={importStatus.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>
            <div>{importStatus.message}</div>
            {importStatus.ignoredItems && importStatus.ignoredItems.length > 0 && (
              <ul className="mt-2 ml-4 list-disc space-y-1">
                {importStatus.ignoredItems.map((item, index) => (
                  <li key={index} className="text-sm">{item}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="shadow-sm border-0 bg-white">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Lista de Materiais</CardTitle>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Pesquisar por código, nome ou data..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <SortableHeader column="codigo" sortConfig={sortConfig} onSort={handleSort}>Código</SortableHeader>
                  <SortableHeader column="codigo_compra" sortConfig={sortConfig} onSort={handleSort}>Cód. Compra</SortableHeader>
                  <SortableHeader column="nome" sortConfig={sortConfig} onSort={handleSort}>Nome do Produto</SortableHeader>
                  <SortableHeader column="unidade_medida" sortConfig={sortConfig} onSort={handleSort}>Unidade</SortableHeader>
                  <SortableHeader column="custo" sortConfig={sortConfig} onSort={handleSort}>Custo</SortableHeader>
                  <SortableHeader column="centro_custo" sortConfig={sortConfig} onSort={handleSort}>Centro Custo</SortableHeader>
                  <SortableHeader column="fornecedor" sortConfig={sortConfig} onSort={handleSort}>Fornecedor</SortableHeader>
                  <SortableHeader column="data_compra" sortConfig={sortConfig} onSort={handleSort}>Data Compra</SortableHeader>
                  <SortableHeader column="created_date" sortConfig={sortConfig} onSort={handleSort}>Data Cadastro</SortableHeader>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAndFilteredMateriais.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.has(item.id)}
                        onCheckedChange={(checked) => handleSelectItem(item.id, checked)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.codigo}</TableCell>
                    <TableCell>{item.codigo_compra}</TableCell>
                    <TableCell>{item.nome}</TableCell>
                    <TableCell>{item.unidade_medida}</TableCell>
                    <TableCell className="font-medium text-green-700">
                      {(item.custo || 0).toLocaleString('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL' 
                      })}
                    </TableCell>
                    <TableCell>{item.centro_custo || '-'}</TableCell>
                    <TableCell>
                      <div>{item.fornecedor || '-'}</div>
                      {item.fornecedor_cnpj && (
                        <div className="text-xs text-slate-500">{item.fornecedor_cnpj}</div>
                      )}
                    </TableCell>
                    {/* Updated to use formatarData function */}
                    <TableCell className="text-sm">
                      {formatarData(item.data_compra)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {formatarData(item.created_date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(item)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {sortedAndFilteredMateriais.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-slate-500">
                      {searchTerm ? "Nenhum material encontrado" : "Nenhum material cadastrado"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MaterialModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingItem(null);
          setError(""); // Clear any potential error from previous modal interaction
        }}
        material={editingItem}
        onSave={handleSave}
      />

      <MaterialNfeImportDialog
        open={showNfeImport}
        onClose={() => setShowNfeImport(false)}
        onImported={async (result) => {
          await loadMateriais();
          setImportStatus({
            type: "success",
            message: `${result.created} criado(s), ${result.updated} atualizado(s) e ${result.ignored} ignorado(s).`,
            ignoredItems: [],
          });
        }}
      />

      {/* Modal de Duplicatas */}
      <Dialog open={showDuplicatesModal} onOpenChange={setShowDuplicatesModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Search className="w-5 h-5" />
              Materiais Duplicados
            </DialogTitle>
            <DialogDescription>
              {duplicates.length === 0 
                ? "Nenhum material duplicado encontrado." 
                : `Encontrados ${duplicates.length} grupos de materiais duplicados.`}
            </DialogDescription>
          </DialogHeader>

          {duplicates.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-100 rounded">
                <span className="text-sm font-medium">
                  {selectedDuplicates.size} item(ns) selecionado(s)
                </span>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleDeleteDuplicates}
                  disabled={selectedDuplicates.size === 0}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir Selecionados
                </Button>
              </div>

              {duplicates.map((group, groupIndex) => (
                <Card key={groupIndex} className="border-orange-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-orange-700">
                      Grupo {groupIndex + 1} - {group.length} materiais duplicados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Unidade</TableHead>
                          <TableHead>Custo</TableHead>
                          <TableHead>Data Cadastro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedDuplicates.has(item.id)}
                                onCheckedChange={(checked) => handleSelectDuplicate(item.id, checked)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{item.codigo}</TableCell>
                            <TableCell>{item.nome}</TableCell>
                            <TableCell>{item.unidade_medida}</TableCell>
                            <TableCell className="font-medium text-green-700">
                              {(item.custo || 0).toLocaleString('pt-BR', { 
                                style: 'currency', 
                                currency: 'BRL' 
                              })}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {formatarData(item.created_date)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicatesModal(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
