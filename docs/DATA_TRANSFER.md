# Importacao e exportacao de dados

## Compatibilidade

O backend Django aceita os CSVs gerados pelo modulo `Exportar Dados` do sistema
legado. O contrato externo continua usando:

- um arquivo CSV por entidade;
- separador virgula, com leitura adicional de ponto e virgula ou tabulacao;
- nomes de colunas em portugues;
- objetos e listas codificados como JSON dentro das celulas;
- campos `id`, `created_date` e `updated_date`.

O formato atual e identificado pelo header HTTP
`X-MaintenancePro-Backup-Version: 1`. Esse versionamento nao altera o conteudo
dos CSVs antigos.

## Entidades

As entidades existentes continuam suportadas:

- `OrdemServico`
- `Equipamento`
- `Material`
- `Mantenedor`
- `TipoManutencao`
- `StatusOS`
- `AreaManutencao`
- `FamiliaEquipamento`
- `PrestadoraServico`
- `Localizacao`
- `NotificacaoOS`

Tambem foram adicionadas `Prioridade` e `CentroCusto`, pois elas possuem
referencias utilizadas pelas ordens e pelos materiais e nao faziam parte do
backup anterior.

## Ordem para restauracao

Para restaurar um conjunto completo de arquivos:

1. `TipoManutencao`, `StatusOS`, `AreaManutencao`, `Prioridade` e `CentroCusto`.
2. `Localizacao` e `FamiliaEquipamento`.
3. `Equipamento`.
4. `Mantenedor`, `Material` e `PrestadoraServico`.
5. `OrdemServico`.

As ordens conseguem criar referencias auxiliares a partir dos nomes presentes
no CSV, mas a ordem acima produz a reconciliacao mais precisa.

## Garantias da importacao

- Limite de 10 MB por arquivo.
- Codificacao UTF-8.
- Validacao de cabecalho, tipos e referencias.
- Transacao unica por arquivo: uma linha invalida desfaz o arquivo inteiro.
- Reimportacao idempotente por `id` legado ou chave natural.
- Relatorio com total de registros criados e atualizados.
- IDs antigos sao preservados em `legacy_id`.
- Numeracao futura de OS avanca alem do maior numero importado.

## Endpoints v2

```text
GET  /api/v1/data-transfer/export/{Entidade}/
POST /api/v1/data-transfer/import/{Entidade}/
```

O `POST` usa `multipart/form-data`, com o arquivo no campo `file`.

## Anexos

O CSV legado guarda apenas metadados e URLs dos anexos. Ele nao contem os bytes
dos arquivos. O importador preserva esses metadados e URLs, mas a copia fisica
dos uploads precisa ser migrada separadamente para o storage definitivo.
