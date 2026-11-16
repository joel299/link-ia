# O que cada rota faz

Os caminhos abaixo são relativos a `https://linkia.iainfinito.com.br/v1/api`. A referência interativa apresenta método, campos e respostas por operação. As rotas existentes foram inventariadas diretamente no código; o nome de um grupo não significa que toda operação daquele grupo será oferecida como ferramenta MCP.

**Atenção:** a coluna MCP mostra operações que podem ser oferecidas ao agente, desde que a chave tenha o escopo indicado. Escopos de escrita são opt-in e precisam ser liberados pelo administrador. Rotas de administração, login/cadastro, callback, webhook, upload, conexão OAuth e desconexão ficam fora do MCP. Ativar campanha requer pedido explícito do usuário, escopo `ads:confirm` e `confirmed: true`.

| Grupo | Rota | Métodos | Uso em palavras simples | Acesso/MCP |
| --- | --- | --- | --- | --- |
| Administração | `/admin/ai-agent` | GET, PUT | Consultar ou trocar as instruções internas da IA | Somente administrador; fora do MCP |
| Administração | `/admin/users` | GET, POST | Listar usuários ou criar uma conta | Somente administrador; fora do MCP |
| Administração | `/admin/users/{userId}` | GET, PATCH | Consultar ou alterar permissões de uma conta | Somente administrador; fora do MCP |
| IA pessoal | `/ai/codex/analyze` | POST | Analisar campanhas usando a conta Codex do usuário | Não é uma ferramenta MCP genérica |
| IA pessoal | `/ai/codex/connect` | POST | Iniciar autenticação por código do Codex | Fluxo do painel; fora do MCP |
| IA pessoal | `/ai/codex/models` | GET | Listar modelos permitidos para a conta Codex | Fluxo do painel |
| IA pessoal | `/ai/codex/status` | GET, DELETE | Ver ou encerrar a conexão Codex | Fluxo do painel; fora do MCP |
| Autenticação | `/auth/demo` | POST | Entrar em conta de demonstração | Fora do MCP |
| Autenticação | `/auth/login` | POST | Entrar com e-mail e senha do LinkIA | Fora do MCP |
| Autenticação | `/auth/logout` | POST | Encerrar a sessão do navegador | Fora do MCP |
| Autenticação | `/auth/me` | GET | Consultar a sessão do navegador | Fora do MCP |
| Autenticação | `/auth/register` | POST | Provisionar usuário autorizado | Fora do MCP |
| Serviço | `/health` | GET | Verificar se a aplicação responde | Público; não precisa de chave pessoal |
| Integrações | `/integrations/composio/callback` | GET | Receber o retorno de autorização do Composio | Callback; fora do MCP |
| Integrações | `/integrations/social/callback` | GET | Receber o retorno de autorização social | Callback; fora do MCP |
| Integrações | `/integrations/whatsapp/callback` | GET | Receber o retorno de autorização do WhatsApp | Callback; fora do MCP |
| Legal | `/legal/acceptance` | GET, POST | Consultar ou registrar aceite dos termos | GET MCP `legal:read`; POST fora do MCP |
| Perfis | `/profiles` | GET, POST | Listar ou criar perfis próprios | GET MCP `profiles:read`; POST MCP `profiles:write` |
| Perfis | `/profiles/slug-availability` | GET | Ver se um endereço curto está disponível | MCP `profiles:read` |
| Perfis | `/profiles/{id}` | GET, PATCH, DELETE | Consultar, editar ou remover um perfil próprio | GET/PATCH MCP (`profiles:read`/`profiles:write`); DELETE fora do MCP |
| Anúncios | `/profiles/{id}/ads/meta_ads/setup` | GET, POST | Consultar/preparar configuração Meta Ads | GET MCP `ads:read`; POST fora do MCP |
| Anúncios | `/profiles/{id}/ads/{provider}` | GET, POST | Consultar dados ou escolher uma conta de anúncios | GET MCP `ads:read`; POST MCP `ads:manage` |
| Anúncios | `/profiles/{id}/ads/{provider}/campaigns` | POST | Criar um rascunho de campanha | MCP `ads:draft`; não ativa anúncio |
| Anúncios | `/profiles/{id}/ads/{provider}/campaigns/{operationId}/confirm` | POST | Confirmar criação ou ativação de campanha | MCP `ads:confirm`; pedido explícito e `confirmed: true` obrigatórios |
| Agenda | `/profiles/{id}/booking-settings` | GET, PUT | Consultar ou editar horários e regras de reserva | GET/PUT MCP (`calendar:read`/`calendar:manage`) |
| Catálogo | `/profiles/{id}/catalog` | GET, POST | Consultar ou criar serviços e produtos | GET/POST MCP (`catalog:read`/`catalog:write`) |
| Catálogo | `/profiles/{id}/catalog/reorder` | PUT | Alterar a ordem de itens | MCP `catalog:write` |
| Catálogo | `/profiles/{id}/catalog/{itemId}` | PATCH, DELETE | Editar ou remover um item | MCP `catalog:write` |
| Agenda Google | `/profiles/{id}/integrations/google-calendar` | GET, DELETE | Consultar ou desconectar calendário | GET pode ser MCP; desconexão fora do MCP |
| Agenda Google | `/profiles/{id}/integrations/google-calendar/connect` | POST | Iniciar conexão do calendário | Fluxo de autorização; fora do MCP |
| Redes sociais | `/profiles/{id}/integrations/social` | GET | Listar conexões sociais do perfil | Consulta MCP; respeita canais liberados |
| Redes sociais | `/profiles/{id}/integrations/social/{provider}` | GET, PATCH, DELETE | Consultar, editar ou desconectar um canal | GET/PATCH MCP (`social:read`/`social:manage`); DELETE fora do MCP |
| Redes sociais | `/profiles/{id}/integrations/social/{provider}/connect` | POST | Iniciar conexão de rede social | Fluxo de autorização; fora do MCP |
| Redes sociais | `/profiles/{id}/integrations/social/{provider}/sync` | POST | Atualizar dados com o provedor | MCP `social:sync`; exige permissão explícita |
| WhatsApp | `/profiles/{id}/integrations/whatsapp` | GET, DELETE | Consultar ou desconectar WhatsApp | GET pode ser MCP; desconexão fora do MCP |
| WhatsApp | `/profiles/{id}/integrations/whatsapp/connect` | POST | Iniciar conexão WhatsApp | Fluxo de autorização; fora do MCP |
| Links | `/profiles/{id}/links` | GET, POST | Consultar ou adicionar links | GET/POST MCP (`links:read`/`links:write`) |
| Links | `/profiles/{id}/links/reorder` | PUT | Alterar a ordem dos links | MCP `links:write` |
| Links | `/profiles/{id}/links/{linkId}` | PATCH, DELETE | Editar ou remover um link | MCP `links:write` |
| Publicação | `/profiles/{id}/publish` | POST, DELETE | Publicar ou despublicar uma página | MCP `profiles:publish`; altera o que fica público |
| Público | `/public/profiles/{slug}` | GET | Ver uma página publicada | Público; sem dados privados |
| Público | `/public/profiles/{slug}/availability` | GET | Consultar horários disponíveis | Público; pode receber data/período e serviço |
| Público | `/public/profiles/{slug}/booking` | GET | Consultar informações de reserva | Público |
| Público | `/public/profiles/{slug}/bookings` | POST | Criar uma reserva na página pública | MCP `booking:create`; confere se o endereço pertence ao usuário da chave |
| Público | `/public/profiles/{slug}/catalog` | GET | Ver serviços e produtos publicados | Público |
| Arquivos | `/uploads` | POST | Enviar arquivo de imagem | Não é ferramenta MCP |
| Arquivos | `/uploads/{filename}` | GET | Buscar um arquivo enviado | Acesso limitado pelas regras de publicação do arquivo |
| Webhook | `/webhooks/zernio/whatsapp` | POST | Receber eventos assinados do Zernio | Somente provedor; fora do MCP |

## Campos de exemplo confirmados no código

### Criar perfil

Obrigatórios: `displayName`, `slug`. `bio` e `theme` são opcionais.

```json
{
  "displayName": "Ana Silva",
  "slug": "ana-silva",
  "bio": "Atendimento e novidades",
  "theme": {}
}
```

### Criar rascunho de campanha

Obrigatórios: `name`, `objective`, `budgetAmount`, `budgetCurrency`, `budgetType`, `startDate`, `targetSummary`, `creativeHeadline`, `destinationUrl` e `idempotencyKey`. `endDate` é opcional. Use orçamento maior que zero, moeda de três letras, datas `AAAA-MM-DD` e endereço HTTPS. A chave de idempotência deve ter de 8 a 128 caracteres.

```json
{
  "name": "Campanha de teste",
  "objective": "OUTCOME_TRAFFIC",
  "budgetAmount": 20,
  "budgetCurrency": "BRL",
  "budgetType": "daily",
  "startDate": "2026-12-01",
  "targetSummary": "Pessoas interessadas no serviço na região atendida",
  "creativeHeadline": "Conheça nosso serviço",
  "destinationUrl": "https://example.com/oferta",
  "idempotencyKey": "teste-campanha-001"
}
```

### Confirmar operação de campanha

Obrigatórios: `action` (`create_paused` ou `activate`) e `confirmed` igual a `true`. A opção `activate` só deve ser usada depois que o usuário pedir explicitamente a ativação; a chave precisa ter o escopo `ads:confirm`.

```json
{
  "action": "create_paused",
  "confirmed": true
}
```

### Aceitar termos

Obrigatórios: `termsAccepted`, `termsVersion`, `privacyAcknowledged`, `privacyVersion`. `profileId` e `optionalProductUpdates` são opcionais.

```json
{
  "termsAccepted": true,
  "termsVersion": "VERSAO_EXIBIDA_NO_LINKIA",
  "privacyAcknowledged": true,
  "privacyVersion": "VERSAO_EXIBIDA_NO_LINKIA",
  "optionalProductUpdates": false
}
```

## Limites conhecidos

O inventário contém **48 arquivos `route.ts`**, não 48 verbos HTTP: alguns arquivos oferecem mais de um método. Os contratos de vários recursos são tipos TypeScript e validações de domínio, não um schema OpenAPI centralizado. A especificação será revisada contra esses tipos antes de ser tratada como contrato de produção. Uma solicitação não deve ser enviada com campos inventados só porque aparecem em um exemplo genérico.
