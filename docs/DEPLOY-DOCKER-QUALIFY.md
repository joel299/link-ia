# Deploy e execução — Docker e Qualify (LinkIA)

**Última atualização:** 12/11/2026  
**Estado:** Configuração Docker preparada; build local e ambiente Qualify pendentes de validação.

## 1. Visão geral

O LinkIA usa Next.js com `output: "standalone"` (`next.config.ts`), banco SQLite via `better-sqlite3` e armazenamento local em `DATA_DIR` (padrão `/app/data` dentro do container).

Arquivos de infraestrutura:
- `Dockerfile`: build multi-stage baseado em `node:22-bookworm-slim`, executando como usuário não-root `node` e com `HEALTHCHECK` em `http://127.0.0.1:3000/api/health`.
- `compose.yaml`: sobe o serviço `linkia` na porta `3000:3000`, com volume nomeado `linkia_data:/app/data`, healthcheck e `restart: unless-stopped`.
- `.dockerignore`: evita copiar `node_modules`, `.next`, `.env`, bancos locais e documentação para o contexto de build.

## 2. Pré-requisitos

- **Windows:** Docker Desktop instalado e em execução (com backend WSL 2 recomendado).
- **Linux:** Docker Engine e plugin Docker Compose v2 (`docker compose`).

## 3. Variáveis de ambiente

Consulte `.env.example` na raiz do repositório. Nunca versionar o arquivo `.env` com segredos reais.

| Variável | Padrão no container / Compose | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta HTTP interna do servidor Next.js. |
| `HOSTNAME` | `0.0.0.0` | Interface de escuta dentro do container. |
| `DATA_DIR` | `/app/data` | Diretório persistente para SQLite e uploads de avatar. |
| `COOKIE_SECURE` | `false` (Compose local) | Define a flag `Secure` nos cookies de sessão. Em produção com HTTPS, definir obrigatoriamente como `true`. |
| `SESSION_SECRET` | Sem padrão seguro (definir via `.env`) | Segredo para assinar cookies de sessão. **Definir um valor longo e aleatório** antes de iniciar a aplicação. |
| `APP_BASE_URL` | `http://localhost:3000` | URL pública base da aplicação (usada em callbacks OAuth, ex.: retorno da conexão Google Agenda). |
| `COMPOSIO_API_KEY` | Vazio (definir via `.env`) | Chave de API da Composio. Obrigatória em produção para integração real com Google Agenda. |
| `COMPOSIO_GOOGLE_CALENDAR_AUTH_CONFIG_ID` | Vazio (definir via `.env`) | ID da configuração de autenticação do Google Calendar na Composio. |
| `COMPOSIO_ALLOW_LOCAL_MOCK` | `false` | Definir `true` apenas em desenvolvimento local sem credenciais Composio para testar o fluxo simulado. |

Antes de rodar `docker compose up`, crie o arquivo `.env` na raiz a partir do `.env.example` e preencha um `SESSION_SECRET` forte (e `COOKIE_SECURE=true`, `APP_BASE_URL` e credenciais `COMPOSIO_*` conforme o ambiente):

- **Windows (PowerShell):**
  ```powershell
  Copy-Item .env.example .env
  ```
- **Linux (bash):**
  ```bash
  cp .env.example .env
  ```

O Docker Compose lê automaticamente o arquivo `.env` da raiz para preencher `${SESSION_SECRET}`, `${COOKIE_SECURE}`, `${APP_BASE_URL}` e as variáveis `COMPOSIO_*`.

## 4. Comandos de operação (Windows e Linux)

Os comandos abaixo usam `docker compose` (v2) e funcionam da mesma forma no PowerShell (Windows) e no terminal bash (Linux), a partir da raiz do projeto.

### Subir a aplicação (build + execução em segundo plano)

```bash
docker compose up -d --build
```

### Verificar status e healthcheck

```bash
docker compose ps
```

A coluna `STATUS` deve exibir `(healthy)` após o período inicial de inicialização (`start_period: 15s`).

### Acompanhar logs

```bash
docker compose logs -f linkia
```

### Encerrar serviços (preservando os dados)

```bash
docker compose down
```

> **Atenção:** `docker compose down` mantém o volume `linkia_data` (banco SQLite e avatares). Só execute `docker compose down -v` se quiser apagar todos os dados persistidos.

## 5. Decisões técnicas e portabilidade

1. **Base `node:22-bookworm-slim`:** escolhida em vez de Alpine para garantir compatibilidade glibc com `better-sqlite3` e evitar falhas de compilação musl. O stage `deps` inclui `python3`, `make` e `g++` caso seja necessário compilar o addon nativo.
2. **Healthcheck com `fetch` nativo do Node 22:** evita instalar `curl` ou `wget` na imagem final e garante comportamento idêntico entre `Dockerfile` e `compose.yaml`.
3. **Volume nomeado `linkia_data:/app/data`:** evita problemas de permissão de bind mount entre Windows (NTFS/WSL2) e Linux (UID/GID do host), mantendo compatibilidade com o usuário `node` (UID 1000). Caso opte por usar bind mount em host Linux no caminho `/app/data`, garanta que o diretório do host permita escrita pelo usuário `node` (UID `1000` / GID `1000`, ex.: `chown -R 1000:1000 ./data`) ou utilize o volume nomeado `linkia_data`.
4. **Pasta `public` e `package-lock.json` opcionais no build:** o `Dockerfile` trata ambos de forma defensiva para não quebrar o build caso `public/` esteja vazio/ausente ou `package-lock.json` ainda não exista.

## 6. Estado do ambiente Qualify

Conforme a Seção 8 do `AGENTS.md`, **Qualify** é tratado como alvo pendente de descoberta até que acesso e documentação oficiais sejam fornecidos.

### O que foi confirmado
- Nenhuma especificação, CLI, API, painel ou variável do ambiente **Qualify** foi confirmada neste repositório até o momento.

### O que NÃO foi confirmado (pendente de descoberta)
- Se "Qualify" refere-se a uma plataforma própria/interna com esse nome ou a uma possível referência ao **Coolify** (não assumir sem confirmação do responsável).
- Suporte da plataforma a deploy via `Dockerfile`, `compose.yaml` ou buildpack.
- Forma de configuração de variáveis de ambiente e segredos (`SESSION_SECRET`).
- Suporte a volume persistente para `DATA_DIR=/app/data` (essencial para SQLite e uploads locais; se o filesystem for efêmero, será necessário revisar a estratégia de banco/storage).
- Configuração de porta exposta, healthcheck HTTP (`/api/health`), domínio e HTTPS.

### Checklist de descoberta antes do deploy no Qualify
1. Tipo de aplicação e runtime aceitos.
2. Método de build ou suporte a container (`Dockerfile` / `compose.yaml`).
3. Portas esperadas e configuração de healthcheck.
4. Variáveis de ambiente e armazenamento persistente (`DATA_DIR`).
5. Banco de dados e política de migrações.
6. Domínio, HTTPS, logs e estratégia de rollback.
7. Acesso e autorização disponíveis para publicação.
