# Governança do Registry

Status: regra obrigatória para toda alteração visual e de experiência

## Regras vinculantes para agentes
1. O registry, `AGENTS.md`, a baseline e as fichas de componente são requisitos. Imagens de referência definem material, camadas e comportamento; não autorizam trocar paleta, navegação, geometria, conteúdo, rotas ou hierarquia existentes.
2. Não redesenhar nem reinterpretar a estrutura. Alterar apenas o componente e a falha nomeados na tarefa. Em dúvida, preservar o comportamento e a composição atuais e registrar a dúvida no handoff.
3. Não alterar seed, usuários de demonstração, migrations ou registros existentes sem autorização explícita. Corrigir configuração/conexão não significa reinicializar o banco.
4. Antes e depois, comparar a mesma rota, viewport, zoom e estado. Uma faixa vazia da largura da sidebar entre sidebar e conteúdo é regressão bloqueante.
5. O efeito Liquid Glass solicitado deve ficar claramente visível na superfície que o usa, sem recolorir a marca nem comprometer contraste, foco ou legibilidade. Em listas e tabelas densas, manter a superfície estável e legível.
6. Na rota Jurisprudências, a primeira página contém no máximo 20 decisões e não carrega páginas adicionais automaticamente. Mais resultados somente por ação explícita.
7. O prompt salvo de classificação começa oculto nas Configurações e só aparece após ativação do disclosure acessível; preservar o valor e o endpoint de salvamento.
8. Uma nova referência de caso dispara análise para os resultados atuais, até 20. Resultado válido para a mesma referência, prompt, modelo e profundidade pode usar cache. Falha permite nova tentativa explícita por decisão; nunca reprocessar toda a base como retry.

## Antes de uma mudança visual
Ler `AGENTS.md`, `design-system/README.md`, a ficha em `components/`, tokens, tier, referências, `audit/PRESERVATION_BASELINE.md` e os critérios de aceite. Identificar EXISTING, PROPOSED e PENDING, registrar arquivos próprios e contratos preservados. Escrever a causa da regressão antes de editar.

## Durante
Reutilizar tokens e wrappers existentes. Não introduzir cor, blur, radius, shadow ou variante arbitrária sem justificativa e aprovação. Não alterar lógica para acomodar estética. Não usar dado de demonstração como evidência real. Cada agente tem arquivos e escopo definidos.

## Depois
Frontend entrega diff, arquivos, causa, decisões, testes, capturas comparáveis com viewport/zoom/estado e limitações. QA registra PASS, FAIL ou NOT_VERIFIED por critério. Reviewer confere registry, foco, contraste, fallback e funções. Atualizar somente documento relacionado e CHANGELOG após decisão aceita.

## Mudança de token ou tema
Proposta registra motivo, consumidores, risco de contraste, temas, amostras de stress e migração. Mudança semântica exige revisão humana. themes/original.json é baseline imutável; schema versionado.

## Gates
Bloquear por texto ilegível, foco perdido/oculto, affordance ambígua, layout inutilizável sem blur, regressão de rota/ação, overflow não tratado ou imagem sem proveniência. Screenshot sem viewport e estado não prova PASS. A registry não autoriza deployment nem commit.
