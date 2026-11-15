# Estado atual — LinkIA

**Última atualização:** 15/11/2026  
**Status:** MVP + Google Calendar (Composio) + Agendamento público + Catálogo/Carrossel + Destaques do Instagram + Canais conectados + Tráfego Pago (`/painel/trafego`, restrito a perfis publicados) + Páginas legais públicas (`/termos-de-uso`, `/politica-de-privacidade`) + Correções finais de painel (remoção de badge MVP e campo URL de foto, CRUD completo com despublicar e exclusão confirmada, seções 1–4 colapsáveis, links personalizados HTTPS e ordenação configurável da prévia e página pública) implementados e validados localmente em `http://127.0.0.1:3000`. Pendente preenchimento dos dados empresariais/jurídicos nas minutas legais, atualização externa de `COMPOSIO_META_ADS_AUTH_CONFIG_ID` para `metaads`, teste em Docker Linux e descoberta da plataforma Qualify.

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
- **Integrações Sociais, WhatsApp Coexistência (Zernio) e Tráfego Pago (`14/11/2026`):**
  - **Google Agenda preservada sem alterações:** `src/lib/composio.ts`, `src/lib/scheduling.ts`, `GoogleCalendarPanel.tsx`, `/api/profiles/[id]/integrations/google-calendar/*` e `/api/integrations/composio/callback` mantidos intocados.
  - **Schema SQLite (`src/lib/db.ts`):** adicionadas tabelas `social_connections`, `social_oauth_states`, `social_assets`, `profile_social_media`, `whatsapp_connections`, `whatsapp_connection_attempts`, `ad_campaign_operations`, `integration_audit_events` e `webhook_events_dedup`.
  - **Levantamento real dos toolkits Composio (`@composio/core`):**
    - `INSTAGRAM`: OAuth gerenciado disponível (`managed: ["OAUTH2"]`); ações confirmadas `INSTAGRAM_GET_USER_INFO`, `INSTAGRAM_GET_IG_USER_MEDIA`.
    - `TIKTOK`: OAuth gerenciado indisponível (`managed: []`); requer credenciais próprias de app do desenvolvedor; ações `TIKTOK_QUERY_CREATOR_INFO`, `TIKTOK_GET_USER_STATS`, `TIKTOK_LIST_VIDEOS`.
    - `METAADS`: OAuth gerenciado indisponível (`managed: []`); requer auth config/credenciais próprias; ações `METAADS_GET_AD_ACCOUNTS`, `METAADS_LIST_CAMPAIGNS`, `METAADS_GET_INSIGHTS`, `METAADS_CREATE_CAMPAIGN`, `METAADS_SET_AD_OBJECT_STATUS`.
    - `TIKTOK_ADS`: OAuth gerenciado disponível (`managed: ["OAUTH2"]`), distinto de `TIKTOK`; ações `TIKTOK_ADS_GET_ADVERTISER_ACCOUNTS`, `TIKTOK_ADS_LIST_CAMPAIGNS`, `TIKTOK_ADS_GET_REPORT_INTEGRATED`, `TIKTOK_ADS_CREATE_CAMPAIGN`, `TIKTOK_ADS_UPDATE_CAMPAIGN_STATUS`.
    - `WHATSAPP`: `managed: ["OAUTH2"]`, mantido desabilitado (`disabled_pending_validation`) enquanto Zernio conduz coexistência.
  - **WhatsApp Coexistência Zernio (`src/lib/zernio-whatsapp.ts`):** fluxo `onboarding=business_app`, allowlist HTTPS, `state_hash` uso único/expiração, verificação server-side antes de marcar `connected`, telefone mascarado, desconexão apenas no LinkIA (sem desregistrar da Cloud API) e webhook `POST /api/webhooks/zernio/whatsapp` com HMAC-SHA256 e deduplicação.
  - **UI em duas áreas (`AppShell.tsx`, `ConnectedChannelsPanel.tsx`, `/painel/trafego` + `PaidTrafficPanel.tsx`):** carregamento sob demanda por seção/aba, sem chamadas externas no primeiro paint; fluxo de rascunho + revisão + confirmação explícita de gasto em duas etapas (criação pausada + ativação separada).
  - **Página pública (`PublicProfileView.tsx`, `PublicSocialSection.tsx`, `src/lib/profiles.ts`):** exibe link canônico verificado do Instagram/TikTok e até 3 publicações/Reels selecionadas do Instagram a partir do cache SQLite.
  - **Configuração manual pendente do administrador:** definir `ZERNIO_API_KEY`, `ZERNIO_WEBHOOK_SECRET`, `COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID`, `COMPOSIO_TIKTOK_AUTH_CONFIG_ID`, `META_ADS_CLIENT_ID`, `META_ADS_CLIENT_SECRET`, `COMPOSIO_META_ADS_AUTH_CONFIG_ID` e `COMPOSIO_TIKTOK_ADS_AUTH_CONFIG_ID` no servidor.
  - **Configuração Segura Meta Ads (`15/11/2026`):**
    - `.env.example`, `compose.yaml` e `docker-compose.coolify.yml` atualizados com `META_ADS_CLIENT_ID`, `META_ADS_CLIENT_SECRET`, `COMPOSIO_META_ADS_AUTH_CONFIG_ID` e `COMPOSIO_META_ADS_REDIRECT_URI` (sem segredos e sem exposição ao navegador).
    - Schema real do toolkit `metaads` no `@composio/core` confirmado (`authScheme: OAUTH2`, campos obrigatórios `client_id` e `client_secret`, callback padrão `https://backend.composio.dev/api/v3/toolkits/auth/callback`, escopos padrão `ads_read,ads_management,business_management`).
    - Criado `src/lib/meta-ads-config.ts` (`getMetaAdsEnvValidation`, `ensureMetaAdsAuthConfig`) e a rota autenticada `GET`/`POST /api/profiles/[id]/ads/meta_ads/setup`, com deduplicação de auth configs existentes no Composio, auditoria redigida e sem criação automática no boot.
    - `src/lib/ads-service.ts` (`getAdsConfigStatus`) e `src/components/panel/PaidTrafficPanel.tsx` atualizados para orientar a criação/validação sob demanda da auth config Meta Ads.
    - Documentação detalhada publicada em `docs/META_ADS_SETUP.md`.
  - **Webhook da Zernio e Acesso Local (`15/11/2026`):**
    - `.env.example` atualizado com `ZERNIO_WEBHOOK_SECRET=` vazio; `.gitignore` reforçado com `.secrets/`, `*.secret`, `*.key`, `*.pem`.
    - Criado `src/instrumentation.ts` para registrar aviso seguro no boot quando `ZERNIO_WEBHOOK_SECRET` estiver ausente (sem gerar segredo em runtime).
    - `src/app/api/webhooks/zernio/whatsapp/route.ts` e `src/lib/zernio-whatsapp.ts` atualizados para também aceitar `X-Zernio-Event` e `X-Zernio-Event-Id` como fallback junto a `X-Zernio-Signature` (HMAC-SHA256 sobre `rawBody` com `crypto.timingSafeEqual`).
    - Documentação de cadastro externo e testes publicada em `docs/ZERNIO_WEBHOOK_SETUP.md`.
    - `next.config.ts` (`allowedDevOrigins: ["127.0.0.1", "localhost"]`) e `src/app/login/page.tsx` ajustados para destravar acesso local via `127.0.0.1:3000`.
  - **Correção Zernio WhatsApp Connect HTTP 400 (`15/11/2026`):**
    - Causa confirmada (`BUG-009`): envio do ID sintético `linkia_u_..._p_...` para `GET /v1/connect/whatsapp` causava HTTP `400 Invalid profileId format` na Zernio.
    - `DefaultZernioWhatsAppProvider.ensureProfile()` passou a obter/criar o perfil real na Zernio (`GET/POST /v1/profiles`) e persistir seu `_id` (ObjectId 24 hex) em `whatsapp_connections.zernio_profile_id`, mantendo o modo coexistência (`onboarding=business_app`), mapeamento sanitizado de erros (`401`/`402`/`404`/`redirect_url`/conflitos), callback completo (`connected=whatsapp`, `profileId`, `accountId`, `username`, códigos de conflito/cancelamento) e botão **"Tentar novamente"** no card existente de **Canais conectados** (`ConnectedChannelsPanel.tsx`).
  - **Correção Instagram Composio (`ig_user_id`) e Sanitização de Erros (`15/11/2026`):**
    - Causa confirmada (`BUG-010`): `INSTAGRAM_GET_IG_USER_MEDIA` exige `ig_user_id` real (obtido via `INSTAGRAM_GET_USER_INFO` com `ig_user_id: "me"`), e falhas do provedor estavam sendo persistidas/exibidas em texto técnico bruto.
    - `src/lib/composio-social.ts`, `src/lib/db.ts`, `src/lib/types.ts`, `src/lib/profiles.ts`, `src/app/api/profiles/[id]/integrations/social/[provider]/sync/route.ts`, `ConnectedChannelsPanel.tsx` e `PublicSocialSection.tsx` atualizados para resolver/persistir `ig_user_id`, sincronizar até 3 publicações/Reels recentes com `likeCount`/`commentCount` (`null` quando indisponível), preservar cache e `last_synced_at` em falhas e sanitizar mensagens de erro com `correlationId` apenas em logs internos.
  - **Consolidação da Sessão 2 ("2. Canais conectados") e Limpeza Idempotente (`15/11/2026`):**
    - `ProfileEditor.tsx` e `ConnectedChannelsPanel.tsx` consolidados para que **2. Canais conectados** (`#canais-conectados`) seja o único local de gerenciamento de WhatsApp, Instagram, TikTok e Facebook, removendo a seção redundante "2. Links de ação" e a antiga seção 6, preservando os campos de link público (`whatsappNumber`, `whatsappMessage`, `whatsappEnabled`, `instagramInput`, `instagramEnabled`) dentro de seus respectivos canais.
    - WhatsApp unificado com os dois caminhos explícitos (vincular conta WhatsApp Business com coexistência quando elegível vs informar número público para mensagens), sem QR Code fictício e sem termos técnicos internos (`Zernio`, `Composio`, `Cloud API`, `API oficial`, códigos HTTP).
    - `PaidTrafficPanel.tsx` (`/painel/trafego`) ajustado para remover botões duplicados de conexão do Facebook (`meta_ads`), direcionando para `/painel#canais-conectados` e sanitizando mensagens de erro em `src/lib/ads-service.ts`.
    - Criada rotina idempotente `cleanupStaleIntegrationStates()` (`src/lib/integration-cleanup.ts`) para expirar/limpar estados OAuth vencidos e tentativas incompletas antigas sem afetar conexões `connected` ou IDs válidos.
    - Google Agenda (`GoogleCalendarPanel.tsx`, `src/lib/composio.ts`, `src/lib/scheduling.ts`) preservada sem alterações.
  - **Validações:** `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` e validação HTTP local em `http://localhost:3000` executados após as alterações.

## Próxima ação

1. Abrir `http://localhost:3000/painel` no navegador, ativar `"Agendamento público ativo"` (ou clicar em **"Salvar alterações"**) e validar o fluxo completo em `/{slug}` -> `/{slug}/agendar` -> criação de evento real na Google Agenda.
2. Confirmar plataforma **Qualify** e validar container em host Linux.

### Preparação do callback OAuth Meta Ads (15/11/2026)
- Inspecionada a rota real `GET /api/integrations/social/callback`: ela valida `state` e sessão e redireciona Meta Ads para `/painel/trafego` com `profileId`, `provider` e status.
- O provedor deve retornar ao Composio em `https://backend.composio.dev/api/v3/toolkits/auth/callback`; o Composio retorna ao LinkIA por `callbackUrl`.
- Produção confirmada pela documentação do Coolify: `APP_BASE_URL=https://linkia.iainfinito.com.br`. Corrigido o exemplo de URL que usava o host `linka.infinito.com.br`.
- `getMetaAdsReturnBaseUrl` agora restringe callback ao mesmo domínio de `APP_BASE_URL` e à rota exata do callback, rejeitando host, caminho, query ou fragmento arbitrários. `getMetaAdsRedirectUri` rejeita URI de provedor diferente da URI v3 requerida.
- Testes de allowlist e URI exata adicionados. A URI v3 foi salva na lista de URIs OAuth válidas no Meta Developers; o app já aparece publicado. As duas variáveis foram salvas no Coolify e estão pendentes de aplicar. Nenhum deploy foi executado. A Auth Config do Composio ainda depende das credenciais Meta; o endpoint de setup agora valida o toolkit e atualiza o oauth_redirect_uri exato antes de reutilizar a configuração.
### Atualização da revisão do callback Meta Ads (15/11/2026)
- O erro observado após o deploy mostrou o Facebook recebendo um `redirect_uri` do LinkIA. A sincronização da Auth Config existia apenas no endpoint de setup; o endpoint de conexão não garantia essa atualização.
- `POST /api/profiles/[id]/integrations/social/[provider]/connect` agora chama `ensureMetaAdsAuthConfig` antes de iniciar Meta Ads OAuth. Assim, a Auth Config `metaads` é validada e recebe a URI v3 canônica a cada nova tentativa.
- A variável legada `COMPOSIO_META_ADS_REDIRECT_URI` no Coolify também será alinhada a `https://backend.composio.dev/api/v3/toolkits/auth/callback`.
- Próxima ação: publicar a versão corrigida, repetir o OAuth e verificar o redirecionamento final para `/painel/trafego`.

### Meta Ads OAuth — revisão concluída em produção (15/11/2026)
- Commit `ca390887db0957bc4a3863e07f68b7c537030f6f` publicado na branch `main`; workflow `Publish LinkIA Coolify Image` terminou com sucesso.
- Coolify puxou a imagem, recriou o container LinkIA e confirmou `Started`/`Running`; as alterações de ambiente deixaram de aparecer como pendentes.
- O Meta App `stark-hermes` já tinha a URI Composio na lista OAuth. O erro reproduzido vinha do domínio LinkIA ausente em App Domains; adicionado `linkia.iainfinito.com.br` e alinhado o URL do site ao host oficial de produção.
- A configuração antiga `COMPOSIO_META_ADS_REDIRECT_URI` no Coolify foi alinhada à URI v3 do Composio. A rota de conexão agora sincroniza a Auth Config `metaads` antes de iniciar OAuth.
- Próximo passo: repetir a conexão Meta Ads no painel; validar que o `redirect_uri` do Facebook é `https://backend.composio.dev/api/v3/toolkits/auth/callback` e que, ao concluir ou cancelar, o navegador volta ao tráfego pago do LinkIA.

### Painel administrativo e controle de funcionalidades por usuário (15/11/2026)
- **Modelo de dados e permissões (`src/lib/types.ts`, `src/lib/db.ts`, `src/lib/permissions.ts`):**
  - Criadas as tabelas `user_feature_permissions` (`user_id`, `permissions_json`, `version`, `updated_by`, `updated_at`) e `admin_audit_logs` (`id`, `actor_user_id`, `target_user_id`, `action`, `details_json`, `created_at`), além da migração idempotente `users.is_active` e `users.updated_at`.
  - Definidas 8 chaves explícitas e independentes (`FeatureKey`): `whatsapp`, `instagram`, `facebook_social`, `meta_ads`, `tiktok_organic`, `tiktok_ads`, `google_calendar` e `catalog`.
  - Contas legadas sem registro em `user_feature_permissions` mantêm todas as 8 funcionalidades liberadas; contas novas criadas pelo admin recebem apenas as permissões explicitamente marcadas (todas desmarcadas por padrão no formulário de criação).
- **Autenticação, bootstrap e APIs administrativas (`src/lib/auth.ts`, `src/lib/admin-users.ts`, `src/app/api/admin/users/**`):**
  - `getSessionUser()` anexa `role`, `isActive` e `permissions` à sessão e invalida sessões de contas suspensas (`is_active === 0`); `authenticateUser()` também bloqueia login de contas suspensas.
  - Adicionado `ensureAdminBootstrapFromEnv()` com `ADMIN_BOOTSTRAP_EMAIL` e `ADMIN_BOOTSTRAP_PASSWORD` documentados em `.env.example` sem valores reais.
  - Rotas `GET/POST /api/admin/users` e `GET/PATCH /api/admin/users/[userId]` protegidas por `requireAdminUser()` (`403` para não-admins), rejeitando escalonamento de papel (`role !== 'client'`) e nunca expondo `password_hash` ou segredos.
- **Enforcement no servidor e filtragem no cliente:**
  - `requireUserFeature()` aplicado com resposta `403` em todas as rotas de WhatsApp, Social (`instagram`, `tiktok`, `facebook_social`), Tráfego Pago (`meta_ads`, `tiktok_ads`), Google Agenda / Agendamento (`google-calendar`, `booking-settings`), Catálogo (`catalog`) e `PATCH /api/profiles/[id]`; `getPublishedPublicProfileBySlug()` também filtra elementos públicos conforme as permissões do dono.
  - Criada a página `/painel/admin` (`src/app/painel/admin/page.tsx` + `src/components/panel/AdminUsersPanel.tsx`) e link condicional `"Administração"` no `AppShell.tsx`.
  - `ProfileEditor.tsx`, `ConnectedChannelsPanel.tsx`, `ProfilePreview.tsx`, `src/app/painel/trafego/page.tsx` e `PaidTrafficPanel.tsx` ocultam abas/canais não liberados para o usuário autenticado.
- **Validações concluídas:** `npm test` (8 arquivos, 68/68 testes incluindo `tests/admin-permissions.test.ts`), `npm run typecheck` (0 erros), `npm run lint` (0 erros), `npm run build` (exit 0) e verificação HTTP E2E local em `http://127.0.0.1:3000` (unauth redirect `307`, admin `200`, criação de cliente com permissões parciais, `403` para cliente em `/api/admin/users` e rotas não liberadas, `200` nas liberadas, suspensão `isActive: false` bloqueando login com `401`).