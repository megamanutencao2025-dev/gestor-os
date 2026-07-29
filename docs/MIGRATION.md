# Migracao do backend

## Estado atual

Os passos de paridade e troca de backend foram concluidos:

- `backend/` e a API oficial em Django REST Framework;
- o React usa `VITE_API_URL=http://127.0.0.1:8000`;
- autenticação JWT, permissoes, CRUDs, administracao, solicitacao publica,
  notificacoes, uploads, extracao e provedores de IA estao no Django;
- importacao e exportacao CSV usam o adaptador relacional do Django;
- o backend Node legado e os metadados da plataforma no-code foram removidos
  depois da publicacao e validacao da aplicacao Django em producao.

Os dados do backup ainda nao foram importados, conforme decisao operacional.

## Execucao local

```powershell
.\setup.ps1
.\.venv\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000
npm run dev
```

Aplicacao: `http://127.0.0.1:5173`

API: `http://127.0.0.1:8000`

OpenAPI: `http://127.0.0.1:8000/api/docs/`

## Restauracao posterior

Use a tela `Exportar Dados` para importar os CSVs. A ordem recomendada e as
garantias de idempotencia estao em `docs/DATA_TRANSFER.md`.

Antes da importacao definitiva:

1. Crie um backup vazio do banco Django.
2. Importe primeiro os cadastros de referencia.
3. Importe equipamentos, recursos e materiais.
4. Importe ordens de servico e notificacoes.
5. Compare totais e relacionamentos.

## Legado removido

O diretorio `backend_node_legacy/`, as definicoes no-code em `entities/` e a
configuracao de paginas duplicada da raiz foram removidos. A compatibilidade
necessaria para importar o backup permanece implementada no backend Django.
