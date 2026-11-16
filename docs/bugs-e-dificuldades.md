# Bugs e dificuldades — LinkIA

**Última atualização:** 15/11/2026  
**Status do registro:** Correções finais do painel, página pública, links personalizados, ordenação da prévia, restrição de tráfego pago a perfis publicados e reorganização do editor em cinco seções sob demanda implementadas e validadas (`npm test` 69/69, `typecheck`, `lint`, `build`). Criação de evento real no Google Calendar, teste em Docker Linux e percurso visual em navegador seguem pendentes.

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

### BUG-011 — Duplicação de blocos de WhatsApp/Instagram/Facebook entre sessões e exibição de termos técnicos na UI
- **Data:** 15/11/2026
- **Estado:** corrigido e validado localmente
- **Causa confirmada:** `ProfileEditor.tsx` mantinha uma seção "2. Links de ação" (com campos públicos de WhatsApp e Instagram) separada da seção 6 ("Canais conectados"), enquanto `PaidTrafficPanel.tsx` duplicava botões de conexão/desconexão para `meta_ads` (Facebook) e textos técnicos internos ("Zernio", "Composio", "Cloud API", nomes de variáveis de ambiente) eram exibidos ao usuário.
- **Correção aplicada:**
  - Consolidado tudo em **2. Canais conectados** (`ConnectedChannelsPanel.tsx` com `#canais-conectados`), preservando os campos de link público de WhatsApp e Instagram dentro de seus respectivos canais e incluindo o canal Facebook (`meta_ads`).
  - Removidos os botões duplicados de conexão do Facebook em `PaidTrafficPanel.tsx`, com link direto para `/painel#canais-conectados` e sanitização de erros em `src/lib/ads-service.ts` e `src/lib/zernio-whatsapp.ts`.
  - Criado `src/lib/integration-cleanup.ts` (`cleanupStaleIntegrationStates`) para limpeza idempotente de estados OAuth expirados e tentativas antigas sem apagar conexões válidas.

### BUG-012 — Falha em Meta Ads (`ConnectedAccount_ToolkitMismatch` / code 633) e mistura entre Facebook social e Meta Ads
- **Data:** 15/11/2026
- **Estado:** diagnóstico concluído; tratamento de erro, separação na UI e filtro de período implementados; pendente ajuste externo da auth config `metaads` no `.env`
- **Causa confirmada:**
  - Em inspeção ao vivo no Composio, `COMPOSIO_META_ADS_AUTH_CONFIG_ID` no `.env` local aponta para uma auth config do toolkit **`facebook`** (e não `metaads`), fazendo com que contas conectadas via esse fluxo pertençam ao toolkit `facebook`. Ao executar `METAADS_GET_AD_ACCOUNTS`, a API retorna HTTP 400 (`code: 633`, `slug: "ConnectedAccount_ToolkitMismatch"`).
  - `sanitizeAdsErrorMessage` lia apenas `err.message`, ocultando `err.cause.details` nos logs de servidor e exibindo erro genérico ao usuário; além disso, `PaidTrafficPanel.tsx` rotulava a aba como "Facebook / Meta Ads" e redirecionava a conexão para a sessão 2.
- **Correção aplicada:**
  - `src/lib/ads-service.ts`: extração profunda de detalhes (`extractDeepAdsErrorText`) para log seguro no servidor e mapeamento explícito de `ConnectedAccount_ToolkitMismatch` (HTTP 409) orientando reconexão em Tráfego pago; adição de `validateAdsDateRange` e suporte a `date_preset` / `time_range` (sem envio simultâneo) em `METAADS_GET_INSIGHTS` e `effective_status` explícito sem `DELETED` em `METAADS_LIST_CAMPAIGNS`.
  - `src/components/panel/PaidTrafficPanel.tsx` e `src/components/panel/ConnectedChannelsPanel.tsx`: separação clara entre **Facebook** (sessão 2) e **Meta Ads** (aba Tráfego pago, com botões próprios de Conectar/Reconectar/Desconectar e seletor de período), além de botão `"Remover número"` no caminho 2 do WhatsApp.
  - `src/components/public/PublicProfileView.tsx`, `PublicSocialSection.tsx`, `public-profile.css`: seção de destaques do Instagram movida para acima de "Serviços e produtos", carrossel horizontal touch no mobile sem barra de rolagem visível, badge `"Reel"` singular e estado pendente sem dados fictícios.
- **Ação externa pendente:** Atualizar `COMPOSIO_META_ADS_AUTH_CONFIG_ID` no `.env` (e ambiente de deploy) para uma auth config OAuth2 do toolkit `metaads` (usando `META_ADS_CLIENT_ID` e `META_ADS_CLIENT_SECRET`) e reconectar o perfil na aba Tráfego pago -> Meta Ads.

### PENDÊNCIA-LEGAL-001 — Minutas de Termos de Uso e Política de Privacidade pendentes de dados empresariais e revisão jurídica
- **Data:** 15/11/2026
- **Estado:** bloqueio de publicação definitiva (exibido explicitamente como minuta `0.1-minuta` em desenvolvimento)
- **Detalhes:**
  - Páginas públicas `/termos-de-uso` e `/politica-de-privacidade` e fluxo de aceite (`legal_acceptances` + `LegalConsentGate` no `/painel`) implementados sem inventar razão social, CNPJ, endereço, canal de privacidade, encarregado (DPO), prazos de retenção ou lista completa de subprocessadores.
  - Remoção de cadastro público e modo demonstração na página inicial (`/`), `/login`, `POST /api/auth/demo` (HTTP 403) e `POST /api/auth/register` (exige autorização administrativa via sessão `role='admin'` ou `ADMIN_PROVISION_SECRET`).
  - Antes de publicar como versão vigente (`1.0`), preencher os campos pendentes em `src/lib/legal-documents.ts` e concluir revisão jurídica.

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
- **Detalhes:** O toolkit `metaads` no Composio (`@composio/core`) não oferece OAuth gerenciado (`managed: []`) e exige `OAUTH2` com `client_id` (`META_ADS_CLIENT_ID`), `client_secret` (`META_ADS_CLIENT_SECRET`) e callback exata cadastrada no Meta for Developers (`https://backend.composio.dev/api/v3/toolkits/auth/callback` por padrão, ou `COMPOSIO_META_ADS_REDIRECT_URI`). O fluxo foi isolado no servidor em `src/lib/meta-ads-config.ts` e `POST /api/profiles/[id]/ads/meta_ads/setup`, evitando criação automática no boot e duplicação de auth configs no Composio. Ver `docs/META_ADS_SETUP.md`.

### META-OAUTH-001 - Callback de Meta Ads divergente entre provedor e LinkIA
- **Data:** 15/11/2026
- **Estado:** correção local preparada; URI v3 salva no Meta Developers; a Auth Config do Composio depende das credenciais Meta para ser atualizada/criada.
- **Evidência:** código usa `/api/integrations/social/callback` como retorno do produto e a documentação do deploy confirma `https://linkia.iainfinito.com.br` como origem. A tela Meta Developers mostra uma URI OAuth cadastrada em outro domínio/provedor (`signature.iainfinito.com.br/v1/oauth/callback`).
- **Correção local:** fixar e validar a URI do Composio em `https://backend.composio.dev/api/v3/toolkits/auth/callback`; restringir `LINKIA_META_ADS_RETURN_URL` à rota de callback no domínio de `APP_BASE_URL`; atualizar `.env.example` e runbook.
- **Limite:** o aplicativo Meta aparece como publicado, mas a URI correta ainda não foi salva na lista de URIs OAuth válidas. A Auth Config do Composio será validada pelo setup do LinkIA; ele rejeita IDs de outro toolkit e atualiza `oauth_redirect_uri` para a URI canônica antes de reutilizar.
### META-OAUTH-001 — Revisão após tentativa em produção (15/11/2026)
- **Evidência:** a URL de autorização do navegador mostrou `redirect_uri` apontando para o domínio LinkIA. A rota de conexão não chamava `ensureMetaAdsAuthConfig`; por isso uma Auth Config existente podia manter o callback anterior.
- **Também encontrado no Coolify:** `COMPOSIO_META_ADS_REDIRECT_URI` estava no valor antigo de retorno do LinkIA, embora a variável nova de callback do provedor estivesse correta.
- **Correção preparada:** a rota Meta Ads valida e sincroniza a Auth Config `metaads` com `https://backend.composio.dev/api/v3/toolkits/auth/callback` antes de cada conexão. O valor de exemplo da variável legada foi alinhado. `callbackUrl` segue apontando para a rota de retorno do LinkIA, dentro de `APP_BASE_URL`.
- **Validação pendente:** publicar a correção e repetir o OAuth para confirmar o `redirect_uri` recebido pelo Meta e o retorno final a `/painel/trafego`.

### META-OAUTH-001 — Implantado; aguardando validação OAuth real (15/11/2026)
- **Causa confirmada:** faltava incluir o domínio LinkIA em App Domains. O `redirect_uri` presente no erro do navegador mostrava o host LinkIA no lugar do callback Composio; além disso, a rota de conexão não sincronizava a Auth Config antes de iniciar a autorização.
- **Correção aplicada:** domínio e URL do site ajustados no Meta Developers; variável legada no Coolify alinhada à URI v3; rota de conexão passou a validar/atualizar a Auth Config `metaads` a cada início de OAuth.
- **Publicação:** commit `ca390887db0957bc4a3863e07f68b7c537030f6f`; workflow GitHub Actions concluído com sucesso; imagem puxada e serviço reiniciado no Coolify, status `Running`.
- **Ainda precisa validar:** refazer o OAuth com uma conta autorizada e conferir `redirect_uri` do provedor e o retorno final para `/painel/trafego`. Não foi possível validar essa parte sem concluir o fluxo com a conta Meta do usuário.

### 15/11/2026 — Ajustes durante implementação do painel administrativo e permissões
- **Mapeamento de `meta_ads` em rotas sociais orgânicas vs tráfego pago:** `SocialProvider` utiliza `"meta_ads"` no canal Facebook de `ConnectedChannelsPanel` (`/api/profiles/[id]/integrations/social/meta_ads`). Ajustado `socialProviderToFeatureKey("meta_ads")` em `src/lib/permissions.ts` para exigir `"facebook_social"`, mantendo `"meta_ads"` separado nas rotas de tráfego pago (`/api/profiles/[id]/ads/meta_ads/**`).
- **Regras do React Compiler no ESLint:** `AdminUsersPanel.tsx` e `PaidTrafficPanel.tsx` apresentaram erros de `react-hooks/set-state-in-effect` e `react-hooks/preserve-manual-memoization`; corrigidos executando `fetch` assíncrono direto no `useEffect` (com flag `cancelled`) e removendo `useCallback` desnecessário em `loadProvider`. Validado com `npm run lint` (0 erros) e `npm run typecheck` (0 erros).

### BUG-010 - Bootstrap de administrador não reaplicado ao validar sessão
- **Data:** 15/11/2026
- **Estado:** correção local; publicação e validação autenticada pendentes.
- **Sintoma:** acesso a `/painel/admin` redirecionava com HTTP 307 apesar das variáveis de bootstrap existirem no Coolify.
- **Causa do redirecionamento confirmada:** o guard envia `role !== 'admin'` para `/painel`; o perfil autenticado não foi disponibilizado na aba para confirmar se o e-mail configurado coincide com a conta. **Lacuna de código confirmada:** o bootstrap só era reavaliado no POST de login, não na leitura da sessão.
- **Correção:** chamar o bootstrap após validar o token e antes de carregar o usuário do banco; adicionar teste cobrindo promoção de conta existente com sessão válida. A promoção ainda exige e-mail correspondente e senha bootstrap de pelo menos 8 caracteres.
- **Validação:** `npm run typecheck` passou; `npm run lint` passou com 4 avisos existentes; `npm test` bloqueado por `EPERM` do Windows ao resolver o Vite. O Coolify mostra as variáveis preenchidas/runtime e o container saudável. A confirmação do painel autenticado depende de sessão com e-mail correspondente.

### BUG-011 - URL digitada `/login/admin` retornava 404
- **Data:** 15/11/2026
- **Estado:** correção local; publicação pendente.
- **Causa confirmada:** a rota existente é `/painel/admin`; não havia rota `/login/admin`.
- **Correção:** adicionar alias `/login/admin` que redireciona para `/painel/admin`; a rota final continua exigindo sessão e papel `admin`.
- **Evidência:** `/painel/admin` abriu em produção com a conta Joel identificada como `Admin` e lista de dois usuários. A rota nova será validada após publicar.

---

## Auditoria de frontend (15/11/2026)

Auditoria solicitada por Joel, sem alteração de código funcional. Método, escopo e limitações estão em `estado-atual.md` (seção "Auditoria de frontend — 15/11/2026"). Cada item abaixo tem evidência reproduzida; nada foi registrado como causa confirmada sem observação direta.

Prioridade: **P1** = quebra de acessibilidade/fluxo essencial; **P2** = atrito relevante ou inconsistência visível; **P3** = manutenção/organização.

### AUD-001 — Landmarks duplicados na home e no painel
- **Data:** 15/11/2026
- **Prioridade:** P2
- **Estado:** aberto (não corrigido — auditoria sem implementação)
- **Evidência (build de produção, 1440×900):** `/` → `main: 2, header: 2, footer: 2, nav: 2`; `/painel` com editor aberto → `main: 2, header: 2`; `/soueujoe` → `main: 1, header: 1, footer: 1` (correto).
- **Causa confirmada:** `src/components/public/PublicProfileView.tsx` sempre renderiza `<main className="public-profile-container">`, `<header>` e `<footer>` (linhas 222–256), inclusive quando recebe `isPreview`. Esse componente é embutido em `src/app/page.tsx` (~linha 186, seção "Exemplo de página pública") e no `ProfilePreview` do editor.
- **Impacto:** leitor de tela anuncia dois "main" e dois cabeçalhos na mesma página; a navegação por regiões fica ambígua.
- **Correção sugerida:** quando `isPreview`, renderizar `div`/`section` com `role="group"` e rótulo, mantendo `main`/`header`/`footer` só na página pública real.

### AUD-002 — Modal de agendamento sem gestão de foco, sem Esc e sem bloqueio de rolagem
- **Data:** 15/11/2026
- **Prioridade:** P1
- **Estado:** aberto
- **Evidência (390×844, fluxo real: dia → horário → modal):** ao abrir, `document.activeElement` permanece `BODY`; 12 pressionamentos de Tab percorrem o fundo ("← Voltar para o perfil", botões dos dias 16–27, `select` de fuso horário) em vez do conteúdo do modal; `getComputedStyle(body).overflow` e `html` = `visible`; a página rola com o modal aberto (`scrolledWithModal: true`); `Escape` não fecha (`modalAfterEscape: true`).
- **Causa provável (código):** `src/components/public/PublicBookingView.tsx` tem apenas um `useEffect` (linha 343) e nenhum listener de `keydown`, `overflow` no `body`, foco inicial ou restauração de foco.
- **Impacto:** WCAG 2.4.3 (ordem de foco), 2.1.2 (sem armadilha de teclado) e 1.4.10; usuário de teclado/leitor de tela pode confirmar o agendamento sem nunca alcançar o modal.
- **Correção sugerida:** mover foco para o primeiro elemento do modal ao abrir, prender o foco (`Tab`/`Shift+Tab`), fechar com `Escape` e clique no backdrop, aplicar `overflow: hidden` no `body` e restaurar o foco no gatilho ao fechar.

### AUD-003 — Contraste 3,6:1 no selo da home (tema claro)
- **Data:** 15/11/2026
- **Prioridade:** P2
- **Estado:** aberto
- **Evidência:** `span` "LinkIA · Página de Bio Profissional" com `color: #9a762f` sobre `#eaf0eb`, 13px/700 → **3,63:1**, abaixo do mínimo 4,5:1 para texto pequeno.
- **Arquivo:** `src/app/page.tsx` (linhas ~62–77, tokens `--color-accent`/`--color-border`).
- **Correção sugerida:** escurecer o dourado no tema claro (ex.: `#7a5c22`) ou aumentar tamanho/peso para dispensa de contraste.

### AUD-004 — Classe `.section-title` usada sem nenhuma regra CSS
- **Data:** 15/11/2026
- **Prioridade:** P2
- **Estado:** aberto
- **Evidência:** `src/app/painel/trafego/page.tsx` usa `className="section-title"` em três títulos (linhas 121, 165, 201); `src/app/globals.css` não contém `section-title`. Medido em `/painel/trafego`: `h2` 24px com margem 19,92px e `h1` inline 21,6px — mesma classe, tamanhos diferentes.
- **Impacto:** hierarquia de títulos inconsistente entre estados da mesma tela.
- **Correção sugerida:** criar a regra no `globals.css` (ou substituir por classe existente) e remover o `fontSize` inline.

### AUD-005 — `public-profile.css` com 13 seletores repetidos 4 vezes
- **Data:** 15/11/2026
- **Prioridade:** P3
- **Estado:** aberto
- **Evidência:** arquivo com 939 linhas, 94 regras e apenas 52 seletores únicos; quatro blocos "/* Public Social Highlights */" (linhas 235, 382, 654, 801). Repetidos 4×: `.public-social-section`, `-header`, `-title`, `-grid`, `-grid::-webkit-scrollbar`, `-pending`, `-stats`, `-card`, `-card:focus-visible`, `-thumb-wrap`, `-thumb`, `-thumb-fallback`, `-badge`, `-caption`.
- **Impacto:** manutenção arriscada (uma alteração visual exige editar 4 blocos) e CSS maior que o necessário.
- **Correção sugerida:** consolidar em um único bloco, validando visual antes/depois.

### AUD-006 — Input de avatar focável, invisível e duplicando a ação
- **Data:** 15/11/2026
- **Prioridade:** P2
- **Estado:** aberto
- **Evidência:** `#avatar-file-input` tem 1×1, `clip: rect(0, 0, 0, 0)`, `position: absolute`, classe `sr-only`. Ordem de Tab no editor desktop: `#displayName` → `#slug` → `#bio` → **`#avatar-file-input` (foco com box-shadow em área invisível)** → botão "Enviar imagem" (44px). Dois stops para a mesma ação.
- **Arquivo:** `src/components/panel/AvatarUploader.tsx`.
- **Correção sugerida:** remover o input da ordem de foco (`tabIndex={-1}`) mantendo o botão visível como único ponto de entrada, ou transformar o botão em `<label for>` estilizado.

### AUD-007 — Editor sem `h1` e títulos de seção fora da hierarquia
- **Data:** 15/11/2026
- **Prioridade:** P2
- **Estado:** corrigido em 15/11/2026
- **Evidência:** `/painel` com editor carregado → `h1: []`. Títulos "1. Identidade" … "5. Links personalizados" eram `SPAN` de 18px (`.editor-section-title`, `src/components/panel/CollapsibleSection.tsx` linhas 45–51). Os únicos `H2/H3` da tela vinham do preview embutido.
- **Impacto:** leitor de tela não encontra título de página nem sumário das seções do editor.
- **Correção aplicada:** o cabeçalho passou a imprimir o nome do perfil em `h1.editor-profile-name`, o menu **Profile** (`ProfileSectionsNav`) usa `button` com estado `aria-current`, e cada seção usa `h2`/`h3` próprios dentro de `SectionShell`, com apenas uma seção montada por vez.
- **Validação:** revisão de código e `npm run typecheck`/`lint`/`build`; leitura com leitor de tela real segue pendente (EDIT-003).

### AUD-008 — Tráfego pago exibe estado contraditório
- **Data:** 15/11/2026
- **Prioridade:** P2
- **Estado:** aberto (problema de apresentação; erro de backend já conhecido)
- **Evidência (`/painel/trafego`, conta demo):** a mesma tela mostra "Conectado", "Conta conectada", "Meta Ads conectada" e "Conta de anúncios ativa" junto com "Nenhuma selecionada", "Não encontramos uma conta de anúncios disponível para este acesso…" e "Campanhas e métricas: A conexão atual não possui autorização para o Meta Ads. Reconecte sua conta na aba Tráfego pago."
- **Erro de servidor reproduzido:** `ConnectedAccount_ToolkitMismatch` — a conta `ca_zF8pU19BbQef` pertence ao toolkit `facebook`, não a `metaads`. A UI apresenta mensagem sanitizada, sem vazar o erro cru (ponto positivo).
- **Correção sugerida:** separar visualmente "autorização OAuth" de "conta de anúncios selecionada/utilizável" e exibir um único estado principal com a ação esperada.

### AUD-009 — Cabeçalho do painel mobile consome mais de uma tela antes do primeiro campo
- **Data:** 15/11/2026
- **Prioridade:** P2
- **Estado:** aberto
- **Evidência (390×844):** `.app-header` 269px de altura; `.profile-bar` mais 159px (top 283); abas Editar/Prévia em `top: 716`; primeiro input em `top: 934` — fora do viewport inicial. Altura total do documento: 3063px.
- **Impacto:** o usuário abre o painel e não vê nenhum campo de edição sem rolar.
- **Correção sugerida:** compactar marca + navegação no mobile (menu recolhido) e encurtar a barra de perfil.

### AUD-010 — Alvos de toque abaixo de 44px
- **Data:** 15/11/2026
- **Prioridade:** P2
- **Estado:** aberto
- **Evidência (medido):** links do menu do painel 36px de altura; CTA do item de catálogo na página pública (`linkia-cat-cta`) 322×38; ações do item no editor 33×34 ("Mover … para cima/baixo") e 34px de altura ("Desativar", "Editar", "Excluir"); "+ Novo item" 40px.
- **Impacto:** alvo mínimo recomendado (WCAG 2.5.8 / 44×44) não atendido em telas de toque.
- **Correção sugerida:** elevar altura mínima dos botões de ação para 44px e ampliar a área clicável sem alterar o visual.

### AUD-011 — Grade de recursos da home quebra em 2+1
- **Data:** 15/11/2026
- **Prioridade:** P3
- **Estado:** aberto
- **Evidência (1440×900):** cards "URL curta própria" (x=140) e "Links essenciais" (x=426) em `y=543`; "Prévia ao vivo" isolado em `x=140, y=665`. Origem: `gridTemplateColumns: repeat(auto-fit, minmax(180px, 1fr))` em `src/app/page.tsx` (~linhas 124–131) dentro de uma coluna de ~560px.
- **Correção sugerida:** `minmax(150px, 1fr)` ou layout explícito de 3 colunas no desktop.

### AUD-012 — `npm run lint` falha por varrer a pasta `.agents`
- **Data:** 15/11/2026
- **Prioridade:** P2 (bloqueia o gate de qualidade do projeto)
- **Estado:** corrigido em 15/11/2026
- **Evidência:** `npm run lint` → **exit 1**, 15 erros e 241 warnings, todos em `.agents/skills/design-taste-frontend/assets/**` (arquivos de terceiros). Em `src/`, apenas 4 warnings `@next/next/no-img-element`.
- **Causa confirmada:** `eslint.config.mjs` ignora `.next`, `out`, `build`, `next-env.d.ts` e `data`, mas não `.agents`.
- **Correção aplicada:** `".agents/**"` adicionado ao `globalIgnores`.
- **Validação:** `npm run lint` → 0 erros e 4 warnings em `src/`.

### AUD-013 — Host do rodapé legal divergente do domínio oficial
- **Data:** 15/11/2026
- **Prioridade:** P2
- **Estado:** aberto
- **Evidência:** `src/components/ui/LegalFooter.tsx:31` imprime `https://linka.infinito.com.br`; a documentação e o Coolify registram `https://linkia.iainfinito.com.br` (`docs/estado-atual.md`, `META_ADS_SETUP.md`, `ZERNIO_WEBHOOK_SETUP.md`). O editor mostra o prefixo `linkia /` na prévia, sem host.
- **Impacto:** endereço incorreto exibido em página pública, com risco de o visitante digitar domínio inexistente.
- **Correção sugerida:** derivar o host de `APP_BASE_URL`/`NEXT_PUBLIC_APP_URL` em vez de literal.

### AUD-014 — Diálogo de exclusão com `aria-modal="false"` e sem foco
- **Data:** 15/11/2026
- **Prioridade:** P3
- **Estado:** corrigido em 15/11/2026
- **Evidência:** `src/components/panel/ProfileEditor.tsx` usavam `role="dialog"` com `aria-modal="false"` e `aria-label="Confirmar exclusão de perfil"`; após abrir, `document.activeElement` continuava em `BODY`.
- **Correção aplicada:** bloco inline passou a `role="alertdialog"` (sem `aria-modal`, pois não é sobreposto) e o botão **Cancelar** recebeu `autoFocus` como ação segura padrão. O diálogo de troca de seção também move o foco para **Salvar e continuar**.

### AUD-015 — Atrito de desenvolvimento: `/painel` entra em ciclo de recarregamento no `next dev`
- **Data:** 15/11/2026
- **Prioridade:** P3 (não reproduzido em produção)
- **Status:** investigado, não reproduzido no build standalone
- **Evidência:** em `next dev -p 3100` (Turbopack), `/painel` repetia `GET /painel` + `GET /api/auth/me` continuamente e ficava em "Carregando seu painel LinkIA...". No build de produção standalone (`.next/standalone/server.js`), o painel carregou e estabilizou em todas as visitas da auditoria.
- **Conclusão:** registrar como limitação de ambiente de desenvolvimento; não classificar como bug de produto sem reprodução em produção.

### Observações de ambiente (não são bugs de frontend)
- Aviso de boot: `ZERNIO_WEBHOOK_SECRET` ausente → o webhook `/api/webhooks/zernio/whatsapp` responde 503 até o segredo ser configurado.
- `next build` emite 2 warnings de tracing dinâmico em `src/lib/db.ts` (`DATA_DIR`); não bloqueiam o build, mas aumentam o pacote do servidor.
- `/painel/admin` acessado como usuário cliente responde 307 para `/painel` (comportamento esperado).
- `/api/health` respondeu 200 em todas as verificações.

---

## Reorganização do editor de perfil (15/11/2026)

### EDIT-001 — Modelos de agendamento não conseguem expressar dois períodos por dia (almoço)
- **Data:** 15/11/2026
- **Prioridade:** P2 (limitação funcional conhecida)
- **Estado:** limitação registrada; comportamento atual documentado
- **Evidência:** `WeeklyAvailabilityDay` (`src/lib/types.ts`) contém apenas `dayOfWeek`, `enabled`, `startTime` e `endTime`; `validateBookingSettings`/`scheduling.ts` assumem `startTime < endTime` em um único intervalo. Os modelos da interface (**Seg a sex**, **Seg a sáb**, **Seg a dom**) aplicam 08:00–18:00 contínuo e avisam que o intervalo inclui o almoço.
- **Impacto:** não é possível representar 08:00–12:00 + 13:00–18:00 por dia sem alterar o contrato do backend, a validação, a geração de slots e as reservas existentes.
- **Correção sugerida (fora do escopo desta entrega):** migrar para uma lista de intervalos por dia (`periods[]`) com migração dos dados atuais e ajuste de `scheduling.ts`, `/availability` e `/bookings`.
- **Decisão:** preservar o contrato atual e permitir personalização manual de horários; nenhum horário salvo é sobrescrito sem confirmação + **Salvar disponibilidade**.

### EDIT-002 — Carregamento sob demanda sem cache entre montagens
- **Data:** 15/11/2026
- **Prioridade:** P3 (trade-off de simplicidade)
- **Estado:** decisão registrada
- **Evidência:** cada seção monta seu painel via `next/dynamic` e busca os dados no `useEffect` de montagem; ao trocar de seção e voltar, uma nova busca é feita. A prévia mantém os últimos `catalogItems`/`customLinks` em estado do `ProfileEditor`.
- **Impacto:** garante dados frescos após salvar/publicar/conectar/desconectar e evita cache cruzado entre perfis, ao custo de uma requisição por reabertura de seção.
- **Correção sugerida:** se necessário, cache em memória por `profileId` com invalidação explícita; não implementado para evitar estado duplicado nesta fase.

### EDIT-003 — Validação visual e de rede em navegador não executada
- **Data:** 15/11/2026
- **Prioridade:** P2 (cobertura de aceite incompleta)
- **Estado:** bloqueado pelo ambiente
- **Evidência:** o ambiente não possui credenciais de conta autorizada (`/api/auth/demo` retorna 403) nem sessão de Chrome DevTools remoto. Foram executados `typecheck`, `lint`, `test` (69/69) e `build` com sucesso, além de revisão de código dos fluxos.
- **Impacto:** os 13 pontos do percurso manual (1440/390, claro/escuro, skeleton, ausência de requests duplicados, Drawer por gesto, capa na primeira dobra) não foram observados em tela real nesta execução.
- **Correção sugerida:** executar o percurso com uma conta de teste em ambiente com navegador disponível e credenciais Google/WhatsApp/Instagram quando o consentimento externo existir.

### EDIT-004 — `react-hooks/set-state-in-effect` nos novos efeitos de carga
- **Data:** 15/11/2026
- **Prioridade:** P3
- **Estado:** corrigido
- **Evidência:** `npm run lint` apontou `setState` síncrono em `useEffect` no carregamento inicial dos canais e na leitura do hash de seção.
- **Correção aplicada:** canais fazem `fetch` direto com atualização em `.then` (sem `setState` síncrono) e o hash é aplicado com `setTimeout(0)`; a página mantém apenas uma busca por canal, sem a duplicação do handler de retorno OAuth.
- **Validação:** `npm run lint` → 0 erros.

### Retomada EDIT-003 — auditoria da versão atual (16/11/2026)
- **Estado:** parcialmente verificado; auditoria visual do baseline registrada, validação do editor reorganizado no commit local fa13140 pendente.
- **Evidência:** a auditoria anterior documenta Chrome headless/CDP em 1440×900 e 390×844, incluindo o editor anterior. Na retomada, git status mostrou main um commit à frente de origin/main; portanto, não se usou a página de produção como prova do código local. npm run typecheck passou e npm run lint passou com 4 avisos; npm test foi bloqueado por EPERM no Vitest e npm run build pelo erro 5 de acesso/canonicalização do caminho Windows.
- **Impacto:** skeletons, navegação por hash, Drawer responsivo, estados de salvamento e layout desktop/mobile adicionados ou reorganizados no commit local não foram observados em navegador nesta versão.
- **Próxima ação:** quando o ambiente permitir executar o build local, repetir o percurso de 13 pontos em 1440/390, temas claro/escuro e estados de loading/erro/sucesso; manter OAuth real, leitor de tela e serviços externos como validações separadas.

### Retomada da auditoria e confirmação de produção (16/11/2026)
- **Estado:** auditoria documental retomada; validação visual do commit local ainda pendente.
- **Evidência:** a página `/painel` de produção aberta no Chrome ainda apresenta o editor antigo com acordeões e Catálogo na tela principal. O commit local `fa13140` não está em `origin/main`, portanto produção não comprova a reorganização. A tentativa de iniciar o app local não pôde ser confirmada por HTTP porque o ambiente negou a permissão de socket.
- **Impacto:** não há evidência visual da versão reorganizada em desktop/mobile nesta retomada. Typecheck e lint passaram; Vitest continuou bloqueado por `EPERM`.
- **Decisão:** manter EDIT-003 aberto e não inferir que a nova interface foi publicada. Nenhuma melhoria funcional foi implementada nesta auditoria.
- **Atualização de publicação:** commit `032870492cf6eecb7ee0b2307b44131d69c36ef0` foi enviado para `main`; o workflow de imagem Coolify estava construindo a imagem e ainda não havia chegado ao gatilho de deploy na última consulta.
- **Próxima ação:** após o workflow/deploy terminar, verificar em browser os fluxos e dimensões documentados em EDIT-003; abrir melhoria funcional separada para EDIT-001 (intervalos de expediente e pausa de almoço).
