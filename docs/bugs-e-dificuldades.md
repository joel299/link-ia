# Bugs e dificuldades — LinkIA

**Última atualização:** 13/11/2026  
**Status do registro:** Correções de callback OAuth e publicação `422` publicadas; perfil `/soueujoe` e disponibilidade pública validados. Criação de evento real no Google Calendar ainda pendente.

## Como usar este arquivo

Registrar aqui cada bug ou dificuldade técnica encontrada durante o trabalho. Não registrar hipóteses como causas confirmadas. Não apagar problemas antigos após a correção; acrescentar a evidência e manter o histórico.

## Registro inicial (histórico preservado)

### Nenhum bug confirmado (12/11/2026 — pré-implementação)

- **Estado:** informativo (histórico).
- **Evidência:** na fase inicial existiam apenas documentos de produto e design, sem implementação para executar ou testar.

---

## Ocorrências registradas

### BUG-001 — Erro de lint com ESLint 9 + Next 16 e `react-hooks/set-state-in-effect`
- **Data:** 12/11/2026
- **Estado:** corrigido
- **Correção aplicada:** `eslint.config.mjs` migrado para flat config nativo do Next 16; hooks e `<Link />` ajustados.
- **Validação:** `npm run lint` com 0 erros.

### BUG-002 — Segredo de sessão com fallback hardcoded em produção (Code Review Grave #1)
- **Data:** 12/11/2026
- **Estado:** corrigido
- **Correção aplicada:** `getSessionSecret()` exige `SESSION_SECRET` (`>= 16` chars) em `NODE_ENV === "production"`.

### BUG-003 — Falta de validação de tipo em runtime no `PATCH /api/profiles/[id]` (Code Review Grave #2)
- **Data:** 12/11/2026
- **Estado:** corrigido
- **Correção aplicada:** `isValidProfilePatchPayload` retornando HTTP 400.

### BUG-004 — Quebras de contrato entre Frontend e Backend na feature Google Calendar + Composio
- **Data:** 12/11/2026
- **Estado:** corrigido
- **Sintoma e impacto:** Code Review identificou 3 bloqueadores: (1) `PublicBookingView` enviava `clientEmail` enquanto `/bookings` lia `clientContact`; (2) `GoogleCalendarPanel` lia `authorizeUrl` enquanto `/connect` retornava `redirectUrl`; (3) `/oauth-mock` enviava `mock_status` enquanto `/callback` lia `status`, e `/callback` redirecionava para `/editor/[id]` (inexistente) em vez de `/painel`. Também foram corrigidos: validação de `expectedComposioUserId` no callback, `horizonDays` na resposta de `/availability`, `idempotencyKey` estável por tentativa em `PublicBookingView`, índice único parcial `idx_bookings_active_slot` contra corrida simultânea e validação de tipos em `upsertBookingSettings`.
- **Validação:** `npm run lint` (0 erros), `npm run typecheck` (0 erros), `npm test` (20/20), `npm run build` e revalidação QA HTTP em `http://localhost:3000` (7/7 itens aprovados).

### BUG-005 — Seção/botão "Agendar horário" ausente no perfil público mesmo com agenda conectada
- **Data:** 12/11/2026
- **Estado:** corrigido
- **Causa raiz confirmada:** No banco local (`data/linkia.db`), o perfil `soueujoe` estava com `calendar_connections.status = 'connected'`, WhatsApp válido e `profiles.status = 'published'`, porém `booking_settings.enabled = 0`. No painel, alternar o switch `"Agendamento público ativo"` em `GoogleCalendarPanel.tsx` alterava apenas o estado local sem persistir automaticamente, e os botões **"Salvar alterações"** / **"Publicar"** de `ProfileEditor.tsx` chamavam somente `PATCH /api/profiles/[id]`, sem salvar `PUT /api/profiles/[id]/booking-settings`. Além disso, `GoogleCalendarPanel.tsx` tinha dependência incompleta de `useCallback` (`connection?.status` em vez de `connection`).
- **Correção aplicada:** `GoogleCalendarPanel.tsx` recebeu `saveBookingRef`, refatorou `persistSettings`, passou a salvar automaticamente ao alternar `"Agendamento público ativo"` e corrigiu a dependência de `useCallback`; `ProfileEditor.tsx` passou a invocar `saveBookingRef.current()` dentro de `saveProfile()`; `PublicProfileView.tsx` padronizou o texto fallback para `"Agendar horário"`; `PublicBookingView.tsx` atualizou o CTA final para `"Falar com {professionalName} no WhatsApp"`.
- **Validação:** `npm run lint` (0 erros), `npm run typecheck` (0 erros), `npm test` (21/21), `npm run build` (16 rotas), leitura real `GOOGLECALENDAR_FREE_BUSY_QUERY` via Composio (`successful: true`) e verificação HTTP em `http://localhost:3000`.

### BUG-006 — `net::ERR_CONNECTION_REFUSED` no painel por ausência de servidor na porta 3000 e ausência de botão "Tentar novamente" no catálogo
- **Data:** 13/11/2026
- **Estado:** corrigido
- **Reprodução e causa raiz comprovada:**
  - Após a preparação do build Docker para o Coolify, o processo local do Next.js na porta `3000` havia sido encerrado (`netstat -ano | Select-String ":3000"` sem listeners). Com a aba `http://localhost:3000/painel` aberta ou parcialmente em cache no navegador, as requisições relativas `fetch("/api/profiles/${profileId}/integrations/google-calendar")`, `fetch("/api/profiles/${profileId}/booking-settings")` e `fetch("/api/profiles/${profileId}/catalog")` falharam com `net::ERR_CONNECTION_REFUSED` antes de obter resposta HTTP.
  - Não havia erro de hostname, porta ou proxy no código nem no Docker Compose (`compose.yaml` e `docker-compose.coolify.yml` servem o app e `/api/*` no mesmo processo na porta `3000`).
  - Adicionalmente, `CatalogPanel.tsx` exibia `"Erro de conexão ao carregar o catálogo."` sem botão **"Tentar novamente"** (diferente de `PainelPage` e `GoogleCalendarPanel.tsx`).
- **Correção aplicada e decisão técnica:**
  - `src/components/panel/CatalogPanel.tsx`: extraído `fetchCatalog` (`useCallback`) e `handleRetryLoad`, adicionando o botão **"Tentar novamente"** ao banner de erro de carregamento para permitir recuperação sem recarregar a página após indisponibilidade transitória.
  - Servidor local reiniciado em `http://localhost:3000` (`npm run dev`) e mantido ativo.
- **Validação:** `npm run lint` (0 erros), `npm run typecheck` (0 erros), `npm test` (24/24), `npm run build` (sucesso) e chamadas HTTP autenticadas em `http://localhost:3000` retornando HTTP `200` para `/api/health`, `/api/profiles/{id}/integrations/google-calendar`, `/api/profiles/{id}/booking-settings`, `/api/profiles/{id}/catalog`, `/soueujoe` e `/soueujoe/agendar`.

### BLOQ-001 — Automação de navegador via Chrome DevTools indisponível no host
- **Data:** 12/11/2026
- **Estado:** bloqueado (dependência externa de ambiente)
- **Sintoma e impacto:** O subagente `browser` não conseguiu conectar ao Chrome (`Could not find DevToolsActivePort ... ENOENT`).
- **Próximo passo:** Abrir `http://localhost:3000` manualmente ou habilitar `chrome://inspect/#remote-debugging` no Chrome.

### BLOQ-002 — Credenciais Composio (`COMPOSIO_API_KEY` e `COMPOSIO_GOOGLE_CALENDAR_AUTH_CONFIG_ID`)
- **Data:** 12/11/2026
- **Estado:** parcialmente resolvido (Connect Link real validado; consentimento Google OAuth depende de login interativo)
- **Evidência atual:** `.env` criado localmente a partir de `.env.example` (com `SESSION_SECRET` gerado localmente, sem expor segredos). `POST /api/profiles/:id/integrations/google-calendar/connect` retornou HTTP `200` com `isMock: false` e URL real em `connect.composio.dev` para dois profissionais distintos, e acesso cruzado retornou `403`.
- **Próximo passo:** Autorizar uma conta Google real no navegador em `http://localhost:3000/painel` para validar o callback OAuth real, FreeBusy e criação real de evento no Google Calendar.

### BUG-007 — Callback OAuth usa endereço interno do container
- **Data:** 13/11/2026
- **Estado:** correção publicada; nova autorização Google pendente.
- **Sintoma e evidência:** após o consentimento Google, a URL de retorno mostrada no navegador aponta para `0.0.0.0:3000`, resultando em `ERR_ADDRESS_INVALID`.
- **Causa confirmada:** a rota de conexão criava o callback com `new URL(request.url).origin`, que neste deploy refletiu o endereço interno do serviço. Coolify já tem `APP_BASE_URL=https://linkia.iainfinito.com.br`.
- **Correção:** centralizado `getAppBaseUrl()` para priorizar `APP_BASE_URL`; a rota que cria o Connect Link e todos os redirecionamentos finais do callback usam essa origem pública.
- **Validação:** GitHub Actions concluiu build/publicação e Coolify recebeu o webhook; domínio público e `/api/health` responderam HTTP 200 com TLS válido. A validação OAuth real ainda requer iniciar outra conexão (o link antigo continua apontando para o endereço inválido) e confirmar o retorno ao painel.

### BUG-008 — Publicação rejeitada por exigir URL externa removida do editor
- **Data:** 13/11/2026
- **Estado:** corrigido e publicado.
- **Sintoma e evidência:** `POST /api/profiles/:id/publish` retorna HTTP 422 mesmo com nome, slug, WhatsApp e agenda interna válidos; DevTools registra a requisição no host público e resposta 422.
- **Causa confirmada no código:** `validateProfileForPublish()` exigia `bookingUrl` HTTPS quando `bookingEnabled=true`, mas o editor não oferece mais URL externa e a página pública usa somente `internalBookingEnabled`. Além disso, `createProfile()` iniciava `booking_enabled` como `1` sem uma URL.
- **Correção:** removida da publicação a validação do campo externo obsoleto; novos perfis agora começam com `booking_enabled=0`. Adicionado teste de regressão para publicar perfil legado sem `bookingUrl`.
- **Validação:** `npm test` (25/25), `npm run typecheck`, `npm run lint` (4 avisos pré-existentes de `<img>`), build Docker no GitHub Actions e webhook Coolify concluídos. Perfil `/soueujoe` publicado pelo painel; `/soueujoe` e `/soueujoe/agendar` retornaram HTTP 200 com TLS válido; disponibilidade para `2026-11-16` retornou horários. Não foi criado evento no Google Calendar.

### BUG-009 — Erro HTTP 400 ao iniciar conexão WhatsApp Business via Zernio ("Conectar meu WhatsApp Business")
- **Data:** 15/11/2026
- **Estado:** corrigido e validado localmente
- **Reprodução e evidência:**
  - `POST http://localhost:3000/api/profiles/fbba6913-2780-47cf-9ea4-72a0853e2548/integrations/whatsapp/connect` retornava HTTP `400` (`{"error":"A Zernio retornou erro (400) ao iniciar a conexão WhatsApp."}`).
  - Chamada subsequente do backend à Zernio (`GET https://zernio.com/api/v1/connect/whatsapp`) usando o ID sintético `linkia_u_{ownerId}_p_{profileId}` retornou HTTP `400` (`x-request-id: 1a382787-6e55-4dd9-99dc-c6fb64f0186d`, corpo: `{"error":"Invalid profileId format","type":"invalid_request_error","code":"invalid_field_value","param":"profileId"}`).
  - Chamada com `profileId` real da Zernio (ObjectId de 24 caracteres hex) retornou HTTP `200` com `authUrl` válida (`https://www.facebook.com/v22.0/dialog/oauth?...` e `featureType: "whatsapp_business_app_onboarding"`).
- **Causa confirmada:** `initiateWhatsAppConnection` em `src/lib/zernio-whatsapp.ts` enviava `buildZernioProfileId(ownerId, profileId)` (`linkia_u_..._p_...`) diretamente como `profileId` na query de `GET /v1/connect/whatsapp`, em vez de criar/obter um perfil real na Zernio via `POST /v1/profiles` / `GET /v1/profiles` e persistir seu `_id`. Além disso, erros `4xx` da Zernio eram convertidos em mensagem genérica `400` sem logar `x-request-id` ou mapear códigos específicos (`401`/`402`/`404`/`redirect_url`/conflitos).
- **Correção aplicada:**
  - `DefaultZernioWhatsAppProvider.ensureProfile()` resolve ou cria o perfil real na Zernio (`GET /v1/profiles` por `externalId` -> `POST /v1/profiles` com `Idempotency-Key` e tratamento de `409 Conflict` via `details.existingProfileId`) e persiste o `_id` em `whatsapp_connections.zernio_profile_id`.
  - `mapZernioHttpError()` registra detalhes sanitizados + `x-request-id` apenas nos logs do servidor e retorna mensagens claras em pt-BR para `401`/`402`/`404`, `redirect_url` inválido e conflitos de número.
  - Callback (`/api/integrations/whatsapp/callback` + `completeWhatsAppCallback`) e `ConnectedChannelsPanel.tsx` atualizados para `connected=whatsapp`, `profileId`, `accountId`, `username`, códigos de conflito/cancelamento e botão **"Tentar novamente"** no card existente de **Canais conectados**, preservando o link público de WhatsApp em **Links de ação**.

### BUG-010 — Falha na sincronização do Instagram via Composio (`ig_user_id` ausente) e vazamento de erros técnicos no painel
- **Data:** 15/11/2026
- **Estado:** corrigido e validado localmente
- **Reprodução e evidência:**
  - Conta `@iainfinito` (`ca_Z3LA9Z71FPjz`) aparecia como conectada, mas ao clicar em **"Sincronizar mídias"**, `social_connections.last_error` registrava e exibia no painel a mensagem técnica `Invalid request data provided - Following fields are missing: {'ig_user_id'}`.
  - Inspeção do schema real do toolkit `instagram` no `@composio/core` confirmou que `INSTAGRAM_GET_IG_USER_MEDIA` exige `ig_user_id` (além de `limit` e `after`), enquanto `INSTAGRAM_GET_USER_INFO` aceita `ig_user_id: "me"` e retorna `id` (`27065993403074843`), `username`, `account_type` e `media_count`.
- **Causa confirmada:** `fetchInstagramMedia()` em `src/lib/composio-social.ts` não recebia nem repassava `ig_user_id` na chamada `INSTAGRAM_GET_IG_USER_MEDIA`, não suportava paginação `after` nem extração de `like_count`/`comments_count`, e `syncSocialMedia()` / `completeSocialOAuthCallback()` persistiam e retornavam `err.message` bruto do provedor sem sanitização.
- **Correção aplicada:**
  - `fetchInstagramUserInfo()` usa `ig_user_id: "me"` com `fields` explícitos e rejeita fallback com `username`; `syncSocialMedia()` resolve e persiste `selected_asset_id` antes de sincronizar ou marca `"Conectada; sincronização pendente..."` quando não resolvido.
  - `fetchInstagramMedia()` exige `igUserId` válido, passa `ig_user_id` + `limit: 3` + paginação `after` (até 3 itens mais recentes) e extrai `likeCount`/`commentCount` preservando `null` quando indisponível (sem fabricar `0`).
  - `profile_social_media` ganhou colunas `like_count` e `comment_count` (`src/lib/db.ts`, `src/lib/types.ts`, `src/lib/profiles.ts`), exibidas em `ConnectedChannelsPanel.tsx` e `PublicSocialSection.tsx`.
  - Sanitização centralizada via `mapSocialProviderError()` e `sanitizeStoredSocialError()` com `correlationId` apenas em logs do servidor, preservação das mídias em cache e de `last_synced_at` em caso de falha, e botões **"Tentar novamente"** / **"Reconectar"** no painel.

## Riscos e questões em aberto — não são bugs

### RISCO-001 — Integração com mídia do Instagram
- **Estado:** risco conhecido; fora do primeiro corte.

### RISCO-002 — Ambiente Qualify e execução Docker em Linux ainda não confirmados
- **Estado:** pendente de descoberta/validação.

### RISCO-003 — Ausência de rate limiting em rotas de autenticação, reserva e upload
- **Estado:** pendência de segurança pré-produção.

### RISCO-004 — Meta Ads exige Meta App próprio e aprovação de permissões da Marketing API
- **Data:** 15/11/2026
- **Estado:** documentado e mitigado com validação/criação sob demanda de auth config.
- **Detalhes:** O toolkit `metaads` no Composio (`@composio/core`) não oferece OAuth gerenciado (`managed: []`) e exige `OAUTH2` com `client_id` (`META_ADS_CLIENT_ID`), `client_secret` (`META_ADS_CLIENT_SECRET`) e callback exata cadastrada no Meta for Developers (`https://backend.composio.dev/api/v1/auth-apps/add` por padrão, ou `COMPOSIO_META_ADS_REDIRECT_URI`). O fluxo foi isolado no servidor em `src/lib/meta-ads-config.ts` e `POST /api/profiles/[id]/ads/meta_ads/setup`, evitando criação automática no boot e duplicação de auth configs no Composio. Ver `docs/META_ADS_SETUP.md`.
