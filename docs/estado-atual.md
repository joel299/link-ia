# Estado atual — LinkIA

**Última atualização:** 13/11/2026  
**Status:** MVP + Google Calendar (Composio) + fluxo de agendamento público `/{slug}/agendar` + catálogo/carrossel + preparação Docker/Coolify (`origin/main`) implementados e ativos localmente em `http://localhost:3000`; `CatalogPanel.tsx` atualizado com botão **"Tentar novamente"** após investigação de `ERR_CONNECTION_REFUSED`. Pendente inspeção interativa no navegador do usuário, criação real de evento no Google Calendar via navegador, teste em Docker Linux e descoberta da plataforma Qualify.

## Retomada rápida

O LinkIA é um MVP para criar e publicar páginas de bio personalizadas e receber agendamentos integrados à Google Agenda via Composio. A aplicação conta com backend Next.js 16 (App Router) + TypeScript + SQLite (`better-sqlite3`), autenticação por sessão assinada (com modo demonstração), painel de edição com prévia ao vivo, configuração de horários, página pública `/{slug}`, página de agendamento `/{slug}/agendar` e empacotamento Docker.

### Estado confirmado

- **MVP Base (Painel, Prévia e Página Pública):**
  - Persistência SQLite (`users`, `profiles`), autenticação HMAC-SHA256 com `SESSION_SECRET` obrigatório em produção, validações no servidor (slug, Instagram, WhatsApp DDI, agendamento HTTPS, texto simples sem HTML, upload seguro com *magic bytes* e `nosniff`), temas claro/escuro sem flash e `GlassSurface` com fallbacks.
- **Feature Google Calendar + Composio (`FEATURE-COMPOSIO-GOOGLE-CALENDAR.md`):**
  - **SDK instalado:** `@composio/core` (`src/lib/composio.ts`), usando `connectedAccounts.link`, `connectedAccounts.get`, `connectedAccounts.delete` e `tools.execute` (`GOOGLECALENDAR_FREE_BUSY_QUERY` e `GOOGLECALENDAR_CREATE_EVENT` no calendário `"primary"`).
  - **Isolamento multi-tenant:** `composioUserId` derivado no servidor (`linkia_u_${ownerId}_p_${profileId}`); validação de `ownerId` em toda rota privada e validação de pertencimento no retorno do callback; nenhum token OAuth, refresh token ou chave Composio é salvo no banco ou enviado ao navegador.
  - **Banco de dados (`src/lib/db.ts`):** tabelas `calendar_connections`, `oauth_states`, `booking_settings` e `bookings` (com `UNIQUE(profile_id, idempotency_key)` e índice único parcial `idx_bookings_active_slot` para evitar dupla reserva concorrente).
  - **Regras de agenda (`src/lib/scheduling.ts`):** validação de fuso IANA (`Intl.DateTimeFormat`), conversão para UTC, respeito a expediente semanal, duração, pausa, antecedência mínima e horizonte; *fail-closed* se conexão desconectada/expirada ou se o provedor falhar; rechecagem de FreeBusy + SQLite antes de criar evento e idempotência por tentativa.
  - **Fluxo completo de agendamento público + WhatsApp:**
  - Removido o campo externo de agendamento (`Cal.com`/`Calendly`) de `ProfileEditor.tsx`.
  - Adicionado `serviceName` em `booking_settings` e regra de ativação pública exigindo agenda conectada + pelo menos 1 dia/horário ativo + WhatsApp válido (10–15 dígitos) no perfil.
  - Formulário público (`PublicBookingView.tsx` em `/{slug}/agendar`) implementado com layout de referência: calendário mensal em pt-BR (segunda a domingo, marcação por ponto nos dias com disponibilidade, dias passados/fora do horizonte/vazios desabilitados), seletor de fuso IANA, alternância 12h/24h, lista vertical de horários, modal de confirmação solicitando nome e telefone (`"Agendando…"` durante envio) e, após sucesso real no backend, fechamento automático do modal, exibição de confirmação não bloqueante na página com botão de fallback **"Abrir WhatsApp"** e navegação automática para `https://wa.me/NUMERO?text=...` (com cliente, profissional/estabelecimento, serviço, data e hora, sem envio automático).
  - Endpoint `GET /api/public/profiles/[slug]/availability` suporta consulta por intervalo (`?from=YYYY-MM-DD&to=YYYY-MM-DD`) e por data (`?date=YYYY-MM-DD`), respeitando o `horizonDays` salvo no perfil.
  - Painel (`GoogleCalendarPanel.tsx`) usa o rótulo **"Ativar agendamento público"**, exibe o link interno `/{slug}/agendar` com botões **"Abrir página"** e **"Copiar link"** assim que a agenda está conectada e há slug, salva automaticamente ao alternar o controle e sincroniza via `saveBookingRef` ao salvar/publicar em `ProfileEditor.tsx`.
  - Página `/{slug}/agendar` diferencia estados de agenda desconectada, WhatsApp ausente, agendamento desativado, erro temporário (com tentativa novamente) e ausência de horários.
  - No perfil público (`PublicProfileView.tsx`), o botão/link padrão é `"Agendar horário"` apontando para `/{slug}/agendar` somente quando `internalBookingEnabled` é verdadeiro (agenda conectada + `booking_settings.enabled = 1` + WhatsApp válido).
  - Quando desconectado ou inativo, `/{slug}/agendar` não exibe horários falsos e oferece contato direto pelo WhatsApp do perfil quando ativo.
  - `connectedAccounts.link` em `src/lib/composio.ts` usa `allowMultiple: true` para permitir reconexões/novas tentativas sem erro do SDK Composio.
- **Catálogo de Serviços e Produtos + Carrossel Público (`PRD-LINKIA-CATALOGO-SERVICOS-CARROSSEL.md`):**
  - **Banco de dados (`src/lib/db.ts`):** tabela `catalog_items` (preço em centavos inteiros `price_cents`, `public_id` opaco, `flow_type` `appointment | whatsapp`, `availability_status`, `is_active`, `duration_minutes`, `sort_order`, `image_url` via `/api/uploads/...` sem base64) e colunas `service_public_id`, `service_title`, `service_price_cents` em `bookings`.
  - **Backend e APIs (`src/lib/catalog.ts`):** CRUD com validação de ownership (`GET/POST /api/profiles/[id]/catalog`, `PATCH/DELETE /api/profiles/[id]/catalog/[itemId]`, `PUT /api/profiles/[id]/catalog/reorder`, `GET /api/public/profiles/[slug]/catalog`), invalidação via `revalidatePath`, suporte a `?service=<publicId>` em `/availability`, `/bookings` e `/{slug}/agendar` com validação server-side de serviço ativo/disponível.
  - **Painel e Carrossel (`CatalogPanel.tsx`, `PublicCatalogCarousel.tsx`):** CRUD completo com uploader `/api/uploads`, prévia em tempo real, carrossel horizontal responsivo (1 item mobile, até 2 tablet, até 3 desktop) sem barra de rolagem ou overflow horizontal, setas no desktop, swipe no celular, lazy loading a partir do 4º item e dimensões reservadas (`aspect-ratio: 16 / 10`).
- **Docker e Operação (`Dockerfile`, `compose.yaml`, `.env.example`, `docs/DEPLOY-DOCKER-QUALIFY.md`):**
  - Variáveis `APP_BASE_URL`, `COMPOSIO_API_KEY`, `COMPOSIO_GOOGLE_CALENDAR_AUTH_CONFIG_ID` e `COMPOSIO_ALLOW_LOCAL_MOCK` adicionadas em `.env.example`, `compose.yaml` e documentação.
  - `docker compose config --quiet` validado.

### Itens ainda pendentes ou não verificados

- **Integração real com Composio (Connect Link):** validada em `http://localhost:3000` com `.env` carregado (`COMPOSIO_API_KEY` e `COMPOSIO_GOOGLE_CALENDAR_AUTH_CONFIG_ID` sem expor segredos):
  - `POST /api/profiles/:id/integrations/google-calendar/connect` retornou HTTP `200`, `isMock: false` e URL real em `connect.composio.dev` para dois profissionais distintos (`demo@linkia.app` e `prof2`).
  - Isolamento entre profissionais validado: tentativas de `GET`, `POST /connect` e `DELETE` cruzadas retornaram HTTP `403`.
- **OAuth interativo com conta Google:** a conclusão do consentimento na tela do Google e o retorno automático para `/api/integrations/composio/callback` dependem de autorização interativa com uma conta Google real no navegador (`http://localhost:3000/painel`).
- **Validação interativa no navegador via Chrome DevTools:** bloqueada localmente porque o Chrome do host não estava com `chrome://inspect/#remote-debugging` (`DevToolsActivePort`) ativo.
- **Execução em host Linux:** validado apenas em Windows (local e Docker Desktop). Execução em Linux (Docker Engine) permanece pendente.
- **Ambiente Qualify:** não confirmado no repositório nem em fontes públicas. Mantido como alvo pendente de descoberta conforme seção 8 do `AGENTS.md`.
- **Rate limiting:** pendente antes de exposição pública em produção.

## Validações realizadas (após últimas correções)

- `npm run lint`: **0 erros** (1 warning esperado `@next/next/no-img-element` em `PublicAvatar.tsx`).
- `npm run typecheck`: **0 erros**.
- `npm test`: **4 arquivos, 24/24 testes passaram** (`validation.test.ts`: 13, `catalog.test.ts`: 2, `profiles.test.ts`: 2, `scheduling.test.ts`: 7, incluindo `horizonDays` dinâmico, `getAvailableSlotsForRange` e isolamento/preços do catálogo).
- `npm run build`: **sucesso** (`next build`, incluindo rotas `/api/profiles/[id]/catalog*` e `/api/public/profiles/[slug]/catalog`).
- **Performance local (`http://localhost:3000`, TTFB 3 execuções em warm server):**
  - Baseline antes do catálogo: `/` `25.4 KB` (`8.8–142.5 ms`), `/painel` `12.0 KB` (`9.5–15.2 ms`), `/soueujoe` `21.1 KB` (`15.5–26.3 ms`), `/soueujoe/agendar` `21.0 KB` (`24.4–48.8 ms`).
  - Após catálogo e carrossel SSR (sem libs extras): `/` `25.7 KB` (`10.4–165.1 ms`), `/painel` `12.0 KB` (`10.2–38 ms`), `/soueujoe` `21.4 KB` (`16.0–145.2 ms`), `/soueujoe/agendar` `21.0 KB` (`18.3–92.4 ms`), `/api/public/profiles/soueujoe/catalog` `12 B` (`12–24.5 ms`).
  - Core Web Vitals em navegador (LCP, INP, CLS via Lighthouse/DevTools): pendente de execução interativa local pelo bloqueio `BLOQ-001` (`DevToolsActivePort` indisponível).
- **QA HTTP do catálogo em `http://localhost:3000`:** catálogo vazio oculto na página pública, upload inválido rejeitado (`400`), base64 rejeitado (`422`), criação de 4 itens, isolamento cruzado (`403`), renderização de carrossel com `Indisponível` + `wa.me` e bloqueio de serviço indisponível em `/{slug}/agendar?service=...`.
- **Composio real (leitura `GOOGLECALENDAR_FREE_BUSY_QUERY`):** executado com sucesso contra a conta conectada de `soueujoe` (`successful: true`, calendário `"primary"`).
- **QA HTTP em `http://localhost:3000` (servidor ativo):**
  - `GET /api/health` -> `200 {"ok":true,"status":"healthy","db":"ok"}`.
  - `GET /soueujoe` (com `booking_settings.enabled = 0`) -> `200`, não exibe `"Agendar horário"`; `GET /api/public/profiles/soueujoe/availability?date=2026-11-16` -> `409` (`"O agendamento online está desativado para este perfil."`).
  - Perfil publicado sem agenda conectada -> `PUT /booking-settings` com `enabled: true` bloqueado (`422`), `GET /{slug}` não exibe `"Agendar horário"`, `GET /{slug}/agendar` exibe fallback WhatsApp, `/availability` e `/bookings` retornam `409`.
- **Browser subagent:** bloqueado no host (`BLOQ-001`, `DevToolsActivePort` ENOENT).

## Próxima ação

1. Abrir `http://localhost:3000/painel` no navegador, ativar `"Agendamento público ativo"` (ou clicar em **"Salvar alterações"**) e validar o fluxo completo em `/{slug}` -> `/{slug}/agendar` -> criação de evento real na Google Agenda.
2. Confirmar plataforma **Qualify** e validar container em host Linux.
