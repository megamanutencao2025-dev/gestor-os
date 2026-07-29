import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, AlertCircle, CheckCircle, Upload } from "lucide-react";
import { appApi } from "@/api/appClient";
import ModuleLabel from "@/components/ModuleLabel";

const entidades = [
  { nome: "OrdemServico", label: "Ordens de Serviço" },
  { nome: "Equipamento", label: "Equipamentos" },
  { nome: "Material", label: "Materiais" },
  { nome: "Mantenedor", label: "Mantenedores" },
  { nome: "TipoManutencao", label: "Tipos de Manutenção" },
  { nome: "StatusOS", label: "Status OS" },
  { nome: "AreaManutencao", label: "Áreas de Manutenção" },
  { nome: "FamiliaEquipamento", label: "Famílias de Equipamento" },
  { nome: "PrestadoraServico", label: "Prestadoras de Serviço" },
  { nome: "Localizacao", label: "Localizações" },
  { nome: "Prioridade", label: "Prioridades" },
  { nome: "CentroCusto", label: "Centros de Custo" }
];

export default function ExportarDados() {
  const [entidadesSelecionadas, setEntidadesSelecionadas] = useState(
    entidades.map(e => e.nome)
  );
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [entidadeImportacao, setEntidadeImportacao] = useState(entidades[0].nome);
  const [arquivoImportacao, setArquivoImportacao] = useState(null);
  const [previewImportacao, setPreviewImportacao] = useState(null);
  const [resultado, setResultado] = useState({ tipo: '', mensagem: '' });

  const handleToggleEntidade = (nomeEntidade) => {
    setEntidadesSelecionadas(prev =>
      prev.includes(nomeEntidade)
        ? prev.filter(e => e !== nomeEntidade)
        : [...prev, nomeEntidade]
    );
  };

  const selecionarTodas = () => setEntidadesSelecionadas(entidades.map(e => e.nome));
  const desmarcarTodas = () => setEntidadesSelecionadas([]);

  const parseCSVLine = (line, delimiter) => {
    const values = [];
    let current = '';
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"' && quoted && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  };

  const detectarDelimitador = (linha) => {
    const opcoes = [',', ';', '\t'];
    return opcoes
      .map(delimiter => ({ delimiter, count: parseCSVLine(linha, delimiter).length }))
      .sort((a, b) => b.count - a.count)[0].delimiter;
  };

  const parseValorImportado = (header, value) => {
    const texto = String(value ?? '').trim();
    if (texto === '') return '';

    if ((texto.startsWith('{') && texto.endsWith('}')) || (texto.startsWith('[') && texto.endsWith(']'))) {
      try {
        return JSON.parse(texto);
      } catch {
        return texto;
      }
    }

    const lower = texto.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;

    const campoNumerico = /(custo|valor|quantidade|ordem|tempo|total|tamanho|minutos|pecas_por_hora|horas)/i.test(header);
    let numeroNormalizado = texto;
    if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(texto)) {
      numeroNormalizado = texto.replace(/\./g, '').replace(',', '.');
    } else if (/^-?\d+,\d+$/.test(texto)) {
      numeroNormalizado = texto.replace(',', '.');
    }

    if (campoNumerico && /^-?\d+(\.\d+)?$/.test(numeroNormalizado)) {
      return Number(numeroNormalizado);
    }

    return texto;
  };

  const parseCSV = (text) => {
    const linhas = text
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter(line => line.trim() !== '');

    if (linhas.length < 2) return [];

    const delimiter = detectarDelimitador(linhas[0]);
    const headers = parseCSVLine(linhas[0], delimiter).map(header => header.trim());

    return linhas.slice(1)
      .map(line => {
        const values = parseCSVLine(line, delimiter);
        return Object.fromEntries(headers.map((header, index) => [
          header,
          parseValorImportado(header, values[index] ?? '')
        ]));
      })
      .filter(item => Object.values(item).some(value => value !== ''));
  };

  const lerArquivoTexto = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Erro ao ler arquivo'));
    reader.readAsText(file, 'utf-8');
  });

  const handleArquivoImportacao = async (event) => {
    const file = event.target.files?.[0] || null;
    setArquivoImportacao(file);
    setPreviewImportacao(null);
    setResultado({ tipo: '', mensagem: '' });

    if (!file) return;

    try {
      const text = await lerArquivoTexto(file);
      const registros = parseCSV(text);
      setPreviewImportacao({
        registros: registros.length,
        colunas: registros[0] ? Object.keys(registros[0]).length : 0
      });
    } catch (error) {
      setResultado({ tipo: 'erro', mensagem: 'Não foi possível ler o arquivo selecionado.' });
    }
  };

  const downloadCSV = (nomeEntidade, blob) => {
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `${nomeEntidade}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarDados = async () => {
    if (entidadesSelecionadas.length === 0) {
      setResultado({ tipo: 'erro', mensagem: 'Selecione pelo menos uma entidade para exportar.' });
      return;
    }

    setExportando(true);
    setResultado({ tipo: '', mensagem: '' });

    try {
      for (const entidade of entidades) {
        if (entidadesSelecionadas.includes(entidade.nome)) {
          const arquivo = await appApi.dataTransfer.exportCsv(entidade.nome);
          downloadCSV(entidade.nome, arquivo);
        }
      }

      setResultado({
        tipo: 'sucesso',
        mensagem: `Exportação concluída! ${entidadesSelecionadas.length} arquivo(s) baixado(s).`
      });
    } catch (error) {
      console.error('Erro na exportação:', error);
      setResultado({ tipo: 'erro', mensagem: 'Erro durante a exportação. Tente novamente.' });
    } finally {
      setExportando(false);
    }
  };

  const importarDados = async () => {
    if (!arquivoImportacao) {
      setResultado({ tipo: 'erro', mensagem: 'Selecione um arquivo CSV para importar.' });
      return;
    }

    if (!appApi.entities[entidadeImportacao]) {
      setResultado({ tipo: 'erro', mensagem: 'Entidade de importação inválida.' });
      return;
    }

    setImportando(true);
    setResultado({ tipo: '', mensagem: '' });

    try {
      const text = await lerArquivoTexto(arquivoImportacao);
      const registros = parseCSV(text);

      if (registros.length === 0) {
        setResultado({ tipo: 'erro', mensagem: 'Nenhum registro válido encontrado no CSV.' });
        return;
      }

      const importResult = await appApi.dataTransfer.importCsv(
        entidadeImportacao,
        arquivoImportacao
      );

      const entidade = entidades.find(e => e.nome === entidadeImportacao);
      setResultado({
        tipo: 'sucesso',
        mensagem: `${importResult.created} criado(s) e ${importResult.updated} atualizado(s) em ${entidade?.label || entidadeImportacao}.`
      });
      setArquivoImportacao(null);
      setPreviewImportacao(null);
    } catch (error) {
      console.error('Erro na importação:', error);
      setResultado({ tipo: 'erro', mensagem: error.message || 'Erro durante a importação. Tente novamente.' });
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4">
      <ModuleLabel>Exportar Dados</ModuleLabel>
      {resultado.mensagem && (
        <Alert variant={resultado.tipo === 'erro' ? 'destructive' : 'default'}>
          {resultado.tipo === 'sucesso' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{resultado.mensagem}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="rounded-lg border bg-white shadow-sm">
          <CardHeader className="p-4 pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-base sm:text-lg">Exportação CSV</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700">
                  {entidadesSelecionadas.length}/{entidades.length} selecionadas
                </span>
                <Button variant="outline" size="sm" onClick={selecionarTodas}>Selecionar Todas</Button>
                <Button variant="outline" size="sm" onClick={desmarcarTodas}>Desmarcar Todas</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {entidades.map(entidade => (
                <div key={entidade.nome} className="flex items-center gap-2 rounded-lg border p-3 hover:bg-slate-50">
                  <Checkbox
                    id={entidade.nome}
                    checked={entidadesSelecionadas.includes(entidade.nome)}
                    onCheckedChange={() => handleToggleEntidade(entidade.nome)}
                  />
                  <Label htmlFor={entidade.nome} className="cursor-pointer text-sm font-medium">
                    {entidade.label}
                  </Label>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border bg-slate-50 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-600">
                    {entidadesSelecionadas.length} de {entidades.length} entidades selecionadas
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Cada entidade será exportada como um arquivo CSV separado</p>
                </div>
                <Button
                  onClick={exportarDados}
                  disabled={exportando || entidadesSelecionadas.length === 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {exportando ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Exportando...</>
                  ) : (
                    <><Download className="w-4 h-4 mr-2" />Exportar Dados</>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-lg border bg-white shadow-sm">
            <CardHeader className="p-4 pb-3">
              <CardTitle className="text-base sm:text-lg">Importação CSV</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0">
              <div>
                <Label>Entidade</Label>
                <Select value={entidadeImportacao} onValueChange={setEntidadeImportacao}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {entidades.map(entidade => (
                      <SelectItem key={entidade.nome} value={entidade.nome}>
                        {entidade.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="arquivo-importacao">Arquivo CSV</Label>
                <Input
                  id="arquivo-importacao"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleArquivoImportacao}
                />
              </div>

              {previewImportacao && (
                <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
                  Arquivo lido: {previewImportacao.registros} registro(s), {previewImportacao.colunas} coluna(s).
                </div>
              )}

              <Button
                onClick={importarDados}
                disabled={importando || !arquivoImportacao}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {importando ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Importando...</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />Importar Dados</>
                )}
              </Button>

              <div className="text-xs text-slate-500">
                A importação identifica registros existentes pelos IDs do backup e atualiza os dados sem duplicação.
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg border bg-blue-50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-2">Informações</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Os arquivos serão baixados automaticamente em CSV</li>
                    <li>• Cada entidade gera um arquivo separado</li>
                    <li>• Use esta funcionalidade para backup local dos dados</li>
                    <li>• Os arquivos podem ser abertos no Excel ou Google Sheets</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
