# Tiers de Liquid Glass
Status: PROPOSED, calibração pendente

Todos os níveis preservam a mesma paleta e anatomia. As faixas numéricas são pontos de partida e não resultados medidos.

| Token | Transparência relativa | Blur inicial proposto | Luz/borda/sombra | Plate | Uso |
|---|---|---|---|---|---|
| glass.subtle | baixa | 4–8px | edge discreto, highlight quase imperceptível, sombra curta | média | pequenos controles ou navegação fixa |
| glass.standard | média | 8–14px | edge e faixa visíveis sem glow, shadow moderada | média/forte | painéis e superfície de navegação |
| glass.elevated | média-alta | 12–20px | espessura e highlight mais legíveis, sem duplicar shadow | forte | modal, drawer, popover |
| glass.dense | baixa; conteúdo domina | 0–6px | estrutura clara, brilho reduzido | alta | tabela, formulário, settings, texto longo |
| glass.fallback | nenhuma dependência de translucidez | 0 | borda/sombra estrutural, sem reflexo | sólida | sem backdrop-filter, contraste alto, baixa capacidade |

## Escolha
Overlay leve pode subir de subtle para standard/elevated quando a hierarquia justificar. Form, table, settings e conteúdo jurídico longo começam em dense. Cenário de baixo suporte escolhe fallback. Não escalar blur como solução de contraste.

## Valores que dependem de teste
Blur em pixels é PROPOSED; alpha/opacity, saturação e intensidade de brilho não são congelados aqui. A meta do usuário de vidro visualmente evidente (aprox. 80% no showcase) é percepção de material, não valor CSS de opacidade. Ajustar a plate primeiro se a legibilidade cair.

## Aceitação
Tiers se distinguem no mesmo background; conteúdo mantém contraste estável; borda não desaparece; mesma light direction; fallback preserva estados e navegação; screenshots e métricas registrados antes de adotar números.
