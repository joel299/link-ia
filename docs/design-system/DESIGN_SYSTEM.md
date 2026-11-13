# Aurum Lex — Design System Registry V1

Status: CANONICAL FOR REVIEW · 27/10/2026

A interface combina identidade jurídica sóbria — preto/carvão, bege/creme e dourado — com Liquid Glass controlado. A V1 preserva integralmente a paleta observada. Liquid Glass é um material semântico, não uma nova identidade cromática.

## Mandatos
Preservar tokens, rotas, conteúdo, funcionalidades, integrações e acessibilidade existente. Reutilizar nomes semânticos. Nenhum valor PROPOSED é CSS aplicado. Este documento prepara a fase seguinte, não a executa.

## Identidade atual
Display: Cormorant Garamond. Corpo: Manrope. Fundo: oklch(0.13 0.004 80). Texto principal: oklch(0.94 0.012 85). Gold: oklch(0.78 0.12 82). Gold soft: oklch(0.86 0.08 88). A lista literal completa está em foundations/COLORS.md e tokens/primitives.json.

## Modelo de material
Pilha visual: outer shell para espessura; border/highlight/inner stroke para separar planos; inner stabilized plate para a estabilidade de texto/ícones; content layer acima; foco, erro e progresso como sinais estruturais. Blur é secundário e não garante contraste.

## Intensidade
glass.subtle, glass.standard, glass.elevated, glass.dense e glass.fallback são categorias PROPOSED. Overlays podem usar transparência mais evidente. Texto longo, listas e tabelas começam em dense/fallback, com scrim reforçado. Números precisam de calibração com protótipo.

## Meta visual solicitada
A presença do vidro deve ficar evidente no showcase, em torno de 80% da intenção estética, sem significar alpha 0.8 universal. A leitura e a paleta existente prevalecem; qualquer valor de opacidade é PROPOSED até teste.

## Como ler as referências
As imagens claras/azuladas mostram anatomia, contextos e estados. Elas não autorizam trocar as cores do Aurum Lex. O painel âmbar de profundidade é uma ilustração de camadas, não uma nova paleta.

## Anti-ruído
Evitar excesso de pills, badges, glow, reflexos, mini-cards, blur generalizado e animação decorativa. Usar uma superfície por agrupamento semântico, um CTA primário por área e tabelas densas com superfície legível.

## Acessibilidade e degradação
WCAG 2.2 AA é o mínimo de validação futura: contraste, foco, teclado, zoom e mensagens de estado. O fallback sem blur conserva layout, anatomia, estados e conteúdo. Nenhum teste visual da nova proposta foi executado.

## Fonte de verdade
Tokens nos JSON; rationale em foundations/materials; realidade nos inventários components/ e audit/; critérios em quality/; mudanças aprovadas em GOVERNANCE.md e CHANGELOG.md.
