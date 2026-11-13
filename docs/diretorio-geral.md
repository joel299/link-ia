# Diretório geral — LinkIA

**Versão:** 1.0  
**Data:** 12/11/2026  
**Status:** Regras iniciais do projeto

## Objetivo

O LinkIA permite que profissionais criem uma página de bio com links de Instagram, WhatsApp e agendamento. O usuário configura o perfil em um painel, escolhe a aparência e publica uma URL curta.

Este arquivo define as regras de trabalho para todos os agentes e colaboradores. Ele é a fonte principal para o processo do projeto.

## Estrutura de documentação

- `diretorio-geral.md`: regras do projeto, fluxo de trabalho, responsabilidades e decisões de processo.
- `estado-atual.md`: fatos confirmados, etapa atual, trabalho concluído, bloqueios e próximo passo.
- `bugs-e-dificuldades.md`: problemas, erros, causas confirmadas, correções e evidências.
- `SYSTEM_DESIGN_LINKIA.md`: identidade visual, componentes, temas, glassmorfismo e qualidade da interface.
- `SDD-PRD-link-bio-mvp.md`: requisitos, escopo, arquitetura e critérios de aceite do MVP.
- `LINKIA-PROGRESSO.html`: painel visual com etapas, decisões, progresso estimado, prazo e grafo interativo.

Manter os arquivos na pasta principal de documentação do LinkIA. Se a pasta ou os nomes mudarem, atualizar este índice.

## Leitura obrigatória no início do trabalho

Todo agente deve seguir esta ordem antes de propor ou executar mudanças:

1. Ler `diretorio-geral.md`.
2. Ler `estado-atual.md` e retomar da próxima ação registrada.
3. Ler `bugs-e-dificuldades.md` para conhecer problemas abertos e correções anteriores.
4. Consultar o PRD, o SDD e o System Design relacionados à tarefa.
5. Inspecionar os arquivos, configurações ou telas envolvidos. A documentação não prova que uma função já existe.

### Regra para subagentes

Todo subagente deve receber e ler este `diretorio-geral.md` antes de trabalhar. Também deve ler o estado atual, o registro de bugs e os documentos específicos da tarefa. O agente que delega deve incluir essas leituras nas instruções da tarefa e confirmar que o subagente teve acesso.

Se um subagente não tiver acesso aos documentos, ele deve registrar o bloqueio e não deve presumir regras ou decisões ausentes.

## Planejamento em tarefas pequenas

Antes de desenvolver, dividir o trabalho em tarefas pequenas, verificáveis e com um resultado claro. Não iniciar uma mudança ampla sem identificar suas partes.

Cada plano deve informar:

- objetivo da tarefa;
- microtarefas em ordem;
- dependências entre microtarefas;
- responsável por cada tarefa, quando houver mais de um agente;
- arquivos ou áreas que podem mudar;
- resultado esperado;
- critério de conclusão;
- validação necessária;
- riscos, dúvidas e bloqueios conhecidos.

As microtarefas devem ser pequenas o bastante para revisão independente. Evitar atribuir o mesmo arquivo a dois agentes ao mesmo tempo. Não delegar trabalho se a tarefa puder ser concluída com segurança e clareza por um único agente.

## Registro das decisões

Cada agente deve registrar as decisões que tomou durante a tarefa. Para cada decisão, documentar:

- decisão tomada;
- motivo da decisão;
- opções relevantes consideradas;
- evidência observada;
- efeito esperado;
- riscos ou limites;
- validação que confirma o resultado.

Separar fatos confirmados, propostas, hipóteses e itens não verificados. Não apresentar hipótese como causa confirmada. Se a evidência não permitir decidir, registrar a dúvida e o próximo passo.

## Atualização dos documentos

### `estado-atual.md`

Atualizar após cada marco significativo. Registrar a etapa atual, o que foi concluído, arquivos alterados, decisões, evidências, validações, bloqueios e próxima ação exata. Preservar o histórico e permitir que outro agente continue sem depender da conversa.

### `bugs-e-dificuldades.md`

Registrar todo bug novo ou alteração importante de um bug existente. Informar sintoma, impacto, evidência, causa somente quando comprovada, decisão, correção, validação, estado e próximo passo. Fechar um bug somente com evidência da correção.

Dúvidas de produto, tarefas pendentes e riscos não são bugs. Registrá-los como pendências ou riscos, com nome claro.

### `LINKIA-PROGRESSO.html`

Atualizar o HTML quando mudar uma etapa, decisão, estimativa, bloqueio ou estado relevante. O HTML deve refletir os documentos atuais. Não inventar percentual com base em atividade não verificada.

## Formato das explicações

- Usar frases curtas, voz ativa e palavras conhecidas.
- Escrever em português claro, seguindo os princípios de linguagem técnica simples do ASD-STE100. Isso não significa certificação da norma.
- Explicar o que mudou, por que mudou e como o resultado foi verificado.
- Evitar siglas sem explicação e jargão quando uma palavra simples servir.
- Marcar claramente o que é proposta e o que já funciona no sistema.

## Regras para o produto

- O MVP deve manter o fluxo simples: configurar perfil, pré-visualizar, salvar, publicar e compartilhar.
- Instagram, WhatsApp e agendamento são destinos externos no MVP.
- Não usar scraping ou endpoints privados para obter mídia do Instagram. Usar imagem enviada pelo usuário ou uma integração oficial futura, se aprovada e viável.
- O link do WhatsApp deve usar número com código do país e validação clara.
- O link de agendamento aceita URL HTTPS de serviços como Cal.com ou Calendly. O LinkIA não agenda nem controla disponibilidade no MVP.
- A página pública deve ser leve e não carregar scripts de administração nem SDKs de terceiros sem necessidade.
- Slug público deve ser único e validado no servidor.
- Conteúdo de perfil é texto simples; não aceitar HTML executável.

## Regras de interface

- Aplicar o System Design do LinkIA: preto, verde e dourado, temas claro e escuro e glassmorfismo controlado.
- Usar tokens semânticos. Não criar cores isoladas por tela.
- Colocar texto sobre uma superfície legível. O blur não substitui contraste.
- Fornecer fallback sólido quando o efeito de vidro não estiver disponível.
- Evitar excesso de cards, botões em formato de pílula, brilhos e animações decorativas.
- Garantir foco visível, uso por teclado, leitura em celular e respeito a movimento reduzido.
- Não declarar acessibilidade ou desempenho aprovados sem validação observada.

## Uso de subagentes

Se a tarefa precisar de mais de uma especialidade, o agente responsável pode dividir o trabalho em subtarefas independentes. Cada tarefa deve ter instrução, critérios de aceite, dependências e limite de arquivos.

O agente responsável deve:

1. explicar por que a divisão ajuda;
2. entregar a cada subagente o contexto e a leitura obrigatória;
3. acompanhar dependências e evitar alterações concorrentes;
4. revisar as entregas e evidências;
5. atualizar estado, bugs e HTML após integrar o trabalho.

Nenhuma resposta de subagente substitui a revisão das mudanças e dos resultados.

## Encerramento de cada etapa

Antes de concluir uma etapa:

- atualizar os documentos que mudaram;
- indicar validações executadas e seus resultados;
- listar bloqueios e itens não verificados;
- apontar o próximo passo;
- não afirmar que houve deploy, publicação, teste ou integração sem evidência.

## Escopo atual do MVP

Inclui perfil público, slug, painel de edição, prévia, temas claro/escuro, cores e fontes selecionáveis, links para Instagram/WhatsApp/agendamento e persistência do perfil.

Não inclui feed do Instagram, scraping, agendamento próprio, cobrança, múltiplos membros por empresa, analytics completos ou sincronização de disponibilidade com Calendly/Cal.com.
