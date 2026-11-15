# Configuração Segura do Meta Ads no LinkIA

Este guia explica como configurar as credenciais do **Meta Ads** (Facebook/Instagram Ads) via **Composio** (`toolkit: metaads`, `authScheme: OAUTH2`) sem expor segredos no código, no navegador, nos logs ou no Git.

---

## 1. Como obter `META_ADS_CLIENT_ID` e `META_ADS_CLIENT_SECRET` no Meta for Developers

1. Acesse o painel [Meta for Developers](https://developers.facebook.com/apps/) e crie (ou selecione) um App do tipo **Business / Marketing API**.
2. Adicione o produto **Marketing API** e **Facebook Login for Business** (ou **Facebook Login**).
3. No menu **Configurações do app → Básico** (*App Settings → Basic*):
   - Copie o **ID do Aplicativo** (*App ID*) → será usado em `META_ADS_CLIENT_ID`.
   - Clique em **Mostrar** em **Chave Secreta do Aplicativo** (*App Secret*) → será usado em `META_ADS_CLIENT_SECRET`.
4. Solicite/configure as permissões OAuth necessárias para o fluxo do toolkit `metaads` no Composio (escopos padrão: `ads_read,ads_management,business_management`).

> **Importante:** Nunca coloque `META_ADS_CLIENT_ID` ou `META_ADS_CLIENT_SECRET` em arquivos versionados, capturas de tela, logs ou no frontend (`NEXT_PUBLIC_*`).

---

## 2. URIs OAuth do Meta Ads (não confunda os dois endereços)

Existem **dois endereços distintos** no fluxo OAuth do Meta Ads via Composio:

1. **Callback do provedor OAuth (Meta → Composio):**
   ```text
   https://backend.composio.dev/api/v3/toolkits/auth/callback
   ```
   - Cadastre **exatamente** esta URI no painel **Meta for Developers → Facebook Login → Configurações → URIs de redirecionamento do OAuth válidos**.
   - Ela também é enviada como `oauth_redirect_uri` na criação da Auth Config `metaads` no Composio (`META_ADS_OAUTH_REDIRECT_URI`, com fallback legado para `COMPOSIO_META_ADS_REDIRECT_URI`).

2. **URL de retorno do produto (Composio → LinkIA):**
   ```text
   https://linka.infinito.com.br/api/integrations/social/callback
   ```
   (em desenvolvimento local: `http://localhost:3000/api/integrations/social/callback`)
   - Passada ao Composio como `callbackUrl` na inicialização da conexão (`LINKIA_META_ADS_RETURN_URL`, ou derivada automaticamente de `APP_BASE_URL` + `/api/integrations/social/callback` quando vazia).
   - Essa rota valida o `state` OAuth e o usuário autenticado, persiste a conexão `meta_ads` e redireciona o navegador para `/painel/trafego?profileId=...&provider=meta_ads&social=connected`.

---

## 3. Onde preencher localmente (`.env`)

1. Copie `.env.example` para `.env` na raiz do repositório (se ainda não existir). `.env` já está protegido no `.gitignore`.
2. Preencha as variáveis abaixo **somente no `.env` local**:

```env
COMPOSIO_API_KEY=seu_composio_api_key
META_ADS_CLIENT_ID=seu_app_id_meta
META_ADS_CLIENT_SECRET=seu_app_secret_meta
META_ADS_OAUTH_REDIRECT_URI=https://backend.composio.dev/api/v3/toolkits/auth/callback
LINKIA_META_ADS_RETURN_URL=http://localhost:3000/api/integrations/social/callback
COMPOSIO_META_ADS_AUTH_CONFIG_ID=
```

Deixe `COMPOSIO_META_ADS_AUTH_CONFIG_ID` vazio até gerar ou validar a auth config no Composio (passo 5).

---

## 4. Onde preencher no deploy (Coolify / Docker Compose)

Os arquivos `compose.yaml` e `docker-compose.coolify.yml` repassam as variáveis ao container de forma segura via ambiente:

- `COMPOSIO_API_KEY`
- `META_ADS_CLIENT_ID`
- `META_ADS_CLIENT_SECRET`
- `COMPOSIO_META_ADS_REDIRECT_URI` (opcional; padrão `https://backend.composio.dev/api/v1/auth-apps/add`)
- `COMPOSIO_META_ADS_AUTH_CONFIG_ID`

No **Coolify**:
1. Abra o serviço do LinkIA → **Environment Variables**.
2. Cadastre `META_ADS_CLIENT_ID`, `META_ADS_CLIENT_SECRET`, `COMPOSIO_META_ADS_REDIRECT_URI` e `COMPOSIO_API_KEY` como variáveis de ambiente (marcando os segredos como sensíveis).
3. Após obter o ID da auth config no passo 5, cadastre também `COMPOSIO_META_ADS_AUTH_CONFIG_ID` e faça **Redeploy / Restart**.

---

## 5. Como criar/validar a auth config `metaads` no Composio

O LinkIA **não** cria auth configs automaticamente no boot do servidor e evita duplicidade verificando se já existe uma auth config habilitada do tipo `OAUTH2` para `metaads` antes de criar.

Com o servidor rodando e autenticado no painel:

- **Pelo painel:** Acesse `/painel/trafego-pago`, selecione a aba **Meta Ads** e clique em **Criar/Validar Auth Config Meta Ads** (visível enquanto `COMPOSIO_META_ADS_AUTH_CONFIG_ID` não estiver configurado).
- **Ou via API autenticada:**
  ```http
  POST /api/profiles/{profileId}/ads/meta_ads/setup
  ```
- O endpoint retorna apenas metadados não secretos:
  - `authConfigId` (ex.: `ac_...`)
  - `source`: `"env"`, `"composio_existing"` ou `"composio_created"`
  - `created`: `true | false`
  - `redirectUri`
  - `scopes`

---

## 6. Como salvar `COMPOSIO_META_ADS_AUTH_CONFIG_ID`

1. Copie o `authConfigId` retornado no passo 5.
2. Preencha `COMPOSIO_META_ADS_AUTH_CONFIG_ID=<authConfigId>` no `.env` local (ou nas variáveis de ambiente do Coolify).
3. Reinicie a aplicação (`npm run dev`, `docker compose up -d` ou redeploy no Coolify) para carregar o novo valor.

---

## 7. Como verificar a conexão sem expor segredos

1. Consulte `GET /api/profiles/{profileId}/ads/meta_ads/setup` (ou recarregue `/painel/trafego-pago`):
   - Deve indicar `hasApiKey: true`, `hasClientId: true`, `hasClientSecret: true`, `hasAuthConfigId: true` e `missingForConnection: []` — sem retornar valores de chaves ou segredos.
2. Na aba **Meta Ads** em `/painel/trafego-pago`, clique em **Conectar conta** para iniciar o OAuth via Composio.
3. Após autorizar no Meta, o LinkIA sincroniza a conta conectada e lista as contas de anúncios (`act_...`) disponíveis para seleção e exibição de métricas.
