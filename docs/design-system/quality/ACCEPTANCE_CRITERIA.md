# Critérios de aceite V1 da implementação
Status: gate; regressão de layout e intensidade do glass reportadas; verificações visuais/WCAG pendentes

## Design
- Paleta preta/bege/dourada original intacta.
- Shell/plate/content têm papéis separados; light direction uniforme.
- Sidebar está na borda esquerda e conteúdo/header começam após uma única largura de sidebar; nenhum gutter vazio duplicado.
- Geometria, navegação, hierarquia e paleta existentes foram preservadas; nenhuma alteração de seed/dados.
- Liquid Glass é claramente perceptível na shell aprovada e não prejudica leitura nem contraste.
- Jurisprudências mostra no máximo 20 registros na carga inicial; próxima página só após ação explícita; resultados aparecem sem esperar classificação.
- Prompt de classificação inicia recolhido e pode ser revelado por mouse e teclado; salvar mantém o contrato existente.
- Nova referência inicia análise para a página atual; retry de erro afeta apenas a decisão selecionada; respostas válidas iguais podem usar cache.
- Tiers escolhidos por risco de leitura e área, não por decoração.
- Sem excesso de pills, badges, cards e glow.

## Operação e acessibilidade
- Todas rotas e ações existentes funcionam.
- Teclado, foco, labels, zoom/reflow e estados passam WCAG 2.2 AA aplicável.
- Fundo, estado, densidade e fallback stress têm evidência.
- Contrast ratio medido para cada texto funcional sobre a composição final.

## Entrega
- Tokens consumidos sem duplicatas/arbitrary values.
- Screenshots comparáveis com viewport/browser/state.
- QA visual e code review sem findings blocking.
- Registry atualizado quando decisão/tokens mudarem.
- Validação humana ocorre antes de merge ou publicação. Commits locais para revisão podem antecedê-la.

## Estado atual
A correção foi conferida no navegador desktop (1476×720): header sem card isolado, sidebar alinhada, disclosure do prompt fechado e 20 decisões renderizadas. Uma consulta pública de teste (“ausência de flagrante”) iniciou e concluiu a análise. Build/testes passaram. Contraste mensurado, mobile, fallback, scroll, arquivo de screenshot e validação humana permanecem NOT_VERIFIED.
