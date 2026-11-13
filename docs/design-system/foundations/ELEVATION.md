# Elevação e sombras
Status: EXISTING + PROPOSED

## Tokens existentes
shadow-gold: 0 10px 40px -12px oklch(0.78 0.12 82 / 35%). shadow-card: 0 1px 0 0 oklch(1 0 0 / 4%) inset e 0 20px 40px -24px oklch(0 0 0 / 80%). .panel usa shadow-card; .panel-hover usa shadow-gold.

## Hierarquia proposta
0: fluxo normal; 1: painel; 2: popover/modal; 3: feedback transitório e foco. Stacking context e z-index precisam estar explícitos. Sombra não substitui contraste, borda, foco ou scrim.

## Limites
Evitar glow global, múltiplas sombras fortes e blur que cobre viewport. Manter separação visível em fundo escuro e em brilho de tela baixo. Elevação é layer semântico, não adicionar sombra individual a cada linha.
