# LinkIA

Painel e página pública de bio com agendamento integrado à Google Agenda (via Composio) e catálogo de serviços/produtos em carrossel responsivo.

## Stack

- **Runtime:** Node.js 22 + Next.js 16 (App Router, `output: "standalone"`) + TypeScript
- **Banco de dados e uploads:** SQLite (`better-sqlite3`) e armazenamento local em `DATA_DIR` (padrão `./data`, ou `/app/data` no container)
- **Porta HTTP interna:** `3000`
- **Healthcheck:** `GET /api/health`

## Execução local

1. Copie `.env.example` para `.env` e preencha valores locais seguros (nunca versione `.env`).
2. Instale dependências e inicie em desenvolvimento:

```bash
npm install
npm run dev
```

3. Para build e execução de produção local:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

## Build e execução com Docker (local)

```bash
docker compose up --build
```

Para encerrar:

```bash
docker compose down
```

## Variáveis de ambiente

Consulte os nomes em `.env.example`:

- `PORT` / `HOSTNAME`: porta e bind HTTP do Next.js (`3000` e `0.0.0.0`).
- `DATA_DIR`: diretório persistente do SQLite e uploads (`./data` local, `/app/data` no Docker).
- `SESSION_SECRET`: segredo obrigatório em produção (>= 16 caracteres) para assinatura de cookies.
- `COOKIE_SECURE`: `true` em produção HTTPS; `false` apenas em desenvolvimento local HTTP.
- `APP_BASE_URL`: URL pública base da aplicação (ex.: `https://seu-dominio.com`), usada em callbacks OAuth.
- `COMPOSIO_API_KEY`: chave de API do projeto no Composio (somente servidor).
- `COMPOSIO_GOOGLE_CALENDAR_AUTH_CONFIG_ID`: Auth Config ID do Google Calendar no Composio (somente servidor).
- `COMPOSIO_ALLOW_LOCAL_MOCK`: `false` em produção; `true` apenas em dev local para simular OAuth sem credenciais.

## Preparação de deploy no Coolify

Consulte [COOLIFY_DEPLOYMENT.md](./COOLIFY_DEPLOYMENT.md) para detalhes de build no GitHub Actions (`.github/workflows/publish-coolify-image.yml`), imagem no GHCR (`ghcr.io/joel299/link-ia:linkia-coolify`), configuração do `docker-compose.coolify.yml` e secrets necessários.

