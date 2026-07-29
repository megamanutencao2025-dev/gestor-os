# MaintenancePro API

Backend oficial em Django 5 e Django REST Framework.

## Desenvolvimento

Na raiz do projeto:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements\development.txt
.\.venv\Scripts\python.exe backend\manage.py migrate
.\.venv\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000
```

O desenvolvimento usa SQLite quando `backend/.env` nao existe. Para PostgreSQL
e demais configuracoes, crie esse arquivo a partir de `backend/.env.example`.

## Qualidade

```powershell
cd backend
..\.venv\Scripts\python.exe -m ruff check .
..\.venv\Scripts\python.exe -m coverage run -m pytest
..\.venv\Scripts\python.exe -m coverage report
..\.venv\Scripts\python.exe manage.py spectacular --validate --fail-on-warn --file schema.yml
```

Documentacao interativa: `http://127.0.0.1:8000/api/docs/`.

