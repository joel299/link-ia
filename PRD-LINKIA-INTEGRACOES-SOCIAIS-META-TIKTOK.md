# PRD — LinkIA: Integrações sociais e tráfego pago

**Status:** Proposta para MVP  
**Produto:** LinkIA  
**Data:** 14/11/2026  
**Objetivo:** adicionar conexões sociais e um espaço separado de gestão de presença social e campanhas, mantendo o painel de perfil leve.

## 1. Contexto e problema

O LinkIA já oferece perfis públicos, configurações de perfil e integração com Google Agenda via Composio. O painel de perfil está crescendo e não deve concentrar conexões sociais, métricas e campanhas junto às configurações da página.

O usuário quer que cada cliente conecte suas próprias contas do Instagram, Facebook/Meta Ads e TikTok usando a estrutura Composio, veja conteúdo recente do Instagram no perfil público e possa preparar campanhas de tráfego pago em um espaço dedicado.

## 2. Resultado esperado

- Uma área/aba independente chamada **Canais e tráfego**, acessível no painel sem aumentar o formulário principal do perfil.
- Conexão e desconexão por cliente, com status legível, identidade da conta e seleção de ativos (conta profissional do Instagram, Página e conta de anúncios quando aplicável).
- Instagram: carregar até três publicações recentes, incluindo Reels elegíveis, com opção do titular de habilitar/desabilitar a exibição pública de cada item.
- Meta Ads: visualizar contas de anúncios e campanhas, consultar indicadores e preparar campanhas como rascunho para revisão.
- TikTok: conectar a conta e exibir os recursos realmente liberados pelo aplicativo/escopos autorizados; não presumir acesso a TikTok Ads apenas por conectar a conta orgânica.
- Isolamento entre clientes, proteção de credenciais e carregamento sob demanda para preservar a performance.

## 3. Usuários e necessidades

### Cliente LinkIA

- Conectar suas próprias contas por fluxo OAuth/Compartilhamento Composio.
- Entender rapidamente o que está conectado, a qual conta e quais permissões foram concedidas.
- Revogar uma conexão sem afetar outras contas ou clientes.
- Ver publicações recentes e escolher quais aparecem no seu perfil público.
- Consultar campanhas e métricas; preparar campanha com parâmetros explícitos e revisar antes de criar/ativar.

### Visitante do perfil público

- Ver somente o conteúdo que o titular escolheu publicar.
- Acessar a postagem original na plataforma.
- Não receber dados privados, métricas, tokens ou informações de anúncio.

## 4. Navegação e experiência

Adicionar uma rota/aba independente no painel, por exemplo **Canais e tráfego** (`/painel/canais` ou padrão de rotas existente). Não inserir formulários extensos no editor de perfil.

A área deve ter seções/tabs internas concisas:

1. **Instagram** — conexão, conta selecionada, últimas mídias, seleção de até 3 itens para exibição pública.
2. **Meta Ads** — conexão/ativos, campanhas e métricas, criação de rascunho.
3. **TikTok** — conexão/status e recursos habilitados para o app autorizado.

Cada área carrega seus dados somente ao ser aberta. Usar estados de carregamento, vazio, desconectado, erro recuperável e conexão expirada. Não carregar feeds, métricas ou SDKs de terceiros no perfil público sem necessidade.

## 5. Escopo funcional do MVP

### 5.1 Conexões via Composio

- Reutilizar a configuração e o padrão de autenticação já existentes para Google Agenda, sem expor API key, tokens, auth config IDs ou connection IDs no frontend.
- Usar o fluxo oficial de conexão/Shared Connection do Composio implementado no projeto e as ferramentas/SDKs/endpoints compatíveis com as versões atuais.
- Criar ou reutilizar configurações de autenticação separadas por toolkit e finalidade. Não reutilizar configuração Google Calendar para redes sociais.
- Armazenar no backend apenas identificadores e estado necessários; vincular conexão a `userId/profileId` autenticado e validar autorização em cada operação.
- Exibir provider, conta/ativo escolhido, estado, data da última sincronização e ação de desconectar/reconectar.
- Não compartilhar uma conexão de um cliente com outros clientes. Shared Connection do Composio deve ser modelada conforme o escopo real de compartilhamento desejado, evitando conexão global entre tenants.

### 5.2 Instagram: conteúdo recente

- Suportar conta profissional Business ou Creator, conforme disponibilidade dos endpoints e permissões aprovadas.
- Buscar as mídias recentes via toolkit Instagram do Composio e identificar Reels conforme metadados retornados. A seleção de mídia deve ocorrer no backend, sem credenciais no navegador.
- Mostrar no máximo três itens escolhidos pelo cliente no perfil público, cada um com miniatura, tipo, legenda curta opcional e permalink oficial.
- Oferecer ação para atualizar sincronização manualmente; definir cache server-side com TTL configurável para reduzir chamadas e latência.
- Se a conta não atender aos requisitos ou faltar permissão, mostrar instrução clara para converter para profissional/conceder permissões; não fingir que a conta conectou.
- Não baixar ou copiar conteúdo protegido sem necessidade. Preferir URL/thumbnail permitida e link para publicação original, respeitando termos e políticas da plataforma.

### 5.3 Meta Ads (Facebook/Instagram Ads)

- Tratar Meta Ads como produto distinto da conexão de Página/publicação Facebook e da conexão Instagram.
- Permitir selecionar uma conta de anúncios acessível pelo usuário conectado.
- MVP de leitura: listar campanhas, estado, objetivo, orçamento configurado e métricas básicas retornadas pelas ferramentas disponíveis.
- MVP de criação: permitir montar campanha como **rascunho/revisão**, validando objetivo, conta, orçamento, datas, público/segmentação e criativo conforme os campos obrigatórios da API.
- Antes de qualquer criação ou ativação que possa gerar gasto, apresentar resumo final e exigir confirmação explícita do usuário. Nunca ativar, publicar ou aumentar orçamento automaticamente após OAuth, sincronização ou erro/retry.
- Implementar idempotência e evitar duplicação de campanha em retries. Registrar auditoria de quem pediu, parâmetros, conta, resultado e IDs externos, sem armazenar tokens.
- O comportamento exato depende das permissões, aprovação da Meta App, ativos e ferramentas Composio disponíveis. Se o toolkit atual não oferecer conexão OAuth gerenciada, documentar a necessidade de credenciais OAuth próprias/consentimento do cliente e não apresentar um botão que aparenta funcionar sem configuração.

### 5.4 TikTok

- Separar **TikTok orgânico** de **TikTok Ads/Marketing** na interface e no modelo técnico.
- Investigar quais toolkits e ações Composio estão habilitados no projeto: perfil/métricas/listagem/publicação orgânica versus Marketing API/Ads.
- Para o MVP, conectar e exibir status/identidade e habilitar somente as ações cobertas pelas permissões efetivamente aprovadas.
- TikTok pode exigir aplicativo e credenciais do desenvolvedor do próprio produto, URI de redirect verificada e escopos aprovados; publicação/ads podem depender de revisão da plataforma. UX deve sinalizar isso e fornecer modo “aguardando configuração” sem simular sucesso.
- Não prometer criação de campanhas TikTok Ads até que toolkit, autenticação, escopos e acesso de produção estejam confirmados.

## 6. Fora do escopo inicial

- Automatizar gasto ou ativar campanhas sem revisão/consentimento expresso.
- Gestão avançada de públicos, pixel, catálogo, testes A/B, regras automatizadas e otimização algorítmica.
- Publicação automática de conteúdo social em múltiplas redes, salvo ação já explicitamente suportada e autorizada pelo toolkit.
- Extração de dados de contas pessoais ou scraping que contorne APIs oficiais.
- Garantir acesso a Instagram pessoal, Meta Ads sem permissões aprovadas ou TikTok Ads sem app/escopos aprovados.
- Armazenar tokens OAuth no frontend ou enviar segredos para páginas públicas.

## 7. Requisitos não funcionais

- **Performance:** carregamento sob demanda; paginação/limite de resultados; cache server-side; imagens com dimensões e lazy loading; não bloquear o primeiro paint do painel nem da página pública.
- **Segurança:** isolamento multi-tenant; checagem de propriedade em toda rota; tokens somente no servidor/Composio; proteção contra IDOR/CSRF conforme autenticação existente; logs com redaction; validação de callbacks OAuth e state/nonce segundo SDK.
- **Disponibilidade:** erros externos não devem derrubar painel ou perfil. Timeout, retry limitado com backoff para operações idempotentes, rate limits e mensagens de estado específicas.
- **Privacidade:** consentimento claro; desconectar/revogar; retenção mínima; link público expõe exclusivamente mídia opt-in.
- **Compatibilidade:** seguir arquitetura, padrões de UI, Docker e suporte Windows/Linux já documentados no repositório.
- **Acessibilidade:** navegação por teclado, rótulos acessíveis e estados não comunicados apenas por cor.

## 8. Modelo de dados conceitual

Adaptar ao banco e às convenções existentes; evitar duplicar tabelas se já houver estrutura equivalente.

- `social_connections`: `id`, `tenant_id/user_id`, `provider`, `composio_connection_id` (ou identificador oficial equivalente), `status`, `connected_account_label`, `scopes_summary`, `connected_at`, `last_synced_at`, `metadata` não sensível.
- `social_assets`: conexão, tipo de ativo (`instagram_account`, `facebook_page`, `meta_ad_account`, `tiktok_account`), ID externo, nome exibível e seleção ativa.
- `profile_social_media`: perfil, provider, ID/permalink externo, thumbnail URL permitida, tipo, legenda curta, posição, `public_enabled`, timestamp de sincronização.
- `ad_campaign_operations`: tenant, ator, conta, estado local (`draft`, `submitted`, `created`, `failed`), parâmetros não secretos, ID externo, chave de idempotência e auditoria.

Tokens/segredos não entram nessas tabelas salvo se arquitetura atual exigir armazenamento próprio seguro; preferir gestão de credenciais pelo Composio.

## 9. APIs internas esperadas

Definir conforme framework/rotas reais do projeto. Abaixo são capacidades, não caminhos obrigatórios:

- iniciar conexão de provider e retornar URL de OAuth/Composio de curta duração;
- receber/validar callback e consultar status;
- listar conexões e ativos disponíveis do usuário;
- selecionar ativo principal e desconectar/revogar;
- sincronizar mídias Instagram e salvar seleção pública (limite de 3);
- listar campanhas/métricas Meta Ads;
- validar e salvar campanha como rascunho;
- confirmar criação/ativação de campanha após confirmação humana;
- consultar status de operação e auditoria;
- recuperar conteúdo social público permitido por `profileSlug`, sem retornar identificadores privados ou tokens.

Todas as rotas devem exigir autenticação adequada, autorização por tenant e validação de payload. A rota pública deve devolver apenas os campos necessários para renderizar os três conteúdos.

## 10. Critérios de aceite

1. O painel principal de perfil permanece enxuto; Canais e tráfego abre em rota/aba separada e não faz chamadas sociais até ser acessada.
2. Cliente consegue iniciar, concluir, visualizar, reconectar e revogar conexão Instagram sem expor segredos.
3. Conta Instagram profissional elegível retorna mídias recentes via Composio; usuário seleciona até três e salva.
4. Perfil público exibe somente itens selecionados, com link para a origem, em desktop e celular; perfil público continua carregando se provider estiver indisponível.
5. Meta Ads exibe somente contas/campanhas autorizadas e oferece leitura de dados disponível.
6. Fluxo de criação mostra validação e revisão; nenhuma campanha com potencial de gasto é criada/ativada sem confirmação explícita; repetição não duplica operação.
7. TikTok mostra claramente quais capacidades estão configuradas e quais aguardam app/escopos. Nenhuma operação não habilitada é apresentada como funcional.
8. A desconexão/revogação remove acesso e dados não necessários segundo política de retenção; nunca afeta outros tenants.
9. Estados de loading, vazio, erro e reconexão estão implementados e acessíveis.
10. Testes cobrem autorização multi-tenant, chamadas Composio mockadas, cache, limites de três mídias, erros/timeouts e proteção contra duplicidade.
11. Build, lint e testes existentes passam; Docker permanece configurável conforme documentação do projeto.

## 11. Métricas de sucesso

- Taxa de conclusão OAuth por provider.
- Tempo até primeira exibição de mídias após conexão.
- Percentual de perfis com ao menos uma mídia pública selecionada.
- Falhas de conexão por provider e frequência de reconexão.
- Latência p95 das rotas internas de leitura, sem incluir latência variável de terceiros quando separável.
- Campanhas duplicadas ou ativadas sem confirmação: meta zero.

## 12. Dependências e riscos

- Configuração/escopos/credenciais de cada toolkit Composio e autorização do titular.
- Instagram exige conta profissional para os recursos de mídia documentados; permissões e revisão do aplicativo podem limitar produção.
- Meta Ads pode exigir credenciais OAuth próprias, aprovação de app e acesso aos ativos; o toolkit Meta Ads do Composio informa indisponibilidade de OAuth gerenciado, portanto validar modelo de autenticação antes de desenhar o fluxo final.
- TikTok toolkit não oferece OAuth gerenciado segundo documentação consultada; cliente precisa de app próprio e escopos explicitamente aprovados. Ads pode demandar produto/app separado.
- Rate limits, expiração de tokens, indisponibilidade e mudança de versões das APIs.
- Publicação ou anúncios podem gerar consequências externas/gastos; manter aprovação explícita e auditoria.

## 13. Referências técnicas atuais

- Composio Instagram toolkit: https://docs.composio.dev/toolkits/instagram — OAuth gerenciado disponível; suporte a contas Business/Creator; ações como `INSTAGRAM_GET_IG_USER_MEDIA`.
- Composio Meta Ads toolkit: https://docs.composio.dev/toolkits/metaads — recursos de campanhas e insights; página informa que OAuth gerenciado não está disponível.
- Composio Facebook toolkit: https://docs.composio.dev/toolkits/facebook — Facebook Pages e ações de páginas/contas.
- Composio TikTok toolkit: https://docs.composio.dev/toolkits/tiktok — ações de perfil/vídeos; OAuth gerenciado não disponível.
- Composio TikTok guide: https://docs.composio.dev/kb/guide/toolkits-tiktok — credenciais próprias, redirect/escopos e aprovação.
- Meta Marketing API: https://developers.facebook.com/documentation/ads-commerce/marketing-api
- Meta Instagram Media API: https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/

## 14. Decisão de produto recomendada

Entregar em etapas para evitar um painel grande e uma promessa de integração que as permissões ainda não sustentam:

1. Infra de conexões multi-tenant Composio e página Canais e tráfego com estados reais.
2. Instagram OAuth + seleção e exibição pública dos três itens.
3. Meta Ads em leitura e rascunhos revisáveis; habilitar criação/ativação só após validar autenticação, permissões e guardrails em ambiente aprovado.
4. TikTok orgânico com capacidades disponíveis; tratar TikTok Ads como fase condicionada a credenciais, aprovação e toolkit compatível.
