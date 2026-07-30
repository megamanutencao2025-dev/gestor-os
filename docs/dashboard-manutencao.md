# Dashboard de manutencao

## Endpoints

- `GET /api/v1/dashboard/maintenance/`: indicadores e agregacoes do dashboard.
- `GET /api/v1/work-orders/`: lista paginada de ordens de servico.

Os dois endpoints exigem autenticacao, acesso ao modulo correspondente e permissao
de visualizacao de ordens.

## Filtros

O dashboard aceita `date_from`, `date_to`, `location`, `equipment`,
`maintenance_type`, `priority` e `responsible`.

A lista tambem aceita `status`, `search`, `ordering`, `page`, `page_size` e
`situation`. Os valores de `situation` sao:

- `open`
- `overdue`
- `due_today`
- `unassigned`
- `waiting_parts`
- `emergency`

O periodo maximo do dashboard e de 731 dias. Na ausencia de datas, sao usados os
ultimos 30 dias.

## Indicadores

- **OS abertas:** aprovadas, criadas no periodo e fora das categorias concluida,
  cancelada e reprovada.
- **OS vencidas:** abertas com `due_at` anterior ao momento atual.
- **Emergenciais:** abertas com prioridade critica ou emergencial.
- **Aguardando peca:** abertas na categoria de status `waiting_parts`.
- **Concluidas no prazo:** concluidas ate `due_at`, dividido pelas concluidas que
  possuem prazo e data de conclusao.
- **Tempo medio de conclusao:** media de `completed_at - created_at` das concluidas.

Status do fluxo e situacao do prazo permanecem independentes.

## Campos estruturais

`WorkOrder` possui `due_at` e `assigned_maintainer`. Tipos, status e prioridades
possuem categorias semanticas usadas nas consultas, sem depender do texto exibido.
A migracao `0009_dashboard_semantics` classifica os cadastros conhecidos,
consolida status equivalentes e desativa duplicados.

Os campos novos fazem parte do CSV de backup e restauracao.

## Limitacoes de dados

Nao existe atualmente modelo de orcamento por periodo ou causa de falha
padronizada. O dashboard sinaliza esses blocos como indisponiveis e nao cria
valores estimados. O projeto tambem nao possui escopo multiempresa; os filtros
atuais respeitam o conjunto de dados autorizado pelo modulo.

## Verificacao manual

1. Abrir o dashboard e alternar os atalhos de periodo.
2. Aplicar local, equipamento, tipo, prioridade e responsavel e recarregar a pagina.
3. Abrir cada indicador e confirmar os filtros na URL da lista.
4. Conferir as abas da central de atencao e abrir uma ordem.
5. Na lista, testar pesquisa, ordenacao, filtros rapidos e paginas de 25, 50 e 100.
6. Criar e editar uma OS com prazo e responsavel.
7. Exportar e importar um CSV contendo os campos novos.
8. Repetir em desktop, tablet e celular.

## Testes automatizados

```powershell
cd backend
$env:DJANGO_SETTINGS_MODULE = "config.settings.test"
..\.venv\Scripts\python.exe -m pytest -q

cd ..
npm run deploy:check
```
