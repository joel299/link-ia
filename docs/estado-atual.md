# Estado atual — LinkIA

**Última atualização:** 15/11/2026  
**Status:** MVP + Google Calendar (Composio) + Agendamento público + Catálogo/Carrossel + Destaques do Instagram + Canais conectados + Tráfego Pago (`/painel/trafego`, restrito a perfis publicados) + Páginas legais públicas (`/termos-de-uso`, `/politica-de-privacidade`) + Correções finais de painel (remoção de badge MVP e campo URL de foto, CRUD completo com despublicar e exclusão confirmada, links personalizados HTTPS e ordenação configurável da prévia e página pública) + Editor de perfil reorganizado em cinco seções sob demanda (menu **Profile**, skeletons, capa com desfoque, canais em cards/Drawer, modelos de agendamento e prévia com indicador de não salvo) implementados e validados localmente em `http://127.0.0.1:3000`. Pendente preenchimento dos dados empresariais/jurídicos nas minutas legais, atualização externa de `COMPOSIO_META_ADS_AUTH_CONFIG_ID` para `metaads`, teste em Docker Linux, descoberta da plataforma Qualify e validação visual em navegador.

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

### Editor de perfil reorganizado (15/11/2026)

- **Navegação:** o cabeçalho do editor exibe nome do perfil + badge de estado (`Publicado`/`Rascunho`) + dropdown **Profile** com as cinco seções (Identidade, Canais conectados, Aparência pública, Agendamento, Serviços e Produtos). A seção ativa é marcada no menu; a escolha apenas troca a seção montada e atualiza o hash (`#identidade`, `#canais`, `#aparencia`, `#agendamento`, `#servicos`) via `history.replaceState`, preservando refresh e o botão Voltar.
- **Carregamento sob demanda:** apenas a seção ativa é montada. `ConnectedChannelsPanel`, `GoogleCalendarPanel`, `CatalogPanel` e `CustomLinksPanel` são importados com `next/dynamic` (`ssr: false`) e buscam seus dados somente ao abrir a seção. Não há fetch inicial de canais, agenda ou catálogo; cada abertura faz uma busca por canal/recurso. Caches ficam no estado do editor por perfil (componente remontado por `key`), e a prévia mantém os últimos dados carregados.
- **Alterações não salvas:** ao trocar de seção com alterações pendentes, o editor exibe **Salvar e continuar**, **Descartar e continuar** (restaura o último perfil salvo) e **Cancelar**. `beforeunload` alerta antes de refresh/fechamento. “Descartar” também limpa o estado sujo do agendamento.
- **Skeletons:** `SectionSkeleton` cobre identidade, canais, aparência, agenda, catálogo e genérico, somente no conteúdo da seção; não aparece quando já há dados. Erros usam bloco simples com **Tentar novamente**. Respeita `prefers-reduced-motion` e tema claro/escuro.
- **Identidade + capa:** `profiles.cover_url` e `profiles.cover_blur` (0–24, padrão 12) adicionados ao SQLite com ALTERs idempotentes. Upload reutiliza `/api/uploads` (PNG/JPEG/WebP, 2 MB, validação de *magic bytes*); a URL técnica não é exibida. `CoverUploader` oferece prévia, envio/remoção e intensidade de desfoque. `PublicProfileView` renderiza capa full-width limitada a `480px` com `backdrop-filter` mascarado; a prévia do editor recebe capa/blur.
- **Canais conectados:** todos os canais habilitados pela permissão são consultados na abertura da seção; cards compactos com ícone e cor da marca mostram estado real (`Conectado`, `Desconectado`, `Ação necessária`, erro) e ação correta (`Gerenciar`/`Conectar`/`Reconectar`). Detalhes abrem em `ChannelDrawer` (desktop lateral, mobile bottom sheet) com Escape, backdrop, gesto de arrastar para baixo, foco inicial e bloqueio de scroll. WhatsApp mantém as duas opções (Business ou apenas número) e não exibe QR fictício; Facebook não é apresentado como Meta Ads.
- **Aparência:** blocos diretos (Tema, Cores, Tipografia, Botões) sem accordion; escolhas salvas por perfil e refletidas imediatamente na prévia.
- **Agendamento:** faixa de status real (ativo/inativo + pré-requisitos), modelos **Seg a sex**, **Seg a sáb**, **Seg a dom** (08:00–18:00) e **Personalizar**. O modelo só substitui os dias locais após confirmação e só é persistido em **Salvar disponibilidade**; fuso, duração, pausa e antecedência são preservados. Como `WeeklyAvailabilityDay` suporta um único intervalo por dia, o modelo cobre 08:00–18:00 contínuo — dois períodos exigiriam mudança no backend (registrado em `bugs-e-dificuldades.md`).
- **Serviços e Produtos:** mantém o CRUD existente dentro de `SectionShell`, com skeleton ao abrir, erro com retry e prévia sincronizada.
- **Prévia:** continua vinculada ao perfil aberto, reflete campos, cores, capa e ordem pública, e mostra um indicador textual discreto **Não salvo** quando há alterações pendentes. Não expõe URLs internas, IDs ou debug.
- **Design system:** verde vibrante controlado adicionado como `--color-primary-vivid` e `--color-primary-soft`, usados apenas em bordas/foco/indicadores; textos pequenos continuam com `--color-primary`/`--color-success` de contraste seguro. Paleta preto/verde/dourado preservada; ícones de marca usam cores oficiais apenas como acento decorativo.

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

- **Editor reorganizado (15/11/2026):**
  - `npm run typecheck`: **0 erros**.
  - `npm run lint`: **0 erros** (4 warnings de `<img>` em `CatalogPanel`, `PublicAvatar`, `PublicCatalogCarousel`; `.agents/**` passou a ser ignorado no `eslint.config.mjs`).
  - `npm test`: **8 arquivos, 69/69 testes passaram**.
  - `npm run build`: **sucesso** (`next build`).
  - Percorrer visual dos 13 pontos em navegador (1440/390, claro/escuro, skeleton, requests) **não executado**: sem credenciais de conta autorizada no ambiente e sem DevTools remoto; validação limitada a build, tipos, lint, testes e revisão de código. Integração real com Google/WhatsApp/Instagram continua dependente de credenciais e consentimento externos.
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
- **Validações do commit anterior:** `npm test` (8 arquivos, 68/68 testes), `npm run typecheck`, `npm run lint`, `npm run build` e verificação HTTP local (admin 200, cliente 403 e usuário suspenso 401).

### Acesso administrativo após bootstrap configurado (15/11/2026)
- **Sintoma:** `/painel/admin` redirecionava com HTTP 307 para `/painel`, mesmo após configurar `ADMIN_BOOTSTRAP_EMAIL` e `ADMIN_BOOTSTRAP_PASSWORD` no Coolify.
- **Evidência:** as duas variáveis aparecem no serviço de produção, com valores preenchidos e runtime habilitado; o container está `Running (healthy)`. O servidor responde redirecionando a conta para `/painel`, comportamento do guard quando o papel não é `admin`.
- **Ajuste:** `getSessionUser()` agora executa o bootstrap idempotente antes de consultar o papel da conta, para reconciliar a sessão com a configuração atual do serviço. A promoção continua restrita ao e-mail configurado e à senha bootstrap válida. Teste de regressão cobre uma sessão existente.
- **Validação local:** `npm run typecheck` e `npm run lint` passaram (4 avisos existentes de `<img>`); `npm test` bloqueado pelo erro Windows `EPERM` ao resolver `node_modules/vite/dist/node/module-runner.js`.
- **Pendente:** confirmar que o e-mail configurado corresponde à conta usada e validar `/painel/admin` autenticado após publicação; a aba está deslogada, portanto a rota autenticada ainda não foi validada.

### Atalho de URL administrativa (15/11/2026)
- A captura de produção abriu `/login/admin`, caminho inexistente; a rota implementada é `/painel/admin`.
- `/painel/admin` foi confirmado carregando em produção com a conta Joel como `Admin` e dois usuários listados.
- Criado alias `/login/admin` que redireciona à rota administrativa real; autenticação e autorização permanecem aplicadas na rota de destino.

---

## Auditoria de frontend — 15/11/2026

Auditoria completa solicitada por Joel, **sem alterar código funcional, sem commit, sem publicar e sem deploy**. Objetivo: avaliar qualidade e oportunidades de melhoria do frontend com evidência reproduzível.

### Escopo e método
- Leitura prévia de `AGENTS.md`, `diretorio-geral.md`, `estado-atual.md`, `bugs-e-dificuldades.md`, `SDD-PRD-link-bio-mvp.md` e `SYSTEM_DESIGN_LINKIA.md`; inspeção de `git status` (alterações do usuário preservadas) e da estrutura de `src/`.
- Skill visual `design-taste-frontend` (tasteskill 2.5.1) instalada via `npx skills add Leonxlnx/taste-skill` em `.agents/skills/design-taste-frontend`; `SKILL.md` e `references/system.md` lidos. A skill é voltada a landing/company sites, então foram aplicados apenas os princípios transferíveis (hierarquia, alvos de toque, foco visível, contraste, consistência), sem impor "uma seção por tela".
- Inspeção de UI em Chrome headless via CDP (sem dependências novas), com medições de landmarks, headings, contraste (WCAG), alvos de toque, overflow, foco e ordem de Tab.
- Público: `http://127.0.0.1:3000` (`/`, `/login`, `/termos-de-uso`, `/politica-de-privacidade`, `/soueujoe`, `/soueujoe/agendar`, 404), em 1440×900 e 390×844, temas escuro e claro.
- Painel autenticado: build de produção standalone em `127.0.0.1:3100` com **cópia** do SQLite em `DATA_DIR` temporário (usuário demo promovido a `admin` apenas na cópia) e cookie de sessão assinado com o `SESSION_SECRET` local. O banco real `data/linkia.db` não foi alterado.
- Telas do painel auditadas: gate legal, editor desktop (escuro/claro), seções abertas, abas Editar/Prévia no mobile, `/painel/trafego` e `/painel/admin` (desktop e mobile).

### Pontos fortes observados
- Layout responsivo sem overflow horizontal em todas as rotas medidas (1440 e 390).
- Página pública `/soueujoe` com estrutura correta (`h1` único, um `main`/`header`/`footer`), CTAs de 64px de altura e contraste 8,65:1.
- Tema claro/escuro consistente, sem "flash" de tema (script de inicialização no `layout.tsx`) e fallback sólido quando `backdrop-filter` não existe.
- Editor mostra estados reais de carregamento e erro, sem inventar progresso; mensagens de erro de integração chegam sanitizadas (nenhum JSON cru ou detalhe interno exposto).
- No mobile, ao alternar para Prévia o editor recebe `display: none` — não há foco fantasma em campos ocultos.
- `/painel/admin` com 3 usuários e chips de permissão legíveis (13px, contraste 4,61:1) em desktop e mobile.
- Gate legal com `h1` correto e foco/estrutura previsíveis.

### Problemas encontrados (detalhe e evidência em `bugs-e-dificuldades.md`, AUD-001 a AUD-015)
- **P1:** modal de agendamento sem foco inicial, sem armadilha de foco, sem `Escape` e sem bloqueio de rolagem; Tab percorre o fundo da página com o modal aberto (AUD-002).
- **P2:** landmarks duplicados na home e no painel (`main`/`header` 2×), porque `PublicProfileView` mantém `<main>/<header>/<footer>` no modo `isPreview` (AUD-001); editor sem `h1` e seções em `SPAN` (AUD-007); contraste 3,63:1 no selo da home (AUD-003); `.section-title` sem CSS, gerando dois tamanhos para o mesmo título (AUD-004); tráfego pago mostrando "Conectado" e "sem autorização" ao mesmo tempo (AUD-008); cabeçalho mobile de 269px + barra de perfil de 159px empurrando o primeiro campo para `top: 934` (AUD-009); alvos de toque de 33–40px (AUD-010); `npm run lint` quebrado por varrer `.agents` (AUD-012); host `linka.infinito.com.br` no rodapé contra `linkia.iainfinito.com.br` na documentação (AUD-013).
- **P3:** input de avatar 1×1 focável antes do botão "Enviar imagem" (AUD-006); `.public-social-*` repetido 4× no CSS (AUD-005); grade de recursos 2+1 na home (AUD-011); diálogo de exclusão com `aria-modal="false"` e foco em `BODY` (AUD-014).

### Validações realmente executadas
- `npm run typecheck`: **passou**.
- `npm test`: **8 arquivos / 69 testes passaram**.
- `npm run build`: **sucesso** (~5s de compilação + TypeScript), com 2 warnings de tracing dinâmico em `src/lib/db.ts` (`DATA_DIR`).
- `npm run lint`: **falhou (exit 1)** — 15 erros e 241 warnings, todos em `.agents/skills/design-taste-frontend/assets/**`; em `src/`, apenas 4 warnings `@next/next/no-img-element`. Não é regressão de código do produto (AUD-012).
- Servidor de produção standalone: `/api/health` 200; `/soueujoe` 200; `/soueujoe/agendar` 200; `/painel/admin` como cliente → 307 para `/painel`.
- Erro de integração reproduzido: `ConnectedAccount_ToolkitMismatch` (conta `ca_zF8pU19BbQef` pertence ao toolkit `facebook`, não `metaads`), apresentado na UI sem detalhe interno.

### Limitações desta auditoria
- Sem Lighthouse, INP, LCP, CLS ou medição de memória/render; as conclusões de performance são qualitativas (peso de CSS, duplicação de regras).
- O painel autenticado foi auditado no **build de produção standalone**, com banco temporário; o ciclo de recarregamento observado no `next dev` (Turbopack) não foi reproduzido em produção e ficou registrado como atrito de ambiente (AUD-015), não como bug de produto.
- Nenhum OAuth real (Meta Ads, Google Agenda, canais sociais) foi concluído; as telas de conexão foram avaliadas apenas em estado desconectado/erro.
- Leitor de tela real (NVDA/VoiceOver) não foi usado; as conclusões vêm da árvore semântica e da ordem de foco no DOM.
- Não foi avaliado Docker Linux nem o ambiente Coolify.

### Próximo passo sugerido
1. Corrigir AUD-002 (modal de agendamento) — maior impacto e escopo pequeno e isolado.
2. Corrigir AUD-001 (landmarks no modo `isPreview`) e AUD-007 (`h1` do editor), que compartilham a mesma área.
3. Adicionar `".agents/**"` ao `globalIgnores` do `eslint.config.mjs` para restaurar o gate de lint (AUD-012).
4. Tratar AUD-003, AUD-004, AUD-009 e AUD-013 (contraste, CSS ausente, chrome mobile, host) antes de nova publicação.
5. Consolidar `public-profile.css` (AUD-005) em mudança separada, comparando capturas antes/depois.

> **Atualização (15/11/2026):** AUD-007, AUD-012 e AUD-014 foram corrigidos na reorganização do editor de perfil (menu **Profile**, seções sob demanda, `h1` do perfil e diálogo de exclusão acessível). Os demais achados permanecem abertos. Ver `bugs-e-dificuldades.md` e a seção "Editor de perfil reorganizado" acima.

### Retomada da auditoria do frontend (16/11/2026)
- **Estado encontrado:** a auditoria base (AUD-001 a AUD-015) e os registros do editor reorganizado (EDIT-001 a EDIT-004) já estavam documentados. O commit local fa13140 adiciona uma reorganização extensa do editor e atualiza parte desses documentos; main local está um commit à frente de origin/main. Esse estado não prova publicação em produção.
- **Skill visual:** design-taste-frontend já existe em .agents/skills/design-taste-frontend; skills-lock.json confirma origem Leonxlnx/taste-skill. A skill e a referência references/system.md foram lidas na auditoria anterior. A nova tentativa de npx skills add Leonxlnx/taste-skill falhou com ENOTFOUND registry.npmjs.org; não houve nova instalação. Foram usados somente princípios aplicáveis a um painel SaaS, sem impor o formato de landing page da skill.
- **Verificações no estado atual:** npm run typecheck passou; npm run lint passou sem erros e com quatro avisos @next/next/no-img-element. npm test não iniciou por EPERM ao carregar a configuração do Vitest. npm run build falhou porque o SWC não conseguiu canonicalizar/acessar o diretório do workspace (Acesso negado, erro 5). Esses dois bloqueios impedem confirmar a compilação e os testes do commit local nesta sessão.
- **Escopo visual atual:** a medição visual detalhada existente refere-se ao baseline anterior à reorganização do editor. O commit local mudou componentes centrais do painel; as telas dessa versão não foram revalidadas em navegador nesta retomada. A validação anterior em produção corresponde à versão publicada e não comprova o commit local ainda não sincronizado.
- **Alterações desta retomada:** somente documentação de auditoria; nenhum código funcional foi alterado. O bloco automático Next.js em AGENTS.md, os arquivos novos do usuário e os arquivos de instalação da skill foram preservados.
- **Próximo passo:** executar o percurso desktop/mobile do editor do commit fa13140 em ambiente local que permita build e navegação, registrar PASS/FAIL/NOT_VERIFIED e então atualizar o estado dos achados sem fechar itens com base apenas em leitura do código.

### Fechamento da retomada da auditoria (16/11/2026)
- **Comparativo com a tarefa original:** o commit local `fa13140` já inclui o menu Profile com cinco seções, montagem sob demanda, skeletons, capa com controle de desfoque, Drawer de canais, estados de salvamento e ajustes da prévia. A auditoria anterior documenta os pontos concluídos e as recomendações ainda abertas; nenhum desses itens foi reimplementado nesta retomada.
- **Limitação funcional registrada:** o documento `docs/4. Agendamento (Google Agenda).md` pede dois intervalos (08:00–12:00 e 13:00–18:00) nos três modelos. O commit `fa13140` ainda aplica 08:00–18:00 contínuo. Isso permanece como recomendação de implementação posterior (EDIT-001), fora do escopo desta auditoria; os horários atuais não foram alterados.
- **Conferência visual em produção:** em 16/11, o painel aberto em `https://linkia.iainfinito.com.br/painel` ainda mostrou a estrutura anterior do editor (seções em acordeão e Catálogo na mesma página). Como `fa13140` não está no `origin/main`, a tela de produção não foi usada como validação desse commit.
- **Tentativa de validação local:** `npm run dev -- --hostname 127.0.0.1 --port 3000` não ficou acessível; a verificação HTTP retornou bloqueio de permissão de socket do ambiente. O percurso visual do commit atual continua `NOT_VERIFIED`.
- **Verificações executadas nesta retomada:** `npm run typecheck` passou; `npm run lint` passou com quatro avisos existentes de `<img>`; `npm test` não iniciou por `EPERM` ao resolver módulo do Vitest; `git diff --check` passou. A falha de build por acesso/canonicalização do caminho Windows segue registrada acima.
- **Publicação do código:** commit `032870492cf6eecb7ee0b2307b44131d69c36ef0` enviado para `main` em 16/11. O workflow `Publish LinkIA Coolify Image` iniciou o build da imagem; o gatilho do Coolify ainda estava pendente na última consulta. Nenhum deploy manual foi executado.
- **Decisão e próximo passo:** não implementar melhorias funcionais nesta fase, conforme o prompt de auditoria. Após o workflow concluir, confirmar que o deploy terminou e repetir o percurso visual em desktop/mobile. Abrir uma tarefa separada para EDIT-001 e os demais achados priorizados.

### Correção do seletor de seções (16/11/2026)
- **Escopo:** correção pontual do dropdown Profile, conforme `docs/Dropdawn Menu.md` e as imagens fornecidas.
- **Causa confirmada:** o seletor era filho da barra de ações do editor; o painel seguinte cobria visualmente o menu aberto. A referência posiciona o seletor ao lado dos perfis publicados.
- **Correção:** seletor renderizado no espaço ao lado da lista de perfis, mantendo opções, comportamento de teclado e navegação. Arquivos: `src/app/painel/page.tsx`, `src/components/panel/ProfileEditor.tsx`, `src/components/panel/PublishStatus.tsx` e `src/components/panel/panel.css`.
- **Ajuste responsivo:** o menu agora mantém largura legível em viewport estreita e se alinha pela borda direita para não sair da tela. A página pública usa espaçamento fluido, títulos e rótulos maiores e links com área de toque mínima de 64px em telas de até 480px (`src/components/panel/panel.css`, `src/components/public/public-profile.css`).
- **Validação:** `npm run typecheck` passou; `npm run lint` passou com quatro avisos preexistentes de `<img>`. `npm test` bloqueado por EPERM ao resolver `node_modules/vite` no ambiente Windows. Visualização local não confirmada nesta execução.
- **Próxima ação:** após sincronizar o commit, conferir o painel publicado em desktop e mobile.
