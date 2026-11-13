# Prompt do agente — Frontend / Gemini
Status: instrução obrigatória para tarefas de frontend

## Missão
Corrigir somente a regressão explicitamente delegada no frontend Aurum Lex, seguindo literalmente o System Design. Não redesenhar nem inferir uma estrutura nova. Preservar paleta, navegação, ordem, conteúdo, rotas, comportamento, seed e dados.

## Leia antes
AGENTS.md; design-system/README.md; DESIGN_SYSTEM.md; ficha do componente; tokens/primitives.json, semantic.json, materials.json, components.json; foundations aplicáveis; refs; preservation baseline; quality/ACCEPTANCE_CRITERIA.md; quality correspondente à tela.

## Método
1. Confirme status EXISTING/PROPOSED/PENDING e componente/funções.
2. Declare arquivos de propriedade e contratos a preservar.
3. Reutilize Tailwind, tokens e primitives instalados. Não adicionar biblioteca/valores arbitrários.
4. Selecione tier por contexto; use plate sob todo texto/ícone; mantenha um modelo de luz.
5. Implementar fallback; proteger foco/labels/estados; reduzir motion.
6. Não multiplicar pills/cards nem aplicar glass em tabela densa por padrão.
7. Capturar antes/depois com viewport, estado, browser e fallback.
8. Entregar via HANDOFF_CONTRACT com diff e testes.

## Regressão atual — correção vinculante
- Compare a tela atual com `design-system/audit/PRESERVATION_BASELINE.md` e as capturas do usuário. Corrija a causa do gutter preto vazio entre sidebar e conteúdo: exatamente uma sidebar fixa à esquerda; header e página começam na borda seguinte à sidebar, sem segundo `padding-left`, `margin-left` ou coluna reservada.
- Mantenha títulos, busca global, perfil, navegação, ordem de seções, largura funcional e alinhamento existentes. Não remova nem reordene controles para esconder a falha.
- Liquid Glass deve ser óbvio visualmente: fundo visível através da shell, blur perceptível, borda/highlight com luz consistente, camada interna estável sob texto e controle. Use a paleta existente. Nada de trocar tema para branco/azul, adicionar novos gradientes de marca ou adicionar dependência.
- Não espalhe blur por cada cartão. Para resultados jurídicos e texto denso, use conteúdo estável, garantindo legibilidade.
- Jurisprudências: mostre imediatamente os 20 itens da primeira resposta sem esperar classificação de IA. Pare de observar/carregar automaticamente a próxima página; carregue mais 20 apenas quando a pessoa usar “Carregar mais decisões”. Não classifique automaticamente registros fora dos 20 iniciais.
- Preserve loading/error/empty states, filtros, consulta, paginação por cursor, URL, seleção/detalhes e responsividade.

## Limites
Apenas arquivos frontend e documentação de Design System atribuídos. Não editar endpoint, migration, payload, seed, dado persistido ou auth. Não assumir que resultado jurídico mock é verdadeiro. Sem novo padrão visual sem justificar e checar registry. Se não tiver browser/screenshot, declarar visual QA NOT_VERIFIED e não inferir sucesso pelo source.
