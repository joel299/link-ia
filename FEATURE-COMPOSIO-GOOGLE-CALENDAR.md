# Feature — Google Calendar com Composio Shared Connections

**Produto:** LinkIA  
**Versão:** 1.0  
**Data:** 12/11/2026  
**Status:** Especificação para desenvolvimento; integração ainda não implementada

## 1. Objetivo

Permitir que cada profissional conecte sua Google Agenda ao LinkIA por uma experiência simples que funciona em celular e desktop. No painel, a pessoa toca no ícone e na opção “Conectar Google Agenda”, autoriza a conta em uma página segura do Composio e retorna ao LinkIA.

Depois da conexão, o profissional configura seus horários disponíveis no LinkIA. A página pública oferece a ação “Agendar”, consulta horários livres e cria o evento na agenda conectada.

Esta feature substitui o requisito anterior de usar um link externo de Cal.com ou Calendly para o agendamento do MVP. O cliente não precisa abrir o painel do Cal.com para concluir o fluxo.

## 2. Decisão sobre conexões privadas e compartilhadas

Composio diferencia conexões privadas e compartilhadas:

- **PRIVATE — padrão do LinkIA:** cada profissional conecta a própria conta Google. A conexão pertence ao `user_id` do perfil/cliente no LinkIA. As credenciais e eventos não ficam disponíveis para outros clientes.
- **SHARED — uso limitado:** usar somente quando uma clínica desejar uma agenda única para várias pessoas autorizadas dentro da mesma clínica. A conexão exige uma ACL restrita e deve ser vinculada explicitamente à sessão que a usa.
- **Proibido:** compartilhar a mesma agenda entre clientes diferentes ou liberar acesso global para simplificar a integração.

A documentação do Composio informa que conexões compartilhadas têm acesso negado por padrão e precisam de ACL explícita. Para agentes construídos sobre a plataforma, a capacidade de Shared Connections é indicada como experimental. Portanto, o primeiro corte deve usar conexão privada por profissional; suporte a agenda clínica compartilhada fica para uma etapa posterior, após validação da versão do SDK e do contrato de sessão.

## 3. Experiência do usuário

### 3.1 No painel LinkIA

1. O profissional abre **Configurações → Agendamento**.
1.1 Link shared https://dashboard.composio.dev/link/lk_OMgkKhWV2eMw
2. Vê um item com ícone do Google Calendar, nome “Google Agenda” e estado da conexão.
3. Toca em **Conectar Google Agenda**. O botão funciona por toque e teclado; não depende de hover.
4. O LinkIA solicita ao backend um Connect Link do Composio e redireciona o navegador para o fluxo de autorização. No celular, a autenticação abre no navegador do dispositivo.
5. O profissional escolhe a conta Google e aprova as permissões explicadas na tela.
6. O Composio retorna o usuário ao LinkIA. O backend confirma o estado da conexão antes de exibir “Conectada”.
7. O profissional configura fuso horário, dias, intervalos de trabalho, duração, pausas entre atendimentos e antecedência mínima.
8. Salva e vê uma prévia do botão **Agendar** no perfil público.

### 3.2 Estados da conexão

- **Desconectada:** mostrar “Conectar Google Agenda”.
- **Aguardando autorização:** mostrar que a conexão ainda não terminou.
- **Conectada:** mostrar a conta autorizada de forma segura e opção de desconectar.
- **Expirada ou revogada:** avisar que é necessário reconectar; não anunciar horários nem aceitar reservas.
- **Falha:** explicar o próximo passo e permitir tentar de novo sem apagar as configurações do LinkIA.

Nunca inferir conexão ativa apenas pelo retorno do navegador. Confirmar o estado no backend/Composio.

### 3.3 Para quem agenda

1. A pessoa abre o perfil público e toca em **Agendar**.
2. O LinkIA mostra os dias e horários livres segundo a disponibilidade configurada e os eventos ocupados da Google Agenda.
3. A pessoa escolhe um horário e informa somente os dados necessários para a reserva.
4. Antes de gravar, o backend verifica novamente a disponibilidade para evitar dupla reserva.
5. O LinkIA cria o evento na agenda conectada e mostra confirmação somente após confirmar a criação.

A reserva acontece em uma página do LinkIA, por exemplo `/{slug}/agendar`. Cal.com e Calendly não fazem parte desse fluxo.

## 4. Escopo funcional

### P0 — MVP

- Item de integração com ícone e rótulo acessível **Google Agenda** no painel.
- Criação do fluxo OAuth/Connect Link por meio do backend e do Composio.
- Callback seguro para retornar ao LinkIA e verificar o estado da conexão.
- Conexão privada para cada profissional/cliente.
- Configuração de fuso horário IANA, dias e horários de atendimento, duração do serviço, intervalo entre reservas e antecedência mínima.
- Consulta de disponibilidade para um período limitado, com tratamento explícito de fuso horário.
- Página pública do LinkIA para escolher data/horário e preencher dados mínimos.
- Rechecagem de disponibilidade no momento de confirmar.
- Criação idempotente do evento na Google Agenda conectada.
- Estados de desconexão, erro, tentativa de novo, carregamento e sucesso.
- Ação para desconectar/revogar a conta e desativar novos agendamentos.
- O painel e a autorização devem funcionar em navegadores móveis.

### Fora do primeiro corte

- Conexão de múltiplas agendas por profissional.
- Agenda compartilhada entre vários profissionais de uma clínica.
- Regras avançadas de recorrência, pagamentos, lembretes SMS/WhatsApp e gestão de clientes.
- Sincronização de alterações feitas no LinkIA em todas as direções além da reserva criada.
- Integração de agendamento com Cal.com ou Calendly.
- Importação de fotos do Instagram.

## 5. Regras de agenda

- Armazenar fuso horário como identificador IANA, por exemplo `America/Sao_Paulo`; não armazenar somente o deslocamento UTC.
- Converter horários para o formato e fuso exigidos pelo Google Calendar no backend.
- Usar o calendário principal (`primary`) no primeiro corte, salvo se uma seleção de calendário for necessária e validada.
- Exibir horários para quem agenda no fuso escolhido pelo profissional; indicar o fuso na interface.
- Consultar disponibilidade em uma janela limitada e paginada, para evitar varredura de datas sem limite.
- Bloquear horários anteriores ao horário atual, fora do expediente, em feriados/bloqueios configurados ou que colidam com evento ocupado.
- Fazer segunda consulta imediatamente antes de criar o evento. Se o horário não estiver mais livre, não criar o evento e pedir uma nova escolha.
- Usar chave de idempotência para evitar eventos duplicados em retry de rede.
- Confirmar reserva somente quando a resposta do Composio/Google Calendar confirmar a criação e fornecer o identificador do evento.
- Falha na consulta de disponibilidade deve falhar de forma segura: não mostrar o horário como disponível por suposição.

## 6. Dados e limites de privacidade

Modelo lógico sugerido, sujeito à stack e ao esquema real do projeto:

### `calendar_connections`

- `id` e `profile_id`/`tenant_id`;
- provedor `google_calendar`;
- `composio_connected_account_id`;
- `status` normalizado pelo LinkIA;
- calendário escolhido, com `primary` como padrão inicial;
- e-mail ou nome de exibição somente se fornecido de modo seguro pelo provedor e necessário à interface;
- datas de conexão, atualização e revogação.

### `booking_settings`

- perfil;
- fuso IANA;
- disponibilidade semanal;
- duração, intervalos, antecedência mínima e horizonte máximo de reserva;
- estado ativo/inativo.

### `bookings`

- perfil, evento do provedor e chave de idempotência;
- início/fim e estado da reserva;
- dados mínimos fornecidos pelo cliente;
- timestamps para auditoria operacional.

Não armazenar access tokens, refresh tokens, client secrets ou chaves Composio no banco do LinkIA nem no navegador. Guardar somente IDs não secretos e estado necessário. Não retornar IDs de conexão a visitantes públicos.

## 7. Integração técnica sugerida

A implementação deve confirmar o SDK, a versão do toolkit e as permissões recomendadas pelo Composio antes de codificar. Não copiar endpoints antigos ou exemplos de SDK sem verificar se ainda são atuais.

### Fluxo do servidor

1. Usuário autenticado solicita conexão para o perfil ao qual tem acesso.
2. Backend deriva o `user_id` Composio de um identificador estável e não controlado pelo navegador.
3. Backend cria o Connect Link com o auth config Google Calendar configurado no Composio.
4. Browser é redirecionado para o link. A chave de projeto Composio permanece no servidor.
5. Callback valida `state`/sessão e pede ao backend que confira a conexão associada ao mesmo usuário/perfil.
6. Backend persiste o ID da conta conectada e estado verificado.
7. Para consultar disponibilidade e criar evento, o backend seleciona a conexão daquele perfil. Não aceitar `connected_account_id` arbitrário vindo do visitante.
8. Em conexão `SHARED`, se aprovada em fase futura, validar ACL e vincular explicitamente a conexão permitida à sessão. Nunca depender de seleção implícita.

### API LinkIA proposta

- `POST /api/profiles/:id/integrations/google-calendar/connect` — cria a solicitação de conexão e retorna a URL segura de autorização.
- `GET /api/integrations/composio/callback` — trata o retorno e confirma a conexão no servidor.
- `GET /api/profiles/:id/integrations/google-calendar` — retorna estado e dados de exibição não sensíveis.
- `DELETE /api/profiles/:id/integrations/google-calendar` — revoga/desconecta e desativa agendamentos futuros.
- `GET /api/public/profiles/:slug/availability` — retorna horários livres em um intervalo limitado.
- `POST /api/public/profiles/:slug/bookings` — valida entrada, confirma disponibilidade e cria a reserva.

Os caminhos são proposta de contrato, não rotas já implementadas. Ajustar à API existente após inspecionar o repositório.

## 8. Permissões OAuth

Solicitar somente os escopos necessários às ações que serão implementadas. A combinação final deve ser conferida usando a recomendação atual de escopos do Composio para os tool slugs escolhidos e as permissões oficiais do Google Calendar.

Em termos de produto, explicar que o LinkIA precisa consultar disponibilidade e criar eventos. Não solicitar acesso amplo a todos os calendários quando a operação puder usar permissões mais limitadas. Aprovação e publicação do app OAuth do Google devem ser verificadas antes do lançamento para clientes externos.

## 9. Segurança e isolamento entre clientes

- Cada cliente LinkIA tem identidade interna estável e isolada.
- Conexão privada é o padrão para agenda individual.
- Nunca usar o e-mail como único identificador de autorização nem confiar em IDs recebidos do browser.
- Toda operação verifica que o perfil pertence ao usuário autenticado.
- Rotas públicas podem consultar somente disponibilidade e campos de perfil necessários; não expor títulos, convidados ou descrições de eventos existentes.
- Usar limites de taxa, validação de entrada, proteção contra CSRF no callback e idempotência na criação.
- Guardar segredos somente em variáveis de ambiente/serviço seguro; nunca em arquivos versionados.
- Registrar conexão, desconexão e erros sem incluir tokens, dados de eventos ou dados pessoais desnecessários.
- Agendamentos de um cliente não podem aparecer na agenda ou resposta de outro cliente.

## 10. Critérios de aceite

1. Um profissional consegue tocar no ícone Google Calendar no celular, autorizar a própria conta e retornar ao painel LinkIA.
2. O painel mostra estado real da conexão, configurações de disponibilidade e ação de desconectar.
3. O perfil público mostra **Agendar** somente quando a agenda está conectada e a disponibilidade está ativa.
4. A página de agendamento mostra horários compatíveis com o fuso e a agenda conectada.
5. Um slot ocupado ou recém-reservado não pode ser confirmado novamente.
6. A reserva cria um evento na agenda do próprio perfil, sem expor dados privados do calendário.
7. Retry após timeout não cria evento duplicado.
8. Conta revogada ou desconectada bloqueia novas reservas e mostra orientação para reconectar ao dono do perfil.
9. Um cliente não consegue consultar ou reservar usando a conexão de outro cliente.
10. Testes cobrem autorização concluída, cancelada, expirada, erro do provedor, conflito de horário, fuso e retry.
11. O fluxo funciona em desktop e celular, com confirmação acessível por teclado e leitor de tela.

## 11. Plano de implementação em microtarefas

1. **Descoberta:** inspecionar stack, autenticação, perfis e chamadas existentes; confirmar SDK/toolkit Composio e contrato vigente.
2. **Modelo:** definir vínculo perfil–conta, estados, migrations e isolamento por tenant.
3. **OAuth:** implementar Connect Link, callback, status, reconexão e revogação.
4. **Configuração:** construir cartão Google Calendar e formulário de disponibilidade responsivo.
5. **Disponibilidade:** implementar consulta, conversão de fuso, bloqueios e janela de busca.
6. **Reserva:** implementar rechecagem, idempotência, criação do evento e resposta segura.
7. **Página pública:** criar rota de agendamento, seleção de slot e confirmação.
8. **QA:** testar fluxos em navegador local, APIs mockadas e integração real apenas quando as credenciais estiverem configuradas.
9. **Code Review:** revisar isolamento multi-tenant, OAuth, scopes, dados pessoais e duplicidade.
10. **Documentação:** atualizar `estado-atual.md`, `bugs-e-dificuldades.md` e `LINKIA-PROGRESSO.html` com evidências.

Cada etapa depende dos contratos reais do projeto. Não inventar comportamento do Composio ou do Google Calendar se o SDK instalado divergir.

## 12. Questões para confirmar antes da fase final

- Cada profissional terá uma conta Google individual ou algumas clínicas usam uma agenda única para toda a equipe?
- O primeiro corte deve permitir escolher entre vários calendários da conta, ou usa apenas o calendário principal?
- Quais dados o cliente que agenda precisa informar?
- A confirmação deve incluir convite por e-mail do Google Calendar ou apenas a tela de confirmação no LinkIA?
- Qual conta, projeto e auth config Composio serão usados? Não registrar chaves neste documento.
- O app OAuth do Google estará em teste ou produção e quais usuários poderão autorizar?

## 13. Referências oficiais

- [Composio — Shared Connections](https://docs.composio.dev/docs/extending-sessions/shared-connections)
- [Composio — Google Calendar](https://docs.composio.dev/kb/guide/toolkits-google-calendar)
- [Composio — Google Calendar Toolkit e ações](https://docs.composio.dev/toolkits/googlecalendar)
- [Google — escolher escopos da Calendar API](https://developers.google.com/workspace/calendar/api/auth)
- [Google — consulta FreeBusy](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)
- [Google — inserir evento](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)
