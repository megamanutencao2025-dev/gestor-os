# Deploy com Render e Neon

O projeto está preparado para publicar o backend Django e o frontend React como dois serviços da Render. O banco de produção é PostgreSQL no Neon.

## 1. Criar o banco no Neon

1. Crie um projeto no [Neon](https://neon.tech/).
2. Copie a connection string PostgreSQL da branch de produção.
3. Use a URL completa como `DATABASE_URL` na Render. Ela deve conter `sslmode=require`, por exemplo:

```text
postgresql://usuario:senha@ep-exemplo.us-east-2.aws.neon.tech/maintenancepro?sslmode=require
```

Use a conexão pooled do Neon para a API em produção quando ela estiver disponível.

## 2. Criar os serviços na Render

O arquivo `render.yaml` é um Blueprint com dois serviços:

- `maintenancepro-api`: Django + Gunicorn no plano gratuito.
- `maintenancepro-web`: build estático do React com fallback para as rotas do SPA.

Na Render, selecione **New > Blueprint**, conecte o repositório e confirme o `render.yaml`. Durante a criação, informe o valor secreto de `DATABASE_URL` quando solicitado.

O serviço da API executa automaticamente:

```text
pip install -r requirements/production.txt
python manage.py migrate --noinput
python manage.py collectstatic --noinput
gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

O health check fica em `https://maintenancepro-api.onrender.com/health`.

## 3. Ligar o frontend à API

Depois que a Render criar a API, abra as variáveis do serviço `maintenancepro-web` e configure:

```env
VITE_API_URL=https://maintenancepro-api.onrender.com
```

Faça um novo deploy do frontend após salvar essa variável, pois `VITE_API_URL` é incorporada no build do React.

Se os nomes dos serviços forem alterados, atualize também no serviço da API:

```env
ALLOWED_HOSTS=nome-real-da-api.onrender.com
CORS_ALLOWED_ORIGINS=https://nome-real-do-frontend.onrender.com
CSRF_TRUSTED_ORIGINS=https://nome-real-do-frontend.onrender.com
```

## 4. Primeiro administrador

O plano gratuito da Render não oferece Shell nem jobs avulsos. Para criar o
primeiro administrador antes da importação, execute localmente apontando
temporariamente `DATABASE_URL` para o Neon:

```powershell
$env:DJANGO_SETTINGS_MODULE = "config.settings.production"
$env:DJANGO_SECRET_KEY = "<a-mesma-chave-configurada-no-render>"
$env:DATABASE_URL = "<connection-string-do-neon>"
$env:DJANGO_ADMIN_USERNAME = "<usuario>"
$env:DJANGO_ADMIN_EMAIL = "<email>"
$env:DJANGO_ADMIN_PASSWORD = "<senha>"
.\.venv\Scripts\python.exe backend\manage.py bootstrap_admin
```

Limpe essas variáveis do terminal depois de criar o usuário. Outra opção é
importar um backup que já contenha o administrador.

## Variáveis de ambiente da API

Obrigatórias:

```env
DJANGO_SETTINGS_MODULE=config.settings.production
DJANGO_SECRET_KEY=uma-chave-aleatoria-longa
DEBUG=false
DATABASE_URL=postgresql://...neon.tech/...?...sslmode=require
ALLOWED_HOSTS=maintenancepro-api.onrender.com
CORS_ALLOWED_ORIGINS=https://maintenancepro-web.onrender.com
CSRF_TRUSTED_ORIGINS=https://maintenancepro-web.onrender.com
ACCESS_TOKEN_MINUTES=15
REFRESH_TOKEN_DAYS=7
```

As chaves de IA são opcionais e devem ficar somente na API:

```env
AI_DEFAULT_PROVIDER=gemini
GEMINI_API_KEY=
DEEPSEEK_API_KEY=
OPENAI_API_KEY=
GROQ_API_KEY=
```

## Arquivos e backups

O disco de um serviço Render pode ser efêmero. A persistência dos dados fica no Neon, mas arquivos enviados para `backend/media` não devem ser tratados como armazenamento permanente. Para anexos em produção, configure um storage de objetos compatível com Django ou um disco persistente da Render.

Antes de liberar o sistema:

1. Teste login, permissões, solicitação pública, notificações, importação e exportação.
2. Confirme o backup e o restore do banco no Neon.
3. Verifique `ALLOWED_HOSTS`, CORS e CSRF com os domínios reais.
4. Nunca publique `.env`, tokens ou chaves de IA no repositório.

O backend Node em `backend_node_legacy` não participa do deploy.
