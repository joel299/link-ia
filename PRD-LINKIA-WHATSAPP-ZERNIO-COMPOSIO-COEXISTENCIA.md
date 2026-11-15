# PRD — LinkIA WhatsApp com Zernio, Composio e coexistência

**Produto:** LinkIA  
**Status:** Especificação para implementação  
**Data:** 14/11/2026  
**Canal:** WhatsApp Business Platform (Cloud API)  
**Objetivo:** permitir que cada cliente conecte pelo painel do LinkIA o número que já utiliza no WhatsApp Business App, usando o onboarding de coexistência da Zernio. O Composio permanece como integração de ferramentas para agentes, condicionado à compatibilidade técnica da conexão daquele cliente.

## 1. Resumo

O cliente inicia a conexão em uma área própria do painel LinkIA. O backend solicita à Zernio a URL de Embedded Signup configurada para onboarding `business_app`, redireciona o cliente para a Meta e recebe o resultado no callback. O cliente confirma a conexão no celular, normalmente escaneando o QR exibido no fluxo Meta com o WhatsApp Business App.

Após o onboarding concluído, o LinkIA registra a conta e os identificadores necessários no seu modelo multi-tenant, consulta o status pela Zernio e habilita somente recursos que estejam disponíveis para aquele número.

O Composio pode ser conectado como camada de execução de ferramentas para agentes. Essa conexão é uma integração separada: não assumir que uma conexão Zernio, seu `accountId` ou seus tokens podem ser reaproveitados pelo Composio. O PRD não exige duas autorizações do cliente no MVP. Primeiro deve ser validado se o Composio consegue operar com a conta WABA criada/conectada via Zernio por um método seguro e suportado. Se isso não for possível, Zernio continua sendo o provedor operacional do WhatsApp e a integração Composio fica desabilitada para esse canal até haver desenho aprovado.

## 2. Problema e objetivo de negócio

Pequenos negócios já atendem clientes pelo WhatsApp Business App. Migrar o número para a API sem coexistência pode causar retrabalho e resistência. O LinkIA precisa oferecer uma experiência guiada para conectar esse mesmo número à Cloud API e, no futuro, permitir automações sem obrigar o cliente a abandonar o aplicativo usado no celular.

### Objetivos

- O cliente inicia o onboarding sem suporte técnico da equipe LinkIA.
- O número atual permanece no WhatsApp Business App quando elegível e aprovado no fluxo de coexistência da Meta.
- O LinkIA exibe status real da conexão e oferece recuperação/reconexão.
- A conexão e seus dados ficam isolados por cliente.
- A configuração de plataforma feita pela equipe LinkIA fica documentada separadamente do fluxo do cliente.
- A integração Composio não cria uma falsa promessa de conexão única se exigir autenticação independente.

### Não objetivos do MVP

- Construir um provedor BSP/Tech Provider próprio ou substituir a infraestrutura Zernio.
- Implementar todo o inbox, CRM, automação de campanhas ou atendimento multiagente nesta feature.
- Garantir elegibilidade de todos os números para coexistência.
- Fazer o cliente informar manualmente tokens da Meta.
- Espelhar histórico de mensagens sem confirmação e suporte explícitos.
- Conectar o mesmo número em múltiplos provedores sem validar as regras Meta/Zernio e o impacto em webhooks/roteamento.

## 3. Papéis e atores

- **Cliente:** autenticado no LinkIA, inicia conexão, conclui o fluxo da Meta e administra o próprio número.
- **LinkIA backend:** cria a sessão de conexão na Zernio, valida callback, associa conta/ativos ao tenant e consulta status.
- **Zernio:** provê a API de conexão e Embedded Signup; conduz onboarding Meta de Cloud API e coexistência.
- **Meta:** autentica o negócio, verifica elegibilidade e finaliza a vinculação do WhatsApp Business App à Cloud API.
- **Composio (condicional):** executa ferramentas em contexto de conta se houver método de autorização seguro e compatível com a conexão Zernio/Meta.
- **Administrador LinkIA:** prepara credenciais, aplicativo, callbacks, permissões e ambientes de produção; não conclui OAuth pelo cliente.

## 4. Jornada do cliente

1. Cliente abre **Painel → Integrações → WhatsApp**.
2. Tela explica que a conexão usa WhatsApp Business e que a coexistência depende da elegibilidade Meta. Orienta manter o celular com o WhatsApp Business App atualizado.
3. Cliente clica **Conectar meu WhatsApp Business**.
4. LinkIA backend verifica sessão, tenant, rate limit e ausência de fluxo pendente indevido; cria `state` aleatório, com uso único e expiração curta.
5. Backend chama a API Zernio para obter a URL de conexão com `platform=whatsapp`, `onboarding=business_app`, `profileId` associado ao cliente e callback LinkIA validado.
6. Navegador redireciona à URL retornada pela Zernio/Meta. O cliente seleciona o negócio/WABA e número existente e conclui os passos de confirmação/QR no WhatsApp Business App, conforme apresentado pela Meta.
7. Meta/Zernio retornam ao callback LinkIA. Backend valida `state`, correlação da sessão, resultado e tenant. Não confiar em IDs enviados livremente pelo browser.
8. Backend consulta a Zernio para confirmar que a conta foi de fato criada/conectada e persiste os identificadores retornados e status.
9. Painel mostra nome/número parcialmente mascarado, tipo de onboarding (coexistência quando comprovado), status, data da conexão, recursos disponíveis e ação de desconectar/reconectar.
10. Se Composio estiver configurado para o tenant e suportar a conexão com segurança, a interface mostra o estado separado da ligação Composio; não pede uma segunda configuração sem explicar por quê e obter autorização explícita.

## 5. Requisitos funcionais

### 5.1 Conexão e status via Zernio

- Usar a API e o SDK/endpoints atuais documentados pela Zernio; não reproduzir OAuth Meta manualmente se o endpoint Zernio for o fluxo previsto.
- O endpoint atual documentado para obter o fluxo é `GET /v1/connect/whatsapp`; suportar a opção `onboarding=business_app` para a variante de coexistência.
- Usar o Embedded Signup/hosted flow e o endpoint de finalização correspondente conforme a documentação da Zernio. Verificar o schema atual de `sdk-config` e `embedded-signup` durante implementação.
- O cliente deve ser redirecionado somente a URL HTTPS retornada/permitida pela Zernio/Meta. Validar allowlist de redirect URLs no backend.
- O callback LinkIA deve tratar conexão concluída, cancelada, sessão expirada, erro de elegibilidade, falha de verificação e retorno incompleto.
- Mostrar estado “Conectando” até validar o status no servidor Zernio. Não marcar conectado apenas porque o browser retornou à página.
- Obter e persistir IDs externos indispensáveis (`accountId`, WABA ID, `phone_number_id`, business ID se disponível) conforme resposta real e necessário; nunca aceitar vínculo por `profileId` sem autenticação/autorização no servidor.
- Nunca armazenar credenciais Zernio no frontend. Não exibir access tokens nos logs ou respostas.

### 5.2 UX de coexistência e elegibilidade

- Antes de abrir o Embedded Signup, explicar que a coexistência mantém o WhatsApp Business App em uso junto à Cloud API para números elegíveis.
- Não prometer preservação de todas as funções do aplicativo. Mostrar que funcionalidades API podem diferir; grupos via API, por exemplo, não estão disponíveis em números coexistentes segundo a documentação da Zernio.
- Incluir instrução de manter o aplicativo atualizado e o aparelho disponível durante o onboarding; detalhes e requisitos exatos devem acompanhar a documentação vigente Zernio/Meta.
- Tratar inelegibilidade, número já vinculado, fluxo expirado ou configuração de outro provedor com mensagem acionável e link de suporte/retorno.
- Se número ficar em estado `ON_PREMISE` ou outra migração incompatível, interromper onboarding automático e orientar suporte/etapa de migração, sem tentar registrar o número por conta própria.

### 5.3 Composio: papel e condição de ativação

- Manter adaptadores e credenciais Zernio e Composio separados.
- Não passar `accountId` Zernio como se fosse connection ID Composio.
- Não presumir que token de acesso gerido pela Zernio é retornado ou reutilizável pelo Composio.
- Antes de implementar conexão Composio, validar documentalmente e com teste não destrutivo se o toolkit WhatsApp Composio suporta uma conta WABA provisionada pela Zernio e quais credenciais/permissões seriam necessárias.
- O toolkit Composio WhatsApp suporta WABA e conexão OAuth/API-key segundo a documentação; no modo API-key pode exigir token de system user e WABA ID. Não solicitar que cliente cole tokens no painel LinkIA.
- Se a conta precisar de uma segunda autorização ou de token system user fora do fluxo Zernio, registrar como decisão/limitação. Não ativar automaticamente, não duplicar onboarding e não colocar essa etapa no MVP sem especificação e consentimento claros.
- Arquitetura preferencial: Zernio gerencia onboarding coexistente e mensageria da conta; Composio é uma integração de ferramentas separada para agentes, habilitada apenas quando a compatibilidade e o escopo de autorização estiverem confirmados. Definir um único provedor operacional de envio por conta para evitar mensagens/webhooks duplicados.

### 5.4 Desconexão, revogação e recuperação

- Oferecer desconectar com confirmação e explicação do impacto no LinkIA.
- Distinguir desconectar integração LinkIA/Zernio de remover o número da WhatsApp Business Platform. Não executar desregistro do telefone automaticamente.
- Quando API externa falhar, manter dados mínimos de status e oferecer tentar novamente; não apagar vínculo válido por timeout transitório.
- Suportar nova conexão idempotente e limpeza de sessões OAuth expiradas.
- Auditar eventos de conexão, desconexão, callback inválido e mudanças de conta com tenant/ator/timestamp, redigindo tokens e dados excessivos.

## 6. Configuração manual do administrador LinkIA

Esta seção é deliberadamente separada da jornada do cliente. A equipe LinkIA realizará a configuração operacional em etapa posterior, mediante instruções próprias. O agente deve documentar cada item e verificar o que já existe antes de solicitar ou alterar qualquer configuração.

Itens esperados para preparação manual:

1. Projeto/conta Zernio e API key para ambiente de desenvolvimento, staging e produção.
2. Identificação do `profileId` Zernio por tenant e estratégia para criar/associar perfil LinkIA↔Zernio.
3. Redirect/callback URLs HTTPS por ambiente, allowlist e domínios autorizados.
4. Hosted Embedded Signup ou SDK config Zernio, incluindo opção de onboarding `business_app`.
5. Meta App/business portfolio, produto WhatsApp, permissões e aprovações exigidas para o modelo Tech Provider/Solution Partner da Zernio.
6. Webhooks Zernio necessários ao estado de conta/mensagens, assinatura/verificação, URL pública HTTPS e política de retries.
7. Segredos guardados em secret manager ou variáveis server-side documentadas; `.env.example` contém apenas nomes/valores demonstrativos, nunca credenciais reais.
8. Projeto Composio, API key e configuração/auth config do toolkit WhatsApp somente se a integração Composio for aprovada; verificar a necessidade de credenciais Meta próprias e fluxo independente.
9. Política de seleção de provedor para ações de WhatsApp (Zernio ou Composio), prevenção de duplicidade e tratamento de webhooks/eventos.
10. Testes em contas/ativos de teste e passos para liberação gradual à produção.

O agente não deve inventar valores de IDs, permissões, tokens ou URLs. Deve listar o nome de cada variável requerida, sua finalidade, onde o administrador obtém o valor e em qual ambiente deve ser configurada, sem incluir o segredo em documentação versionada.

## 7. Modelo de dados conceitual

Adaptar ao banco e convenções existentes, sem duplicar modelos já implementados.

- `whatsapp_connections`: `id`, `tenant_id`, `owner_user_id`, `provider` (`zernio`), `provider_account_id`, `waba_id`, `phone_number_id`, `business_id` opcional, `onboarding_mode`, `status`, `connected_at`, `last_verified_at`, `metadata_safe`.
- `whatsapp_connection_attempts`: `id`, `tenant_id`, `state_hash`, `expires_at`, `used_at`, `status`, `provider`, timestamps; armazenar hash de state quando possível, não o valor reutilizável em log.
- `whatsapp_capabilities`: conta, recurso, disponibilidade, origem, instante de verificação. Ex.: coexistência confirmada, mensagens, templates, grupos indisponíveis.
- `provider_tool_links` (se realmente necessário): ligação independente entre tenant/account e Composio, status, referência externa e escopos resumidos. Nunca presumir equivalência com `provider_account_id` Zernio.
- `integration_audit_events`: ator, tenant, ação, resultado e metadados mínimos redigidos.

## 8. Endpoints internos esperados

Seguir os padrões da aplicação e não tratar os caminhos abaixo como nomes obrigatórios:

- iniciar conexão WhatsApp para usuário/tenant autenticado;
- consultar status e capacidades da conexão;
- callback Zernio/Meta com validação de `state` e correlação;
- reconectar conexão expirada/incompleta;
- desconectar a integração LinkIA sem remover o número da Cloud API;
- receber webhooks Zernio com validação de assinatura/evento e idempotência;
- opcionalmente verificar conexão com Composio em uma rota separada e autorizada.

Webhooks não podem depender de sessão de navegador. Validar autenticidade, limitar payload, registrar deduplicação por ID do evento e devolver sucesso somente após persistência confiável.

## 9. Segurança, privacidade e conformidade

- Isolamento multi-tenant obrigatório em todo handler e job.
- Segredos apenas no backend; nunca localStorage, query string, analytics ou console do frontend.
- `state` aleatório, de uso único, com expiração curta e associação a sessão/tenant; proteger contra CSRF e replay.
- Callback valida host, assinatura/contexto da Zernio quando disponível, state e vínculo de usuário.
- Redigir telefone e IDs nos logs quando não forem necessários; UI pode mascarar número.
- Seguir políticas Meta/WhatsApp, incluindo janela de atendimento e templates aprovados para mensagens iniciadas pela empresa fora da janela permitida.
- Documentar consentimento, retenção e exclusão/revogação de dados.
- Não coletar histórico de conversas por padrão nesta feature.

## 10. Requisitos não funcionais

- A rota de painel não deve bloquear a renderização com chamadas externas síncronas; carregar status após renderização.
- Timeouts e retry limitado com backoff para operações idempotentes.
- Erros da Zernio/Composio/Meta devem ser convertidos em mensagens seguras e acionáveis, sem conteúdo sensível.
- Compatibilidade com Windows, Linux e execução Docker descrita no projeto.
- Métricas de conexão, falha, callback e webhook não devem conter tokens ou conteúdo de mensagens.
- Interface responsiva para uso primário em celular.

## 11. Critérios de aceite

1. Cliente autenticado inicia o fluxo pelo painel e recebe redirect para onboarding Zernio/Meta configurado como coexistência.
2. `state` inválido, expirado, reutilizado ou de outro tenant é rejeitado.
3. Callback incompleto/cancelado/expirado apresenta estado correspondente e permite reiniciar.
4. A conexão só fica “Conectada” após confirmação server-side pela Zernio.
5. O painel identifica e exibe o modo coexistência somente quando resposta/documentação de conta permitir comprová-lo.
6. Número permanece associado ao tenant correto e nenhuma chave/token é exposta ao navegador ou Git.
7. Desconexão no LinkIA não desregistra nem migra automaticamente o número da Cloud API.
8. Webhooks são autenticados e idempotentes; evento duplicado não duplica estado/ação.
9. Recursos incompatíveis com coexistência, como grupos via API quando indisponíveis, são marcados como não suportados.
10. Composio permanece estado separado; nenhuma conta Zernio é considerada conectada no Composio sem fluxo suportado e evidência de autorização.
11. Testes cobrem callback, state, tenant authorization, falhas/timeout, retry e webhooks duplicados.
12. Build, lint e testes existentes passam; fluxo principal é validado em navegador mobile/desktop com sandbox ou número de teste autorizado.

## 12. Plano de entrega

### Fase A — Descoberta técnica e configuração manual documentada

- Inspecionar integração Composio atual e conta/projeto Zernio disponíveis.
- Confirmar endpoint, SDK, `onboarding=business_app`, hosted flow, callback e webhook.
- Confirmar se Zernio já configura o Embedded Signup para coexistência no ambiente LinkIA e quais permissões Meta faltam.
- Testar a interoperabilidade Zernio→Composio sem dados reais do cliente e sem envio de mensagem. Registrar resultado como suportado, não suportado ou inconclusivo.

### Fase B — Autoconexão do cliente por Zernio

- Criar UI/rota separada no painel.
- Implementar início do fluxo, callback, persistência, status, desconexão LinkIA e webhooks mínimos.
- Usar sandbox/test number e cobrir estados de falha.

### Fase C — Recursos de mensageria

- Só depois do onboarding funcional, escolher provedor operacional por conta.
- Implementar recursos e templates permitidos, respeitando regras de janela, opt-in e capacidades de coexistência.
- Integrar Composio somente se o caminho de autorização e ownership estiver comprovado.

## 13. Riscos e decisões abertas

- **Interoperabilidade entre provedores:** a autorização Zernio não deve ser tratada como autorização Composio automaticamente. Confirmar suporte antes de prometer uso de ferramentas WhatsApp no Composio.
- **Aprovação Meta:** disponibilidade de coexistência depende de configuração/aprovação do app e elegibilidade do cliente.
- **Provedor duplicado:** conectar o mesmo número em mais de uma plataforma pode exigir autorização/roteamento específicos e gerar disputa de webhooks ou controle de conversa. Definir um provedor de envio por conta.
- **Capacidades reduzidas:** coexistência tem limites próprios; exibir capacidades reais retornadas/documentadas.
- **Migração antiga:** números ON_PREMISE ou vinculados a outro provedor podem exigir suporte antes do onboarding.

## 14. Referências consultadas

- Zernio WhatsApp Platform: https://docs.zernio.com/platforms/whatsapp — Embedded Signup, `onboarding=business_app`, coexistência e capacidades.
- Zernio WhatsApp Connect: https://docs.zernio.com/platforms/whatsapp/connect — passos e opções de onboarding.
- Zernio Changelog: https://docs.zernio.com/changelog — fluxo hosted Embedded Signup e configuração SDK.
- Zernio WhatsApp Inbox: https://docs.zernio.com/platforms/whatsapp/inbox — mensagens, janela de 24 horas, templates e eventos.
- Composio WhatsApp guide: https://docs.composio.dev/kb/guide/toolkits-whatsapp — requisitos de WABA, auth e papel da coexistência.
- Meta WhatsApp Business Platform overview: https://developers.facebook.com/documentation/business-messaging/whatsapp/overview/ — Cloud API, Embedded Signup e onboarding para clientes.
