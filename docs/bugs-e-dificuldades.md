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

## Riscos e questões em aberto — não são bugs

### RISCO-001 — Integração com mídia do Instagram
- **Estado:** risco conhecido; fora do primeiro corte.

### RISCO-002 — Ambiente Qualify e execução Docker em Linux ainda não confirmados
- **Estado:** pendente de descoberta/validação.

### RISCO-003 — Ausência de rate limiting em rotas de autenticação, reserva e upload
- **Estado:** pendência de segurança pré-produção.
