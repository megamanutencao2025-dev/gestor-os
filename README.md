# MaintenancePro

Sistema de gestao de ordens de servico com frontend React e API Django.

## Arquitetura

- `src/`: interface React/Vite
- `backend/`: API Django, autenticacao e regras de negocio
- `docs/`: documentacao de arquitetura e migracao de dados
- `render.yaml`: infraestrutura do frontend e da API no Render

O PostgreSQL de producao e hospedado no Neon. O backend Node legado nao faz parte
da aplicacao ativa nem do deploy.

## Desenvolvimento local

Requisitos: Node.js 20+, Python 3.12+ e PowerShell.

```powershell
.\setup.ps1
```

Em terminais separados:

```powershell
.\.venv\Scripts\python.exe backend\manage.py runserver
npm run dev
```

A interface fica em `http://127.0.0.1:5173` e a API em
`http://127.0.0.1:8000`.

## Verificacao

```powershell
npm run deploy:check
.\.venv\Scripts\python.exe -m pytest backend
```

## Deploy

O procedimento completo, incluindo Neon, Render, variaveis de ambiente,
migracoes e criacao do primeiro administrador, esta em [DEPLOY.md](DEPLOY.md).
