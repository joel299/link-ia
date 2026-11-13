# Iluminação
Status: PROPOSED

As imagens mostram highlight no topo/esquerda, borda refletiva e sombra macia. O sistema atual não declara modelo completo de luz.

## Modelo único
Adotar como proposta uma direção alto/esquerda. Faixa de highlight fica controlada na borda, inner stroke marca espessura, shadow cue dá separação. Variação por tier muda intensidade, não direção. Não criar reflexos independentes por componente.

## Cor
Derivar acentos de gold/gold-soft existentes. Nunca trazer ciano/azul da imagem para a identidade. Destaque não atravessa texto nem anel de foco.

## Capacidade CSS
CSS nativo oferece gradient, border, inset shadow, opacity, backdrop-filter blur/saturate. Refração que desloca pixels requer SVG displacement ou shader/WebGPU; não afirmar que backdrop-filter simula lente real. Escolha de shader é futura e depende de suporte/performance.
