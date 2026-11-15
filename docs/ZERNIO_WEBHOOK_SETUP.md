# Configuração Segura do Webhook da Zernio no LinkIA

Este guia descreve como gerar, configurar e validar `ZERNIO_WEBHOOK_SECRET` no LinkIA e no painel da Zernio, sem expor segredos no código, na interface web, nos logs ou no Git.

---

## 1. Endpoint público do webhook

Cadastre na Zernio a URL pública completa do seu ambiente:

```text
https://<SEU_DOMINIO>/api/webhooks/zernio/whatsapp
```

- Exemplo em produção (Coolify, conforme `APP_BASE_URL`):
  ```text
  https://linkia.iainfinito.com.br/api/webhooks/zernio/whatsapp
  ```
- Método HTTP: `POST`

---

## 2. Eventos da Zernio esperados pelo LinkIA

O endpoint `/api/webhooks/zernio/whatsapp` processa eventos de ciclo de vida da conta WhatsApp conectada em coexistência:

- `account.connected`
- `account.disconnected`
- Eventos de atualização/status de conta e número WhatsApp (`whatsapp.account.status_updated`, `whatsapp.number.activated`, `whatsapp.number.suspended` ou variações contendo `connected`, `updated`, `disconnected`, `revoked`, `expired`, `ineligible`, `failed`, `error`)
- `webhook.test` (aceito após assinatura válida para validação de conectividade)

---

## 3. Header e mecanismo oficial de assinatura

Conforme a documentação oficial da Zernio e a implementação em `src/app/api/webhooks/zernio/whatsapp/route.ts` e `src/lib/zernio-whatsapp.ts`:

- **Header de assinatura:** `X-Zernio-Signature`
- **Headers auxiliares lidos quando presentes:** `X-Zernio-Event` (tipo do evento) e `X-Zernio-Event-Id` (deduplicação)
- **Algoritmo:** HMAC-SHA256 em hexadecimal calculado sobre o **corpo bruto (`rawBody`)** da requisição HTTP usando o segredo compartilhado `ZERNIO_WEBHOOK_SECRET` (também aceita prefixo opcional `sha256=`).
- **Comparação:** em tempo constante com `crypto.timingSafeEqual`.
- **Comportamento sem segredo configurado:** o LinkIA **não** gera segredos aleatórios no boot; registra um aviso seguro na inicialização (`src/instrumentation.ts`) e rejeita eventos com HTTP `503` (`ZERNIO_WEBHOOK_SECRET não configurado.`).

---

## 4. Variável de ambiente e geração de segredo forte

- **Nome da variável:** `ZERNIO_WEBHOOK_SECRET`
- Gere um segredo forte e único localmente (32 bytes aleatórios em hexadecimal) **sem salvar o valor em arquivos versionados**:

  **Node.js (Windows PowerShell ou Linux/macOS):**
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

  **OpenSSL (Linux/macOS):**
  ```bash
  openssl rand -hex 32
  ```

- Preencha **o mesmo valor** nos dois lados:
  1. **Local (`.env`):** `ZERNIO_WEBHOOK_SECRET=<seu_segredo_gerado>` (o arquivo `.env` é ignorado pelo `.gitignore`).
  2. **Deploy (Coolify → Environment Variables):** defina `ZERNIO_WEBHOOK_SECRET` como variável sensível e reinicie/redeploy a aplicação.

---

## 5. Como cadastrar o segredo e o endpoint na Zernio

1. Acesse o painel da **Zernio** → **Settings → Webhooks** (ou utilize o endpoint oficial `POST /v1/webhooks/settings` da API da Zernio).
2. Informe a URL do endpoint: `https://<SEU_DOMINIO>/api/webhooks/zernio/whatsapp`.
3. Cole no campo **Secret** exatamente o mesmo valor definido em `ZERNIO_WEBHOOK_SECRET`.
4. Selecione os eventos de conta/WhatsApp (`account.connected`, `account.disconnected` e eventos de status do WhatsApp) e salve.

---

## 6. Como testar recebimento válido e rejeição de assinatura inválida

Use apenas um segredo fictício em ambiente de teste local/homologação:

1. **Sem `ZERNIO_WEBHOOK_SECRET` configurado:**
   - `POST /api/webhooks/zernio/whatsapp` retorna **HTTP `503`** (`{"error":"ZERNIO_WEBHOOK_SECRET não configurado."}`).
2. **Sem header `X-Zernio-Signature` ou com assinatura inválida:**
   - `POST /api/webhooks/zernio/whatsapp` retorna **HTTP `401`** (`{"error":"Assinatura inválida."}`) e registra `webhook_invalid_signature` na auditoria sem expor o segredo.
3. **Com assinatura HMAC-SHA256 válida:**
   - Calcule o HMAC-SHA256 do JSON bruto com `ZERNIO_WEBHOOK_SECRET` e envie no header `X-Zernio-Signature`.
   - O endpoint retorna **HTTP `200`** (`{"ok":true,"deduplicated":false}`) e, em reenvio com o mesmo `eventId` / `X-Zernio-Event-Id`, retorna `{"ok":true,"deduplicated":true}`.

