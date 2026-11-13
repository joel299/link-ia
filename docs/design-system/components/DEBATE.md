# Debate jurídico

Status: EXISTING integrated workflow; the visual shell remains governed by the current Aurum Lex tokens.

## Registry

- ID: UI-PAGE-003
- Path: src/routes/debate.tsx
- Responsibility: Exibir execuções persistidas da Defesa, Acusação e Juiz Analítico, resultados, riscos e fontes.
- Dependencies: AppShell, Tag, debate API client, PostgreSQL-backed Go API, 9Router primary provider, Hermes fallback profiles.
- Current appearance: Conversational process lookup, compact context/question composer, three sequential result sections, explicit new-analysis action, verification coverage and related database decisions.
- Current tokens: gold, status, card, display, border, focus.
- Future tokens: glass.standard for high-level summary; dense for arguments and long legal text.
- Visual references: REF-001, REF-002, REF-003, SUP-007, REF-011, REF-012, REF-013
- Recommended tier: standard shell + dense evidence
- Anatomy: case header; steps/status; evidence panels; human review action.
- Variants: queued/running/complete/fail reflect persisted backend stages.
- States: persisted run, cached result, questions for Defense, completed stages, and sanitized failure states.
- Retry: a failed stage exposes “Tentar novamente”; completed stages remain visible and are not sent to a provider again. Render the latest attempt for each role.
- Responsiveness: stack agent columns; preserve sequence and evidence links.
- Accessibility: status announced, step headings, no color-only risk, motion reduced.
- Risks: a model response can be mistaken for verified legal advice; distinguish database candidates, citations, and unverified claims.
- Invariants: preserve the existing route, palette, stage order, session controls, and result-field hierarchy; do not present coverage as a success probability.
- Migration priority: integrated

## Acceptance criteria

source and uncertainty visible; glass doesn't imply validated conclusion.

## Required checks

long evidence, reduced motion, state distinctness, tablet.

The `/debate` route first asks for a process number. Only after the user submits it, the API looks up the latest completed or clarification-pending run for that owner and normalized process number. This read-only lookup does not call an agent. When a saved run exists, show its persisted stages and final result. When none exists, show the compact new-analysis composer. The user must select “Iniciar debate” to call agents. “Nova análise” keeps the process context and explicitly requests a new run. Each completed stage is saved. The API includes up to 20 related decisions from the local jurisprudence corpus, separate from decisions explicitly cited by an agent. Coverage measures source verification, not legal relevance, confidence, or chance of success. When there are no structured agent citations, show “Não calculado” and explain that free-text references cannot be counted.

When a run fails, retry only the failed stage and continue the remaining stages. Preserve earlier completed results, increment the attempt number, and prevent concurrent retries from claiming the same failed run. Transport diagnostics may include the stage, hostname, and network error; never log provider keys or prompt/case content.

## Magic Step e painel de entrada do agente

Status: EXISTING backend integration and process-history lookup. The compact composer is implemented for the process lookup and new-analysis paths; model/effort and attachments remain unavailable until supported by the server contract. Local Docker API, worker and web containers were rebuilt; migration `0013_debate_research_cache` was applied to the database configured for the running application.

Use o formato das referências REF-011 a REF-013 para a barra de entrada e os menus. Preserve os tokens, a paleta preto/carvão, creme e dourado, e a tipografia do Aurum Lex. As capturas mostram a disposição e a interação dos controles. Elas não substituem a identidade visual do produto.

### Composição da barra

- Mantenha uma entrada compacta. A primeira ação consulta o histórico persistido pelo número do processo. Se não houver execução, mostre o resumo e uma barra de instrução com o seletor de modo e a ação principal.
- O seletor de modo fica disponível somente na etapa Defesa. Use os nomes `Plano` e `Perguntar`. `Plano` pode pedir dados que faltam e aguardar a resposta do usuário. `Perguntar` envia uma questão direta. A ação principal inicia ou retoma a etapa; não copie o modo `Build` de uma ferramenta de código.
- Não exibir seletores falsos de anexo, modelo ou esforço: a API atual não aceita esses dados. Os perfis Hermes e o decisor 9Router continuam configurados no servidor; o navegador não envia nomes de perfil, URL ou chave.
- Em telas estreitas, quebre a barra em linhas sem esconder controles. Menus devem funcionar por teclado, fechar com Escape e manter foco visível.

### Magic Step

0. A tela consulta o histórico pelo número normalizado do processo quando o usuário solicita a busca. Ela não restaura análises automaticamente ao abrir a rota e não chama agentes durante essa consulta.
1. Defesa recebe caso, pergunta, documentos autorizados e modo selecionado. Em `Plano`, pode pausar para pedir esclarecimentos. A resposta final é salva antes do avanço.
2. Após salvar a resposta final da Defesa, a execução pausa. O usuário revisa o resultado e inicia a Acusação por ação explícita. O perfil recebe a mesma base de evidências e a resposta da Defesa para construir a contraposição.
3. Após salvar a resposta da Acusação, a execução pausa novamente. O usuário revisa o resultado e inicia o Juiz Analítico por ação explícita. Ele compara os argumentos, confere as fontes e prepara a síntese. A tela deixa claro que o agente não é um juiz real.

Cada etapa apresenta os mesmos campos: tese principal, contraponto, riscos identificados, jurisprudências e estado de verificação, conclusão da etapa e síntese. O relatório final consolida esses campos e identifica pendências para revisão humana. Riscos só podem ser exibidos com um nível reconhecido (`low`, `moderate`, `high`); valores ausentes ou fora da enumeração são mostrados como “Nível não informado”. A interface não inventa uma classificação jurídica. O backend valida o formato do nível, mas não valida semanticamente a avaliação jurídica do risco.

O percentual deve se chamar **Cobertura de verificação**. O backend calcula `citações oficiais verificadas / itens que exigem verificação × 100`. Não exibir chance de vitória ou confiança jurídica. Se o denominador for zero ou faltarem dados, exibir `Não calculado`.

### Síntese final do debate

Status: IMPLEMENTED from persisted data; no additional Hermes profile or request.

After the latest Judge stage is completed, show one compact final summary surface. It groups thesis, counterpoint, strengths, weaknesses, risks, related decisions from the saved database snapshot, citations declared by the Judge, consolidated conclusion and final synthesis. Keep database candidates distinct from Judge citations and display their source and verification status. When a field or source is missing, show an explicit empty state instead of inferring legal content.

The side summary shows only the server-calculated **Cobertura de verificação**. It must not label that value as confidence, relevance, or chance of success. Do not show the final summary before the Judge completes. Human review is a note only until an existing review API is available; do not imply that a review was submitted.

### Contratos Hermes validados e congelados

Status: VALIDATED BY THE PROJECT OWNER; preserve this boundary in future changes.

- Keep the three profiles and order: Defense, Challenger, Judge.
- Keep each profile's URL/key configuration, request body and `choices[0].message.content` response handling.
- Keep the response contracts and prompts in `docs/debate-contracts/` and `docs/PROMPT-AGENTE-*.md` unchanged unless the project owner explicitly requests a contract change.
- The final summary is a local projection of the completed Judge result, saved run sources and server coverage. It does not create a fourth Hermes profile, repeat any agent call, or change stage persistence.
- Any future backend or frontend work must preserve these boundaries and add tests around the changed projection only.

### Perfis comportamentais

O perfil Defesa organiza o plano e consulta o caso. Somente essa etapa oferece `Plano` e `Perguntar`; no modo Plano, pode pedir os dados que faltam e aguarda as respostas antes de concluir. Acusação atua como contraponto padrão e começa depois que a resposta final da Defesa foi salva. Juiz Analítico compara os dois resultados depois que a resposta da Acusação foi salva. Os três perfis usam os mesmos campos de resultado. O backend chama 9Router primeiro e usa Hermes como fallback por papel; ambos preservam o envelope de resposta existente.

Os textos de persona que orientam cada perfil estão em [`PROMPT-AGENTE-DEFESA.md`](../../docs/PROMPT-AGENTE-DEFESA.md), [`PROMPT-AGENTE-ACUSACAO.md`](../../docs/PROMPT-AGENTE-ACUSACAO.md) e [`PROMPT-AGENTE-JUIZ-ANALITICO.md`](../../docs/PROMPT-AGENTE-JUIZ-ANALITICO.md). Os perfis Hermes são chamados pelo backend. Os contratos atuais e o envelope esperado estão em `docs/debate-contracts/`; notas de persistência, cache, fontes e limitações ficam em [`RELATORIO-PERSISTENCIA-ORQUESTRACAO-DEBATE.md`](../../docs/RELATORIO-PERSISTENCIA-ORQUESTRACAO-DEBATE.md).

Quando o número identifica um processo cadastrado em `legal_cases`, a Defesa pode receber documentos e registros de conhecimento coletados para esse processo. A interface deve distinguir o material salvo, candidatos do corpus e citações efetivamente usadas pelos agentes. Avaliações criadas por IA ficam pendentes de revisão humana.

Contrato da API Aurum Lex: [`application-api.md`](../../docs/debate-contracts/application-api.md). Contratos de cada perfil: [`defense.md`](../../docs/debate-contracts/defense.md), [`challenger.md`](../../docs/debate-contracts/challenger.md) e [`judge.md`](../../docs/debate-contracts/judge.md).

### Imagens de referência

- REF-011 mostra a composição compacta; no Aurum Lex, aplicar apenas controles com suporte no contrato ativo.
- REF-012 mostra o menu de modo aberto.
- REF-013 mostra a lista de modelos e o menu de esforço lado a lado.

O conteúdo das capturas pertence a outra interface. Não copiar marca, texto, modelos, paleta cinza/azul nem valores de configuração. Recriar apenas a composição dos controles com os tokens do Aurum Lex.

### Aceite futuro

- A Defesa é a única etapa com os modos `Plano` e `Perguntar`.
- Acusação e Juiz só avançam após a resposta anterior ser salva e o usuário acionar a próxima etapa.
- Cada perfil e cada relatório usa o mesmo formato de dados e mostra as seções indicadas acima.
- Uma resposta interrompida pode ser retomada sem duplicar etapa já salva.
- Nenhuma credencial ou rota privada do Hermes chega ao navegador.
- A métrica percentual pode ser reproduzida a partir dos registros de verificação salvos.
