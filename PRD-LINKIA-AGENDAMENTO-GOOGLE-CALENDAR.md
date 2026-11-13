# PRD — LinkIA: Agendamento público com Google Calendar via Composio

**Status:** Proposta para implementação e validação local  
**Produto:** LinkIA  
**Escopo:** Exibir o agendamento como ação do perfil público, consultar horários livres e criar eventos na agenda Google do profissional conectado.

## 1. Problema

O painel indica que o Google Calendar está conectado e mostra os pré-requisitos de agendamento como atendidos. Mesmo assim, o perfil público (`/soueujoe`) renderiza WhatsApp e Instagram, mas não exibe um link ou botão de agendamento. O visitante não chega a uma página onde possa escolher data e horário.

O fluxo atual precisa ligar a configuração salva no painel à página pública e à agenda do profissional. Não basta mostrar o estado “conectada”: deve existir uma jornada utilizável, do clique no perfil até a confirmação do evento.

## 2. Objetivo

Quando o profissional ativar o agendamento público, o LinkIA deve mostrar uma ação “Agendar horário” no perfil. O link abre uma página própria do LinkIA com identidade visual do perfil, datas e horários disponíveis conforme as regras configuradas. Após o cliente selecionar um horário e informar nome e telefone, o backend revalida o horário e cria o evento na Google Agenda correspondente usando a conta conectada via Composio.

## 3. Usuários

- **Profissional/administrador do perfil:** configura disponibilidade, serviço, fuso, duração, antecedência, horizonte, WhatsApp e ativação pública.
- **Cliente visitante:** abre o perfil, escolhe data e horário, informa contato e confirma o agendamento.

## 4. Escopo MVP

### Incluído

- Botão/link de agendamento renderizado no perfil público quando a configuração estiver ativa e válida.
- Página pública LinkIA de agendamento associada ao slug do perfil, por exemplo `/soueujoe/agendar`.
- Consulta de disponibilidade real para a agenda Google conectada ao profissional.
- Calendário minimalista e seleção de horário, respeitando as regras do perfil.
- Formulário de nome e telefone do cliente.
- Revalidação de disponibilidade no backend e criação do evento via ferramenta Composio.
- Confirmação do agendamento e ação para abrir WhatsApp da clínica/profissional com mensagem preenchida.
- Estados de carregamento, erro, sem horários e agenda indisponível.
- Isolamento da agenda por profissional.

### Fora do escopo

- Pagamento, sinal ou cobrança.
- Recorrência e remarcação/cancelamento pelo visitante, salvo se já houver suporte no projeto.
- Notificações automáticas por SMS, e-mail ou WhatsApp.
- Compartilhar uma única agenda entre profissionais diferentes.
- Substituir o fluxo por link externo Cal.com/Calendly.

## 5. Jornada principal

1. O profissional conecta Google Calendar pelo fluxo Composio já existente.
2. No painel, configura serviço, fuso IANA, duração, intervalo, antecedência, horizonte de agenda, dias e horários de atendimento e telefone WhatsApp.
3. Ativa “Agendamento público” e salva.
4. O backend persiste a configuração. O painel confirma que o agendamento está ativo.
5. O perfil público passa a renderizar o link “Agendar horário”, junto às ações WhatsApp e Instagram.
6. O cliente abre `/[slug]/agendar` e vê o nome, foto, identidade visual e serviço do perfil.
7. A página carrega os dias com disponibilidade dentro do horizonte configurado; por padrão, usar o valor salvo no perfil (a configuração exibida atualmente é 14 dias). Não codificar 14 ou 15 dias fixos.
8. O cliente escolhe uma data e vê horários livres daquela data.
9. Informa nome e telefone e confirma.
10. O backend revalida o horário contra a agenda e as regras do perfil. Se ainda estiver livre, cria o evento na Google Agenda do profissional via Composio.
11. O LinkIA mostra confirmação acessível na página (sem overlay bloqueante) e inicia automaticamente a navegação para o WhatsApp do profissional (`https://wa.me/{numero}?text=...`) com mensagem preenchida contendo cliente, profissional/estabelecimento, serviço, data e hora, mantendo um botão de fallback **“Abrir WhatsApp”** caso o navegador bloqueie a abertura automática. O cliente revisa e envia a mensagem manualmente.

## 6. Requisitos funcionais

### RF-01 — Ativação e persistência

O estado “Agendamento público ativo” deve ser persistido no backend. A ativação depende de: conexão ativa do Google Calendar, pelo menos um dia/período válido configurado e telefone WhatsApp válido, conforme regra atual do produto. Se faltar requisito, mostrar qual campo precisa de correção e não publicar a ação.

### RF-02 — Ação no perfil público

O perfil deve ler a configuração persistida do backend e renderizar a ação de agendamento somente quando ativa. O botão deve apontar para a rota interna do LinkIA, não para um URL externo. A rota deve ser estável por slug.

### RF-03 — Identidade visual

A página de agendamento deve reutilizar nome, foto, cores, tema e identidade visual salvos no perfil. Deve ser responsiva e manter apresentação minimalista, com hierarquia visual clara e sem excesso de cards ou controles decorativos.

### RF-04 — Consulta de disponibilidade

Calcular candidatos de horário dentro do horizonte configurado e dos períodos semanais do perfil. Subtrair compromissos ocupados consultados na Google Agenda certa. Respeitar timezone IANA, duração, intervalo, antecedência mínima e limites do dia. Exibir datas sem disponibilidade como indisponíveis.

A disponibilidade deve ser consultada no servidor. Não aceitar horários calculados somente no navegador como garantia de reserva.

### RF-05 — Dados do cliente

Solicitar nome e telefone antes da confirmação. Validar campos no cliente e no servidor. Guardar somente os dados necessários para criar o evento e concluir a reserva, conforme persistência e política de dados já adotadas pelo projeto.

### RF-06 — Criação de evento

Ao confirmar, o backend deve:

1. Resolver o perfil e a connected account do profissional no servidor.
2. Validar que o agendamento está ativo.
3. Reconsultar disponibilidade e regras no intervalo selecionado.
4. Rejeitar horário inválido, passado, fora do expediente, ocupado ou associado a outro perfil.
5. Executar a ferramenta Composio `GOOGLECALENDAR_CREATE_EVENT` usando a connected account do profissional.
6. Enviar título/serviço, início e fim com timezone correto e descrição contendo os dados relevantes do cliente.
7. Confirmar sucesso somente quando a ferramenta retornar sucesso e o evento criado.

O esquema atual da ferramenta deve ser obtido/confirmado no catálogo Composio antes da chamada; não assumir parâmetros de uma versão antiga. Usar `calendar_id: "primary"` quando aplicável. Os horários devem ser convertidos para RFC3339 conforme o schema vigente.

### RF-07 — WhatsApp após reserva

Após o sucesso real da criação do evento, fechar o modal e iniciar automaticamente a navegação para `https://wa.me/{numero}?text={mensagem_codificada}` (compatível com app instalado no Android/iOS e fallback web) usando o número de WhatsApp do perfil (apenas dígitos com DDI), não o número do cliente. Incluir nome do cliente, nome do profissional/estabelecimento, serviço e data/hora local. Não enviar a mensagem automaticamente e preservar na página um card de confirmação não bloqueante com botão de fallback **“Abrir WhatsApp”** caso o navegador impeça o redirecionamento automático.

### RF-08 — Falhas e concorrência

Se o horário for ocupado entre consulta e confirmação, retornar conflito legível e pedir nova seleção. Impedir duplo clique e reservas duplicadas; usar idempotência ou mecanismo equivalente já disponível. Em erro do Composio, não mostrar confirmação falsa e apresentar opção para tentar novamente ou falar por WhatsApp.

### RF-09 — Segurança e isolamento

API key e Auth Config ID permanecem exclusivamente no backend. O cliente não pode informar ou escolher `connected_account_id` como autoridade. Resolver a conexão por associação interna do perfil autenticado. Aplicar autorização no servidor e não retornar dados de outros eventos; para disponibilidade, retornar somente intervalos livres/ocupados necessários.

## 7. Integração Composio

Usar o endpoint REST de execução de ferramenta v3.1 ou o SDK já adotado no projeto:

`POST https://backend.composio.dev/api/v3.1/tools/execute/{tool_slug}`

O corpo de execução aceita `connected_account_id` ou `user_id`, `arguments` e `version`; a chave de projeto vai no header `x-api-key`. Preferir identificar a conta específica do profissional com `connected_account_id` resolvido no backend e incluir `user_id` conforme a política de segurança do projeto.

Ferramentas relevantes do toolkit `googlecalendar`:

- `GOOGLECALENDAR_FIND_FREE_SLOTS`: consultar intervalos livres/ocupados; conferir schema atual, timezone e formato dos argumentos.
- `GOOGLECALENDAR_FREE_BUSY_QUERY`: alternativa para consultar free/busy; exige pós-processamento correto de timezone e slots.
- `GOOGLECALENDAR_EVENTS_LIST`: alternativa para listar eventos em intervalo e calcular slots no backend.
- `GOOGLECALENDAR_CREATE_EVENT`: criar a reserva depois da validação final.

Antes de construir o payload, buscar metadados/schema das ferramentas na API Composio v3.1 ou usar o SDK e tipos já instalados. Não usar tokens Google diretamente nem criar requisição Google Calendar fora do Composio, salvo se o projeto já tiver uma decisão documentada autorizando isso.

Referências oficiais consultadas:

- [Google Calendar Toolkit — ferramentas e autenticação](https://docs.composio.dev/toolkits/googlecalendar)
- [Guia Composio Google Calendar — disponibilidade e calendário primary](https://docs.composio.dev/kb/guide/toolkits-google-calendar)
- [API Composio — execução de ferramentas](https://docs.composio.dev/reference/api-reference/tools/postToolsExecuteByToolSlug)
- [API Composio — catálogo/schema de ferramentas](https://docs.composio.dev/reference/api-reference/tools/getToolsByToolSlug)
- [API Composio — escopos recomendados](https://docs.composio.dev/reference/api-reference/toolkits/recommendToolkitScopes)

## 8. Endpoints internos esperados

Os caminhos abaixo são requisitos conceituais; adaptar ao roteamento já existente no projeto sem duplicar APIs:

- `GET /api/public/profiles/:slug/booking` — configuração pública mínima para a página.
- `GET /api/public/profiles/:slug/availability?from=...&to=...` — datas e horários livres calculados no servidor.
- `POST /api/public/profiles/:slug/bookings` — validar e criar evento; body com nome, telefone, início selecionado e serviço quando aplicável.

Não expor Auth Config ID, API key, connected account ID ou detalhes de eventos privados nos endpoints públicos.

## 9. Critérios de aceite

1. Com agenda conectada, configuração válida, agendamento ativo e salva, o perfil público mostra “Agendar horário”.
2. Com agendamento inativo, link não aparece e a rota não oferece reservas.
3. Clicar no link abre a página interna do LinkIA com a foto, nome, cores e tema do perfil.
4. O calendário oferece apenas datas do horizonte configurado e horários dentro dos períodos de atendimento.
5. Compromissos Google ocupados não aparecem como horários selecionáveis.
6. Duração, pausa, antecedência e timezone afetam corretamente os slots.
7. Ao confirmar, o backend faz uma nova verificação antes de criar o evento.
8. Evento criado aparece na agenda Google do profissional correto, com os dados esperados.
9. Uma segunda tentativa para o mesmo horário é rejeitada sem criar evento duplicado.
10. O botão WhatsApp abre o número do estabelecimento com mensagem codificada e dados do agendamento.
11. Falha da API nunca resulta em mensagem de sucesso falsa.
12. Um perfil não consegue ler disponibilidade, criar evento ou usar a connected account de outro perfil.
13. O fluxo funciona no navegador local em viewport desktop e mobile.

## 10. Cenários de validação

- Perfil ativo e conexão ativa: visualizar CTA e página de agenda.
- Perfil inativo: CTA ausente e rota bloqueada/indisponível.
- Dia com slots livres e dia sem slots.
- Evento existente que ocupa parte do expediente.
- Antecedência mínima e limites do horizonte.
- Horário de verão/timezone e conversão de data local para RFC3339.
- Dois visitantes tentando reservar o mesmo slot quase simultaneamente.
- Falha/timeout do Composio durante consulta e criação.
- Reserva confirmada e mensagem WhatsApp gerada.
- Dois perfis com connected accounts diferentes para comprovar isolamento.

## 11. Observabilidade e documentação

Registrar erros técnicos com request/correlation ID e contexto não sensível. Não registrar API keys, tokens, dados completos do cliente nem conteúdo privado da agenda. Atualizar `estado-atual`, `bugs-e-dificuldades` e documentos de decisão exigidos pelo `AGENTS.md`.

## 12. Dependências e riscos

- Escopos Google concedidos pela conexão devem permitir consultar disponibilidade e criar eventos. Confirmar escopos exigidos para `GOOGLECALENDAR_FIND_FREE_SLOTS` e `GOOGLECALENDAR_CREATE_EVENT` no catálogo/endpoint oficial.
- O schema de ferramentas pode mudar; confirmar e fixar versão testada para produção conforme estratégia do projeto.
- O estado de ativação atualmente aparece desmarcado na captura, embora a caixa de pré-requisitos esteja verde. Investigar se está apenas desmarcado, se não foi salvo ou se o preview/perfil público lê outra fonte de estado.
- Testar a criação real requer conexão Google ativa e acesso ao ambiente local com navegador.
